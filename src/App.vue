<!-- src/App.vue -->
<script setup>
import { computed, onMounted, onUpdated, provide } from 'vue'; // Importamos 'provide'
import { useRoute } from 'vue-router';
import DefaultLayout from './layouts/DefaultLayout.vue';
import BlankLayout from './layouts/BlankLayout.vue';
import Notification from './components/Notification.vue'; // Importamos el componente
import { useNotification } from './utils/notification'; // Importamos el servicio

// --- LOGS DE DEBUG ---
onMounted(() => console.log('[App.vue] Componente montado en el DOM.'));
onUpdated(() => console.log('[App.vue] Componente actualizado (cambio de layout o ruta).'));

// --- SISTEMA DE NOTIFICACIONES ---
const { notificationShow, notificationMessage, notificationType, showNotification } = useNotification();
// Hacemos que la función 'showNotification' esté disponible para todos los componentes hijos
provide('showNotification', showNotification);
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
</template>