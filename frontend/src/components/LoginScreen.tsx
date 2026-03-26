import { useState } from 'react';
import { authService } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void;
}

function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authService.login(username.trim(), password);
      onLoginSuccess(data.username);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        setError('Invalid username or password.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-gateway-root">
      <div className="login-card-pro">
        <h1 className="login-title-pro">
          QUANT DASHBOARD LOGIN
        </h1>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="login-label-pro">
              Username
            </label>
            <input
              type="text"
              placeholder="operator_id"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input-pro"
              autoComplete="username"
              required
            />
          </div>

          <div className="mb-2">
            <label className="login-label-pro">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input-pro"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="login-error-msg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="login-button-pro"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;

