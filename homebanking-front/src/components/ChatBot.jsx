import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import chatbotFaqs from '../data/chatbotFaqs';

// Asistente de ayuda: solo responde con la guía fija de preguntas
// frecuentes de arriba. No hay campo de texto libre ni llamadas a la
// API — el usuario elige una pregunta y el bot muestra su respuesta.
export default function ChatBot() {
  const [abierto, setAbierto] = useState(false);
  const [historial, setHistorial] = useState([]);
  const finRef = useRef(null);

  useEffect(() => {
    if (abierto) finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [historial, abierto]);

  const preguntar = (faq) => {
    setHistorial((prev) => [...prev, faq]);
  };

  const reiniciar = () => setHistorial([]);

  return (
    <>
      <button
        className="chatbot-fab"
        onClick={() => setAbierto((v) => !v)}
        title={abierto ? 'Cerrar asistente' : 'Abrir asistente'}
      >
        <Icon name={abierto ? 'x' : 'chat'} size={24} />
      </button>

      {abierto && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <div className="chatbot-header-title">
              <Icon name="leaf" size={18} />
              Asistente Tree Bank
            </div>
            <button className="btn-icon-ghost" onClick={() => setAbierto(false)} title="Cerrar">
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className="chatbot-body">
            <div className="chatbot-bubble chatbot-bubble-bot">
              ¡Hola! Soy la guía de Tree Bank. Elegí una consulta de la lista y te muestro la
              respuesta.
            </div>

            {historial.map((faq, i) => (
              <div key={i}>
                <div className="chatbot-bubble chatbot-bubble-user">{faq.pregunta}</div>
                <div className="chatbot-bubble chatbot-bubble-bot">{faq.respuesta}</div>
              </div>
            ))}
            <div ref={finRef} />
          </div>

          <div className="chatbot-topics">
            {chatbotFaqs.map((faq) => (
              <button key={faq.pregunta} className="chatbot-topic" onClick={() => preguntar(faq)}>
                {faq.pregunta}
              </button>
            ))}
            {historial.length > 0 && (
              <button className="chatbot-topic chatbot-topic-reset" onClick={reiniciar}>
                Reiniciar conversación
              </button>
            )}
          </div>

          <p className="chatbot-footnote">
            Guía informativa: no accede a tu cuenta ni pide datos personales.
          </p>
        </div>
      )}
    </>
  );
}
