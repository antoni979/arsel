<!-- src/App.vue -->
<script setup>
import { computed, onMounted, onUnmounted, onUpdated, provide } from 'vue';
import { useRoute } from 'vue-router';
import DefaultLayout from './layouts/DefaultLayout.vue';
import BlankLayout from './layouts/BlankLayout.vue';
import Notification from './components/Notification.vue';
import ConfirmModal from './components/ConfirmModal.vue';
import { useNotification } from './utils/notification';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import ReloadPWA from './components/ReloadPWA.vue';
import { initializeQueue, processQueue } from './utils/syncQueue';

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW();

const handleUpdateServiceWorker = async () => {
  await updateServiceWorker();
};

// --- INICIO DE LA MODIFICACIÓN: Nuevo handler para visibilidad ---
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    // Cuando la app vuelve a ser visible, intentamos sincronizar.
    console.log("App is visible again, attempting to sync queue.");
    processQueue();
  }
};
// --- FIN DE LA MODIFICACIÓN ---

onMounted(() => {
  console.log('[App.vue] Componente montado en el DOM.');
  initializeQueue();
  window.addEventListener('online', processQueue);
  // --- INICIO DE LA MODIFICACIÓN: Añadimos el nuevo listener ---
  document.addEventListener('visibilitychange', handleVisibilityChange);
  // --- FIN DE LA MODIFICACIÓN ---
});

onUnmounted(() => {
  window.removeEventListener('online', processQueue);
  // --- INICIO DE LA MODIFICACIÓN: Limpiamos el nuevo listener ---
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  // --- FIN DE LA MODIFICACIÓN ---
});

onUpdated(() => console.log('[App.vue] Componente actualizado (cambio de layout o ruta).'));

const { notificationShow, notificationMessage, notificationType, confirmShow, confirmTitle, confirmMessage, showNotification, showConfirm, confirmYes, confirmNo } = useNotification();
provide('showNotification', showNotification);
provide('showConfirm', showConfirm);
provide('confirmYes', confirmYes);
provide('confirmNo', confirmNo);

const route = useRoute();
const layout = computed(() => {
  const layoutName = route.meta.layout === 'Blank' ? 'BlankLayout' : 'DefaultLayout';
  console.log(`[App.vue] Layout computado es: ${layoutName}`);
  return layoutName === 'BlankLayout' ? BlankLayout : DefaultLayout;
});
</script>

<template>
  <ReloadPWA 
    :offline-ready="offlineReady" 
    :need-refresh="needRefresh" 
    @update-service-worker="handleUpdateServiceWorker" 
  />
  
  <component :is="layout" />
  
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