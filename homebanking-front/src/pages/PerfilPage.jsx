import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import Icon from '../components/Icon';
import api from '../api/api';

export default function PerfilPage() {
  const { usuario, foto, setFoto } = useAuth();
  const inputFotoRef = useRef(null);

  const [perfil, setPerfil]       = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [editando, setEditando]   = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito]         = useState('');
  const [error, setError]         = useState('');

  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', telefono: '', direccion: '' });

  // Cambio de password
  const [cambioPass, setCambioPass]       = useState(false);
  const [passForm, setPassForm]           = useState({ password_actual: '', password_nueva: '', confirmar: '' });
  const [passError, setPassError]         = useState('');
  const [passExito, setPassExito]         = useState('');
  const [guardandoPass, setGuardandoPass] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await api.get('/auth/perfil');
        setPerfil(res.data);
        setForm({
          nombre: res.data.nombre || '',
          apellido: res.data.apellido || '',
          email: res.data.email || '',
          telefono: res.data.telefono || '',
          direccion: res.data.direccion || '',
        });
      } catch {
        setError('No se pudo cargar el perfil');
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [usuario]);

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError('');

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return setError('El formato del email no es válido');
    }

    setGuardando(true);

    try {
      const res = await api.put('/auth/perfil', form);
      setPerfil(res.data.perfil);
      setExito('Perfil actualizado correctamente');
      setEditando(false);
      setTimeout(() => setExito(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar el perfil');
    } finally {
      setGuardando(false);
    }
  };

  const handleCambioPass = async (e) => {
    e.preventDefault();
    setPassError('');

    if (passForm.password_nueva.length < 6) {
      return setPassError('La nueva contraseña debe tener al menos 6 caracteres');
    }
    if (passForm.password_nueva !== passForm.confirmar) {
      return setPassError('Las contraseñas nuevas no coinciden');
    }

    setGuardandoPass(true);

    try {
      await api.put('/auth/cambiar-password', {
        password_actual: passForm.password_actual,
        password_nueva: passForm.password_nueva,
      });
      setPassExito('Contraseña cambiada correctamente');
      setPassForm({ password_actual: '', password_nueva: '', confirmar: '' });
      setCambioPass(false);
      setTimeout(() => setPassExito(''), 3000);
    } catch (err) {
      setPassError(err.response?.data?.error || 'No se pudo cambiar la contraseña');
    } finally {
      setGuardandoPass(false);
    }
  };

  // Procesa la imagen elegida: la achica a 256px y la guarda en el navegador
  const procesarFoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo tiene que ser una imagen (JPG, PNG…)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 256;
        const escala = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          setFoto(canvas.toDataURL('image/jpeg', 0.85));
          setExito('Foto de perfil actualizada');
          setTimeout(() => setExito(''), 3000);
        } catch {
          setError('No se pudo procesar la imagen');
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const iniciales = perfil
    ? `${perfil.nombre?.[0] || ''}${perfil.apellido?.[0] || ''}`.toUpperCase()
    : '?';

  if (cargando) {
    return (
      <AppLayout>
        <div className="loading-center">
          <div className="spinner" />
          Cargando perfil…
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="anim-up">
        <h1 className="page-title">Mi perfil</h1>
        <p className="page-sub">Tus datos personales y seguridad de la cuenta.</p>
      </div>

      {/* Avatar + nombre */}
      <div className="card anim-up-1" style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 18 }}>
        <div className="avatar-wrap">
          <div className="avatar avatar-lg">
            {foto ? <img src={foto} alt="Foto de perfil" /> : iniciales}
          </div>
          <button
            className="avatar-edit-btn"
            onClick={() => inputFotoRef.current?.click()}
            title={foto ? 'Cambiar foto' : 'Agregar foto'}
          >
            <Icon name="camera" size={14} />
          </button>
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => { procesarFoto(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, marginBottom: 3 }}>
            {perfil?.nombre} {perfil?.apellido}
          </p>
          <p style={{ color: 'var(--text-2)', fontSize: 13 }}>DNI {perfil?.dni}</p>
          {foto && (
            <button className="quitar-foto" onClick={() => setFoto(null)}>
              Quitar foto
            </button>
          )}
        </div>
      </div>

      {/* Mensajes globales */}
      {exito && (
        <div className="alert alert-success">
          <Icon name="check" size={16} /> {exito}
        </div>
      )}
      {passExito && (
        <div className="alert alert-success">
          <Icon name="check" size={16} /> {passExito}
        </div>
      )}
      {error && (
        <div className="alert alert-error">
          <Icon name="alert" size={16} /> {error}
        </div>
      )}

      {/* Datos personales */}
      <div className="card anim-up-2" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>Datos personales</h3>
          {!editando && (
            <button className="btn-outline-green" onClick={() => { setEditando(true); setError(''); }}>
              <Icon name="edit" size={14} /> Editar
            </button>
          )}
        </div>

        {!editando ? (
          <div>
            <InfoRow label="Nombre" value={perfil?.nombre || '-'} />
            <InfoRow label="Apellido" value={perfil?.apellido || '-'} />
            <InfoRow label="Email" value={perfil?.email || 'No registrado'} />
            <InfoRow label="Teléfono" value={perfil?.telefono || 'No registrado'} />
            <InfoRow label="Dirección" value={perfil?.direccion || 'No registrada'} />
          </div>
        ) : (
          <form onSubmit={handleGuardar}>
            <div className="form-grid-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <CampoInput label="Nombre" value={form.nombre} onChange={v => setForm({ ...form, nombre: v })} />
              <CampoInput label="Apellido" value={form.apellido} onChange={v => setForm({ ...form, apellido: v })} />
              <CampoInput label="Email" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="usuario@mail.com" />
              <CampoInput label="Teléfono" value={form.telefono} onChange={v => setForm({ ...form, telefono: v })} placeholder="Ej: 2944123456" />
            </div>
            <CampoInput label="Dirección" value={form.direccion} onChange={v => setForm({ ...form, direccion: v })} placeholder="Calle, número, ciudad" />

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => { setEditando(false); setError(''); }}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" style={{ flex: 1, width: 'auto' }} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Seguridad */}
      <div className="card anim-up-3">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="shield" size={17} style={{ color: 'var(--green-bright)' }} /> Seguridad
          </h3>
          {!cambioPass && (
            <button className="btn-outline-green" onClick={() => { setCambioPass(true); setPassError(''); }}>
              <Icon name="key" size={14} /> Cambiar contraseña
            </button>
          )}
        </div>

        {!cambioPass ? (
          <div>
            <InfoRow label="Contraseña" value="••••••••" />
            <InfoRow label="DNI (no editable)" value={perfil?.dni} />
          </div>
        ) : (
          <form onSubmit={handleCambioPass}>
            {passError && (
              <div className="alert alert-error">
                <Icon name="alert" size={16} /> {passError}
              </div>
            )}
            <CampoInput label="Contraseña actual" type="password" value={passForm.password_actual} onChange={v => setPassForm({ ...passForm, password_actual: v })} />
            <CampoInput label="Nueva contraseña" type="password" value={passForm.password_nueva} onChange={v => setPassForm({ ...passForm, password_nueva: v })} />
            <CampoInput label="Confirmar nueva contraseña" type="password" value={passForm.confirmar} onChange={v => setPassForm({ ...passForm, confirmar: v })} />
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => { setCambioPass(false); setPassError(''); }}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" style={{ flex: 1, width: 'auto' }} disabled={guardandoPass}>
                {guardandoPass ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <p className="info-row-label">{label}</p>
      <p className="info-row-value">{value}</p>
    </div>
  );
}

function CampoInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
