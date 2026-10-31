import { useEffect, useState } from 'react';
import { ArrowRight, Bookmark, BookOpen, BriefcaseBusiness, CalendarDays, CheckCircle2, Compass, FileText, GraduationCap, LogOut, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import './profile.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'pvgj_user_token';
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently';

export default function ProfilePage() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState(null);
  const [savedJobs, setSavedJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!token) { window.location.replace('/signin'); return; }
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([fetch(API + '/auth/me', { headers }), fetch(API + '/auth/saved-jobs', { headers }), fetch(API + '/auth/applications', { headers }), fetch(API + '/auth/saved-searches', { headers })])
      .then(async ([profileResponse, jobsResponse, applicationsResponse, searchesResponse]) => {
        const profileData = await profileResponse.json();
        if (profileResponse.status === 401) throw new Error('SESSION_EXPIRED');
        if (!profileResponse.ok) throw new Error(profileData.message || 'Unable to load your profile.');
        const jobsData = await jobsResponse.json();
        const applicationsData = applicationsResponse.ok ? await applicationsResponse.json() : { applications: [] };
        const searchesData = searchesResponse.ok ? await searchesResponse.json() : { searches: [] };
        if (!jobsResponse.ok) throw new Error(jobsData.message || 'Unable to load saved job alerts.');
        if (active) { setUser(profileData.user); setName(profileData.user.name); setSavedJobs(jobsData.jobs || []); setApplications(applicationsData.applications || []); setSavedSearches(searchesData.searches || []); }
      })
      .catch((err) => {
        if (!active) return;
        if (err.message === 'SESSION_EXPIRED') { sessionStorage.removeItem(TOKEN_KEY); window.location.replace('/signin'); }
        else setError(err.message || 'Unable to load your profile.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function saveProfile(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${API}/auth/me`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ name }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to update profile.');
      setUser(data.user); setName(data.user.name); setNotice('Your profile has been updated.');
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function removeSaved(jobId) {
    setError('');
    try {
      const response = await fetch(`${API}/auth/saved-jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to remove this saved alert.');
      setSavedJobs((items) => items.filter((job) => job.id !== jobId)); setNotice('Saved alert removed.');
    } catch (err) { setError(err.message); }
  }

  async function updateApplication(jobId, values) {
    setError('');
    try { const response = await fetch(API + '/auth/applications/' + encodeURIComponent(jobId), { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(values) }); const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to update this application.'); setApplications((items) => items.map((item) => item.id === jobId ? { ...item, ...values } : item)); setNotice('Application tracker updated.'); }
    catch (err) { setError(err.message); }
  }
  async function removeApplication(jobId) {
    try { const response = await fetch(API + '/auth/applications/' + encodeURIComponent(jobId), { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to remove this application.'); setApplications((items) => items.filter((item) => item.id !== jobId)); setNotice('Job removed from your application tracker.'); }
    catch (err) { setError(err.message); }
  }
  async function removeSearch(searchId) {
    try { const response = await fetch(API + '/auth/saved-searches/' + encodeURIComponent(searchId), { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); const data = await response.json(); if (!response.ok) throw new Error(data.message || 'Unable to remove this saved search.'); setSavedSearches((items) => items.filter((item) => item.id !== searchId)); setNotice('Saved search removed.'); }
    catch (err) { setError(err.message); }
  }
  function logout() { sessionStorage.removeItem(TOKEN_KEY); window.location.assign('/'); }

  return <main className="profile-page"><header className="profile-top"><a className="profile-brand" href="/"><span><GraduationCap size={22}/></span><b>PVGJ</b><small>LEARNER SPACE</small></a><nav><a href="/jobs">Job alerts</a><a href="/about">About PVGJ</a><button onClick={logout}><LogOut size={15}/> Sign out</button></nav></header>
    <section className="profile-hero"><div className="profile-hero-inner"><div><span className="profile-eyebrow"><Sparkles size={14}/> YOUR PVGJ PROFILE</span><h1>Your progress starts<br/><em>with a next step.</em></h1><p>Keep your learning resources and saved opportunities close at hand.</p></div><div className="profile-avatar"><UserRound size={38}/></div></div></section>
    <div className="profile-content">{error && <div className="profile-alert profile-alert-error" role="alert">{error}</div>}{notice && <div className="profile-alert" role="status"><CheckCircle2 size={16}/>{notice}</div>}
      {loading ? <div className="profile-loading">Loading your learner profile…</div> : <>
        <section className="profile-summary"><div className="profile-summary-person"><div className="profile-round-icon"><UserRound size={21}/></div><div><h2>{user?.name || 'Learner'}</h2><p>{user?.email}</p></div><span className="verified-badge"><ShieldCheck size={15}/> Learner account</span></div><div className="profile-stats"><div><Bookmark size={17}/><b>{savedJobs.length}</b><span>Saved alerts</span></div><div><CalendarDays size={17}/><b>{dateLabel(user?.created_at)}</b><span>Member since</span></div></div></section>
        <div className="profile-columns"><section className="profile-panel"><div className="profile-panel-heading"><span className="profile-panel-icon"><UserRound size={18}/></span><div><h3>Profile details</h3><p>Keep your learner information up to date.</p></div></div><form className="profile-edit-form" onSubmit={saveProfile}><label>Display name<input value={name} onChange={(e) => setName(e.target.value)} minLength="2" maxLength="120" required/></label><label>Email address<div className="profile-email-value">{user?.email}<span>Sign-in email</span></div></label><button className="profile-primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'} <ArrowRight size={16}/></button></form></section>
        <section className="profile-panel profile-shortcuts"><div className="profile-panel-heading"><span className="profile-panel-icon profile-icon-gold"><Compass size={18}/></span><div><h3>Keep moving forward</h3><p>A few good places to go next.</p></div></div><a href="/#services"><BookOpen size={18}/><span><b>Explore learning</b><small>Skills, study materials and exam prep</small></span><ArrowRight size={16}/></a><a href="/jobs"><BriefcaseBusiness size={18}/><span><b>Find opportunities</b><small>Browse the latest job alerts</small></span><ArrowRight size={16}/></a></section></div>
        <section className="profile-panel saved-panel"><div className="profile-panel-heading"><span className="profile-panel-icon profile-icon-gold"><Bookmark size={18}/></span><div><h3>Saved job alerts</h3><p>Keep track of opportunities you want to revisit.</p></div><a className="profile-text-link" href="/jobs">Browse alerts <ArrowRight size={15}/></a></div>{savedJobs.length ? <div className="saved-jobs-list">{savedJobs.map((job) => <article className="saved-job-row" key={job.id}><span className="saved-job-mark"><BriefcaseBusiness size={17}/></span><div><b>{job.title}</b><small>{job.category || 'Job alert'} · Saved {dateLabel(job.savedAt)}</small></div><a className="saved-open" href={`/jobs/${encodeURIComponent(job.id)}`}>View <ArrowRight size={14}/></a><button className="saved-remove" onClick={() => removeSaved(job.id)} aria-label={`Remove ${job.title} from saved alerts`}>Remove</button></article>)}</div> : <div className="saved-empty"><Bookmark size={23}/><b>No saved job alerts yet</b><p>Save an alert from the job page and it will appear here.</p><a href="/jobs">Explore job alerts <ArrowRight size={15}/></a></div>}</section>
        <section className="profile-panel saved-panel"><div className="profile-panel-heading"><span className="profile-panel-icon"><FileText size={18}/></span><div><h3>Application tracker</h3><p>Update your progress and keep notes for each opportunity.</p></div><span className="profile-panel-count">{applications.length} tracked</span></div>{applications.length ? <div className="application-tracker-list">{applications.map((job) => <article className="application-tracker-row" key={job.id}><div className="application-tracker-title"><BriefcaseBusiness size={17}/><span><b>{job.title}</b><small>{job.category || 'Job alert'} - Updated {dateLabel(job.updatedAt)}</small></span><a href={'/jobs/' + encodeURIComponent(job.id)}>Details</a></div><div className="application-tracker-controls"><label>Stage<select value={job.status} onChange={(e) => updateApplication(job.id, { status: e.target.value })}>{['Interested','Applied','Interview','Offer','Rejected'].map((status) => <option key={status}>{status}</option>)}</select></label><label className="application-notes">Notes<textarea value={job.notes || ''} maxLength="2000" placeholder="Add a reminder or interview note..." onChange={(e) => setApplications((items) => items.map((item) => item.id === job.id ? { ...item, notes: e.target.value } : item))} onBlur={(e) => updateApplication(job.id, { notes: e.target.value })}/></label><button className="saved-remove" onClick={() => removeApplication(job.id)}>Remove</button></div></article>)}</div> : <div className="saved-empty"><FileText size={23}/><b>Your tracker is ready</b><p>Add a job from the Job Alerts page to track your next step.</p><a href="/jobs">Browse jobs <ArrowRight size={15}/></a></div>}</section>
        <section className="profile-panel saved-panel"><div className="profile-panel-heading"><span className="profile-panel-icon profile-icon-gold"><Bookmark size={18}/></span><div><h3>Saved searches</h3><p>Quickly reopen your search filters for current job listings.</p></div></div>{savedSearches.length ? <div className="saved-search-list">{savedSearches.map((search) => { const params = new URLSearchParams(); if (search.keywords) params.set('q', search.keywords); if (search.category) params.set('category', search.category); return <article className="saved-search-row" key={search.id}><span><b>{search.name}</b><small>{[search.keywords, search.category].filter(Boolean).join(' | ')}</small></span><a href={'/jobs?' + params.toString()}>Open search <ArrowRight size={14}/></a><button className="saved-remove" onClick={() => removeSearch(search.id)}>Remove</button></article>; })}</div> : <div className="saved-empty"><Bookmark size={23}/><b>No saved searches yet</b><p>Save a keyword or category filter from Job Alerts.</p><a href="/jobs">Find a job search <ArrowRight size={15}/></a></div>}</section>
      </>}
    </div><footer className="profile-footer"><span>© {new Date().getFullYear()} PVGJ Educational Institutions</span><span>Learn • Prepare • Progress</span></footer>
  </main>;
}

