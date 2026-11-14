import Hunt from './pages/hunt';
import './components/map.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage';

export default function App() {
  return (
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Pagina principală rămâne exact harta colegei tale */}
            <Route path="/" element={<Hunt />} />

            {/* Pagina ta de Login/Register */}
            <Route path="/auth" element={<AuthPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
  );
}