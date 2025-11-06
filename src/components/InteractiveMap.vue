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
  allIncidencias: { type: Array, default: () => [] }
});

const emit = defineEmits(['add-point', 'delete-point', 'update-point-position', 'point-click', 'area-drawn', 'drawing-cancelled', 'image-error']);

const overlayRef = ref(null);
const draggedPointId = ref(null);
const drawingPoints = ref([]);
const mousePosition = ref({ x: 0, y: 0 });
const imageRect = ref({ left: 0, top: 0, width: 0, height: 0 });
const resizeObserver = ref(null);

// ===== INICIO DE LA CORRECCIÓN: Lógica de carga de imagen robusta =====
const imageLoaded = ref(false);

const updateDimensions = () => {
  if (!overlayRef.value || !imageLoaded.value) {
    return;
  }
  const containerEl = overlayRef.value;
  // Buscamos la imagen por su clase dentro del componente
  const imgEl = containerEl.querySelector('img.plano-image');

  if (!imgEl || !imgEl.naturalWidth) return;

  const containerRatio = containerEl.clientWidth / containerEl.clientHeight;
  const imageRatio = imgEl.naturalWidth / imgEl.naturalHeight;
  let imgW, imgH, imgX, imgY;

  if (imageRatio > containerRatio) {
    imgW = containerEl.clientWidth;
    imgH = imgW / imageRatio;
    imgX = 0;
    imgY = (containerEl.clientHeight - imgH) / 2;
  } else {
    imgH = containerEl.clientHeight;
    imgW = imgH * imageRatio;
    imgY = 0;
    imgX = (containerEl.clientWidth - imgW) / 2;
  }

  imageRect.value = {
    left: imgX,
    top: imgY,
    width: imgW,
    height: imgH
  };
  console.log('Image dimensions updated:', imageRect.value);
};

// Esta función se llamará cuando la imagen termine de cargar
const onImageLoad = () => {
  imageLoaded.value = true;
  // Usamos nextTick para asegurar que el DOM está actualizado antes de medir
  nextTick(() => {
    updateDimensions();
  });
};

const handleImageError = () => {
  console.error('Error loading image from Supabase:', props.imageUrl);
  emit('image-error');
};

// Si la URL de la imagen cambia, reseteamos el estado de carga
watch(() => props.imageUrl, () => {
  imageLoaded.value = false;
});
// ===== FIN DE LA CORRECCIÓN =====


const toSvgPoints = (pointsArray) => {
  if (!pointsArray || pointsArray.length === 0 || !imageRect.value.width || !imageRect.value.height) return "";
  return pointsArray.map(p => `${p.x * imageRect.value.width + imageRect.value.left},${p.y * imageRect.value.height + imageRect.value.top}`).join(' ');
};

const handleMapClick = (event) => {
  if (props.isReadOnly || !overlayRef.value || !imageRect.value.width || !imageRect.value.height) {
    return;
  }

  const overlayRect = overlayRef.value.getBoundingClientRect();
  const x = (event.clientX - overlayRect.left - imageRect.value.left) / imageRect.value.width;
  const y = (event.clientY - overlayRect.top - imageRect.value.top) / imageRect.value.height;

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

onMounted(() => {
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
  if (resizeObserver.value && overlayRef.value) {
    resizeObserver.value.unobserve(overlayRef.value);
  }
});

const getSalaColor = (salaId) => {
  const sala = props.salas.find(s => s.id === salaId);
  return sala ? sala.color : '#9CA3AF';
};

const getPointColor = (point) => {
  // If point is suprimido, always return gray
  if (point.estado === 'suprimido') {
    return '#9CA3AF';
  }
  // Otherwise, use the point's color or the room's color
  return point.color || getSalaColor(point.sala_id);
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

// Get incident badge data for a point (highest severity and count)
function getPointIncidentBadge(puntoId) {
  const incidents = props.allIncidencias.filter(inc => inc.punto_inspeccionado_id === puntoId);
  if (incidents.length === 0) return null;

  const hasRojo = incidents.some(inc => inc.gravedad === 'rojo');
  const hasAmbar = incidents.some(inc => inc.gravedad === 'ambar');

  return {
    count: incidents.length,
    color: hasRojo ? '#EF4444' : hasAmbar ? '#F59E0B' : '#22C55E',
    severity: hasRojo ? 'rojo' : hasAmbar ? 'ambar' : 'verde',
    shouldPulse: hasRojo // Pulse effect for critical incidents
  };
}
</script>

<template>
  <div
    class="relative w-full h-full"
    @mousemove="onDrag"
    @mouseup="stopDrag"
    @mouseleave="stopDrag"
  >
    <!-- ===== CORRECCIÓN: El overlay ahora contiene la imagen para controlar su carga ===== -->
    <div
      ref="overlayRef"
      class="absolute inset-0"
      :class="{ 'cursor-crosshair': isPlacementMode || isAreaDrawingMode }"
      style="z-index: 20;"
      @click="handleMapClick"
      @mousemove="handleMouseMove"
    >
      <img 
        :src="imageUrl" 
        @load="onImageLoad" 
        @error="handleImageError" 
        class="plano-image w-full h-full object-contain pointer-events-none" 
        alt="Plano del centro"
      >
      
      <!-- Mostramos el contenido SVG y los puntos solo cuando la imagen se ha cargado -->
      <template v-if="imageLoaded">
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
             backgroundColor: getPointColor(point),
             opacity: point.estado === 'suprimido' ? '0.6' : '1'
           }"
           @mousedown.stop="startDrag(point, $event)"
           @click.stop="handlePointClick(point)"
         >
          {{ point.nomenclatura.split('-').pop() || '?' }}

          <!-- Incident count badge -->
          <div
            v-if="getPointIncidentBadge(point.id)"
            class="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-lg"
            :class="{ 'animate-pulse': getPointIncidentBadge(point.id).shouldPulse }"
            :style="{ backgroundColor: getPointIncidentBadge(point.id).color }"
          >
            {{ getPointIncidentBadge(point.id).count }}
          </div>

          <button
            v-if="!isReadOnly && (point.estado === 'nuevo' || point.estado === undefined)"
            @click.stop="handleDeleteClick(point)"
            class="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Borrar punto"
          >X</button>
        </div>
      </template>
    </div>
  </div>
</template>