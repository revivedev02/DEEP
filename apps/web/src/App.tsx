import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import LoginPage from '@/pages/LoginPage';
import ChatPage from '@/pages/ChatPage';
import AdminPage from '@/pages/AdminPage';
import AuthGuard from '@/components/AuthGuard';

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
      <Routes location={displayLocation}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/"      element={<AuthGuard><ChatPage /></AuthGuard>} />
        <Route path="/admin" element={<AuthGuard adminOnly><AdminPage /></AuthGuard>} />
        <Route path="*"      element={<Navigate to="/" replace />} />
      </Routes>
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
