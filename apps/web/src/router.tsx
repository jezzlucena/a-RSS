import { createBrowserRouter, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useEffect } from 'react';
import { AppLayout, AuthLayout } from '@/components/layout';
import { ErrorBoundary, ErrorFallback } from '@/components/common';
import { HomePage } from '@/pages/HomePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { useAuthStore } from '@/stores/authStore';
import { useFeedStore } from '@/stores/feedStore';

// Wrapper components to sync URL params with store
function AllArticlesRoute() {
  const { setView } = useFeedStore();
  useEffect(() => {
    setView('all');
  }, [setView]);
  return <HomePage />;
}

function UnreadRoute() {
  const { setView } = useFeedStore();
  useEffect(() => {
    setView('unread');
  }, [setView]);
  return <HomePage />;
}

function SavedRoute() {
  const { setView } = useFeedStore();
  useEffect(() => {
    setView('saved');
  }, [setView]);
  return <HomePage />;
}

function FeedRoute() {
  const { feedId } = useParams<{ feedId: string }>();
  const { selectFeed } = useFeedStore();
  useEffect(() => {
    if (feedId) {
      selectFeed(feedId);
    }
  }, [feedId, selectFeed]);
  return <HomePage />;
}

function CategoryRoute() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const { selectCategory } = useFeedStore();
  useEffect(() => {
    if (categoryId) {
      selectCategory(categoryId);
    }
  }, [categoryId, selectCategory]);
  return <HomePage />;
}

function SearchRoute() {
  const [searchParams] = useSearchParams();
  const { setSearchQuery } = useFeedStore();
  const query = searchParams.get('q');
  useEffect(() => {
    setSearchQuery(query);
  }, [query, setSearchQuery]);
  return <HomePage />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
            <AllArticlesRoute />
          </ErrorBoundary>
        ),
      },
      {
        path: 'all',
        element: (
          <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
            <AllArticlesRoute />
          </ErrorBoundary>
        ),
      },
      {
        path: 'unread',
        element: (
          <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
            <UnreadRoute />
          </ErrorBoundary>
        ),
      },
      {
        path: 'saved',
        element: (
          <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
            <SavedRoute />
          </ErrorBoundary>
        ),
      },
      {
        path: 'feed/:feedId',
        element: (
          <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
            <FeedRoute />
          </ErrorBoundary>
        ),
      },
      {
        path: 'category/:categoryId',
        element: (
          <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
            <CategoryRoute />
          </ErrorBoundary>
        ),
      },
      {
        path: 'search',
        element: (
          <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
            <SearchRoute />
          </ErrorBoundary>
        ),
      },
      {
        path: 'settings',
        element: (
          <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
            <SettingsPage />
          </ErrorBoundary>
        ),
      },
    ],
  },
  {
    path: '/auth',
    element: (
      <PublicRoute>
        <AuthLayout />
      </PublicRoute>
    ),
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
