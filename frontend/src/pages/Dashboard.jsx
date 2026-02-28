import React, { useState, useEffect } from 'react'
import { useData } from './DataContext'
import { useAuth } from './AuthContext'
import axios from 'axios'
import Settings from './Settings'
import Rules from './Rules'

function Dashboard() {
  const { data } = useData()
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [triggeringSelection, setTriggeringSelection] = useState(false)
  const [loginMessage, setLoginMessage] = useState('')

  const { elite_signals, elite_10, index_status, underlying_price, timestamp } = data

  const handleTriggerSelection = async () => {
    setTriggeringSelection(true)
    setLoginMessage('⏳ Starting Elite 10 selection... Please wait.')
    try {
      const sessionToken = localStorage.getItem('session_token')
      const response = await axios.post('/api/auth/trigger-selection', {}, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
      if (response.data.success) {
        setLoginMessage(`✅ ${response.data.message}`)
      }
    } catch (error) {
      setLoginMessage('❌ Failed to trigger selection.')
    } finally {
      setTriggeringSelection(false)
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'settings':
        return <Settings />
      case 'rules':
        return <Rules />
      default:
        return (
          <>
            <div className="card overview-card">
              <div>
                <h2 style={{ margin: '0 0 12px 0', fontSize: '1.25rem' }}>Nifty 50 Index Overview</h2>
                <div className="overview-stats">
                  <div className="stat-box">
                    <label>LTP</label>
                    <div className="value">{underlying_price?.toFixed(2) || '---'}</div>
                  </div>
                  <div className="stat-box">
                    <label>Gap %</label>
                    <div className={`value ${index_status?.gap >= 0 ? 'positive' : 'negative'}`}>
                      {index_status?.gap !== undefined ? `${index_status.gap.toFixed(2)}%` : '---'}
                    </div>
                  </div>
                  <div className="stat-box">
                    <label>Gravity Guard</label>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: Math.abs(index_status?.gap || 0) > 1.0 ? 'var(--down-color)' : 'var(--up-color)' }}>
                      {Math.abs(index_status?.gap || 0) > 1.0
                        ? "⚠️ Skipping Continuation (Gap > 1.0%)"
                        : "✅ Normal Volatility Range"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="live-monitoring">
                <label>Live Monitoring</label>
                <div className="time">
                  {timestamp ? new Date(timestamp).toLocaleTimeString() : 'Waiting for data...'}
                </div>
                {loginMessage && <div style={{ marginTop: '5px', fontSize: '12px', color: 'var(--primary)' }}>{loginMessage}</div>}
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3>Daily Elite 10 Stocks</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Top 10 Independent & Volatile (Beta high / Correlation low)
                    </p>
                  </div>
                  <button
                    onClick={handleTriggerSelection}
                    disabled={triggeringSelection}
                    className="btn-glass"
                  >
                    {triggeringSelection ? 'Processing...' : '🔄 Refresh Elite 10'}
                  </button>
                </div>
                <div className="table-container">
                  {elite_10 && elite_10.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th style={{ textAlign: 'right' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {elite_10.map((symbol) => (
                          <tr key={symbol}>
                            <td className="symbol-cell">{symbol.split('|')[1]}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="nav-badge" style={{ background: 'rgba(255,255,255,0.05)', display: 'inline-flex' }}>POLLING</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      <p>✨ Selection triggers at 09:00 AM</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3>Live Signal Feed</h3>
                </div>
                <div className="signal-feed">
                  {elite_signals && elite_signals.length > 0 ? (
                    elite_signals.map((sig, idx) => (
                      <div key={idx} className={`signal-card ${sig.direction === 'LONG' ? 'long' : 'short'}`}>
                        <div className="signal-top">
                          <h4>{sig.symbol.split('|')[1]}</h4>
                          <span className={`signal-type ${sig.type.toLowerCase()}`}>
                            {sig.type}
                          </span>
                        </div>
                        <div className="signal-body">
                          <span style={{ color: sig.direction === 'LONG' ? 'var(--up-color)' : 'var(--down-color)', fontWeight: 'bold' }}>
                            {sig.direction === 'LONG' ? '⚡ CALL (LONG)' : '📉 PUT (SHORT)'}
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>@</span>
                          <span className="signal-price">{sig.entry_price?.toFixed(2)}</span>
                        </div>
                        <div className="signal-footer">
                          <span>SL: {sig.sl?.toFixed(2)}</span>
                          <span>TP: {sig.tp?.toFixed(2)}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{sig.time}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '80px' }}>
                      <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px', opacity: 0.5 }}>📡</span>
                      Waiting for entry signals...
                      <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Check 09:20 AM (Cont) or 11:30 AM (Rev)</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </>
        )
    }
  }

  return (
    <div className="dashboard-container">
      {/* Tab Navigation */}
      <div className="dashboard-tabs">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
        >
          ⚙️ Settings
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
        >
          📜 Strategy Rules
        </button>
      </div>

      <div className="tab-view">
        {renderContent()}
      </div>
    </div>
  )
}

export default Dashboard
