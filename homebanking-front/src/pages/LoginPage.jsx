import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TreeBankLogo from '../components/TreeBankLogo';
import Icon from '../components/Icon';
import api from '../api/api';

export default function LoginPage() {
  // Si el usuario eligió "recordar mi DNI", lo precargamos
  const [dni, setDni]           = useState(() => localStorage.getItem('tb_dni') || '');
  const [recordar, setRecordar] = useState(() => !!localStorage.getItem('tb_dni'));
  const [password, setPassword] = useState('');
  const [verPass, setVerPass]   = useState(false);
  const [error, setError]       = useState('');
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const recordarDni = () => {
    if (recordar) localStorage.setItem('tb_dni', dni);
    else localStorage.removeItem('tb_dni');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await api.post('/auth/login', { dni, password });
      recordarDni();
      login(res.data.token, res.data.usuario);
      navigate(res.data.usuario?.esAdmin ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'DNI o contraseña incorrectos');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-blob b1" />
      <div className="auth-blob b2" />

      <div className="auth-split">
        {/* ── Panel de marca (desktop) ── */}
        <div className="auth-brand">
          <TreeBankLogo size={56} showText={false} />
          <h1 className="auth-brand-title">
            Tu banco,<br />tu <span className="verde">naturaleza</span>.
          </h1>
          <p className="auth-brand-sub">
            Gestioná tu dinero de forma simple, segura y sustentable,
            desde cualquier lugar.
          </p>

          <div className="auth-feature">
            <div className="auth-feature-icon"><Icon name="send" size={19} /></div>
            <div>
              <b>Transferencias inmediatas</b>
              <p>Enviá dinero a cualquier banco por CBU o alias, en segundos.</p>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon"><Icon name="shield" size={19} /></div>
            <div>
              <b>Seguridad de punta a punta</b>
              <p>Tus datos viajan cifrados y tu sesión está protegida con token JWT.</p>
            </div>
          </div>
          <div className="auth-feature">
            <div className="auth-feature-icon"><Icon name="leaf" size={19} /></div>
            <div>
              <b>Banco sostenible</b>
              <p>Plantamos un árbol por cada cuenta activa. Tu plata, con impacto.</p>
            </div>
          </div>
        </div>

        {/* ── Tarjeta de login ── */}
        <div className="auth-card">
          <div className="auth-logo">
            <TreeBankLogo size={56} showText={true} />
          </div>

          <h2 className="auth-title">Bienvenido de vuelta</h2>
          <p className="auth-sub">Ingresá con tu DNI y contraseña para gestionar tu dinero.</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label">DNI</label>
              <div className="input-icon-wrap">
                <Icon name="user" size={17} />
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej: 35123456"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="label">Contraseña</label>
              <div className="input-icon-wrap">
                <Icon name="lock" size={17} />
                <input
                  className="input"
                  type={verPass ? 'text' : 'password'}
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: 48 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVerPass(!verPass)}
                  className="btn-icon-ghost"
                  style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)' }}
                  title={verPass ? 'Ocultar' : 'Mostrar'}
                >
                  <Icon name={verPass ? 'eyeOff' : 'eye'} size={17} />
                </button>
              </div>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={recordar}
                onChange={(e) => setRecordar(e.target.checked)}
              />
              Recordar mi DNI en este dispositivo
            </label>

            <p className="auth-footer" style={{ margin: '-4px 0 12px', textAlign: 'right' }}>
              <Link to="/olvide-password">¿Olvidaste tu contraseña?</Link>
            </p>

            {error && (
              <div className="alert alert-error">
                <Icon name="alert" size={16} /> {error}
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={cargando}>
              {cargando ? 'Ingresando…' : 'Ingresar'}
              {!cargando && <Icon name="arrowLeft" size={16} style={{ transform: 'rotate(180deg)' }} />}
            </button>
          </form>

          <p className="auth-footer">
            ¿Primera vez? <Link to="/register">Crear contraseña</Link>
            {' · '}
            <Link to="/abrir-cuenta">Abrir una cuenta</Link>
          </p>

          <p className="secure-note">
            <Icon name="lock" size={13} /> Conexión segura · Tus datos viajan cifrados
          </p>
        </div>
      </div>
    </div>
  );
}
