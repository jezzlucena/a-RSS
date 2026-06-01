import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { RequireAuth } from '@/components/RequireAuth';
import { Layout } from '@/components/Layout';
import LoginPage from '@/pages/Login';
import SignupPage from '@/pages/Signup';
import MagicConsumePage from '@/pages/MagicConsume';
import FeedPage from '@/pages/Feed';
import SourcesPage from '@/pages/Sources';
import CategoriesPage from '@/pages/Categories';
import SettingsPage from '@/pages/Settings';
import EntryDetailPage from '@/pages/EntryDetail';

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Keep the resolved theme in sync, and follow the OS when preference is "system".
  useEffect(() => {
    useThemeStore.getState().applyCurrent();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => useThemeStore.getState().applyCurrent();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignupPage />} />
      <Route path="/auth/magic" element={<MagicConsumePage />} />

      <Route
        element={
          <RequireAuth>
            <Layout>
              <Outlet />
            </Layout>
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/feed/all" replace />} />
        <Route path="/feed/all" element={<FeedPage />} />
        <Route path="/feed/:viewKind/:viewId" element={<FeedPage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/entries/:id" element={<EntryDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/feed/all" replace />} />
      </Routes>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
        icon={false}
      />
    </>
  );
}
