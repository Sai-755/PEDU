import { useState, useMemo } from 'react';
import { 
  GraduationCap, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Sparkles,
  ArrowLeft
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function AuthPage() {
  const initialMode = window.location.pathname === '/signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'forgot'
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setNotice('');
    setShowPassword(false);
    if (newMode === 'signup') {
      window.history.pushState(null, '', '/signup');
    } else if (newMode === 'signin') {
      window.history.pushState(null, '', '/signin');
    }
  };

  const passwordCriteria = useMemo(() => [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(password) },
    { label: 'One number (0-9)', met: /\d/.test(password) },
    { label: 'One special character (!@#$%^&*)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) }
  ], [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (mode === 'forgot') {
        const res = await fetch(`${API}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Unable to request password reset.');
        setNotice(data.message || 'If an account exists, a reset link has been dispatched to your email.');
        return;
      }

      const endpoint = mode === 'signup' ? '/auth/register' : '/auth/login';
      const payload = mode === 'signup' ? { name, email, password } : { email, password };

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Authentication request failed.');

      if (mode === 'signup') {
        setNotice('Registration successful! Please sign in with your credentials.');
        switchMode('signin');
        setPassword('');
      } else {
        sessionStorage.setItem('pvgj_user_token', data.token);
        if (data.user) {
          sessionStorage.setItem('pvgj_user_profile', JSON.stringify(data.user));
        }
        window.location.href = '/account';
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#0a2e24',
        backgroundImage: `
          radial-gradient(circle at 18% 15%, rgba(32, 95, 70, 0.45) 0%, transparent 45%),
          radial-gradient(circle at 82% 80%, rgba(179, 130, 52, 0.18) 0%, transparent 40%),
          radial-gradient(circle at 50% 50%, rgba(10, 46, 36, 0.9) 0%, #061e17 100%)
        `,
        minHeight: '100vh',
        padding: '24px 20px 60px',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Subtle Ambient Decorative Lines */}
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

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Top Header */}
        <header style={{ maxWidth: '480px', margin: '0 auto 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.12)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
              <GraduationCap size={24} />
            </div>
            <div>
              <b style={{ color: '#ffffff', fontSize: '1.15rem', letterSpacing: '0.04em', display: 'block', lineHeight: 1.1 }}>PVGJ</b>
              <small style={{ color: '#9bb8ad', fontSize: '0.68rem', letterSpacing: '0.08em', fontWeight: 600 }}>EDUCATIONAL INSTITUTIONS</small>
            </div>
          </a>
          <a href="/" style={{ color: '#e5f0ea', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.9 }}>
            Back to website <ArrowRight size={14} />
          </a>
        </header>

        {/* Hero Headline Section */}
        <div style={{ maxWidth: '480px', margin: '0 auto 28px' }}>
          <p style={{ color: '#e4b665', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE
          </p>
          <h1 style={{ color: '#ffffff', fontSize: '2.5rem', lineHeight: '1.12', margin: '0 0 16px 0', fontFamily: 'serif', fontWeight: 600 }}>
            Make room for<br />
            <span style={{ color: '#e4b665', fontStyle: 'italic', fontWeight: 400 }}>what’s possible.</span>
          </h1>
          <p style={{ color: '#c4dbcf', fontSize: '0.92rem', lineHeight: '1.5', margin: '0 0 20px 0' }}>
            Build a learning habit, discover opportunities, and get guidance for the path ahead.
          </p>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e0ece5', fontSize: '0.88rem' }}>
              <CheckCircle2 size={17} style={{ color: '#7fd49b' }} /> A learning space made for your goals
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e0ece5', fontSize: '0.88rem' }}>
              <CheckCircle2 size={17} style={{ color: '#7fd49b' }} /> Useful resources and career updates
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e0ece5', fontSize: '0.88rem' }}>
              <CheckCircle2 size={17} style={{ color: '#7fd49b' }} /> Your account, ready when you are
            </li>
          </ul>
        </div>

        {/* Auth Card */}
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '32px 28px',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08)',
            boxSizing: 'border-box'
          }}
        >
          {/* Shield Icon Badge */}
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#eef5f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#173b2d', marginBottom: '16px' }}>
            <ShieldCheck size={22} />
          </div>

          <small style={{ color: '#7a8c7e', fontSize: '0.72rem', letterSpacing: '0.1em', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
            PVGJ LEARNER ACCOUNT
          </small>

          <h2 style={{ color: '#173b2d', fontSize: '1.65rem', margin: '0 0 6px 0', fontWeight: 700 }}>
            {mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Welcome back'}
          </h2>
          <p style={{ color: '#68796c', fontSize: '0.88rem', margin: '0 0 22px 0' }}>
            {mode === 'signup' 
              ? 'Create your account to start your learning journey.' 
              : mode === 'forgot' 
              ? 'Enter your registered email and we will send you a reset link.' 
              : 'Sign in to continue your learning journey.'}
          </p>

          {/* Feedback Messages */}
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

          {/* Segmented Pill Toggle */}
          {mode !== 'forgot' && (
            <div style={{ display: 'flex', backgroundColor: '#f4f6f2', borderRadius: '12px', padding: '4px', marginBottom: '24px' }}>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: mode === 'signin' ? '#ffffff' : 'transparent',
                  color: mode === 'signin' ? '#173b2d' : '#697a6d',
                  boxShadow: mode === 'signin' ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: mode === 'signup' ? '#ffffff' : 'transparent',
                  color: mode === 'signup' ? '#173b2d' : '#697a6d',
                  boxShadow: mode === 'signup' ? '0 2px 6px rgba(0, 0, 0, 0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Create account
              </button>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', color: '#173b2d', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                  Your name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="How should we address you?"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #dde3da',
                    fontSize: '0.92rem',
                    outline: 'none',
                    color: '#173b2d'
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', color: '#173b2d', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                Email address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #dde3da',
                  fontSize: '0.92rem',
                  outline: 'none',
                  color: '#173b2d'
                }}
              />
            </div>

            {mode !== 'forgot' && (
              <div style={{ marginBottom: mode === 'signin' ? '12px' : '18px' }}>
                <label style={{ display: 'block', color: '#173b2d', fontSize: '0.84rem', fontWeight: 600, marginBottom: '6px' }}>
                  Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 42px 12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #dde3da',
                      fontSize: '0.92rem',
                      outline: 'none',
                      color: '#173b2d'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#697a6d',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Password Criteria Checklist */}
                {mode === 'signup' && password.length > 0 && (
                  <div style={{ marginTop: '10px', padding: '10px 14px', backgroundColor: '#f7faf7', borderRadius: '10px', border: '1px solid #e1ebe3' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '0.74rem', fontWeight: 700, color: '#173b2d' }}>Password requirements:</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.74rem', lineHeight: '1.5' }}>
                      {passwordCriteria.map((c, i) => (
                        <li key={i} style={{ color: c.met ? '#2e7d32' : '#c62828', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{c.met ? '✓' : '•'}</span> {c.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Forgot Password Link */}
            {mode === 'signin' && (
              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  style={{ background: 'none', border: 'none', color: '#173b2d', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                padding: '13px 0',
                backgroundColor: '#173b2d',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '0.94rem',
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.75 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: mode === 'forgot' ? '12px' : 0
              }}
            >
              <span>
                {busy 
                  ? 'Processing…' 
                  : mode === 'signup' 
                  ? 'Create account' 
                  : mode === 'forgot' 
                  ? 'Send reset link' 
                  : 'Sign in'}
              </span>
              <ArrowRight size={15} />
            </button>
          </form>

          {mode === 'forgot' && (
            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              <button
                type="button"
                onClick={() => switchMode('signin')}
                style={{ background: 'none', border: 'none', color: '#173b2d', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <ArrowLeft size={14} /> Back to Sign in
              </button>
            </div>
          )}

          <p style={{ textAlign: 'center', margin: '20px 0 0 0', color: '#7a8c7e', fontSize: '0.76rem' }}>
            {mode === 'signup' 
              ? 'By creating an account, you agree to our learning guidelines.' 
              : mode === 'forgot' 
              ? 'We will send a 60-minute password reset link to this address.' 
              : 'Sign in securely with your email address and password.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function VerifyEmailPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a2e24',
        backgroundImage: `
          radial-gradient(circle at 50% 30%, rgba(32, 95, 70, 0.4) 0%, transparent 50%),
          radial-gradient(circle at 50% 50%, rgba(10, 46, 36, 0.95) 0%, #061e17 100%)
        `,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div style={{ maxWidth: '440px', width: '100%', backgroundColor: '#fff', borderRadius: '24px', padding: '36px', textAlign: 'center', border: '1px solid #e1e8df', boxShadow: '0 20px 48px rgba(0, 0, 0, 0.35)' }}>
        <h2 style={{ color: '#173b2d', marginBottom: '8px' }}>Email Verification</h2>
        <p style={{ color: '#68796c', fontSize: '0.9rem', marginBottom: '20px' }}>Your verification link is being processed.</p>
        <a href="/signin" style={{ color: '#173b2d', fontWeight: 600, textDecoration: 'none' }}>Continue to Sign in →</a>
      </div>
    </div>
  );
}