/**
 * pages/AuthPage.jsx
 * Login & Register screen.
 */
import './AuthPage.css';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode]       = useState('login'); // 'login' | 'register'
  const [form, setForm]       = useState({ username: '', email: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.username, form.email, form.password);
      }
      navigate('/setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <span className="auth-emoji">🗺️</span>
          <h1>Treasure Hunt Timișoara</h1>
          <p>Descoperă orașul prin aventuri personalizate</p>
        </div>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Autentificare
          </button>
          <button
            className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Înregistrare
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="username">Nume utilizator</label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="ex: explorator_tm"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="username"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="adresa@email.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Parolă</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder={mode === 'register' ? 'Minim 8 caractere' : '••••••••'}
              value={form.password}
              onChange={handleChange}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <p className="form-error">⚠️ {error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Se procesează...' : mode === 'login' ? 'Intră în cont' : 'Creează cont'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? 'Nu ai cont?' : 'Ai deja cont?'}{' '}
          <button
            className="link-btn"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          >
            {mode === 'login' ? 'Înregistrează-te' : 'Autentifică-te'}
          </button>
        </p>
      </div>
    </div>
  );
}
