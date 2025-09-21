<!-- src/components/PointList.vue -->
<script setup>
import { ref } from 'vue';
import { EyeSlashIcon, ArrowUturnLeftIcon, TrashIcon, ChevronDownIcon } from '@heroicons/vue/24/solid';

defineProps({
  groupedPoints: Array,
  canEdit: Boolean,
});

const emit = defineEmits(['select-point', 'update-state', 'delete-new-point']);

const openSalaId = ref(null);

const toggleSala = (salaId) => {
  openSalaId.value = openSalaId.value === salaId ? null : salaId;
};

function handleUpdateState(punto, newState) {
  emit('update-state', punto, newState);
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="grupo in groupedPoints" :key="grupo.id">
      <div class="w-full flex justify-between items-center p-3 rounded-lg" :class="openSalaId === grupo.id ? 'bg-blue-50' : 'hover:bg-slate-50'">
        <button @click="toggleSala(grupo.id)" class="flex-1 flex items-center text-left gap-2">
          <h3 class="font-bold text-slate-700">{{ grupo.nombre }}</h3>
          <span v-if="grupo.isNew" class="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">NUEVA</span>
          <ChevronDownIcon class="h-5 w-5 text-slate-400 transition-transform" :class="{'rotate-180': openSalaId === grupo.id}" />
        </button>
        <slot name="sala-actions" :sala="grupo"></slot>
      </div>

      <ul v-if="openSalaId === grupo.id" class="space-y-1 pl-4 border-l-2 ml-3">
        <li v-for="punto in grupo.puntos" :key="punto.id">
          <div :class="['p-2 rounded-lg flex items-center justify-between group', { 'bg-slate-100': punto.estado === 'suprimido' }]">
            <!-- ===== CORRECCIÓN: El div entero ahora emite el evento para abrir el modal ===== -->
            <div @click="$emit('select-point', punto)" class="flex-1 flex items-center cursor-pointer">
              <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: punto.color }"></span>
              
              <span 
                :class="['font-semibold ml-3', { 'line-through text-slate-500': punto.estado === 'suprimido', 'text-slate-700': punto.estado !== 'suprimido' }]"
              >
                {{ punto.nomenclatura }}
              </span>

              <span v-if="punto.estado === 'nuevo'" class="ml-2 text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">NUEVO</span>
            </div>

            <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button v-if="punto.estado === 'nuevo'" @click.stop="$emit('delete-new-point', punto)" class="p-1 text-slate-400 hover:text-red-500" title="Borrar punto nuevo">
                <TrashIcon class="h-5 w-5" />
              </button>
              
              <button v-if="punto.estado !== 'suprimido'" @click.stop="handleUpdateState(punto, 'suprimido')" class="p-1 text-slate-400 hover:text-red-500" title="Marcar como suprimido">
                <EyeSlashIcon class="h-5 w-5" />
              </button>
              <button v-else @click.stop="handleUpdateState(punto, 'existente')" class="p-1 text-slate-500 hover:text-blue-500" title="Reactivar punto">
                <ArrowUturnLeftIcon class="h-5 w-5" />
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>