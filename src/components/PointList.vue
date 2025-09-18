<!-- src/components/PointList.vue -->
<script setup>
import { ref } from 'vue';
import { EyeSlashIcon, ArrowUturnLeftIcon, TrashIcon, ChevronDownIcon } from '@heroicons/vue/24/solid';

defineProps({
  groupedPoints: {
    type: Array,
    required: true
  }
});

// ===== INICIO DE LA CORRECCIÓN: Hacemos explícito el 'emit' para añadir el log =====
const emit = defineEmits(['select-point', 'update-state', 'delete-new-point']);

const openSalaId = ref(null);

const toggleSala = (salaId) => {
  openSalaId.value = openSalaId.value === salaId ? null : salaId;
};

// Función para registrar el evento antes de emitirlo
function handleUpdateState(punto, newState) {
  console.log(`[PointList.vue] Clic detectado. Emitiendo @update-state para el punto ID ${punto.id} con el nuevo estado: ${newState}`);
  emit('update-state', punto, newState);
}
// ===== FIN DE LA CORRECCIÓN =====
</script>

<template>
  <div class="space-y-2">
    <div v-for="grupo in groupedPoints" :key="grupo.id">
      <button @click="toggleSala(grupo.id)" class="w-full flex justify-between items-center p-3 rounded-lg text-left" :class="openSalaId === grupo.id ? 'bg-blue-50' : 'hover:bg-slate-50'">
        <h3 class="font-bold text-slate-700">{{ grupo.nombre }}</h3>
        <ChevronDownIcon class="h-5 w-5 text-slate-400 transition-transform" :class="{'rotate-180': openSalaId === grupo.id}" />
      </button>

      <ul v-if="openSalaId === grupo.id" class="space-y-1 pl-4 border-l-2 ml-3">
        <li v-for="punto in grupo.puntos" :key="punto.id">
          <div :class="['p-2 rounded-lg flex items-center justify-between group', { 'bg-slate-100': punto.estado === 'suprimido' }]">
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
              <button v-if="punto.estado === 'nuevo'" @click="$emit('delete-new-point', punto)" class="p-1 text-slate-400 hover:text-red-500" title="Borrar punto nuevo">
                <TrashIcon class="h-5 w-5" />
              </button>
              
              <!-- ===== INICIO DE LA CORRECCIÓN: Llamamos a nuestra nueva función con log ===== -->
              <button v-if="punto.estado !== 'suprimido'" @click="handleUpdateState(punto, 'suprimido')" class="p-1 text-slate-400 hover:text-red-500" title="Marcar como suprimido">
                <EyeSlashIcon class="h-5 w-5" />
              </button>
              <button v-else @click="handleUpdateState(punto, 'existente')" class="p-1 text-slate-500 hover:text-blue-500" title="Reactivar punto">
                <ArrowUturnLeftIcon class="h-5 w-5" />
              </button>
              <!-- ===== FIN DE LA CORRECCIÓN ===== -->
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>