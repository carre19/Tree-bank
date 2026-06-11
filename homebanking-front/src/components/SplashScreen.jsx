import { useEffect, useState } from 'react';

// Splash de bienvenida post-login: los árboles de Tree Bank "crecen"
// y la pantalla se funde hacia el dashboard.
export default function SplashScreen({ nombre, onFin }) {
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSaliendo(true), 2500);
    const t2 = setTimeout(onFin, 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onFin]);

  return (
    <div className={`splash${saliendo ? ' splash-out' : ''}`}>
      <div className="splash-glow" />
      <div className="splash-ring" />
      <div className="splash-ring r2" />

      <div className="splash-center">
        <svg className="splash-logo" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sp-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a7f3d0" />
              <stop offset="1" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="sp-grad-2" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6ee7b7" />
              <stop offset="1" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Árbol izquierdo */}
          <g className="splash-tree t1">
            <polygon points="18,72 30,40 42,72" fill="url(#sp-grad-2)" />
            <polygon points="20,60 30,30 40,60" fill="url(#sp-grad-2)" />
            <rect x="27" y="72" width="6" height="10" rx="2" fill="url(#sp-grad-2)" />
          </g>

          {/* Árbol central (más grande) */}
          <g className="splash-tree t2">
            <polygon points="35,75 50,32 65,75" fill="url(#sp-grad)" />
            <polygon points="37,62 50,22 63,62" fill="url(#sp-grad)" />
            <rect x="46" y="75" width="8" height="12" rx="2" fill="url(#sp-grad)" />
          </g>

          {/* Árbol derecho */}
          <g className="splash-tree t3">
            <polygon points="58,72 70,40 82,72" fill="url(#sp-grad-2)" />
            <polygon points="60,60 70,30 80,60" fill="url(#sp-grad-2)" />
            <rect x="67" y="72" width="6" height="10" rx="2" fill="url(#sp-grad-2)" />
          </g>

          {/* Base (se dibuja de centro hacia afuera) */}
          <rect className="splash-base" x="12" y="84" width="76" height="4" rx="2" fill="url(#sp-grad)" />
        </svg>

        <h1 className="splash-title">TREE BANK</h1>
        <p className="splash-sub">Tu banco, tu naturaleza.</p>
        {nombre && <p className="splash-hola">Hola, {nombre} 👋</p>}
      </div>
    </div>
  );
}
