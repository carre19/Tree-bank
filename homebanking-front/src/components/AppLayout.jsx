import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TreeBankLogo from './TreeBankLogo';
import Icon from './Icon';
import ChatBot from './ChatBot';
import ThemeToggle from './ThemeToggle';

// Sidebar (desktop): solo lo esencial. El resto (Depositar, Cambio,
// Prestamos, Tarjetas, Seguros, Reservas) se accede desde los accesos
// rapidos del Inicio, para no repetir todo en dos lugares.
const NAV_ITEMS_CLIENTE = [
  { to: '/dashboard',      icon: 'home',    label: 'Inicio' },
  { to: '/transferencias', icon: 'send',    label: 'Transferir' },
  { to: '/perfil',         icon: 'user',    label: 'Mi perfil' },
  { to: '/historial',      icon: 'history', label: 'Movimientos' },
];

// Bottom nav (mobile): solo lo esencial. El resto (Depositar, Cambio,
// Prestamos, Tarjetas) se accede desde los accesos rapidos del Inicio.
const NAV_ITEMS_CLIENTE_MOBILE = [
  { to: '/dashboard',      icon: 'home',    label: 'Inicio' },
  { to: '/transferencias', icon: 'send',    label: 'Transferir' },
  { to: '/historial',      icon: 'history', label: 'Movimientos' },
  { to: '/perfil',         icon: 'user',    label: 'Mi perfil' },
];

// Los administradores solo gestionan cuentas, no operan una cuenta propia
const NAV_ITEMS_ADMIN = [
  { to: '/admin', icon: 'shield', label: 'Cuentas' },
];

// Shell compartido: sidebar en desktop, topbar + bottom-nav en mobile
export default function AppLayout({ children }) {
  const { usuario, logout, foto } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const NAV_ITEMS = usuario?.esAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS_CLIENTE;
  const NAV_ITEMS_MOBILE = usuario?.esAdmin ? NAV_ITEMS_ADMIN : NAV_ITEMS_CLIENTE_MOBILE;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const iniciales = `${usuario?.nombre?.[0] || ''}${usuario?.apellido?.[0] || ''}`.toUpperCase() || '?';

  // Avatar con foto (si hay) o iniciales
  const avatar = (
    <div className="avatar avatar-sm">
      {foto ? <img src={foto} alt="Foto de perfil" /> : iniciales}
    </div>
  );

  return (
    <div className="app-shell">
      {/* ── Sidebar (desktop) ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <TreeBankLogo size={34} showText={false} />
          <span className="sidebar-logo-txt">TREE BANK</span>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon name={item.icon} size={19} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button
            className="nav-item"
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            onClick={() => navigate('/reportar-problema', { state: { origen: location.pathname } })}
          >
            <Icon name="megaphone" size={19} />
            Reportar un problema
          </button>

          <ThemeToggle />

          <div className="sidebar-user">
            {avatar}
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {usuario?.nombre} {usuario?.apellido || ''}
              </div>
              <div className="sidebar-user-dni">{usuario?.esAdmin ? 'Administrador' : `DNI ${usuario?.dni}`}</div>
            </div>
            <button className="btn-icon-ghost" onClick={handleLogout} title="Cerrar sesión">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Contenido ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Topbar (mobile) */}
        <header className="topbar">
          <div className="topbar-brand">
            <TreeBankLogo size={28} showText={false} />
            <span className="topbar-brand-txt">TREE BANK</span>
          </div>
          <div className="topbar-right">
            <button
              className="btn-icon-ghost"
              onClick={() => navigate('/reportar-problema', { state: { origen: location.pathname } })}
              title="Reportar un problema"
            >
              <Icon name="megaphone" size={17} />
            </button>
            <ThemeToggle />
            {avatar}
            <button className="btn-icon-ghost" onClick={handleLogout} title="Cerrar sesión">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </header>

        <main className="main-content">{children}</main>
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="bottombar">
        {NAV_ITEMS_MOBILE.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `bottombar-item${isActive ? ' active' : ''}`}
          >
            <Icon name={item.icon} size={21} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <ChatBot />
    </div>
  );
}
