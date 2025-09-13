<!-- src/App.vue -->
<script setup>
import { computed, onMounted, onUpdated } from 'vue';
import { useRoute } from 'vue-router';
import DefaultLayout from './layouts/DefaultLayout.vue';
import BlankLayout from './layouts/BlankLayout.vue';

// --- LOGS DE DEBUG ---
onMounted(() => console.log('[App.vue] Componente montado en el DOM.'));
onUpdated(() => console.log('[App.vue] Componente actualizado (cambio de layout o ruta).'));

const route = useRoute();
const layout = computed(() => {
  const layoutName = route.meta.layout === 'Blank' ? 'BlankLayout' : 'DefaultLayout';
  // --- LOGS DE DEBUG ---
  console.log(`[App.vue] Layout computado es: ${layoutName}`);
  return layoutName === 'BlankLayout' ? BlankLayout : DefaultLayout;
});
</script>

<template>
  <component :is="layout" />
</template>