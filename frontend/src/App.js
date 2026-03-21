import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import './App.css';

// ─── Home ────────────────────────────────────────────────────────────────────
function Home() {
  const navigate = useNavigate();
  return (
    <div className="home">
      <div className="home-hero">
        <div className="home-logo">⚡</div>
        <h1>RAG Chat</h1>
        <p className="home-subtitle">Ask questions about any topic, webpage, or document</p>
      </div>
      <div className="home-cards">
        <div className="source-card" onClick={() => navigate('/topic')}>
          <div className="card-icon">🌐</div>
          <h3>Topic</h3>
          <p>Fetch content from Wikipedia by entering any topic</p>
        </div>
        <div className="source-card" onClick={() => navigate('/url')}>
          <div className="card-icon">🔗</div>
          <h3>URL</h3>
          <p>Scrape and index any webpage by pasting its URL</p>
        </div>
        <div className="source-card" onClick={() => navigate('/pdf')}>
          <div className="card-icon">📄</div>
          <h3>PDF</h3>
          <p>Upload a PDF document and chat with its content</p>
        </div>
      </div>
    </div>
  );
}

// ─── Shared input page layout ─────────────────────────────────────────────────
function InputPage({ icon, title, description, children }) {
  const navigate = useNavigate();
  return (
    <div className="input-page">
      <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
      <div className="input-card">
        <div className="input-card-icon">{icon}</div>
        <h2>{title}</h2>
        <p className="input-card-desc">{description}</p>
        {children}
      </div>
    </div>
  );
}

// ─── Topic Page ───────────────────────────────────────────────────────────────
function TopicPage() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/process_topic', { topic });
      navigate('/chat', { state: { docId: res.data.doc_id, source: topic, sourceType: 'topic' } });
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <InputPage icon="🌐" title="Enter a Topic" description="We'll fetch and index the Wikipedia article for your topic.">
      <input
        className="main-input"
        type="text"
        value={topic}
        onChange={e => setTopic(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && handleSubmit()}
        placeholder="e.g. Artificial Intelligence, Black holes, World War II"
        disabled={loading}
        autoFocus
      />
      {error && <div className="error-msg">⚠ {error}</div>}
      <button className="submit-btn" onClick={handleSubmit} disabled={loading || !topic.trim()}>
        {loading ? <><span className="spinner" /> Processing...</> : 'Fetch & Chat →'}
      </button>
    </InputPage>
  );
}

// ─── URL Page ─────────────────────────────────────────────────────────────────
function UrlPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/process_url', { url });
      navigate('/chat', { state: { docId: res.data.doc_id, source: url, sourceType: 'url' } });
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <InputPage icon="🔗" title="Paste a URL" description="We'll scrape the page and index its content for you.">
      <input
        className="main-input"
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && handleSubmit()}
        placeholder="https://example.com/article"
        disabled={loading}
        autoFocus
      />
      {error && <div className="error-msg">⚠ {error}</div>}
      <button className="submit-btn" onClick={handleSubmit} disabled={loading || !url.trim()}>
        {loading ? <><span className="spinner" /> Scraping...</> : 'Scrape & Chat →'}
      </button>
    </InputPage>
  );
}

// ─── PDF Page ─────────────────────────────────────────────────────────────────
function PdfPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const navigate = useNavigate();

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/api/process_pdf', formData);
      navigate('/chat', { state: { docId: res.data.doc_id, source: file.name, sourceType: 'pdf' } });
    } catch (e) {
      setError(e.response?.data?.error || e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    disabled: loading,
    multiple: false,
  });

  return (
    <InputPage icon="📄" title="Upload a PDF" description="Drag & drop or click to upload a PDF document.">
      <div {...getRootProps()} className={`dropzone ${isDragActive ? 'drag-active' : ''} ${loading ? 'loading' : ''}`}>
        <input {...getInputProps()} />
        {loading ? (
          <><span className="spinner large" /><p>Processing {fileName}...</p></>
        ) : isDragActive ? (
          <><div className="drop-icon">📥</div><p>Drop it here!</p></>
        ) : (
          <><div className="drop-icon">📄</div><p>Drag & drop a PDF here</p><span>or click to browse</span></>
        )}
      </div>
      {error && <div className="error-msg">⚠ {error}</div>}
    </InputPage>
  );
}

// ─── Chat Page (split layout) ─────────────────────────────────────────────────
function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { docId, source, sourceType } = location.state || {};

  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeChunks, setActiveChunks] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!docId) navigate('/');
  }, [docId, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim() || loading) return;
    const currentQuery = query;
    const newMessages = [...messages, { type: 'user', text: currentQuery }];
    setMessages(newMessages);
    setQuery('');
    setLoading(true);
    try {
      const res = await axios.post('/api/chat', { query: currentQuery, doc_id: docId });
      setMessages([...newMessages, { type: 'ai', text: res.data.answer, chunks: res.data.chunks }]);
      setActiveChunks(res.data.chunks || []);
    } catch (e) {
      setMessages([...newMessages, { type: 'error', text: e.response?.data?.error || e.message }]);
    } finally {
      setLoading(false);
    }
  };

  const sourceIcon = { topic: '🌐', url: '🔗', pdf: '📄' }[sourceType] || '📁';

  return (
    <div className="chat-page">
      {/* Left panel — context chunks */}
      <div className="context-panel">
        <div className="panel-header">
          <span className="panel-title">Context</span>
          <div className="source-badge">{sourceIcon} {source}</div>
        </div>
        <div className="chunks-area">
          {activeChunks.length === 0 ? (
            <div className="chunks-empty">
              <div className="chunks-empty-icon">💬</div>
              <p>Ask a question to see the relevant context chunks used to answer it.</p>
            </div>
          ) : (
            activeChunks.map((chunk, i) => (
              <div key={i} className="chunk-card">
                <div className="chunk-num">#{i + 1}</div>
                <p>{chunk}</p>
              </div>
            ))
          )}
        </div>
        <button className="new-chat-btn" onClick={() => navigate('/')}>+ New Source</button>
      </div>

      {/* Right panel — chat */}
      <div className="chat-panel">
        <div className="chat-header">
          <span className="chat-title">Chat</span>
          <span className="chat-subtitle">Ask anything about the source</span>
        </div>

        <div className="messages-area">
          {messages.length === 0 && (
            <div className="messages-empty">
              <div className="messages-empty-icon">⚡</div>
              <p>Source loaded! Ask your first question.</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`message-row ${msg.type}`}>
              <div className="message-bubble">
                {msg.type === 'ai' && <div className="ai-label">AI</div>}
                {msg.type === 'error'
                  ? <span className="error-text">⚠ {msg.text}</span>
                  : msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message-row ai">
              <div className="message-bubble typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-row">
          <input
            className="chat-input"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question..."
            disabled={loading}
          />
          <button className="send-btn" onClick={handleSend} disabled={loading || !query.trim()}>
            {loading ? <span className="spinner" /> : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/topic" element={<TopicPage />} />
        <Route path="/url" element={<UrlPage />} />
        <Route path="/pdf" element={<PdfPage />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  );
}
