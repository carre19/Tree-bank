import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import SplashScreen from './components/SplashScreen';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AbrirCuentaPage from './pages/AbrirCuentaPage';
import DashboardPage from './pages/DashboardPage';
import TransferenciasPage from './pages/TransferenciasPage';
import HistorialPage from './pages/HistorialPage';
import DepositosPage from './pages/DepositosPage';
import PrestamosPage from './pages/PrestamosPage';
import CambioPage from './pages/CambioPage';
import TarjetasPage from './pages/TarjetasPage';
import SegurosPage from './pages/SegurosPage';
import ReservasPage from './pages/ReservasPage';
import PerfilPage from './pages/PerfilPage';
import AdminPage from './pages/AdminPage';

function Cargando() {
  return (
    <div className="loading-center" style={{ minHeight: '100vh', justifyContent: 'center' }}>
      <div className="spinner" />
      Cargando…
    </div>
  );
}

// Ruta protegida: si no esta logueado, manda al login.
// Los administradores no operan cuentas propias, asi que van directo al panel admin.
function RutaPrivada({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" />;
  if (usuario.esAdmin) return <Navigate to="/admin" />;
  return children;
}

// Ruta exclusiva del panel de administrador
function RutaAdmin({ children }) {
  const { usuario, cargando } = useAuth();
  if (cargando) return <Cargando />;
  if (!usuario) return <Navigate to="/login" />;
  return usuario.esAdmin ? children : <Navigate to="/dashboard" />;
}

function AppRoutes() {
  const { usuario, splash, setSplash } = useAuth();
  const inicio = usuario ? (usuario.esAdmin ? '/admin' : '/dashboard') : '/login';
  return (
    <>
      {/* Splash de bienvenida al ingresar */}
      {splash && <SplashScreen nombre={usuario?.nombre} onFin={() => setSplash(false)} />}

      <Routes>
        <Route path="/" element={<Navigate to={inicio} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/olvide-password" element={<ForgotPasswordPage />} />
        <Route path="/abrir-cuenta" element={<AbrirCuentaPage />} />
        <Route path="/dashboard" element={<RutaPrivada><DashboardPage /></RutaPrivada>} />
        <Route path="/transferencias" element={<RutaPrivada><TransferenciasPage /></RutaPrivada>} />
        <Route path="/historial" element={<RutaPrivada><HistorialPage /></RutaPrivada>} />
        <Route path="/depositos" element={<RutaPrivada><DepositosPage /></RutaPrivada>} />
        <Route path="/prestamos" element={<RutaPrivada><PrestamosPage /></RutaPrivada>} />
        <Route path="/cambio" element={<RutaPrivada><CambioPage /></RutaPrivada>} />
        <Route path="/tarjetas" element={<RutaPrivada><TarjetasPage /></RutaPrivada>} />
        <Route path="/seguros" element={<RutaPrivada><SegurosPage /></RutaPrivada>} />
        <Route path="/reservas" element={<RutaPrivada><ReservasPage /></RutaPrivada>} />
        <Route path="/perfil" element={<RutaPrivada><PerfilPage /></RutaPrivada>} />
        <Route path="/admin" element={<RutaAdmin><AdminPage /></RutaAdmin>} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
