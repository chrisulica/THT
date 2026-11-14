import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Redirecționare automată pentru pagina de start (/) conform regulilor:
 * 1. Utilizator neautentificat -> /auth
 * 2. Utilizator autentificat cu quiz completat -> /map
 * 3. Utilizator autentificat fără quiz completat -> /quiz
 */
export function RootRedirect() {
  const { isLoggedIn, hasCompletedQuiz } = useAuth();

  if (!isLoggedIn) {
    return <Navigate to="/auth" replace />;
  }

  if (hasCompletedQuiz()) {
    return <Navigate to="/map" replace />;
  }

  return <Navigate to="/quiz" replace />;
}

/**
 * Route guard pentru rute protejate (/quiz, /map, etc.):
 * - Redirecționează utilizatorii neautentificați către /auth
 * - Opțional (requireQuiz), dacă quiz-ul nu a fost completat încă, redirecționează către /quiz
 */
export function ProtectedRoute({ children, requireQuiz = false }) {
  const { isLoggedIn, hasCompletedQuiz } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (requireQuiz && !hasCompletedQuiz()) {
    return <Navigate to="/quiz" replace />;
  }

  return children;
}

/**
 * Route guard pentru rute destinate doar vizitatorilor neautentificați (/auth, /login):
 * - Dacă utilizatorul este deja logat, este redirecționat către /map (dacă a făcut quiz-ul) sau /quiz
 */
export function PublicRoute({ children }) {
  const { isLoggedIn, hasCompletedQuiz } = useAuth();

  if (isLoggedIn) {
    return <Navigate to={hasCompletedQuiz() ? '/map' : '/quiz'} replace />;
  }

  return children;
}
