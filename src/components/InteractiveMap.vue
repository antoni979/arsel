<!-- src/components/InteractiveMap.vue -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  imageUrl: { type: String, required: true },
  points: { type: Array, default: () => [] },
  isReadOnly: { type: Boolean, default: false } // Prop para modo solo lectura
});

const emit = defineEmits(['add-point', 'delete-point', 'update-point-position', 'point-click']);

const mapContainerRef = ref(null);
const draggedPointId = ref(null);
const mapDimensions = ref({ width: 0, height: 0 });

// --- LÓGICA DE DES-SOLAPAMIENTO (SPIDERING) ---
const displayPoints = computed(() => {
  if (!mapDimensions.value.width || !props.points.length) return props.points.map(p => ({ ...p, visualOffsetX: 0, visualOffsetY: 0 }));
  const pixelPoints = props.points.map(p => ({
    ...p,
    x: p.coordenada_x * mapDimensions.value.width,
    y: p.coordenada_y * mapDimensions.value.height,
    visualOffsetX: 0,
    visualOffsetY: 0,
  }));
  const COLLISION_RADIUS = 28;
  const SPIDER_RADIUS = 25;
  for (let i = 0; i < pixelPoints.length; i++) {
    const collisions = [];
    for (let j = 0; j < pixelPoints.length; j++) {
      if (i === j) continue;
      const dx = pixelPoints[i].x - pixelPoints[j].x;
      const dy = pixelPoints[i].y - pixelPoints[j].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < COLLISION_RADIUS) {
        collisions.push(pixelPoints[j]);
      }
    }
    if (collisions.length > 0) {
      collisions.push(pixelPoints[i]);
      collisions.sort((a, b) => a.id - b.id);
      collisions.forEach((point, index) => {
        const angle = (index / collisions.length) * 2 * Math.PI;
        point.visualOffsetX = SPIDER_RADIUS * Math.cos(angle);
        point.visualOffsetY = SPIDER_RADIUS * Math.sin(angle);
      });
    }
  }
  return pixelPoints;
});

// --- LÓGICA DE MOVIMIENTO (DRAG & DROP) ---
const startDrag = (pointId) => {
  if (props.isReadOnly) return;
  draggedPointId.value = pointId;
};
const onDrag = (event) => {
  if (props.isReadOnly || draggedPointId.value === null) return;
  const point = props.points.find(p => p.id === draggedPointId.value);
  const mapRect = mapContainerRef.value.getBoundingClientRect();
  point.coordenada_x = (event.clientX - mapRect.left) / mapRect.width;
  point.coordenada_y = (event.clientY - mapRect.top) / mapRect.height;
};
const stopDrag = () => {
  if (props.isReadOnly || draggedPointId.value === null) return;
  const point = props.points.find(p => p.id === draggedPointId.value);
  emit('update-point-position', point);
  draggedPointId.value = null;
};

// --- LÓGICA DE CLICS ---
const handleMapClick = (event) => {
  if (props.isReadOnly) return;
  const mapRect = mapContainerRef.value.getBoundingClientRect();
  const x = (event.clientX - mapRect.left) / mapRect.width;
  const y = (event.clientY - mapRect.top) / mapRect.height;
  emit('add-point', { x, y });
};
const handleDeleteClick = (pointId) => {
  if (props.isReadOnly) return;
  if (confirm('¿Estás seguro de que quieres borrar este punto?')) {
    emit('delete-point', pointId);
  }
};
const handlePointClick = (point) => {
  if (props.isReadOnly) {
    emit('point-click', point);
  }
};

// --- MANEJO DEL TAMAÑO DEL MAPA ---
const updateMapDimensions = () => {
  if (mapContainerRef.value) {
    mapDimensions.value = {
      width: mapContainerRef.value.offsetWidth,
      height: mapContainerRef.value.offsetHeight,
    };
  }
};
onMounted(() => {
  const resizeObserver = new ResizeObserver(updateMapDimensions);
  if (mapContainerRef.value) {
    resizeObserver.observe(mapContainerRef.value);
  }
  onUnmounted(() => resizeObserver.disconnect());
});
</script>

<template>
  <div 
    ref="mapContainerRef"
    :class="['relative w-full border-2 border-gray-300 overflow-hidden', { 'cursor-crosshair': !isReadOnly, 'cursor-default': isReadOnly }]"
    @click="handleMapClick"
    @mousemove="onDrag"
    @mouseup="stopDrag"
    @mouseleave="stopDrag" 
  >
    <img :src="imageUrl" alt="Plano del centro" class="w-full h-auto block select-none" draggable="false" @load="updateMapDimensions" />
    <div
      v-for="point in displayPoints"
      :key="point.id"
      :class="['absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 bg-blue-600 border-2 border-white rounded-full flex items-center justify-center text-white text-xs font-bold group shadow-lg', { 'cursor-grab active:cursor-grabbing': !isReadOnly, 'cursor-pointer hover:scale-110 transition-transform': isReadOnly }]"
      :style="{ 
        left: (point.coordenada_x * 100) + '%', 
        top: (point.coordenada_y * 100) + '%',
        transform: `translate(-50%, -50%) translate(${point.visualOffsetX}px, ${point.visualOffsetY}px)`
      }"
      @mousedown.stop="startDrag(point.id)"
      @click.stop="handlePointClick(point)"
    >
      {{ point.nomenclatura.split('-')[1] || '?' }}
      <button 
        v-if="!isReadOnly"
        @click.stop="handleDeleteClick(point.id)"
        class="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        X
      </button>
    </div>
  </div>
</template>