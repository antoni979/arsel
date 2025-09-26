<!-- src/components/ReloadPWA.vue -->
<script setup>
defineProps({
  offlineReady: Boolean,
  needRefresh: Boolean,
});

const emit = defineEmits(['update-service-worker']);

const updateSW = () => {
  emit('update-service-worker');
};
</script>

<template>
  <div v-if="needRefresh" role="alert" class="fixed right-0 bottom-0 m-4 p-4 border rounded-lg shadow-lg bg-white z-[100]">
    <div class="flex items-start gap-4">
      <div class="flex-1">
        <p class="font-bold">Nueva versión disponible</p>
        <p class="text-sm">Hay una actualización pendiente. Por favor, recarga la página.</p>
      </div>
      <button @click="updateSW" class="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
        Recargar
      </button>
    </div>
  </div>
</template>