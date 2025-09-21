<!-- src/App.vue -->
<script setup>
import { computed, onMounted, onUpdated, provide } from 'vue'; // Importamos 'provide'
import { useRoute } from 'vue-router';
import DefaultLayout from './layouts/DefaultLayout.vue';
import BlankLayout from './layouts/BlankLayout.vue';
import Notification from './components/Notification.vue'; // Importamos el componente
import ConfirmModal from './components/ConfirmModal.vue'; // Importamos el componente de confirmación
import { useNotification } from './utils/notification'; // Importamos el servicio

// --- LOGS DE DEBUG ---
onMounted(() => console.log('[App.vue] Componente montado en el DOM.'));
onUpdated(() => console.log('[App.vue] Componente actualizado (cambio de layout o ruta).'));

// --- SISTEMA DE NOTIFICACIONES ---
const { notificationShow, notificationMessage, notificationType, confirmShow, confirmTitle, confirmMessage, showNotification, showConfirm, confirmYes, confirmNo } = useNotification();
// Hacemos que las funciones estén disponibles para todos los componentes hijos
provide('showNotification', showNotification);
provide('showConfirm', showConfirm);
provide('confirmYes', confirmYes);
provide('confirmNo', confirmNo);
// --- FIN DEL SISTEMA DE NOTIFICACIONES ---

const route = useRoute();
const layout = computed(() => {
  const layoutName = route.meta.layout === 'Blank' ? 'BlankLayout' : 'DefaultLayout';
  console.log(`[App.vue] Layout computado es: ${layoutName}`);
  return layoutName === 'BlankLayout' ? BlankLayout : DefaultLayout;
});
</script>

<template>
  <!-- El layout se renderiza como siempre -->
  <component :is="layout" />
  
  <!-- El componente de notificación vive por encima de todo -->
  <Notification
    :show="notificationShow"
    :message="notificationMessage"
    :type="notificationType"
  />
  <ConfirmModal
    :is-open="confirmShow"
    :title="confirmTitle"
    :message="confirmMessage"
    @confirm="confirmYes"
    @cancel="confirmNo"
  />
</template>