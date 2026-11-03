import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import splashLogo from './assets/pvgj-splash-logo.png';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, Brain, BriefcaseBusiness,
  CheckCircle2, Code2, Compass, GraduationCap, Landmark, Menu,
  Newspaper, Search, ShieldCheck, Sparkles, X, Zap
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const seedServices = [
  { slug: 'technical-skills', number: '01', title: 'Technical Skills & Knowledge', description: 'Build practical, future-ready skills through programming, web development, AI, data science, and guided projects.', icon: 'Code2', category: 'Learn', tags: ['Programming', 'Web development', 'AI & data'] },
  { slug: 'current-affairs', number: '02', title: 'Current Affairs', description: 'Keep up with important national and international developments, government schemes, and daily quizzes.', icon: 'Newspaper', category: 'Stay informed', tags: ['Daily updates', 'Government schemes', 'Quizzes'] },
  { slug: 'general-knowledge', number: '03', title: 'General Knowledge', description: 'Strengthen your foundation in history, geography, polity, economics, science, and static GK.', icon: 'Brain', category: 'Build knowledge', tags: ['History', 'Polity', 'Science'] },
  { slug: 'job-alerts', number: '04', title: 'Job Alerts', description: 'Explore recruitment announcements, eligibility details, deadlines, and links to official application pages.', icon: 'BriefcaseBusiness', category: 'Find opportunities', tags: ['Government jobs', 'Private jobs', 'Internships'] },
  { slug: 'study-materials', number: '05', title: 'Study Materials', description: 'Find organized notes, revision sheets, practice worksheets, and previous-year question papers.', icon: 'BookOpen', category: 'Study smarter', tags: ['Notes', 'PDF resources', 'Question papers'] },
  { slug: 'government-exams', number: '06', title: 'Government Exam Preparation', description: 'Prepare with exam roadmaps, syllabus breakdowns, study plans, mock tests, and explained answers.', icon: 'Landmark', category: 'Prepare with purpose', tags: ['UPSC & PSC', 'SSC', 'Banking & Railways'] },
  { slug: 'guidance', number: '07', title: 'Guidance & Mentorship', description: 'Get direction on education choices, career paths, exam strategy, resumes, and interview preparation.', icon: 'Compass', category: 'Move forward', tags: ['Career planning', 'Exam roadmap', 'Mentorship'] }
];

const seedResources = [
  { type: 'SKILL GUIDE', title: 'Start your technical learning journey', description: 'A practical roadmap to choose a skill, learn fundamentals, and build your first project.', label: 'Technical skills', slug: 'technical-skills' },
  { type: 'DAILY PRACTICE', title: 'Make current affairs a daily habit', description: 'Review key developments and reinforce what you learn with short quizzes.', label: 'Current affairs', slug: 'current-affairs' },
  { type: 'EXAM ROADMAP', title: 'Build a focused government exam plan', description: 'Start with the official syllabus, set weekly goals, and track practice-test results.', label: 'Exam preparation', slug: 'government-exams' },
  { type: 'CAREER TOOLKIT', title: 'Prepare for your next opportunity', description: 'Organize your skills, improve your resume, and practise interview answers.', label: 'Guidance', slug: 'guidance' }
];

const iconMap = { Code2, Newspaper, Brain, BriefcaseBusiness, BookOpen, Landmark, Compass };
const accents = ['mint', 'gold', 'blue', 'lavender', 'teal', 'peach', 'lilac'];

function Brand({ light = false }) {
  return (
    <a className={`brand ${light ? 'brand-light' : ''}`} href="#home" aria-label="PVGJ home">
      <span className="brand-mark brand-mark-image"><img src="/pvgj-logo-light.png" alt="" /></span>
      <span className="brand-copy"><strong>PVGJ</strong><small>EDUCATIONAL INSTITUTIONS</small></span>
    </a>
  );
}

function App() {
  const [services, setServices] = useState(seedServices);
  const [resources, setResources] = useState(seedResources);
  const [query, setQuery] = useState('');
  const [resourceQuery, setResourceQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [contentLoading, setContentLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', audience: 'college student', topic: 'career guidance', message: '' });
  const [formState, setFormState] = useState({ loading: false, message: '', error: false });
  const [apiStatus, setApiStatus] = useState('demo');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 2100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (window.location.hash !== '#guidance') return;
    const course = new URLSearchParams(window.location.search).get('course');
    if (course) setForm((current) => ({ ...current, topic: 'technical skills', message: 'I would like to know more about ' + course.slice(0, 180) + '.' }));
    setShowGuidance(true);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPublicContent() {
      setContentLoading(true);

      try {
        const [servicesResponse, resourcesResponse] = await Promise.all([
          fetch(`${API}/content/services`),
          fetch(`${API}/content/resources`)
        ]);

        if (!servicesResponse.ok || !resourcesResponse.ok) {
          throw new Error('Unable to load published content.');
        }

        const [servicesData, resourcesData] = await Promise.all([
          servicesResponse.json(),
          resourcesResponse.json()
        ]);

        if (!active) return;

        const resolvedServices = [...seedServices];
        servicesData.forEach((item) => {
          const match = resolvedServices.findIndex((service) => service.title.toLowerCase() === String(item.title || '').toLowerCase());
          const fallback = match >= 0 ? resolvedServices[match] : null;
          const normalized = {
            ...fallback,
            ...item,
            slug: item.slug || fallback?.slug || String(item.title || 'service-' + item.id).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            icon: item.icon || fallback?.icon || 'BookOpen',
            category: item.category || fallback?.category || 'Explore',
            tags: Array.isArray(item.tags) ? item.tags : (fallback?.tags || [])
          };
          if (match >= 0) resolvedServices[match] = normalized; else resolvedServices.push(normalized);
        });
        setServices(resolvedServices.map((service, index) => ({ ...service, number: String(index + 1).padStart(2, '0') })));

        setResources(
          resourcesData.map((item) => ({
            ...item,
            type: item.category || 'STUDY MATERIAL',
            label: item.category || 'Learning resource',
            slug: `resource-${item.id}`,
            url: item.file_url || ''
          }))
        );

        setApiStatus('connected');
      } catch (error) {
        if (!active) return;
        console.error('PVGJ content loading failed:', error);
        setApiStatus('demo');
      } finally {
        if (active) setContentLoading(false);
      }
    }

    loadPublicContent();

    return () => {
      active = false;
    };
  }, []);

  const filteredServices = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return services;
    return services.filter((service) =>
      [service.title, service.description, service.category, ...(service.tags || [])]
        .some((item) => item?.toLowerCase().includes(normalized))
    );
  }, [query, services]);

  const filteredResources = useMemo(() => {
    const search = resourceQuery.trim().toLowerCase();
    if (!search) return resources;

    return resources.filter((resource) =>
      [
        resource.title,
        resource.description,
        resource.category,
        resource.type,
        resource.label
      ].some((value) =>
        String(value || '').toLowerCase().includes(search)
      )
    );
  }, [resources, resourceQuery]);

  async function submitGuidance(event) {
    event.preventDefault();
    setFormState({ loading: true, message: '', error: false });
    try {
      const response = await fetch(`${API}/guidance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not submit your request.');
      setFormState({ loading: false, message: 'Your request has been submitted. The PVGJ team can follow up with you.', error: false });
      setForm({ name: '', email: '', audience: 'college student', topic: 'career guidance', message: '' });
    } catch (error) {
      setFormState({
        loading: false,
        message: error.message || 'The API is not connected. Start the backend and MySQL, then try again.',
        error: true
      });
    }
  }

  return (
    <>
      <div className={showSplash ? "pvgj-splash is-visible" : "pvgj-splash"} aria-hidden={!showSplash}>
        <img src={splashLogo} alt="PVGJ Educational Institutions logo" />
        <div className="splash-caption">LEARN <span></span> PREPARE <span></span> PROGRESS</div>
        <div className="splash-progress"><i /></div>
      </div>
      <div className="site-shell" id="home">
        <div className="announcement">
          <Sparkles size={14}/>
          <span>Your next step starts with what you learn today.</span>
          <a href="#services">Explore PVGJ <ArrowRight size={13}/></a>
        </div>
        <header className="site-header">
          <div className="nav-wrap">
            <Brand/>
            <nav className={menuOpen ? 'nav-links nav-open' : 'nav-links'} aria-label="Main navigation">
              <a href="#services" onClick={() => setMenuOpen(false)}>Explore</a>
              <a href="#resources" onClick={() => setMenuOpen(false)}>Resources</a>
              <a href="/learn" onClick={() => setMenuOpen(false)}>Learning hub</a>
              <a href="/jobs" onClick={() => setMenuOpen(false)}>Job alerts</a>
              <a href="/about" onClick={() => setMenuOpen(false)}>About PVGJ</a>
              <a href={sessionStorage.getItem("pvgj_user_token") ? "/account" : "/signin"} onClick={() => setMenuOpen(false)}>
                {sessionStorage.getItem("pvgj_user_token") ? "My profile" : "Sign in"}
              </a>
              <a href="/signup" onClick={() => setMenuOpen(false)}>Create account</a>
              <a className="admin-nav-link" href="/admin" onClick={() => setMenuOpen(false)}>
                <ShieldCheck size={14}/> Admin sign in
              </a>
            </nav>
            <div className="nav-actions">
              <a className="btn btn-dark btn-nav" href={sessionStorage.getItem("pvgj_user_token") ? "/account" : "/signin"}>
                {sessionStorage.getItem("pvgj_user_token") ? "My profile" : "Sign in"} <ArrowUpRight size={15}/>
              </a>
              <button className="menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X/> : <Menu/>}
              </button>
            </div>
          </div>
        </header>

        <main id="main-content">
          <section className="hero">
            <div className="hero-orb orb-one"></div>
            <div className="hero-orb orb-two"></div>
            <div className="hero-grid">
              <motion.div className="hero-copy" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
                <div className="eyebrow"><span className="eyebrow-dot"></span> LEARN • PREPARE • PROGRESS</div>
                <h1>Knowledge for today.<br/><em>Possibilities</em> for life.</h1>
                <p className="hero-lede">One place to build technical skills, stay informed, prepare for competitive exams, and find your direction.</p>
                <div className="hero-buttons">
                  <a className="btn btn-gold" href="#services">Explore learning <ArrowRight size={17}/></a>
                  <button className="btn btn-outline-light" onClick={() => setShowGuidance(true)}>Talk to PVGJ <ArrowUpRight size={16}/></button>
                  <a className="btn btn-outline-light hero-admin-link" href="/admin"><ShieldCheck size={16}/> Admin sign in</a>
                </div>
                <div className="hero-proof">
                  <span className="proof-icon"><ShieldCheck size={18}/></span>
                  <span><strong>Learn with purpose</strong><small>Skills, knowledge & guidance for everyone</small></span>
                </div>
              </motion.div>
              <motion.div className="hero-visual" initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .7, delay: .12 }}>
                <div className="visual-topline"><span>YOUR LEARNING SPACE</span><span className="live-dot"></span></div>
                <div className="visual-heading">Make progress<br/>that matters.</div>
                <div className="learning-art">
                  <div className="art-ring ring-a"></div><div className="art-ring ring-b"></div>
                  <div className="art-center"><GraduationCap size={57} strokeWidth={1.1}/><span>PVGJ</span></div>
                  <div className="float-card float-card-one"><span className="float-icon mint"><Code2 size={17}/></span><span><b>Build skills</b><small>Learn by doing</small></span></div>
                  <div className="float-card float-card-two"><span className="float-icon gold"><Landmark size={17}/></span><span><b>Prepare smarter</b><small>One step at a time</small></span></div>
                  <div className="float-card float-card-three"><span className="float-icon lilac"><Compass size={17}/></span><span><b>Find direction</b><small>Your future, your way</small></span></div>
                </div>
                <div className="visual-footer"><span><span className="footer-star">✳</span> Curiosity opens doors.</span><span>01 / 07</span></div>
              </motion.div>
            </div>
            <div className="hero-bottom"><span>KNOWLEDGE</span><span className="bottom-line"></span><span>OPPORTUNITY</span><span className="bottom-line"></span><span>GROWTH</span></div>
          </section>

          <section className="trust-strip" aria-label="PVGJ benefits">
            <div><span className="trust-number">01</span><span><b>Practical skills</b><small>Learn what you can use</small></span></div>
            <div><span className="trust-number">02</span><span><b>Focused preparation</b><small>Build consistent habits</small></span></div>
            <div><span className="trust-number">03</span><span><b>Career direction</b><small>Move forward with clarity</small></span></div>
          </section>

          <section className="section services-section" id="services">
            <div className="section-heading">
              <div><div className="eyebrow eyebrow-green">THE PVGJ LEARNING ECOSYSTEM</div><h2>Everything you need<br/>to <em>move forward.</em></h2></div>
              <p>Explore seven connected services designed to help learners grow their knowledge, strengthen their skills, and take the next step with confidence.</p>
            </div>
            <div className="service-toolbar">
              <div className="search-box"><Search size={18}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills, exams, resources..." aria-label="Search PVGJ services"/></div>
              <span className="result-count">{filteredServices.length} SERVICES</span>
            </div>
            <div className="services-grid">
              {filteredServices.map((service, index) => {
                const Icon = iconMap[service.icon] || Sparkles;
                return (
                  <motion.article className={`service-card accent-${accents[index % accents.length]}`} key={service.slug} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: .35, delay: (index % 3) * .06 }}>
                    <div className="card-top"><span className="service-icon"><Icon size={22} strokeWidth={1.8}/></span><span className="service-number">{service.number}</span></div>
                    <div className="service-category">{service.category}</div>
                    <h3>{service.title}</h3>
                    <p>{service.description}</p>
                    <div className="tag-list">{(service.tags || []).map((tag) => <span key={tag}>{tag}</span>)}</div>
                    <a className="card-link" href={'/#/services/' + encodeURIComponent(service.slug)}>View service details <ArrowRight size={16}/></a>
                  </motion.article>
                );
              })}
            </div>
            {filteredServices.length === 0 && <div className="empty-state">No services match “{query}”. Try another search.</div>}
          </section>

          <section className="feature-section" id="resources">
            <div className="feature-intro">
              <div className="eyebrow"><span className="eyebrow-dot"></span> A BETTER WAY TO BEGIN</div>
              <h2>Small steps.<br/><em>Real momentum.</em></h2>
              <p>You don't need to figure everything out at once. Start with one resource, one new skill, or one clear goal.</p>
              <a className="btn btn-gold" href="#services">Find your starting point <ArrowRight size={16}/></a>
              <div className="feature-note"><Zap size={17}/><span>Consistency beats cramming. Make learning a habit.</span></div>
            </div>
      
            <div className="search-box resource-search">
              <Search size={18} />
              <input
                type="search"
                value={resourceQuery}
                onChange={(event) => setResourceQuery(event.target.value)}
                placeholder="Search study materials and resources..."
                aria-label="Search study materials"
              />
              <span className="result-count">{filteredResources.length}</span>
            </div>

            <div className="resource-list">
              {filteredResources.map((resource, index) => (
                <a
                  href={resource.url || '#resources'}
                  className="resource-row"
                  key={resource.id || resource.title}
                  target={resource.url ? '_blank' : undefined}
                  rel={resource.url ? 'noreferrer' : undefined}
                >
                  <span className={`resource-index resource-${index % 4}`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="resource-copy">
                    <small>{resource.type || 'STUDY MATERIAL'}</small>
                    <strong>{resource.title}</strong>
                    <span>{resource.description}</span>
                  </span>
                  <ArrowUpRight className="resource-arrow" size={19}/>
                </a>
              ))}

              {!contentLoading && resources.length === 0 && (
                <p className="empty-state">No study materials have been published yet. Please check back soon.</p>
              )}
            </div>
            {filteredResources.length === 0 && (
              <p className="empty-state">No study materials match "{resourceQuery}". Try another search.</p>
            )}
          </section>

          <section className="jobs-section pvgj-jobs-promo" aria-labelledby="jobs-promo-title">
            <div className="jobs-copy">
              <div className="eyebrow eyebrow-green">OPPORTUNITIES AHEAD</div>
              <h2 id="jobs-promo-title">Your next opportunity<br/><em>starts here.</em></h2>
              <p>Browse recruitment updates, search job notifications, and read available details on the dedicated PVGJ Job Alerts page.</p>
              <a className="btn btn-dark" href="/jobs">Explore all job alerts <ArrowRight size={17}/></a>
            </div>
            <div className="jobs-panel pvgj-jobs-promo-panel">
              <span className="jobs-panel-icon"><BriefcaseBusiness size={22}/></span>
              <h3>PVGJ Job Alerts</h3>
              <p>One dedicated page for the latest available recruitment updates, with individual detail pages inside PVGJ.</p>
              <a className="text-link" href="/jobs">Open Job Alerts <ArrowUpRight size={16}/></a>
            </div>
          </section>

          <section className="guidance-section" id="guidance">
            <div className="guidance-symbol"><Compass size={36} strokeWidth={1.3}/><span className="symbol-star">✳</span></div>
            <div className="guidance-copy">
              <div className="eyebrow"><span className="eyebrow-dot"></span> YOU DON'T HAVE TO FIGURE IT OUT ALONE</div>
              <h2>Every good journey<br/>starts with <em>direction.</em></h2>
              <p>Whether you're choosing a career, preparing for an exam, or deciding which skill to learn, start a conversation with PVGJ.</p>
            </div>
            <button className="btn btn-gold" onClick={() => setShowGuidance(true)}>Request guidance <ArrowUpRight size={17}/></button>
          </section>

          <section className="about-section" id="about">
            <div className="about-mark"><GraduationCap size={29}/></div>
            <div><div className="eyebrow eyebrow-green">THE PVGJ PURPOSE</div><h2>Knowledge should open doors.</h2></div>
            <p>PVGJ Educational Institutions brings learning resources, practical skills, exam preparation, job information, and guidance together in one accessible place — for learners at every stage.</p>
          </section>
        </main>

        <footer className="site-footer">
          <div className="footer-main">
            <div><Brand light/><p>Learn today. Lead tomorrow.<br/>A clearer path to knowledge and opportunity.</p></div>
            <div className="footer-links">
              <a href="#services">Our services</a>
              <a href="#resources">Resources</a>
              <a href="/jobs">Job alerts</a>
              <a href="#guidance" onClick={(e) => { e.preventDefault(); setShowGuidance(true); }}>Get guidance</a>
              <a href="/about">About PVGJ</a>
              <a href="/account">My profile</a>
            </div>
            <a className="back-top" href="#home">Back to top <ArrowUpRight size={15}/></a>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} PVGJ Educational Institutions</span>
            <span className={`api-indicator ${apiStatus}`}><span></span>{apiStatus === 'connected' ? 'API connected' : 'Preview mode · sample content'}</span>
            <span>Knowledge. Character. Excellence.</span>
          </div>
        </footer>

        {showGuidance && (
          <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowGuidance(false); }}>
            <div className="guidance-modal" role="dialog" aria-modal="true" aria-labelledby="guidance-title">
              <button className="modal-close" aria-label="Close guidance form" onClick={() => { setShowGuidance(false); setFormState({ loading: false, message: '', error: false }); }}><X size={20}/></button>
              <div className="modal-icon"><Compass size={25}/></div>
              <div className="eyebrow eyebrow-green">LET'S FIND YOUR NEXT STEP</div>
              <h2 id="guidance-title">Talk to PVGJ.</h2>
              <p className="modal-lede">Tell us what you're working towards. Submit your request to the PVGJ guidance team.</p>
              <form className="guidance-form" onSubmit={submitGuidance}>
                <label>Full name<input required minLength="2" maxLength="80" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name"/></label>
                <label>Email address<input required type="email" maxLength="254" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com"/></label>
                <div className="form-row">
                  <label>You are a
                    <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                      <option value="school student">School student</option>
                      <option value="college student">College student</option>
                      <option value="graduate">Graduate</option>
                      <option value="job seeker">Job seeker</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label>Need help with
                    <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                      <option value="technical skills">Technical skills</option>
                      <option value="government exams">Government exams</option>
                      <option value="career guidance">Career guidance</option>
                      <option value="study materials">Study materials</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                </div>
                <label>Your question<textarea required minLength="10" maxLength="1500" rows="4" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Tell us about your goal or question..."/></label>
                {formState.message && <div className={`form-message ${formState.error ? 'form-error' : 'form-success'}`}>{formState.error ? null : <CheckCircle2 size={17}/>}<span>{formState.message}</span></div>}
                <button className="btn btn-dark submit-btn" disabled={formState.loading}>{formState.loading ? 'Submitting...' : 'Submit guidance request'} <ArrowRight size={16}/></button>
                <small className="privacy-note">Your information is used to respond to your enquiry. Avoid including sensitive personal details.</small>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;