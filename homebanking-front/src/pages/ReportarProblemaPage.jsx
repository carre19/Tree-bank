import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

export default function ReportarProblemaPage() {
  const { usuario } = useAuth();
  const location = useLocation();

  const [descripcion, setDescripcion] = useState('');
  const [contacto, setContacto] = useState(usuario?.dni ? `DNI ${usuario.dni}` : '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  // Mis reportes: solo tiene sentido si esta logueado (los anonimos no quedan
  // asociados a nadie, asi que no hay forma de que el usuario los vuelva a ver)
  const [misReportes, setMisReportes] = useState([]);
  const [cargandoMisReportes, setCargandoMisReportes] = useState(false);

  const cargarMisReportes = useCallback(async () => {
    if (!usuario) return;
    setCargandoMisReportes(true);
    try {
      const res = await api.get('/reportes/mios');
      setMisReportes(res.data);
    } catch {
      // silencioso: no tapar el formulario de reporte por un error al listar
    } finally {
      setCargandoMisReportes(false);
    }
  }, [usuario]);

  useEffect(() => {
    cargarMisReportes();
  }, [cargarMisReportes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (descripcion.trim().length < 10) {
      setError('Contanos el problema con al menos 10 caracteres, para que podamos entender qué pasó');
      return;
    }

    setEnviando(true);
    try {
      await api.post('/reportes', {
        descripcion: descripcion.trim(),
        // Página desde la que se reporta, útil para que el equipo lo reproduzca rápido
        pagina: location.state?.origen || '/reportar-problema',
        contacto: contacto.trim() || undefined,
      });
      setEnviado(true);
      setDescripcion('');
      cargarMisReportes();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo enviar el reporte. Probá de nuevo en unos minutos.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Reportar un problema</h1>
        <p className="page-sub">
          Contanos qué encontraste raro o que no funcionó. El reporte le llega directo al equipo.
        </p>
      </div>

      <div className="card anim-up-1">
        {enviado ? (
          <div className="alert alert-success" style={{ marginBottom: 0 }}>
            <Icon name="check" size={16} />
            <span>Gracias, recibimos tu reporte. El equipo lo va a revisar.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="label">¿Qué pasó?</label>
              <textarea
                className="input"
                rows={5}
                placeholder="Ej: al confirmar una transferencia, la pantalla se queda cargando y no muestra el comprobante."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={2000}
              />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{descripcion.length}/2000</span>
            </div>

            <div className="field">
              <label className="label">
                Contacto <span className="optional">(opcional, por si necesitamos más info)</span>
              </label>
              <input
                className="input"
                type="text"
                placeholder="Email o teléfono"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
                maxLength={255}
              />
            </div>

            {error && (
              <div className="alert alert-error"><Icon name="alert" size={16} /> <span>{error}</span></div>
            )}

            <button className="btn-primary" type="submit" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar reporte'}
              {!enviando && <Icon name="megaphone" size={16} />}
            </button>
          </form>
        )}
      </div>

      {usuario && (
        <div className="anim-up-1">
          <h3 className="section-title">Mis reportes</h3>

          {cargandoMisReportes && (
            <div className="loading-center">
              <div className="spinner" />
              Cargando…
            </div>
          )}

          {!cargandoMisReportes && misReportes.length === 0 && (
            <div className="empty">
              <div className="empty-icon"><Icon name="megaphone" size={26} /></div>
              <p>Todavía no reportaste nada</p>
            </div>
          )}

          {misReportes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {misReportes.map((r) => (
                <div key={r.id} className="tx-item" style={{ flexWrap: 'wrap' }}>
                  <div className={`tx-icon ${r.estado === 'ABIERTO' ? 'out' : 'in'}`}>
                    <Icon name="megaphone" size={19} />
                  </div>
                  <div className="tx-info">
                    <p className="tx-desc">{r.descripcion}</p>
                    <p className="tx-date">
                      {r.pagina ? `${r.pagina} · ` : ''}
                      {new Date(r.fecha).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <span className={`tx-badge ${r.estado === 'ABIERTO' ? 'out' : 'in'}`}>
                    {r.estado === 'ABIERTO' ? 'Abierto' : 'Resuelto'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}
