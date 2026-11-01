import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, Bookmark, BookmarkCheck, BookmarkPlus, BriefcaseBusiness, CalendarDays, CheckCircle2, Filter, GraduationCap, MapPin, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import '../jobs.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ALL = 'All categories';
const PAGE_SIZE = 12;
async function parseResponse(response) { const text = await response.text(); try { return text ? JSON.parse(text) : {}; } catch { return { message: response.status === 429 ? 'The job-alert service is busy. Wait briefly, then refresh.' : 'The PVGJ API returned an unreadable response.' }; } }

const formatDate = (value) => {
  if (!value) return 'Date not provided by feed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date not provided by feed' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function JobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);
  const [page, setPage] = useState(1);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const [savedIds, setSavedIds] = useState([]);
  const [savingJobId, setSavingJobId] = useState('');
  const [trackedIds, setTrackedIds] = useState([]);
  const [trackingJobId, setTrackingJobId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [savedSearchMessage, setSavedSearchMessage] = useState('');
  const [qualification, setQualification] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [alertName, setAlertName] = useState('');
  const [savedAlerts, setSavedAlerts] = useState([]);
  const [alertMessage, setAlertMessage] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('pvgj_job_notifications') === 'true');
  const previousJobIds = useRef(null);

  const loadJobs = useCallback(async ({ refresh = false } = {}) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API}/external-jobs${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' });
      const payload = await parseResponse(response);
      if (!response.ok) throw new Error([payload.message, ...(payload.errors || [])].filter(Boolean).join(' · ') || 'Unable to load job alerts.');
      setJobs(Array.isArray(payload.jobs) ? payload.jobs : []);
      setFetchedAt(payload.fetchedAt || '');
      if (payload.errors?.length) setError(`Some sources could not be refreshed: ${payload.errors.join(' · ')}`);
      if (payload.stale) setError('Live refresh failed. Showing the most recently cached feed data.');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadJobs(); const poll = window.setInterval(() => loadJobs({ refresh: true }), 15 * 60 * 1000); return () => window.clearInterval(poll); }, [loadJobs]);

  useEffect(() => {
    const token = sessionStorage.getItem('pvgj_user_token');
    if (!token) return;
    const headers = { Authorization: 'Bearer ' + token };
    Promise.all([fetch(API + '/auth/saved-jobs', { headers }), fetch(API + '/auth/applications', { headers }), fetch(API + '/learning/alerts', { headers })])
      .then(async ([savedResponse, trackedResponse, alertResponse]) => {
        const [saved, tracked, alertData] = await Promise.all([parseResponse(savedResponse), parseResponse(trackedResponse), parseResponse(alertResponse)]);
        if (savedResponse.ok) setSavedIds((saved.jobs || []).map((job) => job.id));
        if (trackedResponse.ok) setTrackedIds((tracked.applications || []).map((job) => job.id));
        if (alertResponse.ok) setSavedAlerts(alertData.alerts || []);
      }).catch(() => {});
  }, []);

  async function toggleSaved(job) {
    const token = sessionStorage.getItem('pvgj_user_token');
    if (!token) { window.location.assign('/signin'); return; }
    setSavingJobId(job.id);
    try {
      const saved = savedIds.includes(job.id);
      const response = await fetch(saved ? `${API}/auth/saved-jobs/${encodeURIComponent(job.id)}` : `${API}/auth/saved-jobs`, {
        method: saved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(saved ? {} : { body: JSON.stringify({ id: job.id, title: job.title, category: job.category, sourceUrl: job.sourceUrl }) })
      });
      const data = await parseResponse(response); if (!response.ok) throw new Error(data.message || 'Unable to update saved alerts.');
      setSavedIds((items) => saved ? items.filter((id) => id !== job.id) : [...items, job.id]);
      setError(saved ? 'Saved alert removed from your profile.' : 'Job alert saved to your profile.');
    } catch (error) { setError(error.message); }
    finally { setSavingJobId(''); }
  }
  async function trackApplication(job) {
    const token = sessionStorage.getItem('pvgj_user_token');
    if (!token) { window.location.assign('/signin'); return; }
    setTrackingJobId(job.id);
    try {
      const response = await fetch(API + '/auth/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ id: job.id, title: job.title, category: job.category, sourceUrl: job.sourceUrl }) });
      const data = await parseResponse(response); if (!response.ok) throw new Error(data.message || 'Unable to add this job to your tracker.');
      setTrackedIds((items) => items.includes(job.id) ? items : [...items, job.id]); setError('This job is now in your application tracker.');
    } catch (e) { setError(e.message); } finally { setTrackingJobId(''); }
  }
  async function saveSearch(event) {
    event.preventDefault();
    const token = sessionStorage.getItem('pvgj_user_token');
    if (!token) { window.location.assign('/signin'); return; }
    setSavedSearchMessage('');
    try {
      const response = await fetch(API + '/auth/saved-searches', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ name: searchName, keywords: query, category: category === ALL ? '' : category }) });
      const data = await parseResponse(response); if (!response.ok) throw new Error(data.message || 'Unable to save this search.');
      setSavedSearchMessage('Search saved to your learner profile.'); setSearchName('');
    } catch (e) { setSavedSearchMessage(e.message); }
  }

  const matchesAlert = (job, alert) => { const text = [job.title, job.description, job.category, job.source].map((value) => String(value || '').toLowerCase()).join(' '); return ['keywords','qualification','location','jobType'].every((key) => !alert[key] || text.includes(String(alert[key]).toLowerCase())) && (!alert.category || String(job.category || '').toLowerCase().includes(String(alert.category).toLowerCase())); };

  useEffect(() => {
    if (!jobs.length) return;
    const ids = jobs.map((job) => job.id);
    if (previousJobIds.current === null) { previousJobIds.current = ids; return; }
    const fresh = jobs.filter((job) => !previousJobIds.current.includes(job.id));
    previousJobIds.current = ids;
    if (!notificationsEnabled || !savedAlerts.length || !('Notification' in window) || Notification.permission !== 'granted') return;
    const match = fresh.find((job) => savedAlerts.some((alert) => alert.reminderEnabled && matchesAlert(job, alert)));
    if (match) { const notification = new Notification('PVGJ job alert', { body: match.title, icon: '/pvgj-logo.png' }); notification.onclick = () => { window.focus(); window.location.assign('/jobs/' + encodeURIComponent(match.id)); }; }
  }, [jobs, savedAlerts, notificationsEnabled]);

  async function saveAdvancedAlert(event) {
    event.preventDefault(); const token = sessionStorage.getItem('pvgj_user_token');
    if (!token) { window.location.assign('/signin'); return; }
    try { const response = await fetch(API + '/learning/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ name: alertName, keywords: query, category: category === ALL ? '' : category, qualification, location, jobType, reminderEnabled: true }) }); const data = await parseResponse(response); if (!response.ok) throw new Error(data.message || 'Unable to save this alert.'); setSavedAlerts((old) => [{ id: data.id, name: alertName, keywords: query, category: category === ALL ? '' : category, qualification, location, jobType, reminderEnabled: true }, ...old]); setAlertName(''); setAlertMessage('Alert saved. We will check for matches every 15 minutes while this page is open.'); } catch (e) { setAlertMessage(e.message); }
  }
  async function deleteAlert(id) { const token = sessionStorage.getItem('pvgj_user_token'); try { const response = await fetch(API + '/learning/alerts/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } }); const data = await parseResponse(response); if (!response.ok) throw new Error(data.message || 'Unable to remove alert.'); setSavedAlerts((old) => old.filter((alert) => alert.id !== id)); } catch (e) { setAlertMessage(e.message); } }
  function applyAlert(alert) { setQuery(alert.keywords || ''); setCategory(alert.category || ALL); setQualification(alert.qualification || ''); setLocation(alert.location || ''); setJobType(alert.jobType || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  async function enableNotifications() { if (!('Notification' in window)) { setAlertMessage('This browser does not support desktop notifications.'); return; } const permission = await Notification.requestPermission(); const enabled = permission === 'granted'; setNotificationsEnabled(enabled); localStorage.setItem('pvgj_job_notifications', String(enabled)); setAlertMessage(enabled ? 'Browser notifications are enabled on this device.' : 'Notification permission was not granted.'); }

  const categories = useMemo(() => [ALL, ...new Set(jobs.map((job) => job.category || 'Other Government & Public Jobs').filter(Boolean))].sort((a, b) => a === ALL ? -1 : b === ALL ? 1 : a.localeCompare(b)), [jobs]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qualificationText = qualification.trim().toLowerCase(), locationText = location.trim().toLowerCase(), typeText = jobType.trim().toLowerCase();
    return jobs.filter((job) => { const text = [job.title, job.description, job.category, job.source].map((value) => String(value || "").toLowerCase()).join(" "); return (category === ALL || job.category === category) && (!q || text.includes(q)) && (!qualificationText || text.includes(qualificationText)) && (!locationText || text.includes(locationText)) && (!typeText || text.includes(typeText)); });
  }, [jobs, query, category, qualification, location, jobType]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageJobs = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) : null;

  useEffect(() => {
    if (!selectedJob) return;
    let active = true;
    setDetail(null); setDetailError(''); setDetailLoading(true);
    fetch(`${API}/external-jobs/${encodeURIComponent(selectedJob.id)}`)
      .then(async (response) => { const data = await parseResponse(response); if (!response.ok) throw new Error(data.message || 'Unable to load this job notification.'); return data; })
      .then((data) => { if (active) setDetail(data); })
      .catch((error) => { if (active) setDetailError(error.message); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedJob?.id, detailRetry]);

  useEffect(() => { setPage(1); }, [category, query, qualification, location, jobType]);
  useEffect(() => {
    const match = window.location.pathname.match(/^\/jobs\/([^/]+)\/?$/);
    if (match) setSelectedJobId(decodeURIComponent(match[1]));
    else setSelectedJobId('');
    const params = new URLSearchParams(window.location.search);
    if (params.has('q')) setQuery(params.get('q') || '');
    if (params.has('category')) setCategory(params.get('category') || ALL);
  }, []);

  const openJob = (job) => {
    setSelectedJobId(job.id);
    window.history.pushState({}, '', `/jobs/${encodeURIComponent(job.id)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const backToList = () => {
    setSelectedJobId('');
    window.history.pushState({}, '', '/jobs');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onPopState = () => {
      const match = window.location.pathname.match(/^\/jobs\/([^/]+)\/?$/);
      setSelectedJobId(match ? decodeURIComponent(match[1]) : '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return <main id="main-content" className="pvgj-jobs-page">
    <div className="jobs-topbar">
      <a className="jobs-brand" href="/"><span className="jobs-brand-mark">P</span><span><b>PVGJ</b><small>EDUCATIONAL INSTITUTIONS</small></span></a>
      <div className="jobs-top-links"><a href="/learn">Learning hub</a><a href="/" className="jobs-home-link">Back to home <ArrowRight size={16}/></a></div>
    </div>

    <section className="jobs-hero">
      <div className="jobs-hero-orb" />
      <span className="jobs-eyebrow"><BriefcaseBusiness size={15}/> CAREER OPPORTUNITIES</span>
      <h1>{selectedJob ? 'Job alert details' : 'Find your next opportunity.'}</h1>
      <p>Explore recruitment alerts in one place. Filter by category, search the feed, and refresh to request the latest available posts.</p>
      <div className="jobs-hero-bottom"><span><ShieldCheck size={16}/> New recruitment updates, together in one place</span><span>{jobs.length} feed entries loaded</span></div>
    </section>

    {selectedJob ? <section className="jobs-detail-wrap">
      <button className="jobs-back-button" onClick={backToList}><ArrowLeft size={16}/> All job alerts</button>
      <article className="jobs-detail-card">
        <div className="jobs-card-meta"><span className="jobs-category-pill">{selectedJob.category}</span><span><CalendarDays size={14}/> {formatDate(selectedJob.publishedAt)}</span></div>
        <h2>{selectedJob.title}</h2>
        <p className="jobs-detail-source">Recruitment details</p>
        <div className="jobs-full-description">{detailLoading ? <div className="jobs-detail-loading"><RefreshCw className="jobs-spinning" size={20}/> Loading the full recruitment notification…</div> : detailError ? <div className="jobs-detail-error" role="alert"><b>Full details are temporarily unavailable.</b><p>{detailError}</p><p>{selectedJob.description || 'Please refresh the job list and try again.'}</p><button onClick={() => setDetailRetry((attempt) => attempt + 1)}>Try loading again</button></div> : detail?.contentHtml ? <div className="jobs-article-content" dangerouslySetInnerHTML={{ __html: detail.contentHtml }} /> : <p>{selectedJob.description || 'Full notification details are not available in the feed yet.'}</p>}</div>
        <div className="jobs-source-note"><CheckCircle2 size={18}/><p>The job notification is displayed here on PVGJ. Verify eligibility, dates, and application requirements with the recruiting organisation before applying.</p></div>
      </article>
    </section> : <section className="jobs-list-section">
      <div className="jobs-controls-heading"><div><span className="jobs-section-kicker">THE LATEST LISTINGS</span><h2>Job alerts, organized.</h2><p>Search by title, category, qualification, location, or job type. Save filters for updates.</p></div>
        <button className="jobs-refresh-button" onClick={() => loadJobs({ refresh: true })} disabled={refreshing}><RefreshCw size={17} className={refreshing ? 'jobs-spinning' : ''}/>{refreshing ? 'Refreshing…' : 'Refresh live data'}</button>
      </div>
      <div className="jobs-search-row"><label className="jobs-search-box"><Search size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search job title, department, or keyword..."/></label><label className="jobs-category-select"><Filter size={17}/><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
      <div className="jobs-advanced-filters"><label><GraduationCap size={16}/><input value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="Qualification (e.g. graduate)" aria-label="Filter by qualification"/></label><label><MapPin size={16}/><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location or state" aria-label="Filter by location"/></label><label><BriefcaseBusiness size={16}/><input value={jobType} onChange={(e) => setJobType(e.target.value)} placeholder="Job type (e.g. internship)" aria-label="Filter by job type"/></label></div>
      <form className="jobs-save-search-form" onSubmit={saveSearch}><span><BookmarkPlus size={17}/><b>Keep this search</b><small>Reopen your filters from your profile.</small></span><input aria-label="Saved search name" value={searchName} onChange={(e) => setSearchName(e.target.value)} placeholder="Name this search" maxLength="120" required disabled={!query.trim() && category === ALL}/><button type="submit" disabled={!query.trim() && category === ALL}>Save search</button>{savedSearchMessage && <small role="status">{savedSearchMessage}</small>}</form>
      <form className="jobs-alert-form" onSubmit={saveAdvancedAlert}><span><Bell size={17}/><b>Get matches for this filter</b><small>Checks for new matches every 15 minutes while this page is open.</small></span><input aria-label="Alert name" required maxLength="120" value={alertName} onChange={(e) => setAlertName(e.target.value)} placeholder="Name this alert"/><button type="submit">Save alert</button><button className="jobs-notification-button" type="button" onClick={enableNotifications}><Bell size={15}/>{notificationsEnabled ? 'Notifications on' : 'Enable notifications'}</button></form>
      {alertMessage && <div className="jobs-alert-message" role="status">{alertMessage}</div>}
      {savedAlerts.length > 0 && <div className="jobs-saved-alerts"><b>Saved alerts</b>{savedAlerts.map((alert) => <article key={alert.id}><span><strong>{alert.name}</strong><small>{[alert.keywords, alert.category, alert.qualification, alert.location, alert.jobType].filter(Boolean).join(' · ')}</small></span><button type="button" onClick={() => applyAlert(alert)}>Apply</button><button type="button" aria-label={'Delete '+alert.name} onClick={() => deleteAlert(alert.id)}><Trash2 size={14}/></button></article>)}</div>}      <div className="jobs-feed-status"><span>{filtered.length} matching alerts</span><span>{fetchedAt ? `Feed checked ${new Date(fetchedAt).toLocaleString('en-IN')}` : 'Feed time not available'}</span></div>
      {error && <div className="jobs-error" role="status">{error}</div>}
      {loading ? <div className="jobs-empty"><RefreshCw className="jobs-spinning"/><p>Loading job alerts…</p></div> : pageJobs.length ? <div className="jobs-grid">{pageJobs.map((job) => <article className="jobs-card" key={job.id}>
        <div className="jobs-card-meta"><span className="jobs-category-pill">{job.category}</span><span><CalendarDays size={13}/>{formatDate(job.publishedAt)}</span></div>
        <h3>{job.title}</h3>
        <p className="jobs-description">{job.description || 'Open this alert to see vacancies, eligibility, key dates, and application instructions.'}</p>
        <div className="jobs-card-footer"><button onClick={() => toggleSaved(job)} className="jobs-save-button" disabled={savingJobId === job.id} title={savedIds.includes(job.id) ? "Remove saved alert" : "Save to profile"}>{savedIds.includes(job.id) ? <BookmarkCheck size={16}/> : <Bookmark size={16}/>}<span>{savingJobId === job.id ? "Saving…" : savedIds.includes(job.id) ? "Saved" : "Save"}</span></button><button onClick={() => trackApplication(job)} className="jobs-track-button" disabled={trackingJobId === job.id || trackedIds.includes(job.id)} title="Add to application tracker"><span>{trackedIds.includes(job.id) ? "Tracking" : trackingJobId === job.id ? "Adding..." : "Track"}</span></button><button onClick={() => openJob(job)} className="jobs-view-button">View details <ArrowRight size={15}/></button></div>
      </article>)}</div> : <div className="jobs-empty"><BriefcaseBusiness size={28}/><h3>No matching job alerts</h3><p>Try another keyword or category, or refresh the feed.</p><button onClick={() => { setQuery(''); setCategory(ALL); loadJobs({ refresh: true }); }}>Clear filters & refresh</button></div>}
      {pageCount > 1 && <nav className="jobs-pagination" aria-label="Job alert pages"><button disabled={page <= 1} onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 450, behavior: 'smooth' }); }}><ArrowLeft size={16}/> Previous</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 450, behavior: 'smooth' }); }}>Next <ArrowRight size={16}/></button></nav>}
      <p className="jobs-legal-note">Job cards and detail pages stay on PVGJ. Details shown here are limited to information available in the feed; verify application requirements against the official recruitment notification before applying.</p>
    </section>}
    <footer className="jobs-footer"><span>© {new Date().getFullYear()} PVGJ Educational Institutions</span><span>Learn with purpose. Move forward with confidence.</span></footer>
  </main>;
}




