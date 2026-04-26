import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { getHomePathForRole } from '../utils/roleHome';
import Button from '../components/Button';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await authAPI.login(formData.email, formData.password);
      login(data.token, data.user);
      navigate(getHomePathForRole(data.user.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.1fr 1fr', background: '#fff' }}>
      <section style={{ borderRight: '1px solid var(--border-default)', padding: '56px 64px', background: 'linear-gradient(180deg, #111827 0%, #1f2a44 100%)', color: '#fff' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(255,255,255,.22)', display: 'grid', placeItems: 'center', fontWeight: 700 }}>U</div>
        <p style={{ margin: '28px 0 0', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c7d2fe' }}>Delivery governance suite</p>
        <h1 style={{ margin: '10px 0 0', fontSize: 34, lineHeight: 1.2, maxWidth: 520, fontWeight: 600 }}>
          Run delivery programs with confidence and control.
        </h1>
        <p style={{ margin: '14px 0 0', maxWidth: 520, color: '#cbd5e1', fontSize: 14 }}>
          Unified workspace for project health, financial discipline, change control and governance operations.
        </p>
        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, maxWidth: 460 }}>
          {['Portfolio-level controls', 'AI-assisted risk visibility', 'Compliance-ready workflows', 'Audit-friendly change trails'].map((x) => (
            <div key={x} style={{ border: '1px solid rgba(255,255,255,.16)', borderRadius: 10, background: 'rgba(255,255,255,.04)', padding: '10px 12px', fontSize: 12 }}>
              {x}
            </div>
          ))}
        </div>
      </section>

      <section style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 430, border: '1px solid var(--border-default)', borderRadius: 12, padding: 28, background: '#fff' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#5B4ED4' }}>Welcome back</p>
          <h2 style={{ margin: '6px 0 0', fontSize: 24, color: '#111827' }}>Sign in to UDIP</h2>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: '#6b7280' }}>Use your work credentials to continue.</p>

          <form onSubmit={onSubmit} style={{ marginTop: 18, display: 'grid', gap: 12 }}>
            {error ? (
              <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}>
                {error}
              </div>
            ) : null}

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#374151' }}>Work email</span>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={onChange}
                required
                placeholder="name@company.com"
                style={{ height: 38, border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 13, padding: '0 10px' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#374151' }}>Password</span>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={onChange}
                required
                placeholder="Enter password"
                style={{ height: 38, border: '1px solid var(--border-default)', borderRadius: 6, fontSize: 13, padding: '0 10px' }}
              />
            </label>

            <div style={{ marginTop: 4 }}>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
