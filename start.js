#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');

const ROOT_DIR = __dirname;
const CLIENT_DIR = path.join(ROOT_DIR, 'client');

// ANSI Colors
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

console.log(`${CYAN}${BOLD}════════════════════════════════════════════════════════════${RESET}`);
console.log(`${CYAN}${BOLD}  SARA — Low-Latency Real-Time Multilingual AI Voice Platform  ${RESET}`);
console.log(`${CYAN}${BOLD}════════════════════════════════════════════════════════════${RESET}\n`);

// Free up ports 8000, 8001 and 5174 if already occupied
const isWin = process.platform === 'win32';
const pythonCmd = isWin ? 'python' : 'python3';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function freePort(port) {
  try {
    if (isWin) {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (output) {
        const lines = output.split('\n');
        const pids = new Set();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid) && pid !== '0' && parseInt(pid, 10) !== process.pid) {
            pids.add(pid);
          }
        }
        for (const pid of pids) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            console.log(`${YELLOW}[SETUP] Freed port ${port} by terminating PID ${pid}${RESET}`);
          } catch {}
        }
      }
    } else {
      const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
      if (output) {
        const pids = output.split('\n').filter(Boolean);
        for (const pid of pids) {
          try {
            process.kill(parseInt(pid, 10), 'SIGKILL');
            console.log(`${YELLOW}[SETUP] Freed port ${port} by terminating PID ${pid}${RESET}`);
          } catch {}
        }
      }
    }
  } catch {}
}

console.log(`${YELLOW}[SETUP] Checking port availability (8000, 8001, 5174)...${RESET}`);
freePort(8000);
freePort(8001);
freePort(5174);

// Terminate any stale background cloudflared instances
try {
  if (isWin) {
    execSync('taskkill /F /IM cloudflared.exe', { stdio: 'ignore' });
  } else {
    execSync('pkill -9 cloudflared', { stdio: 'ignore' });
  }
} catch {}

let serverProcess = null;
let clientProcess = null;
let tunnelProcess = null;
let isShuttingDown = false;

function startAppProcesses() {
  if (serverProcess) return;

  // 1. Launch Backend Server (FastAPI / Python)
  console.log(`${GREEN}[SERVER] Starting FastAPI Backend on http://localhost:8000...${RESET}`);
  serverProcess = spawn(pythonCmd, ['-m', 'server.main'], {
    cwd: ROOT_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: isWin,
    env: { ...process.env, PYTHONUNBUFFERED: '1', RELOAD: 'true' }
  });

  serverProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => console.log(`${CYAN}[SERVER]${RESET} ${line}`));
  });

  serverProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => {
      if (line.includes('INFO:') || line.includes('DeprecationWarning')) {
        console.log(`${CYAN}[SERVER]${RESET} ${line}`);
      } else {
        console.log(`${RED}[SERVER ERR]${RESET} ${line}`);
      }
    });
  });

  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${RED}[SERVER] Process exited with code ${code}${RESET}`);
    }
  });

  // 2. Launch Frontend Client (Vite / React)
  console.log(`${GREEN}[CLIENT] Starting Vite React Frontend on http://localhost:5174...${RESET}`);
  clientProcess = spawn(npmCmd, ['run', 'dev', '--', '--host'], {
    cwd: CLIENT_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: isWin,
    env: { ...process.env }
  });

  clientProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => console.log(`${GREEN}[CLIENT]${RESET} ${line}`));
  });

  clientProcess.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach(line => console.log(`${YELLOW}[CLIENT]${RESET} ${line}`));
  });

  clientProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.log(`${RED}[CLIENT] Process exited with code ${code}${RESET}`);
    }
  });
}

// 3. OAuth Proxy (port 8001 -> 8000)
const oauthProxy = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 8000,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'localhost:8000',
      'x-forwarded-host': req.headers.host || 'localhost:8001',
      'x-forwarded-proto': 'http',
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('OAuth Proxy Gateway Error: ' + err.message);
  });

  req.pipe(proxyReq, { end: true });
});

oauthProxy.on('error', (err) => {
  console.log(`${YELLOW}[OAUTH PROXY] Notice: ${err.message}${RESET}`);
});

oauthProxy.listen(8001, '0.0.0.0', () => {
  console.log(`${CYAN}[OAUTH PROXY] Bridge active on http://localhost:8001 -> forwarding to :8000${RESET}`);
});

// 4. Cloudflare Tunnel with Auto-Recovery
const cloudflaredBin = path.join(ROOT_DIR, 'bin', isWin ? 'cloudflared.exe' : 'cloudflared');

function updateEnvFiles(publicUrl, wsUrl) {
  process.env.PUBLIC_BASE_URL = publicUrl;
  process.env.PUBLIC_WS_URL = wsUrl;
  process.env.PLIVO_WEBHOOK_BASE_URL = publicUrl;

  const envTargets = [
    path.join(ROOT_DIR, '.env'),
    path.join(ROOT_DIR, 'server', '.env')
  ];

  for (const envPath of envTargets) {
    if (fs.existsSync(envPath)) {
      try {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (/PUBLIC_BASE_URL=/.test(envContent)) {
          envContent = envContent.replace(/PUBLIC_BASE_URL=.*(\r?\n)/, `PUBLIC_BASE_URL=${publicUrl}$1`);
        } else {
          envContent += `\nPUBLIC_BASE_URL=${publicUrl}\n`;
        }
        if (/PUBLIC_WS_URL=/.test(envContent)) {
          envContent = envContent.replace(/PUBLIC_WS_URL=.*(\r?\n)/, `PUBLIC_WS_URL=${wsUrl}$1`);
        } else {
          envContent += `\nPUBLIC_WS_URL=${wsUrl}\n`;
        }
        if (/PLIVO_WEBHOOK_BASE_URL=/.test(envContent)) {
          envContent = envContent.replace(/PLIVO_WEBHOOK_BASE_URL=.*(\r?\n)/, `PLIVO_WEBHOOK_BASE_URL=${publicUrl}$1`);
        } else {
          envContent += `\nPLIVO_WEBHOOK_BASE_URL=${publicUrl}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      } catch {}
    }
  }
}

let tunnelWatchdogTimer = null;
let consecutiveTunnelFailures = 0;

function startTunnelWatchdog(publicUrl) {
  if (tunnelWatchdogTimer) clearInterval(tunnelWatchdogTimer);
  consecutiveTunnelFailures = 0;

  tunnelWatchdogTimer = setInterval(() => {
    if (isShuttingDown || !tunnelProcess) return;

    const checkUrl = `${publicUrl}/api/health`;
    const req = https.get(checkUrl, { timeout: 10000 }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 500) {
        consecutiveTunnelFailures = 0;
      } else {
        consecutiveTunnelFailures++;
      }
      res.resume();
      if (consecutiveTunnelFailures >= 3) {
        console.log(`\n${YELLOW}[TUNNEL WATCHDOG] Notice: Public tunnel returned HTTP ${res.statusCode}.${RESET}`);
        consecutiveTunnelFailures = 0;
      }
    });

    req.on('error', (err) => {
      consecutiveTunnelFailures++;
      if (consecutiveTunnelFailures >= 4) {
        console.log(`\n${RED}[TUNNEL WATCHDOG] Public tunnel consistently failing after 4 attempts (${err.message}). Restarting tunnel...${RESET}`);
        consecutiveTunnelFailures = 0;
        try { tunnelProcess.kill('SIGKILL'); } catch {}
      }
    });

    req.on('timeout', () => {
      req.destroy();
      consecutiveTunnelFailures++;
      if (consecutiveTunnelFailures >= 4) {
        console.log(`\n${YELLOW}[TUNNEL WATCHDOG] Public tunnel check timed out 4 consecutive times.${RESET}`);
        consecutiveTunnelFailures = 0;
        try { tunnelProcess.kill('SIGKILL'); } catch {}
      }
    });
  }, 30000);
}

let cloudflaredFailCount = 0;

function launchLocalhostRunTunnel() {
  if (isShuttingDown) return;

  console.log(`${YELLOW}[TUNNEL] Activating high-reliability carrier fallback tunnel via localhost.run (SSH)...${RESET}`);
  tunnelProcess = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-R', '80:localhost:8000',
    'nokey@localhost.run'
  ], {
    cwd: ROOT_DIR,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let tunnelSynced = false;
  const onTunnelOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.lhr\.life/);
    if (match && !tunnelSynced) {
      tunnelSynced = true;
      const publicUrl = match[0];
      const wsUrl = publicUrl.replace('https://', 'wss://');
      console.log(`\n${GREEN}${BOLD}🌐 Live Carrier Fallback Tunnel Active (localhost.run)!${RESET}`);
      console.log(`${CYAN}  ► Carrier Webhook Base URL: ${BOLD}${publicUrl}${RESET}`);
      console.log(`${CYAN}  ► Carrier Stream WS URL:    ${BOLD}${wsUrl}${RESET}\n`);

      updateEnvFiles(publicUrl, wsUrl);
      startTunnelWatchdog(publicUrl);

      try {
        const syncCmd = `${pythonCmd} -c "from server.services.voice.plivo_client import plivo_client; plivo_client.update_application_urls('${publicUrl}')"`;
        execSync(syncCmd, { cwd: ROOT_DIR, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, PYTHONPATH: ROOT_DIR } });
        console.log(`${GREEN}  ✓ Plivo Carrier Inbound Webhook Synced to Fallback Tunnel${RESET}`);
      } catch (err) {
        console.log(`${RED}  ✗ Notice: Plivo application sync error: ${err.message}${RESET}`);
      }

      startAppProcesses();
    }
  };

  tunnelProcess.stdout.on('data', onTunnelOutput);
  tunnelProcess.stderr.on('data', onTunnelOutput);

  tunnelProcess.on('close', (code) => {
    if (tunnelWatchdogTimer) clearInterval(tunnelWatchdogTimer);
    if (!isShuttingDown) {
      console.log(`${YELLOW}[TUNNEL] Fallback tunnel closed (code ${code}). Retrying Cloudflare carrier tunnel...${RESET}`);
      tunnelSynced = false;
      cloudflaredFailCount = 0;
      setTimeout(launchTunnel, 2000);
    }
  });
}

function launchTunnel() {
  if (isShuttingDown) {
    startAppProcesses();
    return;
  }

  // Only fall back to SSH tunnel if Cloudflare repeatedly fails 3 times
  if (cloudflaredFailCount >= 3 || !fs.existsSync(cloudflaredBin)) {
    launchLocalhostRunTunnel();
    return;
  }

  console.log(`${GREEN}[TUNNEL] Launching Cloudflare Carrier Tunnel for Live Calls...${RESET}`);
  tunnelProcess = spawn(cloudflaredBin, ['tunnel', '--edge-ip-version', '4', '--protocol', 'http2', '--url', 'http://localhost:8000'], {
    cwd: ROOT_DIR,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let tunnelSynced = false;
  const onTunnelOutput = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/([a-zA-Z0-9-]+)\.trycloudflare\.com/);
    if (match && match[1] !== 'api' && !tunnelSynced) {
      tunnelSynced = true;
      cloudflaredFailCount = 0;
      const publicUrl = match[0];
      const wsUrl = publicUrl.replace('https://', 'wss://');
      console.log(`\n${GREEN}${BOLD}🌐 Live Cloudflare Carrier Tunnel Active!${RESET}`);
      console.log(`${CYAN}  ► Carrier Webhook Base URL: ${BOLD}${publicUrl}${RESET}`);
      console.log(`${CYAN}  ► Carrier Stream WS URL:    ${BOLD}${wsUrl}${RESET}\n`);

      updateEnvFiles(publicUrl, wsUrl);
      startTunnelWatchdog(publicUrl);

      // Sync Plivo application webhook endpoint
      try {
        const syncCmd = `${pythonCmd} -c "from server.services.voice.plivo_client import plivo_client; plivo_client.update_application_urls('${publicUrl}')"`;
        execSync(syncCmd, { cwd: ROOT_DIR, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, PYTHONPATH: ROOT_DIR } });
        console.log(`${GREEN}  ✓ Plivo Carrier Inbound Webhook Synced to Cloudflare Tunnel${RESET}`);
      } catch (err) {
        console.log(`${RED}  ✗ Notice: Plivo application sync error: ${err.message}${RESET}`);
      }

      startAppProcesses();
    }
  };

  tunnelProcess.stdout.on('data', onTunnelOutput);
  tunnelProcess.stderr.on('data', onTunnelOutput);

  tunnelProcess.on('close', (code) => {
    if (tunnelWatchdogTimer) clearInterval(tunnelWatchdogTimer);
    if (!isShuttingDown) {
      cloudflaredFailCount++;
      tunnelSynced = false;
      if (cloudflaredFailCount >= 3) {
        console.log(`${YELLOW}[TUNNEL] Cloudflare exited 3 times (code ${code}). Switching to fallback tunnel...${RESET}`);
        setTimeout(launchLocalhostRunTunnel, 1000);
      } else {
        console.log(`${YELLOW}[TUNNEL] Cloudflare tunnel exited (code ${code}). Retrying Cloudflare (attempt ${cloudflaredFailCount}/3)...${RESET}`);
        setTimeout(launchTunnel, 2000);
      }
    }
  });

  // Fallback: start processes after 8s if tunnel resolution is slow
  setTimeout(() => {
    startAppProcesses();
  }, 8000);
}

launchTunnel();


// Helper: Check backend health
function checkHealth() {
  const req = http.get('http://127.0.0.1:8000/api/health', (res) => {
    if (res.statusCode === 200) {
      console.log(`\n${GREEN}${BOLD}✓ SARA Platform is Ready & Active!${RESET}`);
      console.log(`${CYAN}  ► Frontend Web Application:  ${BOLD}http://localhost:5174${RESET}`);
      console.log(`${CYAN}  ► Backend REST & WebSocket:   ${BOLD}http://localhost:8000${RESET}`);
      console.log(`${CYAN}  ► Google OAuth Callback Port: ${BOLD}http://localhost:8001${RESET}`);
      console.log(`${CYAN}  ► Interactive API Docs:       ${BOLD}http://localhost:8000/docs${RESET}\n`);
    } else {
      setTimeout(checkHealth, 1000);
    }
  });
  req.on('error', () => {
    setTimeout(checkHealth, 1000);
  });
}

setTimeout(checkHealth, 1500);

// Cleanup on exit
function cleanup(signal = 'SIGINT') {
  console.log(`\n${YELLOW}[SHUTDOWN] Received ${signal} — Stopping SARA processes cleanly...${RESET}`);
  try {
    oauthProxy.close();
  } catch {}
  try {
    if (tunnelProcess) {
      if (isWin && tunnelProcess.pid) {
        execSync(`taskkill /F /T /PID ${tunnelProcess.pid}`, { stdio: 'ignore' });
      } else {
        tunnelProcess.kill('SIGINT');
      }
    }
  } catch {}
  try {
    if (isWin && serverProcess && serverProcess.pid) {
      execSync(`taskkill /F /T /PID ${serverProcess.pid}`, { stdio: 'ignore' });
    } else if (serverProcess) {
      serverProcess.kill('SIGINT');
    }
  } catch {}
  try {
    if (isWin && clientProcess && clientProcess.pid) {
      execSync(`taskkill /F /T /PID ${clientProcess.pid}`, { stdio: 'ignore' });
    } else if (clientProcess) {
      clientProcess.kill('SIGINT');
    }
  } catch {}
  setTimeout(() => {
    freePort(8000);
    freePort(8001);
    freePort(5174);
    process.exit(0);
  }, 500);
}

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGHUP', () => {
  console.log(`${YELLOW}[SETUP] SIGHUP received, ignoring to keep server running in background...${RESET}`);
});
