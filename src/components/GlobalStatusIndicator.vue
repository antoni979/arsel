<!-- src/components/GlobalStatusIndicator.vue -->
<script setup>
import { syncQueue, isProcessing } from '../utils/syncQueue';
import { useOnlineStatus } from '../composables/useOnlineStatus';
import { SignalSlashIcon, CloudArrowUpIcon, WifiIcon } from '@heroicons/vue/24/solid';

defineProps({
  mode: {
    type: String,
    default: 'desktop', // 'desktop' or 'mobile'
  }
});

const { isOnline } = useOnlineStatus();
</script>

<template>
  <!-- ======================== MODO MÓVIL (ICONO COMPACTO) ======================== -->
  <!-- INICIO DE LA CORRECCIÓN: Añadido un div contenedor -->
  <div v-if="mode === 'mobile'">
  <!-- FIN DE LA CORRECCIÓN -->
    <div class="relative flex items-center justify-center w-8 h-8">
      <!-- Offline (Máxima Prioridad) -->
      <div v-if="!isOnline" title="Estás sin conexión">
        <SignalSlashIcon class="h-6 w-6 text-red-500" />
      </div>
      <!-- Sincronizando -->
      <div v-else-if="isProcessing" title="Sincronizando cambios...">
        <CloudArrowUpIcon class="h-6 w-6 text-blue-500 animate-pulse" />
      </div>
      <!-- Cambios Pendientes -->
      <div v-else-if="syncQueue.length > 0" title="Cambios pendientes de sincronizar">
        <CloudArrowUpIcon class="h-6 w-6 text-amber-500" />
        <span class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
          {{ syncQueue.length }}
        </span>
      </div>
      <!-- Online y Sincronizado -->
      <div v-else title="Conectado y sincronizado">
        <WifiIcon class="h-6 w-6 text-green-500" />
      </div>
    </div>
  </div>

  <!-- ======================== MODO ESCRITORIO (TEXTO DESCRIPTIVO) ======================== -->
  <div v-if="mode === 'desktop'">
    <!-- Indicador de Conexión -->
    <div 
      :class="['flex items-center justify-center gap-2 p-2 rounded-md text-xs font-bold mb-2', isOnline ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300']">
      <component :is="isOnline ? WifiIcon : SignalSlashIcon" class="h-4 w-4" />
      <span>{{ isOnline ? 'Conectado' : 'Sin Conexión' }}</span>
    </div>
    <!-- Indicador de Sincronización (solo si hay algo que mostrar) -->
    <div v-if="syncQueue.length > 0 || isProcessing"
         class="flex items-center gap-2 p-2 rounded-md text-xs font-bold bg-blue-500/20 text-blue-300">
      <CloudArrowUpIcon class="h-4 w-4" :class="{ 'animate-pulse': isProcessing }" />
      <span v-if="isProcessing">Sincronizando...</span>
      <span v-else>{{ syncQueue.length }} cambio(s) en cola</span>
    </div>
  </div>
</template>