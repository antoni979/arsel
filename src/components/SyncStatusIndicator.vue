<!-- src/components/SyncStatusIndicator.vue -->
<script setup>
import { syncQueue, isProcessing } from '../utils/syncQueue';
import { CloudArrowUpIcon } from '@heroicons/vue/24/solid';
</script>

<template>
  <!-- INICIO DE LA MODIFICACIÓN: Añadimos clases para ocultar en móvil -->
  <div v-if="syncQueue.length > 0 || isProcessing"
       class="fixed bottom-4 right-4 z-[100] bg-white rounded-full shadow-lg p-3 border items-center gap-3 hidden md:flex"> 
       <!-- Se añadió 'hidden md:flex' para que solo aparezca en pantallas medianas y superiores -->
  <!-- FIN DE LA MODIFICACIÓN -->
    <CloudArrowUpIcon class="h-6 w-6 text-blue-500" :class="{ 'animate-pulse': isProcessing }" />
    <div v-if="syncQueue.length > 0">
      <p class="font-bold text-sm text-slate-700">{{ syncQueue.length }} cambio(s) en cola</p>
      <p class="text-xs text-slate-500">{{ isProcessing ? 'Sincronizando...' : 'Esperando conexión...' }}</p>
    </div>
    <div v-else>
       <p class="font-bold text-sm text-slate-700">Sincronizando...</p>
    </div>
  </div>
</template>