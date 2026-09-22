import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ContactsPage } from './pages/ContactsPage';
import { ImportPage } from './pages/ImportPage';
import { TagsPage } from './pages/TagsPage';
import { InboxPage } from './pages/InboxPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import api from './api';
import { User } from './types';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data.success) {
        setUser(res.data.user);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center text-xs text-slate-400">
        Loading WhatsApp Platform...
      </div>
    );
  }

  if (!user) {
    return (
      <ThemeProvider>
        <LoginPage
          onLoginSuccess={(userData) => {
            setUser(userData);
          }}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppLayout user={user} onLogout={handleLogout}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="/tags" element={<TagsPage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
