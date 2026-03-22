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
    <div className="min-h-screen flex items-center justify-center bg-bg-root">
      <div className="pro-card max-w-md w-full p-8">
        <h1 className="text-2xl font-black tracking-tight text-white mb-6 uppercase">
          Elite 10 Dashboard Login
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] font-bold text-text-tertiary block mb-1 uppercase tracking-widest">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-black/40 border border-border-mid p-3 rounded-lg font-mono text-base focus:border-brand-primary outline-none transition-all"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-tertiary block mb-1 uppercase tracking-widest">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-border-mid p-3 rounded-lg font-mono text-base focus:border-brand-primary outline-none transition-all"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="text-xs text-brand-secondary font-mono mt-1">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-4 action-btn action-btn-primary w-full flex justify-center"
          >
            <span>{loading ? 'Authenticating…' : 'Login'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;

