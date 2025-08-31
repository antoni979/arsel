<!-- src/components/PointList.vue -->
<script setup>
import { EyeSlashIcon, ArrowUturnLeftIcon, TrashIcon } from '@heroicons/vue/24/solid';

defineProps({
  groupedPoints: {
    type: Array,
    required: true
  }
});

defineEmits(['select-point', 'update-state', 'delete-new-point']);
</script>

<template>
  <div v-for="grupo in groupedPoints" :key="grupo.id" class="mb-4">
    <h3 class="font-bold text-slate-600 px-3 pb-1 border-b mb-2">{{ grupo.nombre }}</h3>
    <ul class="space-y-1">
      <li v-for="punto in grupo.puntos" :key="punto.id">
        <div :class="['p-3 rounded-lg flex items-center justify-between group', { 'bg-slate-100': punto.estado === 'suprimido' }]">
          <button @click="$emit('select-point', punto)" 
                  :disabled="punto.estado === 'suprimido'"
                  class="flex-1 text-left disabled:cursor-not-allowed">
            <div class="flex items-center">
              <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: punto.color }"></span>
              <span :class="['font-semibold ml-3', { 'line-through text-slate-500': punto.estado === 'suprimido', 'text-slate-700': punto.estado !== 'suprimido' }]">
                {{ punto.nomenclatura }}
              </span>
              <span v-if="punto.estado === 'nuevo'" class="ml-2 text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">NUEVO</span>
            </div>
          </button>
          <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <!-- === INICIO DEL CAMBIO: Botón de Borrar para Puntos Nuevos === -->
            <button v-if="punto.estado === 'nuevo'" @click="$emit('delete-new-point', punto)" class="p-1 text-slate-400 hover:text-red-500" title="Borrar punto nuevo">
              <TrashIcon class="h-5 w-5" />
            </button>
            <!-- === FIN DEL CAMBIO === -->
            
            <button v-if="punto.estado !== 'suprimido'" @click="$emit('update-state', punto, 'suprimido')" class="p-1 text-slate-400 hover:text-red-500" title="Marcar como suprimido">
              <EyeSlashIcon class="h-5 w-5" />
            </button>
            <button v-else @click="$emit('update-state', punto, 'existente')" class="p-1 text-slate-500 hover:text-blue-500" title="Reactivar punto">
              <ArrowUturnLeftIcon class="h-5 w-5" />
            </button>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>