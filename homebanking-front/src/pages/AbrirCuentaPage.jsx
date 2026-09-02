import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import TreeBankLogo from '../components/TreeBankLogo';
import Icon from '../components/Icon';
import api from '../api/api';
import ThemeToggle from '../components/ThemeToggle';

// Alta de cliente (punto 4.1 de la documentación, paso 1):
// crea la persona en el Banco Central, que asigna CBU y alias.
export default function AbrirCuentaPage() {
  const [nombre, setNombre]     = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni]           = useState('');
  const [cuenta, setCuenta]     = useState(null); // { cbu, alias, mensaje }
  const [error, setError]       = useState('');
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (nombre.trim().length < 2) return setError('El nombre debe tener al menos 2 caracteres');
    if (apellido.trim().length < 2) return setError('El apellido debe tener al menos 2 caracteres');
    if (!/^\d{7,8}$/.test(dni)) return setError('El DNI debe tener 7 u 8 dígitos numéricos');

    setCargando(true);
    try {
      const res = await api.post('/personas', { nombre: nombre.trim(), apellido: apellido.trim(), dni });
      setCuenta({ cbu: res.data.cbu, alias: res.data.alias, mensaje: res.data.mensaje });
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo abrir la cuenta. ¿Está corriendo el backend?');
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

        {!cuenta ? (
          <>
            <h1 className="auth-title">Abrí tu cuenta</h1>
            <p className="auth-sub">
              Completá tus datos. El Banco Central te asigna un CBU y un alias al instante.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label className="label">Nombre</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Ej: Juan"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="label">Apellido</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Ej: Pérez"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="label">DNI</label>
                <input
                  className="input"
                  type="text"
                  inputMode="numeric"
                  placeholder="7 u 8 dígitos, sin puntos"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  maxLength={8}
                  required
                />
              </div>

              {error && (
                <div className="alert alert-error">
                  <Icon name="alert" size={16} /> {error}
                </div>
              )}

              <button className="btn-primary" type="submit" disabled={cargando}>
                {cargando ? 'Abriendo cuenta…' : 'Abrir mi cuenta'}
                {!cargando && <Icon name="leaf" size={16} />}
              </button>
            </form>

            <p className="auth-footer">
              ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
            </p>
          </>
        ) : (
          <>
            <div className="receipt-check">
              <Icon name="check" size={28} strokeWidth={3} />
            </div>
            <h1 className="auth-title">¡Cuenta creada!</h1>
            <p className="auth-sub">{cuenta.mensaje || 'Tu cuenta ya está activa en Tree Bank.'}</p>

            <div className="receipt">
              <div className="receipt-row"><span className="k">Titular</span><span className="v">{nombre} {apellido}</span></div>
              <div className="receipt-row"><span className="k">DNI</span><span className="v">{dni}</span></div>
              <div className="receipt-row"><span className="k">CBU</span><span className="v">{cuenta.cbu}</span></div>
              <div className="receipt-row"><span className="k">Alias</span><span className="v">{cuenta.alias}</span></div>
            </div>

            <div className="alert alert-info">
              <Icon name="info" size={16} />
              <span>Guardá tu CBU y alias. Ahora creá tu contraseña para entrar al homebanking.</span>
            </div>

            <button
              className="btn-primary"
              onClick={() => navigate('/register', { state: { dni } })}
            >
              Crear mi contraseña
              <Icon name="key" size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
