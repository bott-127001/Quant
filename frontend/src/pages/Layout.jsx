import React, { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useData } from './DataContext';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { Activity, LogOut, Key, ShieldCheck, ShieldAlert, Cpu, Menu, X } from 'lucide-react';

function Layout() {
  const { data, connected } = useData();
  const { logout, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [upstoxLoginStatus, setUpstoxLoginStatus] = useState(null)
  const [triggeringLogin, setTriggeringLogin] = useState(false)
  const [loginMessage, setLoginMessage] = useState('')

  const { index_status } = data;

  useEffect(() => {
    const checkUpstoxLoginStatus = async () => {
      if (!currentUser) return
      try {
        const sessionToken = localStorage.getItem('session_token')
        const response = await axios.get('/api/auth/check-upstox-login-status', {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        })
        setUpstoxLoginStatus(response.data)
      } catch (error) {
        console.error('Error checking Upstox login status:', error)
      }
    }
    checkUpstoxLoginStatus()
  }, [currentUser])

  const handleTriggerUpstoxLogin = async () => {
    setTriggeringLogin(true)
    setLoginMessage('⏳ Initiating login...')
    try {
      const sessionToken = localStorage.getItem('session_token')
      const response = await axios.post('/api/auth/trigger-upstox-login', {}, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
      if (response.data.success) {
        setLoginMessage('✅ Login successful!')
        setUpstoxLoginStatus({ logged_in: true })
      }
    } catch (error) {
      setLoginMessage('❌ Login failed.')
    } finally {
      setTriggeringLogin(false)
      setTimeout(() => setLoginMessage(''), 3000)
    }
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect to login even if logout fails
      navigate('/login');
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <div className="layout-container">
      <nav className="top-navbar">
        <div className="nav-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu className="brand-icon" size={24} />
            <h1>Elite 10 Quant System</h1>
          </div>
          <button className="mobile-menu-btn" onClick={toggleMenu}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <div className={`nav-controls ${isMenuOpen ? 'open' : ''}`}>
          {/* Gravity Badge */}
          <div className={`nav-badge gravity-badge ${Math.abs(index_status?.gap || 0) < 1.0 ? 'safe' : 'restricted'}`}>
            {Math.abs(index_status?.gap || 0) < 1.0 ? (
              <><ShieldCheck size={16} /> Gravity: Safe</>
            ) : (
              <><ShieldAlert size={16} /> Gravity: Restricted</>
            )}
          </div>

          {/* Upstox Auth */}
          {!upstoxLoginStatus?.logged_in ? (
            <button
              onClick={handleTriggerUpstoxLogin}
              disabled={triggeringLogin}
              className="btn-glass"
            >
              <Key size={16} />
              {triggeringLogin ? 'Authenticating...' : 'Broker Auth'}
            </button>
          ) : (
            <span className="broker-connected"><ShieldCheck size={14} />Broker Ready</span>
          )}

          {/* WS Status */}
          <div className={`connection-status ${connected ? 'status-online' : 'status-offline'}`}>
            <Activity className="pulse-icon" size={16} />
            {connected ? 'Live' : 'Offline'}
          </div>

          {/* Logout */}
          <button onClick={handleLogout} className="btn-logout" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Main Content Pane */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;