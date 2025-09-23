<!-- src/components/InteractiveMap.vue -->
<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  imageUrl: { type: String, required: true },
  points: { type: Array, default: () => [] },
  salas: { type: Array, default: () => [] },
  isReadOnly: { type: Boolean, default: false },
  isPlacementMode: { type: Boolean, default: false },
  isAreaDrawingMode: { type: Boolean, default: false },
});

const emit = defineEmits(['add-point', 'delete-point', 'update-point-position', 'point-click', 'area-drawn', 'drawing-cancelled', 'image-error']);

const overlayRef = ref(null);
const draggedPointId = ref(null);
const drawingPoints = ref([]);
const mousePosition = ref({ x: 0, y: 0 });
const overlayWidth = ref(0);
const overlayHeight = ref(0);
const lastWidth = ref(0);
const lastHeight = ref(0);
const resizeObserver = ref(null);
const updateTimeout = ref(null);
const imageRect = ref({ left: 0, top: 0, width: 0, height: 0 });

watch(() => props.isAreaDrawingMode, (newVal) => {
  // NUEVO LOG: ¿El componente hijo recibe el cambio de la prop?
  console.log('[InteractiveMap] La prop isAreaDrawingMode ha cambiado a:', newVal);
  if (!newVal) {
    drawingPoints.value = [];
  }
});

watch(() => props.salas, () => {
  nextTick(() => updateDimensions());
}, { immediate: true });

watch(() => props.imageUrl, () => {
  nextTick(() => updateDimensions());
}, { immediate: true });

const updateDimensions = () => {
  if (updateTimeout.value) clearTimeout(updateTimeout.value);
  updateTimeout.value = setTimeout(() => {
    if (overlayRef.value) {
      const newWidth = overlayRef.value.clientWidth;
      const newHeight = overlayRef.value.clientHeight;
      if (newWidth !== lastWidth.value || newHeight !== lastHeight.value) {
        overlayWidth.value = newWidth;
        overlayHeight.value = newHeight;
        lastWidth.value = newWidth;
        lastHeight.value = newHeight;
        console.log('Overlay dimensions updated:', newWidth, newHeight);

        // Compute image rect
        const img = overlayRef.value.previousElementSibling;
        if (img && img.naturalWidth && img.naturalHeight) {
          const scale = Math.min(overlayWidth.value / img.naturalWidth, overlayHeight.value / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          imageRect.value = {
            left: (overlayWidth.value - dw) / 2,
            top: (overlayHeight.value - dh) / 2,
            width: dw,
            height: dh
          };
          console.log('Image rect updated:', imageRect.value);
        }
      }
    }
  }, 100); // Debounce 100ms
};

const toSvgPoints = (pointsArray) => {
  if (!pointsArray || pointsArray.length === 0 || !imageRect.value.width || !imageRect.value.height) return "";
  return pointsArray.map(p => `${p.x * imageRect.value.width + imageRect.value.left},${p.y * imageRect.value.height + imageRect.value.top}`).join(' ');
};

const handleMapClick = (event) => {
  // NUEVO LOG: ¿Se detecta el clic en el mapa?
  console.log('[InteractiveMap] Se ha detectado un clic en el mapa.');

  if (props.isReadOnly || !overlayRef.value || !imageRect.value.width || !imageRect.value.height) {
    console.log('[InteractiveMap] Clic ignorado. Razón:', { isReadOnly: props.isReadOnly, hasOverlay: !!overlayRef.value, hasImageRect: !!imageRect.value.width });
    return;
  }

  const overlayRect = overlayRef.value.getBoundingClientRect();
  const x = (event.clientX - overlayRect.left - imageRect.value.left) / imageRect.value.width;
  const y = (event.clientY - overlayRect.top - imageRect.value.top) / imageRect.value.height;

  // NUEVO LOG: ¿Cuál es el estado del modo de dibujo DENTRO del manejador de clics?
  console.log('[InteractiveMap] Dentro de handleMapClick, isAreaDrawingMode es:', props.isAreaDrawingMode);

  if (props.isAreaDrawingMode) {
    // NUEVO LOG: ¡Hemos entrado en la lógica de dibujo!
    console.log('[InteractiveMap] ¡MODO DIBUJO ACTIVO! Añadiendo punto en', { x, y });

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
    // NUEVO LOG: ¿Cómo queda el array de puntos?
    console.log('[InteractiveMap] Array de puntos de dibujo actualizado:', drawingPoints.value);

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

onMounted(() => {
  updateDimensions();
  window.addEventListener('keydown', handleKeydown);
  if (overlayRef.value) {
    resizeObserver.value = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.value.observe(overlayRef.value);
  }
});
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (resizeObserver.value) {
    resizeObserver.value.disconnect();
  }
  if (updateTimeout.value) {
    clearTimeout(updateTimeout.value);
  }
});

const getSalaColor = (salaId) => {
  const sala = props.salas.find(s => s.id === salaId);
  return sala ? sala.color : '#9CA3AF';
};

const startDrag = (point, event) => {
  if (props.isReadOnly) return;
  event.preventDefault();
  draggedPointId.value = point.id;
};

const onDrag = (event) => {
  if (props.isReadOnly || draggedPointId.value === null || !overlayRef.value || !imageRect.value.width || !imageRect.value.height) return;
  event.preventDefault();
  const point = props.points.find(p => p.id === draggedPointId.value);
  if (!point) return;
  const overlayRect = overlayRef.value.getBoundingClientRect();
  point.coordenada_x = (event.clientX - overlayRect.left - imageRect.value.left) / imageRect.value.width;
  point.coordenada_y = (event.clientY - overlayRect.top - imageRect.value.top) / imageRect.value.height;
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

const handleImageError = () => {
  console.error('Error loading image from Supabase:', props.imageUrl);
  // Emitir evento para manejar en el padre si es necesario
  emit('image-error');
};
</script>

<template>
  <div
    class="relative w-full h-full"
    @mousemove="onDrag"
    @mouseup="stopDrag"
    @mouseleave="stopDrag"
  >
    <img :src="imageUrl" @load="updateDimensions" @error="handleImageError" class="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="Plano del centro">
    <div
      ref="overlayRef"
      class="absolute inset-0"
      :class="{ 'cursor-crosshair': isPlacementMode || isAreaDrawingMode }"
      style="z-index: 20;"
      @click="handleMapClick"
      @mousemove="handleMouseMove"
    >
        <svg class="absolute top-0 left-0 w-full h-full pointer-events-none">
          <template v-for="sala in salas" :key="`sala-area-${sala.id}`">
            <polygon
              v-if="sala.area_puntos"
              :points="toSvgPoints(sala.area_puntos)"
              :style="{ fill: `${getSalaColor(sala.id)}33`, stroke: getSalaColor(sala.id), strokeWidth: '2px' }"
            />
          </template>

          <g v-if="isAreaDrawingMode && overlayRef">
            <polyline
              :points="toSvgPoints(drawingPoints)"
              style="fill: none; stroke: #3b82f6; stroke-width: 2px; stroke-dasharray: 4;"
            />
            <line
              v-if="drawingPoints.length > 0"
              :x1="drawingPoints[drawingPoints.length - 1].x * imageRect.width + imageRect.left"
              :y1="drawingPoints[drawingPoints.length - 1].y * imageRect.height + imageRect.top"
              :x2="mousePosition.x"
              :y2="mousePosition.y"
              style="stroke: #3b82f6; stroke-width: 2px; stroke-dasharray: 4;"
            />
            <circle
              v-for="(point, index) in drawingPoints"
              :key="`drawing-point-${index}`"
              :cx="point.x * imageRect.width + imageRect.left"
              :cy="point.y * imageRect.height + imageRect.top"
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
             left: (point.coordenada_x * imageRect.width + imageRect.left) + 'px',
             top: (point.coordenada_y * imageRect.height + imageRect.top) + 'px',
             backgroundColor: point.color || getSalaColor(point.sala_id)
           }"
           @mousedown.stop="startDrag(point, $event)"
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
</template>