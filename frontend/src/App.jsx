import Hunt from './pages/hunt';
import SetupPage from './pages/SetupPage';
import './components/map.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage';

export default function App() {
  return (
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Pagina principală cu Harta și Bingo AI */}
            <Route path="/" element={<Hunt />} />
            <Route path="/hunt" element={<Hunt />} />
            <Route path="/main" element={<Hunt />} />

            {/* Pagina de Quiz / Setup preferințe */}
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/quiz" element={<SetupPage />} />

            {/* Pagina de Login/Register */}
            <Route path="/auth" element={<AuthPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
  );
}