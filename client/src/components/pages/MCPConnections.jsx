import React, { useState, useEffect } from 'react';
import {
  Cpu, Plus, CheckCircle2, AlertCircle, RefreshCw, Trash2,
  ExternalLink, Terminal, Shield, Zap, Search, X
} from 'lucide-react';
import SkeletonLoader from '../common/SkeletonLoader';

export default function MCPConnections({ onNavigate }) {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverDesc, setServerDesc] = useState('');
  const [serverType, setServerType] = useState('http');
  const [submitting, setSubmitting] = useState(false);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/mcp');
      if (res.ok) {
        const data = await res.json();
        setServers(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching MCP servers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleAddServer = async (e) => {
    e.preventDefault();
    if (!serverName) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serverName,
          description: serverDesc,
          server_url: serverUrl,
          server_type: serverType,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setServerName('');
        setServerUrl('');
        setServerDesc('');
        await fetchServers();
      }
    } catch (err) {
      console.error('Failed to create MCP server:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={26} color="var(--primary)" />
            Model Context Protocol (MCP) Connections
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Connect external tools, databases, APIs, and microservices using the open Model Context Protocol standard.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={fetchServers} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={16} /> Add MCP Server
          </button>
        </div>
      </div>

      {/* Grid or Empty State */}
      {loading && servers.length === 0 ? (
        <SkeletonLoader type="cards" count={3} />
      ) : servers.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center', borderRadius: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Cpu size={28} color="#7c3aed" />
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>No MCP Servers Connected</h3>
          <p style={{ margin: '0 auto 20px', fontSize: 13, color: 'var(--text-muted)', maxWidth: 440 }}>
            Connect databases, internal APIs, or browser automation servers so your AI employees can safely call tools during workflows and voice calls.
          </p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={14} /> Connect MCP Server
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20 }}>
          {servers.map((s, idx) => (
            <div key={s.id || idx} className="card" style={{ padding: 24, borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(124,58,237,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Cpu size={20} color="var(--primary)" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{s.name}</h3>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 3 }}>
                        {s.server_url || s.url || 'stdio://local'}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                    background: s.status === 'connected' ? '#ecfdf5' : '#fffbeb',
                    color: s.status === 'connected' ? '#059669' : '#d97706',
                  }}>
                    ● {s.status?.toUpperCase() || 'CONNECTED'}
                  </span>
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
                  {s.description || 'Verified MCP service exposing executable tool endpoints to Sara AI.'}
                </p>

                {/* Tools count */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} color="var(--primary)" /> TOOLS DETECTED ({s.tool_count || 0})
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Type: <strong style={{ color: 'var(--text-primary)' }}>{s.server_type || 'http'}</strong>
                    {s.last_ping && ` · Last ping: ${new Date(s.last_ping).toLocaleTimeString()}`}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Registered {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Active'}
                </span>
                <span className="badge badge-active" style={{ fontSize: 11 }}>
                  <CheckCircle2 size={11} style={{ marginRight: 4 }} /> Ready
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 500, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Cpu size={18} color="#7c3aed" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Connect New MCP Server</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Standard Model Context Protocol Integration</div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddServer}>
              <div style={{ marginBottom: 14 }}>
                <label className="label">Server Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., PostgreSQL DB MCP, Twilio Gateway"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="label">Transport Type</label>
                <select className="select" value={serverType} onChange={(e) => setServerType(e.target.value)}>
                  <option value="http">Stream over HTTP / SSE</option>
                  <option value="stdio">Local Stdio Process</option>
                  <option value="websocket">WebSocket</option>
                </select>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="label">Server Endpoint / Command</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. http://localhost:8000/mcp or npx -y @modelcontextprotocol/server"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label className="label">Description & Permitted Capabilities</label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="Describe tools provided by this server and access rules for AI employees..."
                  value={serverDesc}
                  onChange={(e) => setServerDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Connecting...' : 'Connect Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
