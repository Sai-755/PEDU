import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, BriefcaseBusiness, CheckCircle2, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';
import './auth.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const tokenKey = 'pvgj_user_token';

export default function AuthPage() {
  const [mode, setMode] = useState(window.location.pathname === '/signup' ? 'signup' : 'login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem(tokenKey);
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => { if (response.ok) window.location.replace('/account'); else sessionStorage.removeItem(tokenKey); })
      .catch(() => sessionStorage.removeItem(tokenKey));
  }, []);

  async function submitAccount(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to continue.');
      sessionStorage.setItem(tokenKey, data.token);
      window.location.assign('/account');
    } catch (err) { setError(err.message || 'The account service is unavailable.'); }
    finally { setBusy(false); }
  }

  return <main className="account-page">
    <header className="account-top"><a className="account-brand" href="/"><span><GraduationCap size={22}/></span><b>PVGJ</b><small>EDUCATIONAL INSTITUTIONS</small></a><a href="/">Back to website <ArrowRight size={15}/></a></header>
    <div className="account-layout">
      <section className="account-story"><div className="account-story-label"><Sparkles size={15}/> YOUR NEXT CHAPTER STARTS HERE</div><h1>Make room for<br/><em>what's possible.</em></h1><p>Build a learning habit, discover opportunities, and get guidance for the path ahead.</p><div className="account-points"><span><CheckCircle2 size={17}/> A learning space made for your goals</span><span><CheckCircle2 size={17}/> Useful resources and career updates</span><span><CheckCircle2 size={17}/> Your account, ready when you are</span></div><div className="story-orbit"><div className="orbit-ring"></div><div className="orbit-cap"><GraduationCap size={50}/><b>PVGJ</b></div><span className="orbit-badge orbit-books"><BookOpen size={18}/></span><span className="orbit-badge orbit-jobs"><BriefcaseBusiness size={18}/></span></div></section>
      <section className="account-card"><div className="account-card-icon"><ShieldCheck size={21}/></div><p className="account-kicker">PVGJ LEARNER ACCOUNT</p><h2>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2><p className="account-subtitle">{mode === 'signup' ? 'Create your account to start your learning journey.' : 'Sign in to continue your learning journey.'}</p>
        <div className="account-tabs"><button className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); }} type="button">Sign in</button><button className={mode === 'signup' ? 'selected' : ''} onClick={() => { setMode('signup'); setError(''); }} type="button">Create account</button></div>
        <form className="account-form" onSubmit={submitAccount}>{mode === 'signup' && <label>Your name<input autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="How should we address you?" required minLength="2" maxLength="120"/></label>}<label>Email address<input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" required maxLength="254"/></label><label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'} required minLength={mode === 'signup' ? 8 : undefined} maxLength="128"/></label>{error && <div className="account-error" role="alert">{error}</div>}<button className="account-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create my account' : 'Sign in'} <ArrowRight size={17}/></button></form><p className="account-terms">Sign in securely with your email address and password.</p>
      </section>
    </div><footer className="account-footer">© {new Date().getFullYear()} PVGJ Educational Institutions <span>Learn • Prepare • Progress</span></footer>
  </main>;
}
