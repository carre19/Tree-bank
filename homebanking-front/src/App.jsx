import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import SplashScreen from './components/SplashScreen';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AbrirCuentaPage from './pages/AbrirCuentaPage';
import DashboardPage from './pages/DashboardPage';
import TransferenciasPage from './pages/TransferenciasPage';
import HistorialPage from './pages/HistorialPage';
import DepositosPage from './pages/DepositosPage';
import PerfilPage from './pages/PerfilPage';

// Ruta protegida: si no esta logueado, manda al login
function RutaPrivada({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh', justifyContent: 'center' }}>
        <div className="spinner" />
        Cargando…
      </div>
    );
  }
  return usuario ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { usuario, splash, setSplash } = useAuth();
  return (
    <>
      {/* Splash de bienvenida al ingresar */}
      {splash && <SplashScreen nombre={usuario?.nombre} onFin={() => setSplash(false)} />}

      <Routes>
        <Route path="/" element={<Navigate to={usuario ? '/dashboard' : '/login'} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/abrir-cuenta" element={<AbrirCuentaPage />} />
        <Route path="/dashboard" element={<RutaPrivada><DashboardPage /></RutaPrivada>} />
        <Route path="/transferencias" element={<RutaPrivada><TransferenciasPage /></RutaPrivada>} />
        <Route path="/historial" element={<RutaPrivada><HistorialPage /></RutaPrivada>} />
        <Route path="/depositos" element={<RutaPrivada><DepositosPage /></RutaPrivada>} />
        <Route path="/perfil" element={<RutaPrivada><PerfilPage /></RutaPrivada>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
