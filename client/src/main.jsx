import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import AboutPage from './AboutPage.jsx';
import AuthPage from './AuthPage.jsx';
import ProfilePage from './ProfilePage.jsx';
import JobsPage from './pages/JobsPage.jsx';
import './styles.css';

function MainApp() {
  const path = window.location.pathname;
  if (path.startsWith('/admin')) return <AdminDashboard />;
  if (path === '/signin' || path === '/signup') return <AuthPage />;
  if (path === '/account') return <ProfilePage />;
  if (path === '/about') return <AboutPage />;
  if (path === '/jobs' || path.startsWith('/jobs/')) return <JobsPage />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><MainApp /></React.StrictMode>
);
