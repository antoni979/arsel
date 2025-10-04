<!-- src/components/MobileStatusIndicator.vue -->
<script setup>
import { syncQueue, isProcessing } from '../utils/syncQueue';
import { useOnlineStatus } from '../composables/useOnlineStatus';
import { SignalSlashIcon, CloudArrowUpIcon } from '@heroicons/vue/24/solid';

const { isOnline } = useOnlineStatus();
</script>

<template>
  <div v-if="!isOnline" class="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded-md">
    <SignalSlashIcon class="h-4 w-4" />
    <span>Estás sin conexión</span>
  </div>
  <div v-else-if="isProcessing" class="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-blue-500 rounded-md">
    <CloudArrowUpIcon class="h-4 w-4 animate-pulse" />
    <span>Sincronizando...</span>
  </div>
  <div v-else-if="syncQueue.length > 0" class="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-800 bg-amber-400 rounded-md">
    <CloudArrowUpIcon class="h-4 w-4" />
    <span>{{ syncQueue.length }} cambio(s) pendiente(s)</span>
  </div>
</template>