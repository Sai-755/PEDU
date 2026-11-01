import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, GraduationCap, Sparkles } from 'lucide-react';
import './service.css';
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const FALLBACK = {
 'technical-skills':['Technical Skills & Knowledge','Build practical skills through programming, web development, AI, data science, and guided projects.'],
 'current-affairs':['Current Affairs','Stay up to date with national and international developments, government schemes, and exam-focused news.'],
 'general-knowledge':['General Knowledge','Strengthen your foundation in history, geography, polity, economics, and science.'],
 'job-alerts':['Job Alerts','Explore recruitment announcements, eligibility details, important dates, and official application information.'],
 'study-materials':['Study Materials','Find organized notes, revision sheets, worksheets, and previous-year question papers.'],
 'government-exams':['Government Exam Preparation','Prepare with exam roadmaps, syllabus breakdowns, mock tests, and explained answers.'],
 'guidance':['Guidance & Mentorship','Get direction on education choices, career paths, exam strategy, resumes, and interviews.']
};
const priceText = (value) => Number(value) <= 0 ? 'Free' : new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(value));
export default function ServicePage() {
 const routePath = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : window.location.pathname;
 const pathParts = routePath.split('/').filter(Boolean);
 let slug = pathParts[pathParts.length - 1] || '';
 try { slug = decodeURIComponent(slug); } catch { slug = ''; }
 const seed = FALLBACK[slug];
 const [service,setService] = useState(seed ? {title:seed[0],description:seed[1]} : null);
 const [courses,setCourses] = useState([]);
 const [loading,setLoading] = useState(true);
 const [error,setError] = useState('');
 useEffect(() => { let active=true; fetch(API+'/content/services/'+encodeURIComponent(slug)+'/courses').then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||'Unable to load service.');return d;}).then(d=>{if(active){setService(d.service);setCourses(d.courses||[]);}}).catch(e=>{if(active&&!seed)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;}; },[slug]);
 return <main id="main-content" className="service-page">
  <header className="service-page-header"><a className="service-page-brand" href="/"><span><GraduationCap size={22}/></span><b>PVGJ</b><small>EDUCATIONAL INSTITUTIONS</small></a><nav><a href="/#services">All services</a><a href="/about">About us</a><a href="/jobs">Job alerts</a></nav></header>
  <section className="service-page-hero"><div className="service-page-hero-inner"><a href="/#services" className="service-back-link"><ArrowLeft size={15}/> Explore all services</a><span className="service-page-eyebrow"><Sparkles size={14}/> {service?.category||'PVGJ LEARNING SERVICE'}</span><h1>{service?.title||'PVGJ service'}</h1><p>{service?.description||'Explore resources and courses in this PVGJ service area.'}</p><div className="service-hero-points"><span><CheckCircle2 size={15}/> Practical learning</span><span><CheckCircle2 size={15}/> Clear course details</span><span><CheckCircle2 size={15}/> Learn at your pace</span></div></div></section>
  <section className="service-course-section"><div className="service-course-heading"><div><span className="service-section-kicker">LEARN IN THIS SERVICE</span><h2>Courses & learning content</h2><p>Review course details, duration, level, materials, and price.</p></div><span className="service-count">{courses.length} {courses.length===1?'COURSE':'COURSES'}</span></div>
   {loading?<div className="service-empty">Loading this service…</div>:error?<div className="service-empty"><b>Content is temporarily unavailable</b><p>{error}</p></div>:courses.length?<div className="service-course-grid">{courses.map(c=><article className="service-course-card" key={c.id}><div className="service-course-top"><span className="course-level">{c.courseLevel||'PVGJ COURSE'}</span><span className="course-price">{priceText(c.price)}</span></div><h3>{c.title}</h3>{c.summary&&<p className="course-summary">{c.summary}</p>}<div className="course-facts">{c.duration&&<span><Clock3 size={15}/>{c.duration}</span>}{c.courseLevel&&<span><GraduationCap size={15}/>{c.courseLevel}</span>}</div>{c.details&&<div className="course-details"><h4>Course details</h4><p>{c.details}</p></div>}{c.materialUrl&&<a className="course-material-link" href={c.materialUrl} target="_blank" rel="noreferrer">Open course materials <ArrowRight size={15}/></a>}<a className="course-enroll-link" href={"/?course="+encodeURIComponent(c.title)+"#guidance"}>Ask about this course <ArrowRight size={15}/></a></article>)}</div>:<div className="service-empty"><BookOpen size={28}/><b>Courses are being prepared</b><p>There are no published courses in this service yet. Check back soon for new learning content.</p></div>}
  </section><footer className="service-page-footer">© {new Date().getFullYear()} PVGJ Educational Institutions <a href="/#services">Explore other services</a></footer>
 </main>;
}
