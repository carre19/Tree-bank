import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import TreeBankLogo from '../components/TreeBankLogo';
import Icon from '../components/Icon';
import api from '../api/api';
import ThemeToggle from '../components/ThemeToggle';

export default function ForgotPasswordPage() {
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMensaje('');
    if (password !== confirmar) return setError('Las contraseñas no coinciden');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');

    setCargando(true);
    try {
      const res = await api.post('/auth/olvide-password', { dni, email, password_nueva: password });
      setMensaje(res.data.mensaje);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo recuperar el acceso');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-blob b1" />
      <div className="auth-blob b2" />
      <ThemeToggle flotante />

      <div className="auth-card">
        <div className="auth-logo">
          <TreeBankLogo size={62} showText={true} />
        </div>

        <h1 className="auth-title">Recuperar acceso</h1>
        <p className="auth-sub">
          Ingresá tu DNI y el email con el que registraste tu cuenta para definir una contraseña nueva.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label">DNI</label>
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

          <div className="field">
            <label className="label">Email registrado</label>
            <input
              className="input"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="label">Nueva contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="label">Confirmar contraseña</label>
            <input
              className="input"
              type="password"
              placeholder="Repetir contraseña"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="alert alert-error">
              <Icon name="alert" size={16} /> {error}
            </div>
          )}
          {mensaje && (
            <div className="alert alert-success">
              <Icon name="check" size={16} /> {mensaje} Redirigiendo…
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={cargando}>
            {cargando ? 'Guardando…' : 'Actualizar contraseña'}
            {!cargando && <Icon name="key" size={16} />}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
