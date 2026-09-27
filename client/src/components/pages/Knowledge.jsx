import React, { useState, useEffect } from 'react';
import {
  GraduationCap, Upload, Globe, FileText, Search, Plus, Trash2,
  RefreshCw, CheckCircle2, Clock, AlertTriangle, BookOpen, Sparkles, Filter, Database
} from 'lucide-react';

const CATEGORIES = ['All', 'Company Knowledge', 'Products', 'FAQs', 'Policies', 'SOPs'];

export default function Knowledge({ onNavigate }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // New source form state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('text'); // text | website | document
  const [newCategory, setNewCategory] = useState('Company Knowledge');
  const [newContent, setNewContent] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchKnowledge = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/knowledge');
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      }
    } catch (e) {
      console.error('Error fetching knowledge:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          source_type: newType,
          category: newCategory,
          extracted_text: newType === 'text' ? newContent : '',
          url: newType === 'website' ? newUrl : null,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewName('');
        setNewContent('');
        setNewUrl('');
        fetchKnowledge();
      }
    } catch (err) {
      console.error('Error creating knowledge source:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this knowledge source?')) return;
    try {
      await fetch(`/api/v1/knowledge/${id}`, { method: 'DELETE' });
      setSources(sources.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleSemanticSearch = async (e) => {
    e.preventDefault();
    if (!testSearchQuery) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/v1/knowledge/search?query=${encodeURIComponent(testSearchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (err) {
      console.error('Error searching knowledge:', err);
    } finally {
      setSearching(false);
    }
  };

  const filteredSources = sources.filter((s) => {
    const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <GraduationCap size={26} color="var(--primary)" />
            AI Knowledge & Training Center
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Feed company knowledge, SOPs, websites, and documents into your AI workforce's shared intelligence memory.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
          >
            <Plus size={16} />
            Add Knowledge Source
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookOpen size={16} color="var(--primary)" /> Total Sources
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>{sources.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Across all AI employees</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} color="#10b981" /> Total Chunks Indexed
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>
            {sources.reduce((acc, s) => acc + (s.chunk_count || 0), 0)}
          </div>
          <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>Ready for real-time retrieval</div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={16} color="#6366f1" /> Embeddings Engine
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>OpenAI + Vector RAG</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Latency ~18ms lookup</div>
        </div>
      </div>

      {/* Semantic Search Sandbox */}
      <div className="card" style={{ padding: 20, marginBottom: 28, background: 'linear-gradient(180deg, rgba(124,58,237,0.03), transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Sparkles size={18} color="var(--primary)" />
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Test Knowledge Retrieval (RAG Testbench)
          </h3>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Enter a customer question to see exactly what factual context your AI employees retrieve before answering:
        </p>
        <form onSubmit={handleSemanticSearch} style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: 12 }} />
            <input
              type="text"
              placeholder="e.g. What is our refund policy? or What amenities are in 3 BHK villas?"
              value={testSearchQuery}
              onChange={(e) => setTestSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-input, #fff)',
                color: 'var(--text-primary)',
                fontSize: 14,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="btn-primary"
            style={{ padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600 }}
          >
            {searching ? 'Querying...' : 'Test Retrieval'}
          </button>
        </form>

        {searchResults && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              Retrieved Context Chunks ({searchResults.length}):
            </div>
            {searchResults.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No matching knowledge chunks found. Add documents below to enrich SARA's brain.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.map((r, i) => (
                  <div key={r.id || i} style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border)', fontSize: 13 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 4 }}>CHUNK #{r.chunk_index + 1}</div>
                    <div style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>{r.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: selectedCategory === cat ? 'var(--primary)' : 'var(--border)',
                background: selectedCategory === cat ? 'rgba(124,58,237,0.1)' : 'transparent',
                color: selectedCategory === cat ? 'var(--primary)' : 'var(--text-muted)',
                transition: 'all 0.15s ease',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', width: 260 }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
          <input
            type="text"
            placeholder="Search sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* Knowledge Sources Table / List */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: 10 }} />
            <div>Loading knowledge base...</div>
          </div>
        ) : filteredSources.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <BookOpen size={40} color="var(--text-muted)" style={{ marginBottom: 12, opacity: 0.5 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No Knowledge Sources Yet</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 16px' }}>
              Add FAQs, company documents, sales pitch books, or pricing sheets so your AI employees can answer questions accurately.
            </p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13 }}>
              + Add First Knowledge Source
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary, #fafafa)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>SOURCE NAME</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>TYPE</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>CATEGORY</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>CHUNKS</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>ADDED</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredSources.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s ease' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {s.source_type === 'website' ? <Globe size={16} color="#0284c7" /> : <FileText size={16} color="var(--primary)" />}
                      {s.name}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {s.source_type}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(124,58,237,0.08)', color: 'var(--primary)', fontSize: 12, fontWeight: 500 }}>
                      {s.category}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 500,
                      background: s.status === 'indexed' ? '#ecfdf5' : '#fffbeb',
                      color: s.status === 'indexed' ? '#059669' : '#d97706',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.status === 'indexed' ? '#10b981' : '#f59e0b' }} />
                      {s.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {s.chunk_count || 1} chunks
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 12 }}>
                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Today'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(s.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                      title="Delete source"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Knowledge Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 540, padding: 24, borderRadius: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
              Add Knowledge to SARA AI
            </h2>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Source Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Commercial Pricing Q3 2026 or Company Refund SOP"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Source Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                  >
                    <option value="text">Direct Text / SOP</option>
                    <option value="website">Website URL (Scrape)</option>
                    <option value="faq">FAQ Collection</option>
                    <option value="document">Document Upload</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                  >
                    <option value="Company Knowledge">Company Knowledge</option>
                    <option value="Products">Products & Pricing</option>
                    <option value="FAQs">FAQs</option>
                    <option value="Policies">Policies</option>
                    <option value="SOPs">SOPs & Workflows</option>
                  </select>
                </div>
              </div>

              {newType === 'website' ? (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Public Web Page URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/pricing-and-terms"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                    Knowledge Content / FAQs
                  </label>
                  <textarea
                    rows={6}
                    placeholder="Paste business policies, verified FAQs, price tiers, property specifications, or instructions here..."
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.5 }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary"
                  style={{ padding: '8px 18px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}
                >
                  {creating ? 'Saving & Indexing...' : 'Index Knowledge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
