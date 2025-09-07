<!-- src/components/InteractiveMap.vue -->
<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  imageUrl: { type: String, required: true },
  points: { type: Array, default: () => [] },
  salas: { type: Array, default: () => [] },
  isReadOnly: { type: Boolean, default: false },
  isPlacementMode: { type: Boolean, default: false },
  isAreaDrawingMode: { type: Boolean, default: false },
});

const emit = defineEmits(['add-point', 'delete-point', 'update-point-position', 'point-click', 'area-drawn']);

const overlayRef = ref(null);
const draggedPointId = ref(null);
const isDrawing = ref(false);
const drawingState = ref({ startX: 0, startY: 0, currentX: 0, currentY: 0 });

const drawingStyle = computed(() => {
  if (!isDrawing.value) return { display: 'none' };
  const { startX, startY, currentX, currentY } = drawingState.value;
  return {
    left: `${Math.min(startX, currentX) * 100}%`,
    top: `${Math.min(startY, currentY) * 100}%`,
    width: `${Math.abs(currentX - startX) * 100}%`,
    height: `${Math.abs(currentY - startY) * 100}%`,
    display: 'block',
  };
});

const startAreaDrawing = (event) => {
  if (!props.isAreaDrawingMode) return;
  event.preventDefault();
  if (!overlayRef.value) return;
  const overlayRect = overlayRef.value.getBoundingClientRect();
  const getCoords = (e) => {
    const x = (e.clientX - overlayRect.left) / overlayRect.width;
    const y = (e.clientY - overlayRect.top) / overlayRect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };
  const startCoords = getCoords(event);
  drawingState.value = { 
    startX: startCoords.x, 
    startY: startCoords.y, 
    currentX: startCoords.x, 
    currentY: startCoords.y 
  };
  isDrawing.value = true;
  const handleDrawing = (e) => {
    const currentCoords = getCoords(e);
    drawingState.value.currentX = currentCoords.x;
    drawingState.value.currentY = currentCoords.y;
  };
  const stopDrawing = () => {
    window.removeEventListener('mousemove', handleDrawing);
    window.removeEventListener('mouseup', stopDrawing);
    isDrawing.value = false;
    const { startX, startY, currentX, currentY } = drawingState.value;
    emit('area-drawn', {
      area_x1: Math.min(startX, currentX), 
      area_y1: Math.min(startY, currentY),
      area_x2: Math.max(startX, currentX), 
      area_y2: Math.max(startY, currentY),
    });
  };
  window.addEventListener('mousemove', handleDrawing);
  window.addEventListener('mouseup', stopDrawing);
};

const getSalaColor = (salaId) => {
  const sala = props.salas.find(s => s.id === salaId);
  return sala ? sala.color : '#9CA3AF';
};

const startDrag = (point) => {
  if (props.isReadOnly) return;
  draggedPointId.value = point.id;
};

const onDrag = (event) => {
  if (props.isReadOnly || draggedPointId.value === null) return;
  const point = props.points.find(p => p.id === draggedPointId.value);
  if (!point || !overlayRef.value) return;
  const overlayRect = overlayRef.value.getBoundingClientRect();
  point.coordenada_x = (event.clientX - overlayRect.left) / overlayRect.width;
  point.coordenada_y = (event.clientY - overlayRect.top) / overlayRect.height;
};

const stopDrag = () => {
  if (draggedPointId.value === null) return;
  const point = props.points.find(p => p.id === draggedPointId.value);
  if (point) {
    emit('update-point-position', point);
  }
  draggedPointId.value = null;
};

const handleMapClick = (event) => {
  if (isDrawing.value || draggedPointId.value || !props.isPlacementMode) return;
  if (!overlayRef.value) return;
  const overlayRect = overlayRef.value.getBoundingClientRect();
  const x = (event.clientX - overlayRect.left) / overlayRect.width;
  const y = (event.clientY - overlayRect.top) / overlayRect.height;
  emit('add-point', { x, y });
};

const handleDeleteClick = (point) => {
  emit('delete-point', point);
};

const handlePointClick = (point) => {
  if (props.isPlacementMode || props.isAreaDrawingMode) return;
  emit('point-click', point);
};
</script>

<template>
  <div 
    class="relative w-full h-full flex justify-center items-center bg-slate-100"
    @mousemove="onDrag"
    @mouseup="stopDrag"
    @mouseleave="stopDrag"
  >
    <div class="relative max-w-full max-h-full">
      <img :src="imageUrl" class="block max-w-full max-h-full object-contain pointer-events-none" alt="Plano del centro">
      <div
        ref="overlayRef"
        class="absolute inset-0"
        :class="{ 'cursor-crosshair': isPlacementMode || isAreaDrawingMode }"
        @mousedown="startAreaDrawing"
        @click="handleMapClick"
      >
          <!-- Áreas de Salas -->
          <template v-for="sala in salas" :key="`sala-area-${sala.id}`">
            <div
              v-if="sala && sala.area_x1 && sala.area_y1 && sala.area_x2 && sala.area_y2"
              class="absolute"
              :style="{
                left: `${Math.min(sala.area_x1, sala.area_x2) * 100}%`,
                top: `${Math.min(sala.area_y1, sala.area_y2) * 100}%`,
                width: `${Math.abs(sala.area_x2 - sala.area_x1) * 100}%`,
                height: `${Math.abs(sala.area_y2 - sala.area_y1) * 100}%`,
                border: `2px solid ${getSalaColor(sala.id)}`
              }"
            ></div>
          </template>

          <!-- Puntos -->
          <div
            v-for="point in points"
            :key="point.id"
            class="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 border-2 border-white rounded-full flex items-center justify-center text-white text-xs font-bold group shadow-lg pointer-events-auto"
            :class="{ 
              'cursor-grab active:cursor-grabbing': !isReadOnly, 
              'cursor-pointer hover:scale-110 transition-transform': isReadOnly 
            }"
            :style="{ 
              left: (point.coordenada_x * 100) + '%', 
              top: (point.coordenada_y * 100) + '%',
              backgroundColor: point.color || getSalaColor(point.sala_id)
            }"
            @mousedown.stop="startDrag(point)"
            @click.stop="handlePointClick(point)"
          >
            {{ point.nomenclatura.split('-').pop() || '?' }}
            
            <!-- === INICIO DEL CAMBIO CORREGIDO === -->
            <!-- Esta condición ahora maneja ambos casos:
                 1. Vista de Inspección: El punto tiene 'estado' y debe ser 'nuevo'.
                 2. Vista de Configuración: El punto NO tiene 'estado', así que se muestra si no es 'isReadOnly'. -->
            <button 
              v-if="!isReadOnly && (point.estado === 'nuevo' || point.estado === undefined)"
              @click.stop="handleDeleteClick(point)"
              class="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              title="Borrar punto"
            >X</button>
            <!-- === FIN DEL CAMBIO CORREGIDO === -->
          </div>
          
          <!-- Dibujo de área en progreso -->
          <div 
            class="absolute bg-blue-500 bg-opacity-20 border-2 border-blue-600 border-dashed"
            :style="drawingStyle"
          ></div>
      </div>
    </div>
  </div>
</template>