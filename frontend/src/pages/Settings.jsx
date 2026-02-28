import React, { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import axios from 'axios'

function Settings() {
  const [settings, setSettings] = useState({
    irs_threshold: 0.45,
    relvol_threshold: 1.3,
    gap_threshold: 0.8,
    index_gravity_threshold: 1.0,
    adr_threshold: 80,
    reversal_irs_threshold: 1.0,
    reversal_gap_threshold: 0.5,
    consecutive_confirmations: 1,
    prev_day_close: '',
  })

  const { currentUser } = useAuth()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (currentUser) {
      const fetchSettings = async () => {
        try {
          const response = await axios.get(`/api/settings/${currentUser}`)
          if (response.data) {
            setSettings(prev => ({ ...prev, ...response.data }))
          }
        } catch (error) {
          console.error('Error loading settings:', error)
        }
      }
      fetchSettings()
    }
  }, [currentUser])

  const handleChange = (e) => {
    const { name, value } = e.target
    setSettings(prev => ({
      ...prev,
      [name]: value === '' ? '' : (isNaN(Number(value)) ? value : parseFloat(value))
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await axios.put(`/api/settings/${currentUser}`, settings)
      setMessage('✅ Strategy parameters updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('❌ Error saving settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3>Strategy Settings</h3>
        </div>

        {message && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '24px',
            borderRadius: '6px',
            backgroundColor: message.includes('❌') ? 'var(--down-color-bg)' : 'var(--up-color-bg)',
            color: message.includes('❌') ? 'var(--down-color)' : 'var(--up-color)',
            border: `1px solid ${message.includes('❌') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
            fontWeight: '500'
          }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="settings-grid">
            {/* Continuation Sniper Settings */}
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '1rem' }}>Continuation Sniper (09:20 AM)</h4>
              <div className="form-group">
                <label>IRS Threshold (%)</label>
                <input type="number" name="irs_threshold" value={settings.irs_threshold} onChange={handleChange} step="0.01" />
              </div>
              <div className="form-group">
                <label>Relative Volume (x)</label>
                <input type="number" name="relvol_threshold" value={settings.relvol_threshold} onChange={handleChange} step="0.1" />
              </div>
              <div className="form-group">
                <label>Max Stock Gap (%)</label>
                <input type="number" name="gap_threshold" value={settings.gap_threshold} onChange={handleChange} step="0.05" />
              </div>
              <div className="form-group">
                <label>Index Gravity Skip (%)</label>
                <input type="number" name="index_gravity_threshold" value={settings.index_gravity_threshold} onChange={handleChange} step="0.1" />
              </div>
            </div>

            {/* Reversal Income Settings */}
            <div>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '16px', fontSize: '1rem' }}>Reversal Income (11:30 AM)</h4>
              <div className="form-group">
                <label>Min IRS for Reversal (%)</label>
                <input type="number" name="reversal_irs_threshold" value={settings.reversal_irs_threshold} onChange={handleChange} step="0.1" />
              </div>
              <div className="form-group">
                <label>Min Stock Gap (%)</label>
                <input type="number" name="reversal_gap_threshold" value={settings.reversal_gap_threshold} onChange={handleChange} step="0.05" />
              </div>
              <div className="form-group">
                <label>Min ADR Coverage (%)</label>
                <input type="number" name="adr_threshold" value={settings.adr_threshold} onChange={handleChange} step="1" />
              </div>
            </div>
          </div>

          <hr style={{ margin: '32px 0', border: '0', borderTop: '1px solid var(--border-light)' }} />

          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label>Confirmations (Secs)</label>
            <input type="number" name="consecutive_confirmations" value={settings.consecutive_confirmations} onChange={handleChange} step="1" min="1" />
          </div>

          <div style={{ marginTop: '24px' }}>
            <button type="submit" className="btn-glass" disabled={saving}>
              {saving ? 'Saving...' : '🛡️ Save Strategy Parameters'}
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h3>Risk Management Note</h3>
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 4px 0' }}>• Max 1 trade per stock per day.</p>
          <p style={{ margin: '0 0 4px 0' }}>• Automated square-off at 03:15 PM.</p>
          <p style={{ margin: '0' }}>• Trailing Stop Loss to Breakeven at +1.0% Profit.</p>
        </div>
      </div>
    </>
  )
}

export default Settings