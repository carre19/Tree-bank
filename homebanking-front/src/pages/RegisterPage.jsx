import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import TreeBankLogo from '../components/TreeBankLogo';
import Icon from '../components/Icon';
import api from '../api/api';

export default function RegisterPage() {
  const location = useLocation();
  // Si venimos de "Abrir cuenta", el DNI llega precargado
  const [dni, setDni] = useState(location.state?.dni || '');
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
      const res = await api.post('/auth/register', { dni, password });
      setMensaje(res.data.mensaje);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="auth-bg">
      <div className="auth-blob b1" />
      <div className="auth-blob b2" />

      <div className="auth-card">
        <div className="auth-logo">
          <TreeBankLogo size={62} showText={true} />
        </div>

        <h1 className="auth-title">Crear contraseña</h1>
        <p className="auth-sub">
          Tu cuenta ya debe estar creada por un operador del banco.
          Acá definís tu contraseña de acceso.
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
            {cargando ? 'Guardando…' : 'Crear contraseña'}
            {!cargando && <Icon name="shield" size={16} />}
          </button>
        </form>

        <p className="auth-footer">
          ¿Ya tenés contraseña? <Link to="/login">Iniciar sesión</Link>
          {' · '}
          <Link to="/abrir-cuenta">Abrir una cuenta</Link>
        </p>
      </div>
    </div>
  );
}
