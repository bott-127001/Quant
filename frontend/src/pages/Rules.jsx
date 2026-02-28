import React from 'react'

function Rules() {
  return (
    <div className="rules-container">
      <div className="card">
        <h2>📊 ELITE 10 QUANT SYSTEM: CORE STRATEGY</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
          (Automated Stock Selection & Precision Execution)
        </p>

        {/* Step 1: Selection */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: 'var(--primary)', marginTop: '20px', marginBottom: '10px' }}>STEP 1 — DAILY ELITE 10 SELECTION (09:00 AM)</h3>
          <p style={{ marginBottom: '10px' }}>The system identifies the top 10 Nifty 50 stocks with the highest "Explosive Independence":</p>
          <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
            <li><strong>Pearson Correlation (r)</strong>: Target lowest values (independence from Index).</li>
            <li><strong>Beta (β)</strong>: Target highest values (maximum volatility).</li>
            <li><strong>Historical Base</strong>: Last 30 trading days of data.</li>
          </ul>
        </div>

        {/* Step 2: Continuation Sniper */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: 'var(--primary)', marginTop: '20px', marginBottom: '10px' }}>STEP 2 — CONTINUATION SNIPER (09:20 AM)</h3>
          <p style={{ marginBottom: '10px' }}>Capture aggressive morning momentum in the first 5 minutes of trade:</p>
          <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
            <li><strong>IRS (Intraday Relative Strength)</strong>: Must be {">"} 0.45%.</li>
            <li><strong>Relative Volume (RelVol)</strong>: Must be {">"} 1.3x benchmark.</li>
            <li><strong>Stock Gap</strong>: |Gap| must be {"<"} 0.80%.</li>
            <li><strong>Alignment Rule</strong>: Sign(Stock Gap) == Sign(IRS Direction).</li>
            <li><strong>Index Gravity</strong>: Skip if Index Gap {">"} 1.0% or Index conflicts with IRS.</li>
          </ul>
        </div>

        {/* Step 3: Reversal Income */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: 'var(--primary)', marginTop: '20px', marginBottom: '10px' }}>STEP 3 — REVERSAL INCOME (11:30 AM)</h3>
          <p style={{ marginBottom: '10px' }}>Mean reversion for overextended stocks that didn't trigger a morning trade:</p>
          <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
            <li><strong>Eligibility</strong>: Gap {">"} 0.5%, ADR Coverage {">"} 80%, |IRS| {">"} 1.0%.</li>
            <li><strong>Execution Trigger</strong>: IRS Flattening (|IRS @ 11:30| {"<"} |IRS @ 11:00|).</li>
            <li><strong>Direction</strong>: Counter-trend (Against the morning directional bias).</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <h2 style={{ color: 'var(--down-color)' }}>🛡️ RISK & EXIT MANAGEMENT</h2>
        <div style={{ marginTop: '15px' }}>
          <ul style={{ marginLeft: '20px', lineHeight: '2.0', fontSize: '15px' }}>
            <li><strong>Participation</strong>: Maximum 1 trade per stock per day.</li>
            <li><strong>Capital</strong>: Equal allocation across all triggered signals.</li>
            <li><strong>Stop Loss (SL)</strong>: Fixed percentage or volatility-based (as configured).</li>
            <li><strong>Take Profit (TP)</strong>: Trailing SL to Breakeven once profit hits +1.0%.</li>
            <li><strong>Time Square-off</strong>: All positions closed at 03:15 PM IST.</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
        <h3>📈 SYMBOL CONVENTIONS</h3>
        <p style={{ fontSize: '14px', color: 'var(--up-color)' }}>
          The system uses Nifty 50 constituents only. Live data is polled every 5 seconds for the Elite 10 list to ensure low-latency execution triggers.
        </p>
      </div>
    </div>
  )
}

export default Rules

