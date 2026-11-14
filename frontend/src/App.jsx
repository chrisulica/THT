import Hunt from './pages/hunt';
import SetupPage from './pages/SetupPage';
import AuthPage from './pages/AuthPage';
import { RootRedirect, ProtectedRoute, PublicRoute } from './components/RouteGuards.jsx';
import './components/map.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 1. Pagina de start (/) – Redirecționare automată:
              - Neautentificat -> /auth
              - Autentificat cu quiz completat -> /map
              - Autentificat fără quiz completat -> /quiz */}
          <Route path="/" element={<RootRedirect />} />

          {/* Pagina de Autentificare (Login / Register) – accesibilă doar vizitatorilor neautentificați */}
          <Route
            path="/auth"
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            }
          />

          {/* 2. Pagina de Quiz (după Login / Register) – protejată de Route Guard */}
          <Route
            path="/quiz"
            element={
              <ProtectedRoute>
                <SetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <SetupPage />
              </ProtectedRoute>
            }
          />

          {/* 3. Pagina de Hartă – protejată, necesită autentificare și finalizarea quiz-ului */}
          <Route
            path="/map"
            element={
              <ProtectedRoute requireQuiz>
                <Hunt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hunt"
            element={
              <ProtectedRoute requireQuiz>
                <Hunt />
              </ProtectedRoute>
            }
          />
          <Route
            path="/main"
            element={
              <ProtectedRoute requireQuiz>
                <Hunt />
              </ProtectedRoute>
            }
          />

          {/* Fallback pentru orice altă rută inexistentă */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}