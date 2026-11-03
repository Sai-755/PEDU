import { useState } from 'react';
import { GraduationCap, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Unable to request password reset.');

      setNotice(data.message || 'If an account exists, a reset link has been dispatched to your email.');
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a2e24',
        backgroundImage: `
          radial-gradient(circle at 20% 20%, rgba(32, 95, 70, 0.45) 0%, transparent 45%),
          radial-gradient(circle at 80% 80%, rgba(179, 130, 52, 0.16) 0%, transparent 40%),
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
          <h1 style={{ fontSize: '1.45rem', color: '#173b2d', margin: '0 0 6px 0', fontWeight: 700 }}>Reset Password</h1>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.88rem', color: '#68796c' }}>
            Enter your registered email address to receive a secure password reset link.
          </p>

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

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.84rem', fontWeight: 600, color: '#173b2d' }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid #dde3da', fontSize: '0.92rem', outline: 'none', color: '#173b2d' }}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{ width: '100%', padding: '13px 0', backgroundColor: '#173b2d', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, fontSize: '0.94rem', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.75 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <span>{busy ? 'Sending link…' : 'Send Reset Link'}</span>
            <ArrowRight size={15} />
          </button>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <a href="/signin" style={{ color: '#173b2d', fontSize: '0.84rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <ArrowLeft size={14} /> Back to Sign in
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}