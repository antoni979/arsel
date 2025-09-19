<!-- src/components/PlanoBadge.vue -->
<template>
  <div
    class="w-full h-full p-1 flex flex-col items-center bg-white rounded-lg shadow-lg border border-gray-300 cursor-move font-sans"
  >
    <!-- Cabecera con Punto y Estado -->
    <div class="text-center">
      <div class="font-bold text-xs text-gray-800 leading-tight">Punto {{ pointNumber }}</div>
      <div v-if="stateText" class="font-bold text-[9px] leading-tight text-blue-600 uppercase">
        {{ stateText }}
      </div>
    </div>
    
    <hr class="w-11/12 my-1 border-t border-gray-200">
    
    <!-- Contenedor del semáforo -->
    <div class="flex-1 w-full flex justify-center items-center">
      <!-- Fila de círculos con espaciado explícito -->
      <div class="flex items-center">
        <!-- ===== INICIO DE LA SOLUCIÓN FINAL ===== -->
        <div 
          v-for="(item, index) in semaphoreItems" 
          :key="item.label"
          :class="['w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center', { 'mx-1': index === 1 }]"
          :style="{ backgroundColor: item.color }"
          :title="`${item.count} incidencias de tipo ${item.label}`"
        >
          <span class="text-white font-bold text-[10px] leading-none">
            {{ item.count }}
          </span>
        </div>
        <!-- ===== FIN DE LA SOLUCIÓN FINAL ===== -->
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  pointData: Object
});

const pointNumber = computed(() => props.pointData.nomenclatura.split('-').pop() || '?');

const stateText = computed(() => {
  if (props.pointData.estado === 'nuevo') return 'NUEVA';
  if (props.pointData.estado === 'suprimido') return 'SUPRIMIDA';
  if (props.pointData.detalle_modificacion === 'aumentado') return 'AUMENTADA';
  if (props.pointData.detalle_modificacion === 'disminuido') return 'DISMINUIDA';
  return null;
});

const semaphoreItems = computed(() => [
  { label: 'verde', color: '#22C55E', count: props.pointData.counts.verde },
  { label: 'ambar', color: '#F59E0B', count: props.pointData.counts.ambar },
  { label: 'rojo', color: '#EF4444', count: props.pointData.counts.rojo },
]);
</script>