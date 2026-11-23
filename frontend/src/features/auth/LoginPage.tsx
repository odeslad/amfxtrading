import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Field, TextInput } from '../../shared/ui';
import { useAuth } from './useAuth';
import styles from './LoginPage.module.css';

// Only internal paths from ProtectedRoute's state; anything else lands on the root.
function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('/login') ? from : '/';
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(returnPath(location.state), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>AMFX</div>
        <div className={styles.subtitle}>Trading Terminal V2.0</div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <Field label="Email" htmlFor="email">
            <TextInput
              id="email"
              type="email"
              size="lg"
              placeholder="user@domain.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <TextInput
              id="password"
              type="password"
              size="lg"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <div className={styles.error}>{error}</div>

          <Button variant="primary" size="lg" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
