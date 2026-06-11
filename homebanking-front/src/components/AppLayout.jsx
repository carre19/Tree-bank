import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TreeBankLogo from './TreeBankLogo';
import Icon from './Icon';

const NAV_ITEMS = [
  { to: '/dashboard',      icon: 'home',    label: 'Inicio' },
  { to: '/transferencias', icon: 'send',    label: 'Transferir' },
  { to: '/depositos',      icon: 'deposit', label: 'Depositar' },
  { to: '/historial',      icon: 'history', label: 'Movimientos' },
  { to: '/perfil',         icon: 'user',    label: 'Mi perfil' },
];

// Shell compartido: sidebar en desktop, topbar + bottom-nav en mobile
export default function AppLayout({ children }) {
  const { usuario, logout, foto } = useAuth();
  const navigate = useNavigate();

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

        <div className="sidebar-user">
          {avatar}
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">
              {usuario?.nombre} {usuario?.apellido || ''}
            </div>
            <div className="sidebar-user-dni">DNI {usuario?.dni}</div>
          </div>
          <button className="btn-icon-ghost" onClick={handleLogout} title="Cerrar sesión">
            <Icon name="logout" size={17} />
          </button>
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
        {NAV_ITEMS.map((item) => (
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
    </div>
  );
}
