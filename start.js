#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');

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

// 1. Launch Backend Server (FastAPI / Python)
console.log(`${GREEN}[SERVER] Starting FastAPI Backend on http://localhost:8000...${RESET}`);
const serverProcess = spawn(pythonCmd, ['-m', 'server.main'], {
  cwd: ROOT_DIR,
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: isWin,
  env: { ...process.env, PYTHONUNBUFFERED: '1' }
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

// 2. Launch Frontend Client (Vite / React)
console.log(`${GREEN}[CLIENT] Starting Vite React Frontend on http://localhost:5174...${RESET}`);
const clientProcess = spawn(npmCmd, ['run', 'dev', '--', '--host'], {
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

// 3. OAuth Proxy (port 8001 -> 8000)
// Forward incoming Google OAuth callbacks on port 8001 to FastAPI backend on port 8000
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
function cleanup() {
  console.log(`\n${YELLOW}[SHUTDOWN] Stopping SARA processes cleanly...${RESET}`);
  try {
    oauthProxy.close();
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

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
serverProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`${RED}[SERVER] Process exited with code ${code}${RESET}`);
  }
});
clientProcess.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`${RED}[CLIENT] Process exited with code ${code}${RESET}`);
  }
});

