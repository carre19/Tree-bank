import { createContext, useContext, useEffect, useState } from 'react';

// Tema claro/oscuro. Se aplica con data-theme en <html>, que es de donde
// cuelgan todos los tokens de color (ver index.css).
const ThemeContext = createContext(null);

const CLAVE = 'tb_theme';

// Preferencia guardada; si no hay, la del sistema operativo
const temaInicial = () => {
  const guardado = localStorage.getItem(CLAVE);
  if (guardado === 'light' || guardado === 'dark') return guardado;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(temaInicial);

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem(CLAVE, tema);
    // La barra del navegador en mobile acompaña el fondo de la app
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', tema === 'dark' ? '#071a11' : '#d9d6c8');
  }, [tema]);

  // Si el usuario nunca eligió, seguimos los cambios del sistema
  useEffect(() => {
    if (localStorage.getItem(CLAVE)) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const alCambiar = (e) => setTema(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);

  const alternarTema = () => setTema((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ tema, setTema, alternarTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
