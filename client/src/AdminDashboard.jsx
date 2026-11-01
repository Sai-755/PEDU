import { useCallback, useEffect, useMemo, useState } from 'react';
import { GraduationCap, LayoutDashboard, Inbox, BookOpen, BriefcaseBusiness, Layers3, LogOut, Plus, Search, Trash2, Pencil, RefreshCw, ExternalLink, X, CheckCircle2, Newspaper, Users, ScrollText, Upload } from 'lucide-react';
import './admin.css';
import AdminCoursesPanel from './AdminCoursesPanel.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const EMPTY = { kind: 'service', title: '', description: '', category: '', organization: '', officialUrl: '', lastDate: '', fileUrl: '', publishAt: '', isPublished: true };
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'enquiries', label: 'Guidance enquiries', icon: Inbox },
  { id: 'service', label: 'Services', icon: Layers3 },
  { id: 'resource', label: 'Study materials', icon: BookOpen },
  { id: 'job', label: 'Job alerts', icon: BriefcaseBusiness },
  { id: 'affair', label: 'Current affairs', icon: Newspaper },
  { id: 'learners', label: 'Learners', icon: Users },
  { id: 'audit', label: 'Audit log', icon: ScrollText }
];
const LABELS = { service: 'Services', resource: 'Study materials', job: 'Job alerts', affair: 'Current affairs' };

export default function AdminDashboard() {
  const [token, setToken] = useState(() => sessionStorage.getItem('pvgj_admin_token') || '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState({});
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [courseService, setCourseService] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  }, [token]);

  const logout = useCallback(() => {
    sessionStorage.removeItem('pvgj_admin_token');
    setToken(''); setRows([]); setPassword(''); setOverview({});
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true); setError('');
    try {
      if (tab === 'overview') setOverview(await api('/admin/overview'));
      else if (tab === 'enquiries') setRows((await api('/admin/enquiries')).map((row) => ({ ...row, createdAt: row.created_at, status: row.status || 'new' })));
      else if (tab === 'learners') setRows((await api('/admin/learners')).learners || []);
      else if (tab === 'audit') setRows((await api('/admin/audit-log')).entries || []);
      else setRows((await api('/admin/content?kind=' + tab)).map((row) => ({ ...row, officialUrl: row.official_url || '', fileUrl: row.file_url || '', lastDate: row.last_date || '', publishAt: row.publish_at || '', isPublished: Boolean(row.is_published) })));
    } catch (e) {
      setError(e.message);
      if (e.message.toLowerCase().includes('expired') || e.message.toLowerCase().includes('authentication required')) logout();
    } finally { setBusy(false); }
  }, [api, tab, token, logout]);

  useEffect(() => { if (token) load(); }, [token, tab, load]);

  async function login(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch(`${API}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Sign in failed.');
      sessionStorage.setItem('pvgj_admin_token', data.token); setToken(data.token); setNotice('Signed in successfully.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  function openNew() { setEditing('new'); setForm({ ...EMPTY, kind: tab }); setError(''); }
  function openEdit(item) {
    setEditing(item.id);
    setForm({ ...EMPTY, kind: tab, ...item, officialUrl: item.officialUrl || '', fileUrl: item.fileUrl || '', lastDate: item.lastDate ? String(item.lastDate).slice(0, 10) : '', publishAt: item.publishAt ? String(item.publishAt).replace(' ', 'T').slice(0, 16) : '', isPublished: Boolean(item.isPublished) });
    setError('');
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const path = editing === 'new' ? '/admin/content' : `/admin/content/${editing}`;
      await api(path, { method: editing === 'new' ? 'POST' : 'PUT', body: JSON.stringify({ ...form, file_url: form.fileUrl, official_url: form.officialUrl, last_date: form.lastDate, publish_at: form.publishAt, is_published: form.isPublished }) });
      setEditing(null); setNotice(editing === 'new' ? 'New content created.' : 'Changes saved.'); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    setBusy(true); setError('');
    try { await api(`/admin/content/${item.id}?kind=${tab}`, { method: 'DELETE' }); setNotice('Content deleted.'); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function importJson(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const items = JSON.parse(bulkText);
      if (!Array.isArray(items)) throw new Error('JSON must contain an array of records.');
      const result = await api('/admin/content/bulk', { method: 'POST', body: JSON.stringify({ kind: tab, items }) });
      setBulkOpen(false); setBulkText(''); setNotice(result.imported + ' records imported.'); await load();
    } catch (e) { setError(e.message || 'The JSON could not be imported.'); }
    finally { setBusy(false); }
  }
  async function setStatus(item, status) {
    try { await api(`/admin/enquiries/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); setNotice('Enquiry status updated.'); await load(); }
    catch (e) { setError(e.message); }
  }

  const shown = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase())), [rows, query]);

  if (!token) return <div className="admin-login"><form className="login-card" onSubmit={login}>
    <div className="admin-emblem"><GraduationCap size={30} /></div><p className="eyebrow">PVGJ EDUCATIONAL INSTITUTIONS</p><h1>Admin portal</h1><p className="muted">Sign in to manage jobs, services, study materials, and enquiries.</p>
    {error && <div className="admin-error" role="alert">{error}</div>}
    <label>Email address<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
    <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
    <button className="admin-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button><a className="back-link" href="/">← Back to website</a>
  </form></div>;

  const current = SECTIONS.find((section) => section.id === tab);
  return <div className="admin-shell">
    <aside className="admin-sidebar"><a className="admin-brand" href="/"><span><GraduationCap /></span><div><b>PVGJ</b><small>ADMINISTRATION</small></div></a><div className="side-caption">WORKSPACE</div>
      {SECTIONS.map((section) => <button key={section.id} className={`side-link ${tab === section.id ? 'active' : ''}`} onClick={() => { setTab(section.id); setQuery(''); setEditing(null); setCourseService(null); }}><section.icon size={18} />{section.label}</button>)}
      <div className="sidebar-bottom"><div className="admin-avatar">A</div><div className="admin-user"><b>Administrator</b><small>Signed in</small></div><button className="logout-icon" title="Sign out" onClick={logout}><LogOut size={18} /></button></div>
    </aside>
    <main id="main-content" className="admin-main"><header className="admin-topbar"><div><p className="eyebrow">PVGJ / WORKSPACE</p><h1>{courseService ? courseService.title + ' courses' : current?.label || 'Dashboard'}</h1></div><div className="top-actions"><a className="view-site" href="/" target="_blank" rel="noreferrer">View website <ExternalLink size={15} /></a><button className="refresh-btn" onClick={load} title="Refresh data"><RefreshCw size={17} /></button></div></header>
      {error && <div className="admin-error inline-error" role="alert">{error}<button onClick={() => setError('')}><X size={15} /></button></div>}
      {notice && <div className="admin-notice" role="status"><CheckCircle2 size={16} />{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}
      {tab === 'overview' ? <>
        <div className="welcome-panel"><div><span className="welcome-chip">ADMINISTRATOR VIEW</span><h2>Good work starts with good organisation.</h2><p>Manage learning resources, recruitment alerts, and incoming guidance requests from one place.</p></div><div className="welcome-icon"><GraduationCap size={60} /></div></div>
        <div className="stats-grid">{[
          { label: 'Total enquiries', value: overview.enquiries ?? '—', icon: Inbox },
          { label: 'Open enquiries', value: overview.openEnquiries ?? '—', icon: Inbox },
          { label: 'Services', value: overview.services ?? '—', icon: Layers3 },
          { label: 'Study materials', value: overview.resources ?? '—', icon: BookOpen },
{ label: 'Job alerts', value: overview.jobs ?? 'n/a', icon: BriefcaseBusiness },
          { label: 'Learners', value: overview.learners ?? 'n/a', icon: Users },
          { label: 'Current affairs', value: overview.currentAffairs ?? 'n/a', icon: Newspaper },
          { label: 'Courses', value: overview.courses ?? 'n/a', icon: BookOpen }
        ].map((item, index) => <div className="stat-card" key={item.label}><div className={`stat-icon tone-${index}`}><item.icon size={19} /></div><p>{item.label}</p><strong>{item.value}</strong></div>)}</div>
        <div className="admin-section-card"><div className="section-heading"><div><h3>Quick actions</h3><p>Keep the public website useful and up to date.</p></div></div><div className="quick-grid">{SECTIONS.slice(1).map((section) => <button key={section.id} className="quick-action" onClick={() => setTab(section.id)}><section.icon size={20} /><b>{section.label}</b><span>Manage entries →</span></button>)}</div></div>
      </> : tab === 'service' && courseService ? <AdminCoursesPanel service={courseService} token={token} onBack={() => setCourseService(null)} /> : <div className="admin-section-card"><div className="section-heading"><div><h3>{tab === 'enquiries' ? 'Incoming guidance requests' : tab === 'learners' ? 'Learner directory' : tab === 'audit' ? 'Recent admin activity' : `${LABELS[tab]} catalogue`}</h3><p>{tab === 'enquiries' ? 'Review messages and track follow-up status.' : tab === 'learners' ? 'Review registered accounts and verification status.' : tab === 'audit' ? 'Review recent administrator changes.' : 'Create, edit, publish, or remove website content.'}</p></div>{tab !== 'enquiries' && tab !== 'learners' && tab !== 'audit' && <div className="admin-heading-actions"><button className="admin-secondary" onClick={() => setBulkOpen(true)}><Upload size={15}/> Import JSON</button><button className="admin-primary add-btn" onClick={openNew}><Plus size={17} /> Add new</button></div>}</div>
        <div className="table-toolbar"><label className="search-field"><Search size={17} /><input placeholder="Search this list…" value={query} onChange={(e) => setQuery(e.target.value)} /></label><span>{shown.length} records</span></div>
        {busy ? <div className="empty-state">Loading your data…</div> : shown.length === 0 ? <div className="empty-state"><Inbox size={30} /><b>No records found</b><span>{query ? 'Try another search term.' : tab === 'learners' ? 'New learner accounts will appear here.' : tab === 'audit' ? 'New admin actions will appear here.' : 'Try a different search or add your first item.'}</span></div> : tab === 'learners' ? <div className="table-wrap"><table><thead><tr><th>LEARNER</th><th>PHONE</th><th>EMAIL STATUS</th><th>JOINED</th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td><b>{item.name}</b><a className="email-link" href={'mailto:'+item.email}>{item.email}</a></td><td>{item.phone || 'Not provided'}</td><td><span className={'status-pill '+(item.emailVerified?'published':'draft')}>{item.emailVerified?'Verified':'Unverified'}</span></td><td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : 'Unknown'}</td></tr>)}</tbody></table></div> : tab === 'audit' ? <div className="table-wrap"><table><thead><tr><th>TIME</th><th>ADMIN</th><th>ACTION</th><th>CONTENT</th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td>{item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : 'Unknown'}</td><td>{item.adminEmail}</td><td>{item.action}</td><td>{item.contentKind} / {item.title || item.contentId || 'Content'}</td></tr>)}</tbody></table></div> : tab === 'enquiries' ? <div className="table-wrap"><table><thead><tr><th>PERSON</th><th>REQUEST</th><th>MESSAGE</th><th>RECEIVED</th><th>STATUS</th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td><b>{item.name}</b><a className="email-link" href={`mailto:${item.email}`}>{item.email}</a><small>{item.phone || 'No phone supplied'}</small></td><td>{item.subject || 'General guidance'}</td><td className="message-cell">{item.message}</td><td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : '—'}</td><td><select className="status-select" value={item.status || 'New'} onChange={(e) => setStatus(item, e.target.value)}><option value="new">New</option><option value="in-progress">In progress</option><option value="resolved">Resolved</option></select></td></tr>)}</tbody></table></div> : <div className="table-wrap"><table><thead><tr><th>TITLE</th><th>DETAILS</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td><b>{item.title}</b><small>{item.category || item.organization || LABELS[tab]}</small></td><td className="message-cell">{item.description || '—'}{item.officialUrl && <a className="email-link" href={item.officialUrl} target="_blank" rel="noreferrer">Official application ↗</a>}{item.fileUrl && <a className="email-link" href={item.fileUrl} target="_blank" rel="noreferrer">Open material ↗</a>}{item.lastDate && <small>Last date: {String(item.lastDate).slice(0, 10)}</small>}{item.publish_at && <small>Scheduled: {new Date(item.publish_at).toLocaleString('en-IN')}</small>}</td><td><span className={`status-pill ${item.isPublished ? 'published' : 'draft'}`}>{item.isPublished ? 'Published' : 'Draft'}</span></td><td><div className="row-actions">{tab === 'service' && <button title="Manage courses in this service" onClick={() => setCourseService(item)}><BookOpen size={16} /></button>}<button title="Edit" onClick={() => openEdit(item)}><Pencil size={16} /></button><button title="Delete" onClick={() => remove(item)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>}
      </div>}
      <footer className="admin-footer">PVGJ Educational Institutions <span>•</span> Administration workspace</footer>
    </main>
    {bulkOpen && <div className="modal-backdrop"><form className="content-modal" onSubmit={importJson}><div className="modal-heading"><div><p className="eyebrow">BULK CONTENT</p><h2>Import JSON records</h2></div><button type="button" className="close-modal" onClick={() => setBulkOpen(false)}><X size={18}/></button></div><p className="bulk-help">Paste a JSON array. Each item can include title, description, category, is_published, plus this content type's fields. New imports default to drafts.</p><label>JSON data<textarea rows={12} required value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'[{"title":"Sample title","description":"Details","category":"Topic"}]'} /></label>{error && <div className="admin-error">{error}</div>}<div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setBulkOpen(false)}>Cancel</button><button className="admin-primary" disabled={busy}>{busy ? 'Importing...' : 'Import records'}</button></div></form></div>}
    {editing !== null && <div className="modal-backdrop"><form className="content-modal" onSubmit={save}><div className="modal-heading"><div><p className="eyebrow">CONTENT MANAGEMENT</p><h2>{editing === 'new' ? `Add ${LABELS[tab].toLowerCase()}` : 'Edit content'}</h2></div><button type="button" className="close-modal" onClick={() => setEditing(null)}><X size={18} /></button></div>
      <label>Title *<input value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
      {tab === 'job' && <label>Recruiting organisation<input value={form.organization} maxLength={200} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="e.g. Staff Selection Commission" /></label>}
      <label>Description<textarea rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Enter verified details for visitors" /></label>
      {tab !== 'job' && <label>Category<input value={form.category} maxLength={100} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={tab === 'service' ? 'e.g. Learning' : 'e.g. Computer Science'} /></label>}
      {tab === 'resource' && <label>Material URL<input type="url" value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} placeholder="https://…" /></label>}
      {(tab === 'job' || tab === 'affair') && <label>{tab === 'affair' ? 'Reference source URL' : 'Official notification / application URL'}<input type="url" value={form.officialUrl} onChange={(e) => setForm({ ...form, officialUrl: e.target.value })} placeholder="https://" /></label>}{tab === 'job' && <label>Last date to apply<input type="date" value={form.lastDate} onChange={(e) => setForm({ ...form, lastDate: e.target.value })} /></label>}{tab === 'affair' && <label>Schedule publication<input type="datetime-local" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} /><small>Leave blank to publish immediately. Future dates stay hidden until the scheduled time.</small></label>}
      <label className="publish-check"><input type="checkbox" checked={Boolean(form.isPublished)} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} /> Publish on the public website</label>
      {error && <div className="admin-error">{error}</div>}<div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setEditing(null)}>Cancel</button><button className="admin-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div>
    </form></div>}
  </div>;
}




