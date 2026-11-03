import { useState } from 'react';
import { GraduationCap, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import PasswordInput from './components/PasswordInput.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ResetPassword() {
  const getQueryToken = () => {
    const hash = window.location.hash;
    const query = hash.includes('?') ? hash.split('?')[1] : window.location.search.slice(1);
    const params = new URLSearchParams(query);
    return params.get('token');
  };

  const token = getQueryToken();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Password reset failed.');

      setNotice('Password updated successfully! Redirecting to sign in…');
      setTimeout(() => {
        window.location.href = '/signin';
      }, 2200);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0a2e24',
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(32, 95, 70, 0.35) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(10, 46, 36, 0.95) 0%, #061e17 100%)
          `,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}
      >
        <div style={{ maxWidth: '440px', width: '100%', padding: '36px 28px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '24px', boxShadow: '0 20px 48px rgba(0, 0, 0, 0.35)', boxSizing: 'border-box' }}>
          <h2 style={{ color: '#173b2d', margin: '0 0 8px 0' }}>Invalid Reset Link</h2>
          <p style={{ color: '#68796c', fontSize: '0.9rem', margin: '0 0 20px 0' }}>This password reset link is missing a valid token or has expired.</p>
          <a href="/" style={{ color: '#173b2d', fontWeight: 600, textDecoration: 'none' }}>Return to home page →</a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a2e24',
        backgroundImage: `
          radial-gradient(circle at 18% 18%, rgba(32, 95, 70, 0.45) 0%, transparent 45%),
          radial-gradient(circle at 82% 82%, rgba(179, 130, 52, 0.16) 0%, transparent 40%),
          radial-gradient(circle at 50% 50%, rgba(10, 46, 36, 0.9) 0%, #061e17 100%)
        `,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none'
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ marginBottom: '24px' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
              <GraduationCap size={24} />
            </div>
            <div>
              <b style={{ color: '#ffffff', fontSize: '1.15rem', letterSpacing: '0.04em', display: 'block', lineHeight: 1.1 }}>PVGJ</b>
              <small style={{ color: '#9bb8ad', fontSize: '0.68rem', letterSpacing: '0.08em', fontWeight: 600 }}>EDUCATIONAL INSTITUTIONS</small>
            </div>
          </a>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            width: '100%',
            padding: '32px 28px',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            boxSizing: 'border-box'
          }}
        >
          <h1 style={{ fontSize: '1.45rem', color: '#173b2d', margin: '0 0 6px 0', fontWeight: 700 }}>Set New Password</h1>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#68796c' }}>Enter your new strong password below.</p>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: '#fdf2f2', border: '1px solid #f8b4b4', color: '#c62828', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '18px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: '#f3faf4', border: '1px solid #bbf0c8', color: '#2e7d32', borderRadius: '8px', fontSize: '0.84rem', marginBottom: '18px' }}>
              <CheckCircle2 size={16} />
              <span>{notice}</span>
            </div>
          )}

          <PasswordInput
            label="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            showRequirements={true}
            autoComplete="new-password"
          />

          <PasswordInput
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={busy}
            style={{ width: '100%', padding: '13px 0', backgroundColor: '#173b2d', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.94rem', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.75 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '12px' }}
          >
            <span>{busy ? 'Updating Password…' : 'Update Password'}</span>
            <ArrowRight size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}