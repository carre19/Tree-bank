import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

// Switch de tema: dos opciones con una pastilla que se desliza.
// `flotante` lo fija arriba a la derecha (pantallas de login/registro).
export default function ThemeToggle({ flotante = false }) {
  const { tema, setTema } = useTheme();

  return (
    <div
      className={`theme-toggle${flotante ? ' theme-toggle-float' : ''}`}
      data-active={tema}
      role="group"
      aria-label="Tema de la aplicación"
    >
      <span className="theme-toggle-thumb" aria-hidden="true" />
      <button
        type="button"
        className={`theme-toggle-opt${tema === 'light' ? ' active' : ''}`}
        onClick={() => setTema('light')}
        title="Modo claro"
        aria-pressed={tema === 'light'}
      >
        <Icon name="sun" size={16} />
      </button>
      <button
        type="button"
        className={`theme-toggle-opt${tema === 'dark' ? ' active' : ''}`}
        onClick={() => setTema('dark')}
        title="Modo oscuro"
        aria-pressed={tema === 'dark'}
      >
        <Icon name="moon" size={15} />
      </button>
    </div>
  );
}
