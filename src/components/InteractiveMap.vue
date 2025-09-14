<!-- src/components/InteractiveMap.vue -->
<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  imageUrl: { type: String, required: true },
  points: { type: Array, default: () => [] },
  salas: { type: Array, default: () => [] },
  isReadOnly: { type: Boolean, default: false },
  isPlacementMode: { type: Boolean, default: false },
  isAreaDrawingMode: { type: Boolean, default: false },
});

const emit = defineEmits(['add-point', 'delete-point', 'update-point-position', 'point-click', 'area-drawn', 'drawing-cancelled']);

const overlayRef = ref(null);
const draggedPointId = ref(null);
const drawingPoints = ref([]);
const mousePosition = ref({ x: 0, y: 0 });

watch(() => props.isAreaDrawingMode, (newVal) => {
  if (!newVal) {
    drawingPoints.value = [];
  }
});

const toSvgPoints = (pointsArray, overlayWidth, overlayHeight) => {
  if (!pointsArray || pointsArray.length === 0 || !overlayWidth || !overlayHeight) return "";
  return pointsArray.map(p => `${p.x * overlayWidth},${p.y * overlayHeight}`).join(' ');
};

const handleMapClick = (event) => {
  if (!overlayRef.value) return;
  const overlayRect = overlayRef.value.getBoundingClientRect();
  const x = (event.clientX - overlayRect.left) / overlayRect.width;
  const y = (event.clientY - overlayRect.top) / overlayRect.height;
  
  if (props.isAreaDrawingMode) {
    if (drawingPoints.value.length > 2) {
      const firstPoint = drawingPoints.value[0];
      const distance = Math.sqrt(Math.pow((x - firstPoint.x), 2) + Math.pow((y - firstPoint.y), 2));
      if (distance < 0.02) {
        emit('area-drawn', drawingPoints.value);
        drawingPoints.value = [];
        return;
      }
    }
    drawingPoints.value.push({ x, y });
  } else if (props.isPlacementMode) {
    emit('add-point', { x, y });
  }
};

const handleMouseMove = (event) => {
    if (!props.isAreaDrawingMode || !overlayRef.value) return;
    const overlayRect = overlayRef.value.getBoundingClientRect();
    mousePosition.value.x = event.clientX - overlayRect.left;
    mousePosition.value.y = event.clientY - overlayRect.top;
};

const handleKeydown = (e) => {
    if (e.key === 'Escape' && props.isAreaDrawingMode) {
        drawingPoints.value = [];
        emit('drawing-cancelled');
    }
};

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

const getSalaColor = (salaId) => {
  const sala = props.salas.find(s => s.id === salaId);
  return sala ? sala.color : '#9CA3AF';
};

const startDrag = (point) => {
  if (props.isReadOnly) return;
  draggedPointId.value = point.id;
};

const onDrag = (event) => {
  if (props.isReadOnly || draggedPointId.value === null || !overlayRef.value) return;
  const point = props.points.find(p => p.id === draggedPointId.value);
  if (!point) return;
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
        @click="handleMapClick"
        @mousemove="handleMouseMove"
      >
        <svg class="absolute top-0 left-0 w-full h-full pointer-events-none">
          <template v-for="sala in salas" :key="`sala-area-${sala.id}`">
            <!-- ===== INICIO DE LA CORRECCIÓN: Se cambia 'vif' por 'v-if' ===== -->
            <polygon
              v-if="sala.area_puntos && overlayRef"
              :points="toSvgPoints(sala.area_puntos, overlayRef.clientWidth, overlayRef.clientHeight)"
              :style="{ fill: `${getSalaColor(sala.id)}33`, stroke: getSalaColor(sala.id), strokeWidth: '2px' }"
            />
            <!-- ===== FIN DE LA CORRECCIÓN ===== -->
          </template>

          <g v-if="isAreaDrawingMode && overlayRef">
            <polyline 
              :points="toSvgPoints(drawingPoints, overlayRef.clientWidth, overlayRef.clientHeight)"
              style="fill: none; stroke: #3b82f6; stroke-width: 2px; stroke-dasharray: 4;"
            />
            <line 
              v-if="drawingPoints.length > 0"
              :x1="drawingPoints[drawingPoints.length - 1].x * overlayRef.clientWidth"
              :y1="drawingPoints[drawingPoints.length - 1].y * overlayRef.clientHeight"
              :x2="mousePosition.x"
              :y2="mousePosition.y"
              style="stroke: #3b82f6; stroke-width: 2px; stroke-dasharray: 4;"
            />
            <circle
              v-for="(point, index) in drawingPoints"
              :key="`drawing-point-${index}`"
              :cx="point.x * overlayRef.clientWidth"
              :cy="point.y * overlayRef.clientHeight"
              r="5"
              :class="index === 0 ? 'fill-green-500 stroke-white' : 'fill-blue-500 stroke-white'"
              style="stroke-width: 2px;"
            />
          </g>
        </svg>

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
          <button 
            v-if="!isReadOnly && (point.estado === 'nuevo' || point.estado === undefined)"
            @click.stop="handleDeleteClick(point)"
            class="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Borrar punto"
          >X</button>
        </div>
      </div>
    </div>
  </div>
</template>