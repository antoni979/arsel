<!-- src/components/InteractiveMap.vue -->

<script setup>
const props = defineProps({
  imageUrl: {
    type: String,
    required: true,
  },
  points: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['add-point'])

const handleMapClick = (event) => {
  const mapContainer = event.currentTarget
  const rect = mapContainer.getBoundingClientRect()

  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height

  emit('add-point', { x, y })
}
</script>

<template>
  <div 
    class="relative w-full border-2 border-gray-300 overflow-hidden cursor-crosshair"
    @click="handleMapClick"
  >
    <img :src="imageUrl" alt="Plano del centro" class="w-full h-auto block" />

    <div
      v-for="point in points"
      :key="point.id"
      class="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-white text-xs font-bold"
      :style="{ 
        left: point.coordenada_x * 100 + '%', 
        top: point.coordenada_y * 100 + '%' 
      }"
    >
      <!-- Mostramos el número del punto, ej: de "P-1" muestra "1" -->
      {{ point.nomenclatura.split('-')[1] || '?' }}
    </div>
  </div>
</template>