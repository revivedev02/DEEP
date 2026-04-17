import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import AuthGuard from '@/components/AuthGuard';

// Lazy-load pages — only downloaded when user navigates to them
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const ChatPage  = lazy(() => import('@/pages/ChatPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));

// Minimal spinner for route suspense
function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-bg-primary">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Wraps children with a smooth fade+slide animation on every route change
function AnimatedRoutes() {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionKey, setTransitionKey] = useState(location.key);
  const [animating, setAnimating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setAnimating(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setDisplayLocation(location);
        setTransitionKey(location.key);
        setAnimating(false);
      }, 80); // fast fade-out before swap
    }
    return () => clearTimeout(timer.current);
  }, [location]);

  return (
    <div
      key={transitionKey}
      className="page-transition h-full w-full"
      style={animating ? { opacity: 0, transition: 'opacity 80ms ease' } : undefined}
    >
      <Suspense fallback={<RouteFallback />}>
        <Routes location={displayLocation}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/"      element={<AuthGuard><ChatPage /></AuthGuard>} />
          <Route path="/admin" element={<AuthGuard adminOnly><AdminPage /></AuthGuard>} />
          <Route path="*"      element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
