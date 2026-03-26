import { useState, useEffect } from 'react';
import { Layout, Zap, Settings, List, Activity, Power, RefreshCw, Key, Menu, X, Loader2, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardService, configService, authService } from './services/api';
import * as XLSX from 'xlsx';
import LoginScreen from './components/LoginScreen';

// --- Types ---
interface NiftyData {
  ltp: number;
  change: number;
  lastUpdate: string;
}

interface Signal {
  _id: string;
  symbol: string;
  type: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  metrics: { irs: number; relVol: number; gap: number };
  date: string;
  status: 'OPEN' | 'CLOSED';
  exitReason?: 'TP' | 'SL' | 'SQUARE_OFF' | 'TRAILING_SL';
  pnlPercentage?: number;
}

interface Elite10Item {
  symbol: string;
  ltp: number;
  irs: number;
  relVol: number;
  adr: number;
  gap: number;
  direction: '+' | '-' | 'neutral';
}

// --- Sub-components ---
const DashboardHeader = ({
  activeTab,
  nifty,
  onAction,
  isLoading,
  activeAction,
  lastLog
}: {
  activeTab: string;
  nifty: NiftyData | null;
  onAction: (action: string) => void;
  currentUser: string | null;
  isLoading: boolean;
  activeAction: string | null;
  lastLog: string;
}) => {
  return (
    <div className={`pro-card dashboard-header mb-12 ${activeTab === 'logs' ? 'header-logs-view' : ''}`}>
      <div className={activeTab === 'logs' ? 'header-internal-wrapper' : ''}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 pb-4 border-b border-white/5">
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase leading-none">
              {activeTab === 'dashboard' && 'Terminal'}
              {activeTab === 'settings' && 'Config'}
              {activeTab === 'logs' && 'Audit'}
            </h1>
            <p className="text-text-tertiary text-[8px] md:text-[10px] font-bold tracking-[0.2em] md:tracking-[0.3em] uppercase opacity-60">
              Quant Dashboard
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-4 w-full md:w-auto">
            <div className="terminal-button-matrix w-full md:w-auto">
              {activeTab === 'dashboard' && (
                <>
                  <button
                    onClick={() => onAction('login')}
                    disabled={isLoading}
                    className={`action-btn ${activeAction === 'login' ? 'active' : ''} ${isLoading && activeAction !== 'login' ? 'opacity-20 grayscale' : ''}`}
                  >
                    {activeAction === 'login' ? <Loader2 size={14} className="animate-spin-custom text-brand-primary" /> : <Power size={14} />}
                    <span>AUTH</span>
                  </button>
                  <button
                    onClick={() => onAction('sync')}
                    disabled={isLoading}
                    className={`action-btn ${activeAction === 'sync' ? 'active' : ''} ${isLoading && activeAction !== 'sync' ? 'opacity-20 grayscale' : ''}`}
                    title="Setup and map symbols (Run once)"
                  >
                    {activeAction === 'sync' ? <Loader2 size={14} className="animate-spin-custom text-brand-primary" /> : <RefreshCw size={14} />}
                    <span>Sync Symbols</span>
                  </button>
                  <button
                    onClick={() => onAction('syncData')}
                    disabled={isLoading}
                    className={`action-btn ${activeAction === 'syncData' ? 'active' : ''} ${isLoading && activeAction !== 'syncData' ? 'opacity-20 grayscale' : ''}`}
                    title="Sync local price data for all symbols"
                  >
                    {activeAction === 'syncData' ? <Loader2 size={14} className="animate-spin-custom text-brand-primary" /> : <Activity size={14} />}
                    <span>Sync Data</span>
                  </button>
                  <button
                    onClick={() => onAction('rank')}
                    disabled={isLoading}
                    className={`action-btn action-btn-primary ${activeAction === 'rank' ? 'active' : ''} ${isLoading && activeAction !== 'rank' ? 'opacity-20 grayscale' : ''}`}
                  >
                    {activeAction === 'rank' ? <Loader2 size={14} className="animate-spin-custom text-black" /> : <Zap size={14} />}
                    <span>Refresh Stocks</span>
                  </button>
                </>
              )}

              {activeTab === 'settings' && (
                <>
                  <button onClick={() => onAction('nuke')} className="action-btn text-brand-secondary border-brand-secondary/30">
                    <Key size={14} /> <span>CLEAR ACCESS</span>
                  </button>
                  <button onClick={() => onAction('save')} className="action-btn action-btn-primary">
                    <span>SAVE CHANGES</span>
                  </button>
                </>
              )}
            </div>

            <div className="h-6 flex items-center justify-end w-full mt-2 md:mt-1">
              <AnimatePresence mode="wait">
                {(isLoading || activeAction) && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2 px-3 py-1 bg-brand-primary/5 rounded-full"
                  >
                    <span className="w-1 h-1 rounded-full bg-brand-primary animate-pulse" />
                    <div className="h-[10px] overflow-hidden relative w-full max-w-[calc(100vw-60px)] sm:w-[500px] flex justify-end">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={lastLog}
                          initial={{ y: 15, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -15, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          style={{ whiteSpace: 'nowrap', fontSize: '7px' }}
                          className="text-[7px] font-mono font-bold text-brand-primary uppercase text-right truncate"
                        >
                          {lastLog}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="status-bar flex flex-col sm:flex-row gap-4 mt-6">
          <div className="nifty-ticker w-full sm:w-auto">
            <Activity className={nifty && nifty.change >= 0 ? 'text-brand-primary' : 'text-brand-secondary'} size={20} />
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-text-tertiary uppercase tracking-widest">NIFTY 50 INDEX</span>
              <span className="font-mono font-bold text-xl leading-none">
                {nifty ? nifty.ltp.toLocaleString() : '---'}
                <span className={`ml-2 text-sm ${nifty && nifty.change >= 0 ? 'text-brand-primary' : 'text-brand-secondary'}`}>
                  {nifty ? `${nifty.change >= 0 ? '+' : ''}${nifty.change.toFixed(2)}%` : '(0.00%)'}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 px-6 py-2 rounded-lg bg-black/20 border border-border-dim w-full sm:w-auto">
            <RefreshCw size={16} className="animate-spin-slow text-brand-primary" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-text-tertiary uppercase tracking-widest">
                Latest Fetch
              </span>
              <span className="text-xs font-mono font-bold text-text-secondary">
                SYNC_TS: {nifty ? new Date(nifty.lastUpdate).toLocaleTimeString() : '--:--:--'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface Config {
  continuation: { irsThreshold: number; relVolThreshold: number; gapMax: number };
  reversal: { irsThreshold: number; adrThreshold: number; gapMin: number; flatteningThreshold: number };
  toggles: { sniperEnabled: boolean; reversalEnabled: boolean; autoTrading: boolean };
}

// --- Main App ---
function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'logs'>('dashboard');
  const [dashboardData, setDashboardData] = useState<{
    nifty: NiftyData | null;
    signals: Signal[];
    elite10: Elite10Item[];
    sessionStatus: 'VALID' | 'EXPIRED' | 'MISSING';
  }>({ nifty: null, signals: [], elite10: [], sessionStatus: 'MISSING' });
  const [tradeLogs, setTradeLogs] = useState<Signal[]>([]);
  const [filterStock, setFilterStock] = useState('');
  const [filterTradeType, setFilterTradeType] = useState<'ALL' | 'CONTINUATION' | 'REVERSAL'>('ALL');
  const [filterOutcome, setFilterOutcome] = useState<'ALL' | 'TP' | 'SL'>('ALL');
  const [sortOption, setSortOption] = useState<
    'NONE' | 'TP_DESC' | 'TP_ASC' | 'SL_ASC' | 'SL_DESC'
  >('NONE');
  const [config, setConfig] = useState<Config | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [lastLog, setLastLog] = useState<string>('System Ready');

  // Data Polling & Initial Fetch
  const fetchData = async () => {
    try {
      const data = await dashboardService.getLiveDashboard();
      setDashboardData(data);
    } catch (err) {
      console.error('Fetch Failed:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const data = await configService.getConfig();
      setConfig(data);
    } catch (err) {
      console.error('Config Fetch Failed:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const data = await dashboardService.getTradeLogs();
      setTradeLogs(data);
    } catch (err) {
      console.error('Logs Fetch Failed:', err);
    }
  };

  useEffect(() => {
    let interval: number | undefined;

    const init = async () => {
      try {
        const me = await authService.me();
        setIsAuthed(true);
        setCurrentUser(me.username);
        await Promise.all([fetchData(), fetchConfig(), fetchLogs()]);
        interval = window.setInterval(fetchData, 30000);
      } catch {
        setIsAuthed(false);
      }
    };

    void init();

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  // Poll logs only when loading
  useEffect(() => {
    let interval: number | undefined;
    if (isLoading || activeAction) {
      interval = window.setInterval(async () => {
        try {
          const res = await dashboardService.getLiveLogs();
          if (res.logs && res.logs.length > 0) {
            const latest = res.logs[res.logs.length - 1];
            if (latest !== lastLog) {
              setLastLog(latest);
            }
          }
        } catch { }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    }
  }, [isLoading, lastLog]);

  const handleLogout = async () => {
    try {
      await authService.logout();
      setIsAuthed(false);
      setCurrentUser(null);
    } catch (err) {
      alert('Logout failed');
    }
  };

  const handleAction = async (action: string) => {
    setIsLoading(true);
    setActiveAction(action);
    try {
      if (action === 'login') await dashboardService.manualLogin();
      if (action === 'sync') {
        const res = await dashboardService.manualSync();
        alert(res);
      }
      if (action === 'syncData') {
        const res = await dashboardService.syncData();
        alert(res);
      }
      if (action === 'rank') {
        const res = await dashboardService.calculateRanking();
        alert(res.message);
      }
      if (action === 'nuke') {
        await configService.nukeAuth();
        alert('Access tokens cleared!');
      }
      if (action === 'save' && config) {
        await configService.updateConfig(config);
        alert('Configuration synchronized.');
      }
    } catch (err) {
      alert(`Action failed.`);
      setIsLoading(false);
      setActiveAction(null);
    } finally {
      // Don't clear for background actions immediately
      if (action !== 'syncData') {
        setIsLoading(false);
        setActiveAction(null);
      }
    }
  };

  const updateConfigField = (section: keyof Config, field: string, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      [section]: {
        ...(config[section] as any),
        [field]: value
      }
    });
  };

  const filteredLogs = tradeLogs
    .filter((log: Signal) =>
      log.symbol.toLowerCase().includes(filterStock.toLowerCase())
    )
    .filter((log: Signal) => (filterTradeType === 'ALL' ? true : log.type === filterTradeType))
    .filter((log: Signal) => (filterOutcome === 'ALL' ? true : log.exitReason === filterOutcome))
    .slice()
    .sort((a, b) => {
      if (sortOption === 'TP_DESC') return (b.takeProfit ?? 0) - (a.takeProfit ?? 0);
      if (sortOption === 'TP_ASC') return (a.takeProfit ?? 0) - (b.takeProfit ?? 0);
      if (sortOption === 'SL_ASC') return (a.stopLoss ?? 0) - (b.stopLoss ?? 0);
      if (sortOption === 'SL_DESC') return (b.stopLoss ?? 0) - (a.stopLoss ?? 0);
      return 0;
    });

  const downloadLogsExcel = (rows: Signal[], filename: string) => {
    const exportRows = rows.map((log) => ({
      Date: log.date ? new Date(log.date).toLocaleString() : '',
      Symbol: log.symbol,
      Type: log.type,
      Direction: log.direction,
      Status: log.status,
      ExitReason: log.exitReason ?? '',
      Entry: log.entryPrice,
      TakeProfit: log.takeProfit,
      StopLoss: log.stopLoss,
      ReturnPct: typeof log.pnlPercentage === 'number' ? log.pnlPercentage : '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trade Logs');
    XLSX.writeFile(wb, filename);
  };

  if (isAuthed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-root">
        <div className="pro-card p-8">
          <p className="text-xs text-text-tertiary font-mono uppercase tracking-[0.3em]">
            Initializing secure session…
          </p>
        </div>
      </div>
    );
  }

  if (isAuthed === false) {
    return (
      <LoginScreen
        onLoginSuccess={async (username) => {
          setIsAuthed(true);
          setCurrentUser(username);
          await Promise.all([fetchData(), fetchConfig(), fetchLogs()]);
        }}
      />
    );
  }

  return (
    <div className={`main-wrapper`}>
      {/* Navigation */}
      <nav className="top-nav-bar desktop-only">
        <div className="nav-pill-container">
          {(['dashboard', 'settings', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'logs') fetchLogs();
              }}
              className={`nav-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab === 'dashboard' && <Layout size={18} />}
              {tab === 'settings' && <Settings size={18} />}
              {tab === 'logs' && <List size={18} />}
              <span className="capitalize">{tab}</span>
            </button>
          ))}
          <div className="h-4 w-px bg-white/10 mx-2" />

          <div className="flex items-center gap-6">
            <div className="auth-status-container">
              <span className="auth-label mr-2">AUTH:</span>
              <div className="status-indicator-group">
                <div className={`status-led ${(dashboardData.sessionStatus || 'MISSING').toLowerCase()}`} />
                <span className={`status-text ${dashboardData.sessionStatus === 'VALID' ? 'text-brand-primary' : 'text-brand-secondary'}`}>
                  {dashboardData.sessionStatus === 'VALID' ? 'YES' : 'NO'}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="logout-btn-premium"
            >
              <LogOut size={16} />
              <span className="logout-label">LOGOUT</span>
            </button>
          </div>
        </div>
      </nav>

      <nav className="mobile-nav mobile-only">
        <div className="mobile-nav-bar">
          <button
            className="mobile-nav-toggle"
            onClick={() => setIsMobileNavOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {isMobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="mobile-nav-title">
            <span className="capitalize">{activeTab}</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-4 mr-2">
            <div className="auth-status-container scale-90 origin-right">
              <span className="auth-label mr-1">AUTH : </span>
              <div className="status-indicator-group">
                <div className={`status-led ${(dashboardData.sessionStatus || 'MISSING').toLowerCase()}`} />
                <span className={`status-text ${dashboardData.sessionStatus === 'VALID' ? 'text-brand-primary' : 'text-brand-secondary'}`}>
                  {dashboardData.sessionStatus === 'VALID' ? 'YES' : 'NO'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="logout-btn-premium"
            >
              <LogOut size={14} />
              <span className="logout-label">LOGOUT</span>
            </button>
          </div>
        </div>

        {isMobileNavOpen && (
          <div className="mobile-nav-menu">
            {(['dashboard', 'settings', 'logs'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setIsMobileNavOpen(false);
                  if (tab === 'logs') fetchLogs();
                }}
                className={`mobile-nav-item ${activeTab === tab ? 'active' : ''}`}
              >
                {tab === 'dashboard' && <Layout size={16} />}
                {tab === 'settings' && <Settings size={16} />}
                {tab === 'logs' && <List size={16} />}
                <span className="capitalize">{tab}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Main Header */}
      <DashboardHeader
        activeTab={activeTab}
        nifty={dashboardData.nifty}
        onAction={handleAction}
        currentUser={currentUser}
        isLoading={isLoading}
        activeAction={activeAction}
        lastLog={lastLog}
      />

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'dashboard' && (
              <div className="content-grid">
                {/* Active Trading Tickets */}
                <div className="col-span-4 flex flex-col gap-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary">Live Signal Stream</h3>
                    <div className="flex gap-1">
                      <div className="w-1 h-1 rounded-full bg-brand-primary animate-pulse" />
                      <div className="w-1 h-1 rounded-full bg-brand-primary/20" />
                    </div>
                  </div>
                  {dashboardData.signals.length > 0 ? (
                    dashboardData.signals.map(signal => (
                      <div key={signal._id} className="pro-card border-l-2 border-l-brand-primary">
                        <div className="terminal-card-header">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-primary/40 shadow-[0_0_8px_rgba(0,245,160,0.4)]" />
                          <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest">Signal Node :: 0x{signal.symbol.slice(0, 3)}</span>
                        </div>
                        <div className="p-6">
                          <div className="flex justify-between items-center mb-6">
                            <span className={`indicator-tag ${signal.type === 'REVERSAL' ? 'indicator-down' : 'indicator-up'}`}>
                              {signal.type} {signal.direction}
                            </span>
                            <span className="font-mono text-[10px] text-text-tertiary">#EXE_{signal.symbol}</span>
                          </div>
                          <div className="flex justify-between items-end mb-8">
                            <div>
                              <h2 className="text-3xl font-bold tracking-tighter text-white">{signal.symbol}</h2>
                              <p className="text-text-tertiary text-xs font-mono mt-1">LTP: <span className="text-text-secondary">{signal.entryPrice.toFixed(2)}</span></p>
                            </div>
                            <div className="text-right">
                              <p className="text-text-tertiary text-[9px] uppercase font-black mb-1">IRS_INDEX</p>
                              <h3 className={`text-2xl font-mono font-bold ${signal.metrics.irs >= 0 ? 'text-brand-primary' : 'text-brand-secondary'}`}>
                                {signal.metrics.irs >= 0 ? '+' : ''}{signal.metrics.irs.toFixed(2)}%
                              </h3>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-dim/50">
                            <div>
                              <p className="text-[9px] font-bold text-text-tertiary uppercase mb-1">STOP</p>
                              <p className="font-mono font-bold text-lg text-brand-secondary">{signal.stopLoss.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-bold text-text-tertiary uppercase mb-1">TARGET</p>
                              <p className="font-mono font-bold text-lg text-brand-primary">{signal.takeProfit.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="pro-card p-12 flex flex-col items-center justify-center text-center">
                      <Activity size={32} className="text-text-tertiary mb-4 opacity-10" />
                      <p className="text-text-tertiary font-bold tracking-widest uppercase text-[10px] opacity-40">System Idle :: Awaiting Signals</p>
                    </div>
                  )}
                </div>

                {/* Main Ranking Terminal */}
                <div className="col-span-8">
                  <div className="pro-card">
                    <div className="p-6 border-b border-border-dim flex justify-between items-center">
                      <h3 className="font-bold text-sm uppercase tracking-widest text-text-secondary flex items-center gap-2">
                        <List size={14} className="text-brand-primary" /> Today's 10 Stocks
                      </h3>
                      <div className="flex gap-2">
                        <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
                        <span className="text-[10px] font-mono text-text-tertiary uppercase">Live Stream</span>
                      </div>
                    </div>
                    <div className="terminal-table-container">
                      <table className="terminal-table">
                        <thead>
                          <tr>
                            <th>Symbol</th>
                            <th>LTP</th>
                            <th>IRS%</th>
                            <th>RelVol</th>
                            <th>ADR%</th>
                            <th>Gap%</th>
                            <th className="text-right">Signal Bias</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono text-sm">
                          {dashboardData.elite10.map((item) => (
                            <tr key={item.symbol}>
                              <td className="font-bold text-white">{item.symbol}</td>
                              <td className="text-text-secondary font-bold">{item.ltp.toLocaleString()}</td>
                              <td className={`font-bold ${item.irs >= 0 ? 'text-brand-primary' : 'text-brand-secondary'}`}>
                                {item.irs >= 0 ? '+' : ''}{item.irs.toFixed(2)}%
                              </td>
                              <td className="text-text-tertiary">{item.relVol.toFixed(2)}x</td>
                              <td className="text-text-tertiary">{item.adr.toFixed(1)}%</td>
                              <td className="text-text-tertiary">{item.gap.toFixed(2)}%</td>
                              <td className="text-right">
                                <span className={`indicator-tag p-1 px-3 ${item.direction === '+' ? 'indicator-up' : item.direction === '-' ? 'indicator-down' : 'bg-border-dim text-text-tertiary'}`}>
                                  {item.direction === '+' ? 'BULL' : item.direction === '-' ? 'BEAR' : 'NEUT'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && config && (
              <div className="content-grid gap-4 md:gap-8">
                {/* Global Policy Toggles */}
                {/* Global Policy Hub */}
                <div className="col-span-full pro-card global-policy-card flex flex-col mb-4">
                  <div className="terminal-card-header py-4 md:py-6">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
                    <span className="text-[9px] md:text-sm font-black text-text-tertiary uppercase tracking-widest">Execution Allowance</span>
                  </div>

                  <div className="p-6 md:p-16 flex flex-col justify-between h-full gap-8 md:gap-12 bg-gradient-to-b from-bg-surface to-transparent flex-1">
                    {[
                      { label: 'Sniper (Continuation)', field: 'sniperEnabled', val: config.toggles.sniperEnabled },
                      { label: 'Income (Reversal)', field: 'reversalEnabled', val: config.toggles.reversalEnabled },
                      { label: 'Automated Execution', field: 'autoTrading', val: config.toggles.autoTrading }
                    ].map((t) => (
                      <div key={t.field} className="policy-toggle-row flex items-center justify-between w-full border-b border-white/5 pb-10 last:border-0 last:pb-0">
                        <span className="policy-label text-[10px] md:text-lg font-black text-text-tertiary uppercase tracking-[0.45em]">{t.label}</span>
                        <label className="toggle-switch policy-switch scale-100 md:scale-150 origin-right">
                          <input
                            type="checkbox"
                            checked={t.val}
                            onChange={() => updateConfigField('toggles', t.field as any, !t.val)}
                          />
                          <span className="toggle-track" aria-hidden="true">
                            <span className="toggle-thumb" />
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Configuration Blocks */}
                <div className="col-span-6 pro-card">
                  <div className="terminal-card-header">
                    <Zap size={10} className="text-brand-primary" />
                    <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest"></span>
                  </div>
                  <div className="p-6 md:p-16">
                    <h3 className="text-xl md:text-5xl font-black mb-4 text-white tracking-tighter uppercase tracking-[0.1em]">Sniper Thresholds</h3>
                    <div className="h-px w-full bg-gradient-to-r from-border-mid via-border-mid to-transparent mb-12 opacity-50" />

                    <div className="flex flex-col gap-10 md:gap-14">
                      {[
                        { label: 'IRS Floor (%)', section: 'continuation', field: 'irsThreshold', step: 0.01 },
                        { label: 'RelVol Minimum', section: 'continuation', field: 'relVolThreshold', step: 0.1 },
                        { label: 'Gap Max (%)', section: 'continuation', field: 'gapMax', step: 0.01 }
                      ].map(f => (
                        <div key={f.field} className="parameter-group flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12 w-full border-b border-white/5 pb-10 last:border-0 last:pb-0">
                          <label className="parameter-label text-[10px] lg:text-[0.9rem] font-black lg:font-medium text-text-tertiary uppercase lg:normal-case tracking-[0.45em] lg:tracking-normal whitespace-nowrap w-full md:w-1/2">{f.label}</label>
                          <input
                            type="number" step={f.step}
                            value={(config as any)[f.section][f.field]}
                            onChange={(e) => updateConfigField(f.section as any, f.field, parseFloat(e.target.value))}
                            className="parameter-input w-full md:w-[10%] lg:w-[120px] bg-black/40 border-l-4 border-brand-primary p-4 md:p-8 lg:p-4 rounded-r-2xl lg:rounded-md font-mono text-2xl md:text-5xl lg:text-base focus:bg-black/60 outline-none transition-all shadow-2xl text-right md:text-left"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="col-span-6 pro-card">
                  <div className="terminal-card-header">
                    <Activity size={10} className="text-brand-secondary" />
                    <span className="text-[9px] font-bold text-text-tertiary uppercase tracking-widest"></span>
                  </div>
                  <div className="p-6 md:p-16">
                    <h3 className="text-xl md:text-5xl font-black mb-4 text-white tracking-tighter uppercase tracking-[0.1em]">Reversal Thresholds</h3>
                    <div className="h-px w-full bg-gradient-to-r from-border-mid via-border-mid to-transparent mb-12 opacity-50" />

                    <div className="flex flex-col gap-10 md:gap-14">
                      {[
                        { label: 'Peak IRS (%)', section: 'reversal', field: 'irsThreshold', step: 0.1 },
                        { label: 'ADR Coverage (%)', section: 'reversal', field: 'adrThreshold', step: 1 },
                        { label: 'Flattening Sens.', section: 'reversal', field: 'flatteningThreshold', step: 0.1 }
                      ].map(f => (
                        <div key={f.field} className="parameter-group flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12 w-full border-b border-white/5 pb-10 last:border-0 last:pb-0">
                          <label className="parameter-label text-[10px] lg:text-[0.9rem] font-black lg:font-medium text-text-tertiary uppercase lg:normal-case tracking-[0.45em] lg:tracking-normal whitespace-nowrap w-full md:w-1/2">{f.label}</label>
                          <input
                            type="number" step={f.step}
                            value={(config as any)[f.section][f.field]}
                            onChange={(e) => updateConfigField(f.section as any, f.field, parseFloat(e.target.value))}
                            className="parameter-input w-full md:w-[45%] lg:w-[120px] bg-black/40 border-l-4 border-brand-secondary p-4 md:p-8 lg:p-4 rounded-r-2xl lg:rounded-md font-mono text-2xl md:text-5xl lg:text-base focus:bg-black/60 outline-none transition-all shadow-2xl text-right md:text-left"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="flex flex-col gap-6">
                {/* Search & Aggregates */}
                <div className="logs-controls lg:flex lg:flex-row lg:items-center lg:gap-[20px] lg:mt-6 lg:mb-8 pro-card p-4">
                  <div className="logs-filter-group flex flex-col md:flex-row items-center gap-3 lg:gap-[20px] w-full lg:w-auto">
                    <input
                      type="text"
                      placeholder="Filter symbol..."
                      value={filterStock}
                      onChange={(e) => setFilterStock(e.target.value)}
                      className="logs-search-input w-full lg:max-w-[250px] bg-black/30 border border-border-mid p-2 md:p-3 text-xs md:text-sm rounded-xl focus:border-brand-primary outline-none"
                    />

                    <select
                      value={filterTradeType}
                      onChange={(e) => setFilterTradeType(e.target.value as any)}
                      className="logs-select w-full lg:min-w-[160px] bg-black/30 border border-border-mid p-2 lg:p-3 text-xs md:text-sm rounded-xl focus:border-brand-primary outline-none"
                    >
                      <option value="ALL">All trades</option>
                      <option value="CONTINUATION">Continuation</option>
                      <option value="REVERSAL">Reversal</option>
                    </select>

                    <select
                      value={filterOutcome}
                      onChange={(e) => setFilterOutcome(e.target.value as any)}
                      className="logs-select w-full lg:min-w-[160px] bg-black/30 border border-border-mid p-2 lg:p-3 text-xs md:text-sm rounded-xl focus:border-brand-primary outline-none"
                    >
                      <option value="ALL">All outcomes</option>
                      <option value="TP">TP hit</option>
                      <option value="SL">SL hit</option>
                    </select>

                    <select
                      value={sortOption}
                      onChange={(e) => setSortOption(e.target.value as any)}
                      className="logs-select w-full lg:min-w-[160px] bg-black/30 border border-border-mid p-2 lg:p-3 text-xs md:text-sm rounded-xl focus:border-brand-primary outline-none"
                    >
                      <option value="NONE">No sorting</option>
                      <option value="TP_DESC">TP: max → low</option>
                      <option value="TP_ASC">TP: low → max</option>
                      <option value="SL_ASC">SL: low → max</option>
                      <option value="SL_DESC">SL: max → low</option>
                    </select>
                  </div>

                  <div className="logs-action-row-mobile logs-action-row-desktop flex items-center gap-3 lg:gap-[20px]">
                    <button
                      onClick={() =>
                        downloadLogsExcel(
                          filteredLogs,
                          `trade-logs_filtered_${new Date().toISOString().slice(0, 10)}.xlsx`
                        )
                      }
                      className="action-btn action-btn-sm action-btn-filtered-desktop"
                    >
                      DOWNLOAD FILTERED
                    </button>

                    <button
                      onClick={() =>
                        downloadLogsExcel(
                          tradeLogs,
                          `trade-logs_all_${new Date().toISOString().slice(0, 10)}.xlsx`
                        )
                      }
                      className="action-btn action-btn-sm action-btn-all-desktop"
                    >
                      DOWNLOAD ALL
                    </button>
                  </div>
                </div>

                {/* Metrics Row (Desktop optimized) */}
                <div className="flex justify-end gap-12 pr-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">Audit Ledger</p>
                    <p className="text-2xl font-mono font-bold">{tradeLogs.length} Records</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mb-1">Yield Performance</p>
                    <p className="text-2xl font-mono font-bold text-brand-primary">+8.42%</p>
                  </div>
                </div>

                {/* Audit Table */}
                <div className="pro-card">
                  <div className="terminal-table-container">
                    <table className="terminal-table">
                      <thead>
                        <tr>
                          <th>Timestamp & Asset</th>
                          <th>Strategy</th>
                          <th>Entry</th>
                          <th>Target</th>
                          <th>Stop</th>
                          <th className="text-right">Return</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-sm">
                        {filteredLogs.map((log) => (
                          <tr key={log._id}>
                            <td>
                              <p className="font-bold text-white">{log.symbol}</p>
                              <p className="text-[10px] text-text-tertiary">{new Date(log.date).toLocaleDateString()}</p>
                            </td>
                            <td>
                              <span className={`indicator-tag ${log.type === 'REVERSAL' ? 'indicator-down' : 'indicator-up'}`}>
                                {log.type}
                              </span>
                            </td>
                            <td className="text-text-secondary font-bold">{log.entryPrice.toLocaleString()}</td>
                            <td className="text-brand-primary opacity-60">{log.takeProfit.toLocaleString()}</td>
                            <td className="text-brand-secondary opacity-60">{log.stopLoss.toLocaleString()}</td>
                            <td className="text-right">
                              {log.status === 'OPEN' ? (
                                <span className="text-brand-accent animate-pulse font-bold">LIVE</span>
                              ) : (
                                <span className={`font-bold ${typeof log.pnlPercentage === 'number' && log.pnlPercentage < 0 ? 'text-brand-secondary' : 'text-brand-primary'}`}>
                                  {typeof log.pnlPercentage === 'number' ? `${log.pnlPercentage >= 0 ? '+' : ''}${log.pnlPercentage.toFixed(2)}%` : '--'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredLogs.length === 0 && (
                      <div className="logs-empty-state">No archival records found matching criteria.</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
