import { useState, useEffect } from 'react'
import { 
  Shield, AlertTriangle, CheckCircle, Send, Upload, 
  LayoutDashboard, FileText, Settings, Sun, Moon,
  Activity, AlertOctagon, ShieldCheck, BarChart3
} from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [log, setLog] = useState('')
  const [results, setResults] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [darkMode, setDarkMode] = useState(true)
  const [dragActive, setDragActive] = useState(false)

  const analyzeText = async () => {
    if (!log.trim()) return
    setLoading(true)
    setResults([])
    try {
      const res = await fetch('http://localhost:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log })
      })
      const data = await res.json()
      setResults([data])
      addToHistory(data, log)
    } catch (err) {
      setResults([{ error: err.message }])
    }
    setLoading(false)
  }

  const analyzeFile = async (file) => {
    if (!file) return
    setLoading(true)
    setResults([])
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      setResults(data.results || [])
      data.results?.forEach(r => addToHistory(r, 'Batch upload'))
    } catch (err) {
      setResults([{ error: err.message }])
    }
    setLoading(false)
  }

  const addToHistory = (result, source) => {
    setHistory(prev => [{
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      threat: result.threat_type || 'No Threat',
      severity: result.severity || 'Low',
      source: source.slice(0, 50)
    }, ...prev].slice(0, 50))
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    if (e.type === 'dragleave') setDragActive(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) analyzeFile(e.dataTransfer.files[0])
  }

  const color = (sev) => {
    if (sev === 'High') return '#ff4444'
    if (sev === 'Medium') return '#ffaa00'
    return '#00cc66'
  }

  const stats = {
    total: history.length,
    threats: history.filter(h => h.severity !== 'Low').length,
    high: history.filter(h => h.severity === 'High').length,
    medium: history.filter(h => h.severity === 'Medium').length
  }

  const pieData = [
    { name: 'High', value: stats.high, color: '#ff4444' },
    { name: 'Medium', value: stats.medium, color: '#ffaa00' },
    { name: 'Low', value: history.filter(h => h.severity === 'Low').length, color: '#00cc66' }
  ].filter(d => d.value > 0)

  const barData = [
    { name: 'SSH', value: history.filter(h => h.threat?.includes('SSH') || h.threat?.includes('Brute')).length },
    { name: 'Web', value: history.filter(h => h.threat?.includes('Web') || h.threat?.includes('Directory')).length },
    { name: 'Other', value: history.filter(h => !h.threat?.includes('SSH') && !h.threat?.includes('Web') && !h.threat?.includes('Directory')).length }
  ]

  const renderDashboard = () => (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <Activity size={24} color="#2563eb" />
          <div>
            <h3>{stats.total}</h3>
            <p>Total Scans</p>
          </div>
        </div>
        <div className="stat-card">
          <AlertOctagon size={24} color="#ff4444" />
          <div>
            <h3>{stats.threats}</h3>
            <p>Threats Found</p>
          </div>
        </div>
        <div className="stat-card">
          <ShieldCheck size={24} color="#00cc66" />
          <div>
            <h3>{stats.high}</h3>
            <p>High Severity</p>
          </div>
        </div>
        <div className="stat-card">
          <BarChart3 size={24} color="#ffaa00" />
          <div>
            <h3>{stats.medium}</h3>
            <p>Medium Severity</p>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="left-panel">
          <div className="input-box">
            <textarea
              value={log}
              onChange={(e) => setLog(e.target.value)}
              placeholder="Paste a log entry here..."
              rows={4}
            />
            <div className="button-row">
              <button onClick={analyzeText} disabled={loading}>
                <Send size={16} /> {loading ? 'Analyzing...' : 'Analyze Text'}
              </button>
            </div>
            
            <div 
              className={`drop-zone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload size={32} />
              <p>Drag & drop .log or .txt file here</p>
              <span>or</span>
              <label className="file-btn">
                Browse Files
                <input type="file" accept=".log,.txt" onChange={(e) => analyzeFile(e.target.files[0])} hidden />
              </label>
            </div>
          </div>

          {loading && (
            <div className="skeleton-loader">
              <div className="skeleton-line"></div>
              <div className="skeleton-line short"></div>
              <div className="skeleton-line"></div>
            </div>
          )}

          <div className="results">
            {results.map((result, i) => (
              <div key={i} className="result-card" style={{ borderLeft: `4px solid ${color(result.severity)}` }}>
                <div className="result-header">
                  {result.threat_detected ? <AlertTriangle color={color(result.severity)} /> : <CheckCircle color="#00cc66" />}
                  <h3>{result.threat_type || 'No Threat Detected'}</h3>
                  <span className="badge" style={{ background: color(result.severity) }}>{result.severity}</span>
                </div>
                <div className="result-body">
                  <p><strong>IP:</strong> {result.affected_ip || 'N/A'}</p>
                  <p><strong>Mitigation:</strong> {result.mitigation}</p>
                  <p><strong>Confidence:</strong> {result.confidence}</p>
                </div>
                {result.error && <p className="error-text">Error: {result.error}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="right-panel">
          <div className="chart-box">
            <h4>Threat Severity Distribution</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-box">
            <h4>Threat Categories</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )

  const renderHistory = () => (
    <div className="history-page">
      <h2>Recent Analyses</h2>
      <div className="history-table">
        <div className="history-header">
          <span>Time</span>
          <span>Threat</span>
          <span>Severity</span>
          <span>Source</span>
        </div>
        {history.map((item) => (
          <div key={item.id} className="history-row">
            <span>{item.time}</span>
            <span>{item.threat}</span>
            <span className="badge" style={{ background: color(item.severity) }}>{item.severity}</span>
            <span className="source">{item.source}</span>
          </div>
        ))}
        {history.length === 0 && <p className="empty">No analyses yet. Run a scan to see history.</p>}
      </div>
    </div>
  )

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <aside className="sidebar">
        <div className="logo">
          <Shield size={28} />
          <span>SIEM AI</span>
        </div>
        <nav>
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
            <FileText size={18} /> History
          </button>
          <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
            <Settings size={18} /> Settings
          </button>
        </nav>
        <button className="theme-toggle" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          {darkMode ? 'Light Mode' : 'Dark Mode'}
        </button>
      </aside>

      <main className="content">
        <header>
          <h1>{activeTab === 'dashboard' ? 'Security Dashboard' : activeTab === 'history' ? 'Scan History' : 'Settings'}</h1>
          <div className="status">
            <span className="dot green"></span>
            Gemma 4 E4B Online
          </div>
        </header>

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'settings' && (
          <div className="settings-page">
            <h2>Settings</h2>
            <p>Model: Gemma 4 E4B Q5_K_P</p>
            <p>Context Window: 128K tokens</p>
            <p>Backend: http://localhost:5000</p>
            <p>LLM Server: http://localhost:8080</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App