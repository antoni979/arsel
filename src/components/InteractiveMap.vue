<!-- src/components/InteractiveMap.vue -->
<script setup>
import { ref } from 'vue';

const props = defineProps({
  imageUrl: { type: String, required: true },
  points: { type: Array, default: () => [] },
});

const emit = defineEmits(['add-point', 'delete-point', 'update-point-position']);

const draggedPointId = ref(null);
const mapContainerRef = ref(null);

// --- LÓGICA DE MOVIMIENTO (DRAG & DROP) ---

// Al hacer clic en un punto, iniciamos el arrastre
const startDrag = (pointId) => {
  draggedPointId.value = pointId;
};

// Mientras movemos el ratón por el mapa
const onDrag = (event) => {
  if (draggedPointId.value === null) return;

  const point = props.points.find(p => p.id === draggedPointId.value);
  const mapRect = mapContainerRef.value.getBoundingClientRect();

  // Actualizamos la posición del punto EN LA PANTALLA en tiempo real
  point.coordenada_x = (event.clientX - mapRect.left) / mapRect.width;
  point.coordenada_y = (event.clientY - mapRect.top) / mapRect.height;
};

// Al soltar el clic, terminamos el arrastre y guardamos
const stopDrag = () => {
  if (draggedPointId.value !== null) {
    const point = props.points.find(p => p.id === draggedPointId.value);
    // Emitimos el evento para que el padre guarde la nueva posición en la BD
    emit('update-point-position', point);
    draggedPointId.value = null;
  }
};

// --- LÓGICA DE CLICS ---

// Al hacer clic en el mapa, añadimos un nuevo punto
const handleMapClick = (event) => {
  const mapRect = mapContainerRef.value.getBoundingClientRect();
  const x = (event.clientX - mapRect.left) / mapRect.width;
  const y = (event.clientY - mapRect.top) / mapRect.height;
  emit('add-point', { x, y });
};

// Al hacer clic en el botón de borrar de un punto
const handleDeleteClick = (pointId) => {
  // Pedimos confirmación antes de borrar
  if (confirm('¿Estás seguro de que quieres borrar este punto?')) {
    emit('delete-point', pointId);
  }
};
</script>

<template>
  <!-- Añadimos eventos para el drag & drop y una ref para el contenedor -->
  <div 
    ref="mapContainerRef"
    class="relative w-full border-2 border-gray-300 overflow-hidden cursor-crosshair"
    @click="handleMapClick"
    @mousemove="onDrag"
    @mouseup="stopDrag"
    @mouseleave="stopDrag" 
  >
    <img :src="imageUrl" alt="Plano del centro" class="w-full h-auto block select-none" draggable="false" />

    <!-- Puntos existentes -->
    <div
      v-for="point in points"
      :key="point.id"
      class="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-white text-xs font-bold cursor-grab active:cursor-grabbing group"
      :style="{ left: point.coordenada_x * 100 + '%', top: point.coordenada_y * 100 + '%' }"
      @mousedown.stop="startDrag(point.id)"
      @click.stop 
    >
      {{ point.nomenclatura.split('-')[1] || '?' }}
      
      <!-- Botón de borrar que aparece al pasar el ratón por encima -->
      <button 
        @click.stop="handleDeleteClick(point.id)"
        class="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        X
      </button>
    </div>
  </div>
</template>