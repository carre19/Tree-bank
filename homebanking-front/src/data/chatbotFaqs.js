// Guía estática del asistente: preguntas frecuentes con respuesta fija.
// No llama a ninguna API ni accede a datos del backend — es solo texto de ayuda.
const chatbotFaqs = [
  {
    pregunta: '¿Cómo transfiero dinero?',
    respuesta:
      'Andá a "Transferir", ingresá el CBU o alias del destinatario, el monto y confirmá. Podés guardar el contacto para la próxima vez.',
  },
  {
    pregunta: '¿Qué son el CBU y el alias?',
    respuesta:
      'El CBU es el número único de tu cuenta (22 dígitos). El alias es un nombre fácil de recordar que lo reemplaza para recibir transferencias.',
  },
  {
    pregunta: '¿Cómo deposito dinero en efectivo?',
    respuesta:
      'Desde "Depositar", ingresá el monto y confirmá. El saldo se acredita al instante en tu cuenta.',
  },
  {
    pregunta: '¿Dónde veo mis movimientos?',
    respuesta:
      'En "Movimientos" está el historial completo, con filtros por fecha o tipo y un gráfico del flujo de tu dinero.',
  },
  {
    pregunta: '¿Cómo cambio mi contraseña o mi alias?',
    respuesta:
      'Entrá a "Mi perfil": ahí podés editar tu foto, cambiar tu alias y actualizar tu contraseña.',
  },
  {
    pregunta: '¿Cómo abro una cuenta nueva?',
    respuesta:
      'Desde la pantalla de inicio, antes de loguearte, tocá "Abrir cuenta". El banco te asigna un CBU y un alias automáticamente.',
  },
  {
    pregunta: '¿Para qué sirven Préstamos y Cambio?',
    respuesta:
      '"Préstamos" te permite simular y solicitar un crédito. "Cambio" te permite convertir entre las monedas disponibles en tu cuenta.',
  },
  {
    pregunta: '¿Mi cuenta está sincronizada con el Banco Central?',
    respuesta:
      'Sí, tu cuenta se sincroniza automáticamente con el Banco Central cada 15 minutos para mantener el saldo y los movimientos al día.',
  },
]

export default chatbotFaqs
