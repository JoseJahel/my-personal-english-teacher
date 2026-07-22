/**
 * Textos de interfaz de la pantalla inicial de la aplicación.
 *
 * Este es el ÚNICO lugar del código donde deben vivir cadenas de texto
 * visibles para la persona usuaria. Ningún componente de `ui/` debería
 * escribir texto en español directamente en su JSX: en su lugar, importa
 * los valores de este objeto. Esto facilita mantener el idioma consistente
 * y, más adelante, extraer estos textos a un sistema de traducción si hiciera falta.
 */
export const homeScreenInterfaceTexts = {
  applicationTitle: 'My Personal English Teacher',
  applicationSubtitle:
    'Practica inglés sin conexión: pronunciación, gramática y conversación con inteligencia artificial que corre en tu propio navegador.',
  projectPhaseBadgeLabel: 'Fase: Avance 1 — Procesamiento de señales',
  startMicrophoneButtonLabel: 'Iniciar micrófono',
  stopMicrophoneButtonLabel: 'Detener micrófono',
  statusFieldLabel: 'Estado',
  /**
   * Mensajes de estado de la captura de micrófono, uno por cada valor posible
   * del estado de la interfaz (esperando / arrancando / escuchando / detenido
   * / permiso denegado / error genérico).
   */
  microphoneStatusMessages: {
    idle: 'Esperando interacción...',
    starting: 'Solicitando acceso al micrófono...',
    listening: 'Escuchando voz y procesando señal en tiempo real...',
    stopped: 'Captura detenida.',
    permissionDenied:
      'Permiso de micrófono denegado. Habilítalo en la configuración del navegador para poder practicar.',
    genericError: 'No fue posible acceder al micrófono por un error inesperado.',
  },
} as const
