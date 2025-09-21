// src/utils/notification.js
import { ref, readonly } from 'vue';

// Estado reactivo que compartiremos en toda la app
const show = ref(false);
const message = ref('');
const type = ref('success');

// Estado para confirm modal
const confirmShow = ref(false);
const confirmTitle = ref('');
const confirmMessage = ref('');
let confirmResolve = null;

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

  const showConfirm = (title, msg) => {
    return new Promise((resolve) => {
      confirmTitle.value = title;
      confirmMessage.value = msg;
      confirmShow.value = true;
      confirmResolve = resolve;
    });
  };

  const confirmYes = () => {
    confirmShow.value = false;
    if (confirmResolve) confirmResolve(true);
  };

  const confirmNo = () => {
    confirmShow.value = false;
    if (confirmResolve) confirmResolve(false);
  };

  return {
    // Exportamos los estados como `readonly` para que no se puedan modificar directamente
    notificationShow: readonly(show),
    notificationMessage: readonly(message),
    notificationType: readonly(type),
    // Confirm modal
    confirmShow: readonly(confirmShow),
    confirmTitle: readonly(confirmTitle),
    confirmMessage: readonly(confirmMessage),
    // Exportamos la función que permite mostrar notificaciones
    showNotification,
    showConfirm,
    confirmYes,
    confirmNo,
  };
}