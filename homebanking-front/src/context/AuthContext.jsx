import { createContext, useContext, useState, useEffect } from 'react';

// El AuthContext guarda el usuario logueado y el token en toda la app
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  // Splash de bienvenida. Tiene dos modos: 'ingreso' cuando alguien acaba de
  // loguearse (lo saluda por el nombre) y 'reapertura' cuando vuelve a abrir
  // la app con la sesion ya guardada, sin saludo porque no esta entrando de
  // nuevo. Se decide aca, en el estado inicial, y no en el useEffect de abajo:
  // el efecto corre despues del primer render, asi que por un frame se veria
  // el spinner gris antes del splash.
  const [splash, setSplash] = useState(
    () => (localStorage.getItem('token') && localStorage.getItem('usuario')) ? 'reapertura' : false
  );
  const [foto, setFotoState] = useState(null); // foto de perfil (base64 en localStorage)

  // Al iniciar la app, revisamos si ya habia un token guardado
  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioGuardado = localStorage.getItem('usuario');
    if (token && usuarioGuardado) {
      setUsuario(JSON.parse(usuarioGuardado));
    }
    setCargando(false);
  }, []);

  // Cargar la foto guardada de este usuario (clave por DNI)
  useEffect(() => {
    if (usuario?.dni) {
      setFotoState(localStorage.getItem(`tb_foto_${usuario.dni}`) || null);
    } else {
      setFotoState(null);
    }
  }, [usuario]);

  // Guardar/quitar la foto de perfil
  const setFoto = (dataUrl) => {
    if (!usuario?.dni) return;
    if (dataUrl) localStorage.setItem(`tb_foto_${usuario.dni}`, dataUrl);
    else localStorage.removeItem(`tb_foto_${usuario.dni}`);
    setFotoState(dataUrl);
  };

  const login = (token, datosUsuario) => {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(datosUsuario));
    setUsuario(datosUsuario);
    setSplash('ingreso'); // splash completo, con el saludo por nombre
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, login, logout, cargando, splash, setSplash, foto, setFoto }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook para usar el contexto facilmente
export function useAuth() {
  return useContext(AuthContext);
}
