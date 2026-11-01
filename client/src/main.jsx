import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import AboutPage from './AboutPage.jsx';
import AuthPage, { VerifyEmailPage } from './AuthPage.jsx';
import ProfilePage from './ProfilePage.jsx';
import JobsPage from './pages/JobsPage.jsx';
import ServicePage from './ServicePage.jsx';
import LearningHub from './LearningHub.jsx';
import './styles.css';

function MainApp() {
  const readPath = () => {
    const hashRoute = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '';
    return hashRoute || window.location.pathname;
  };
  const [path, setPath] = React.useState(readPath);
  React.useEffect(() => {
    const syncPath = () => setPath(readPath());
    window.addEventListener('hashchange', syncPath);
    window.addEventListener('popstate', syncPath);
    return () => {
      window.removeEventListener('hashchange', syncPath);
      window.removeEventListener('popstate', syncPath);
    };
  }, []);
  if (path.startsWith('/admin')) return <AdminDashboard />;
  if (path === '/signin' || path === '/signup') return <AuthPage />;
  if (path === '/verify-email') return <VerifyEmailPage />;
  if (path === '/account') return <ProfilePage />;
  if (path === '/about') return <AboutPage />;
  if (path.startsWith('/learn')) return <LearningHub />;
  if (path.startsWith('/services/')) return <ServicePage />;
  if (path === '/jobs' || path.startsWith('/jobs/')) return <JobsPage />;
  return <App />;
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.__pvgjInstallPrompt = event;
});
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((error) => console.info('PVGJ offline support is unavailable:', error.message)));
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <MainApp />
  </React.StrictMode>
);
