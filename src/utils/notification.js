// src/utils/notification.js
import { ref, readonly } from 'vue';

// Estado reactivo que compartiremos en toda la app
const show = ref(false);
const message = ref('');
const type = ref('success');

// Temporizador para ocultar la notificación
let timeoutId = null;

// La función que llamaremos desde cualquier componente
export function useNotification() {
  const showNotification = (newMessage, newType = 'success', duration = 3000) => {
    message.value = newMessage;
    type.value = newType;
    show.value = true;

    // Limpiamos cualquier temporizador anterior para evitar solapamientos
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Ocultamos la notificación después de la duración especificada
    timeoutId = setTimeout(() => {
      show.value = false;
    }, duration);
  };

  return {
    // Exportamos los estados como `readonly` para que no se puedan modificar directamente
    notificationShow: readonly(show),
    notificationMessage: readonly(message),
    notificationType: readonly(type),
    // Exportamos la función que permite mostrar notificaciones
    showNotification,
  };
}