<!-- src/layouts/BlankLayout.vue -->
<script setup>
import { onMounted } from 'vue';
// --- LOGS DE DEBUG ---
onMounted(() => console.log('[BlankLayout.vue] Componente montado en el DOM.'));
</script>

<template>
  <!-- 
    CORRECCIÓN: Se elimina el div contenedor. 
    <router-view> actuará como el elemento raíz de este layout,
    permitiendo que la página que renderiza controle su propio layout al 100%.
  -->
  <router-view />
</template>