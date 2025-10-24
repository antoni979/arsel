<!-- src/components/InspectionSidebar.vue -->
<script setup>
import { ref } from 'vue';
import PointList from './PointList.vue';
import AddPointForm from './AddPointForm.vue';
import { PlusIcon, XCircleIcon, CheckCircleIcon, PencilSquareIcon, MapIcon } from '@heroicons/vue/24/solid';

const props = defineProps({
  canEdit: Boolean,
  salas: Array,
  puntosAgrupados: Array,
  allIncidencias: {
    type: Array,
    default: () => []
  },
  isPlanoEditingMode: {
    type: Boolean,
    default: false
  },
  isMobileAddPointOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'toggle-plano-editing',
  'add-sala',
  'start-area-drawing',
  'start-placement-mode',
  'cancel-placement-mode',
  'select-point',
  'update-point-state',
  'delete-new-point',
  'update-point-nomenclatura',
  'update:is-mobile-add-point-open'
]);

// Estado local para desktop
const isPlanoEditingModeLocal = ref(false);
const showAddSalaForm = ref(false);
const newSalaName = ref('');
const showAddPointForm = ref(false);
const isPlacementMode = ref(false);

const handleTogglePlanoEditing = () => {
  isPlanoEditingModeLocal.value = !isPlanoEditingModeLocal.value;
  emit('toggle-plano-editing', isPlanoEditingModeLocal.value);
  if (!isPlanoEditingModeLocal.value) {
    showAddSalaForm.value = false;
  }
};

const handleAddSala = () => {
  if (newSalaName.value.trim()) {
    emit('add-sala', newSalaName.value.trim());
    newSalaName.value = '';
    showAddSalaForm.value = false;
  }
};

const handleStartPlacement = (salaId) => {
  isPlacementMode.value = true;
  showAddPointForm.value = false;
  emit('update:is-mobile-add-point-open', false);
  emit('start-placement-mode', salaId);
};

const handleCancelPlacement = () => {
  isPlacementMode.value = false;
  emit('cancel-placement-mode');
};
</script>

<template>
  <aside class="w-full lg:w-80 xl:w-96 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
    <!-- Botón Editar Plano - SOLO VISIBLE EN DESKTOP -->
    <div class="hidden lg:block p-4 flex-shrink-0 border-b">
      <button v-if="canEdit" @click="handleTogglePlanoEditing"
              :class="[
                'w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-md shadow-sm transition-colors',
                isPlanoEditingModeLocal ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              ]">
        <PencilSquareIcon class="h-5 w-5" />
        {{ isPlanoEditingModeLocal ? 'Finalizar Edición Plano' : 'Editar Plano' }}
      </button>
    </div>

    <!-- Formularios de Edición - SOLO VISIBLE EN DESKTOP -->
    <div class="hidden lg:block p-4 flex-shrink-0 space-y-2">
       <div v-if="canEdit && isPlanoEditingModeLocal" class="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
          <h3 class="font-bold text-orange-800">Modo Edición de Plano</h3>
          <form v-if="showAddSalaForm" @submit.prevent="handleAddSala" class="flex gap-2">
              <input v-model="newSalaName" type="text" placeholder="Nombre nueva sala..." class="flex-1 block w-full rounded-md border-slate-300 shadow-sm text-sm">
              <button type="submit" class="p-2 bg-green-600 text-white rounded-md hover:bg-green-700"><CheckCircleIcon class="h-5 w-5"/></button>
              <button @click="showAddSalaForm = false" type="button" class="p-2 bg-red-600 text-white rounded-md hover:bg-red-700"><XCircleIcon class="h-5 w-5"/></button>
          </form>
          <button v-else @click="showAddSalaForm = true" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-slate-600 bg-white rounded-md hover:bg-slate-50 border">
             <PlusIcon class="h-5 w-5" /> Añadir Sala
          </button>
       </div>

       <div v-if="canEdit && !isPlanoEditingModeLocal">
          <AddPointForm
             v-if="showAddPointForm"
             :salas="salas"
             @save="handleStartPlacement"
             @cancel="showAddPointForm = false"
          />
          <button v-else-if="!isPlacementMode" @click="showAddPointForm = true" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200">
             <PlusIcon class="h-5 w-5" />
             Agregar Punto Nuevo
          </button>
          <button v-if="isPlacementMode" @click="handleCancelPlacement" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
             <XCircleIcon class="h-5 w-5" />
             Cancelar Colocación
          </button>
       </div>
    </div>

    <!-- Formulario móvil de Agregar Punto - SOLO VISIBLE EN MÓVIL -->
    <div v-if="canEdit && !isPlanoEditingMode && isMobileAddPointOpen" class="lg:hidden p-4 flex-shrink-0 border-b bg-blue-50">
       <AddPointForm
          :salas="salas"
          @save="handleStartPlacement"
          @cancel="emit('update:is-mobile-add-point-open', false)"
       />
    </div>

    <!-- Botón Cancelar Colocación en Móvil - SOLO VISIBLE EN MÓVIL -->
    <div v-if="canEdit && !isPlanoEditingMode && isPlacementMode" class="lg:hidden p-4 flex-shrink-0 border-b">
       <button @click="handleCancelPlacement" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
          <XCircleIcon class="h-5 w-5" />
          Cancelar Colocación
       </button>
    </div>

    <!-- --- INICIO DE LA MODIFICACIÓN: Panel de Edición de Plano en Móvil --- -->
    <div v-if="canEdit && isPlanoEditingMode" class="lg:hidden p-3 bg-orange-50 border-b border-orange-200 space-y-3">
       <h3 class="font-bold text-orange-800 text-center">Modo Edición de Plano</h3>
       <form v-if="showAddSalaForm" @submit.prevent="handleAddSala" class="flex gap-2">
          <input v-model="newSalaName" type="text" placeholder="Nombre nueva sala..." class="flex-1 block w-full rounded-md border-slate-300 shadow-sm text-sm">
          <button type="submit" class="p-2 bg-green-600 text-white rounded-md hover:bg-green-700"><CheckCircleIcon class="h-5 w-5"/></button>
          <button @click="showAddSalaForm = false" type="button" class="p-2 bg-red-600 text-white rounded-md hover:bg-red-700"><XCircleIcon class="h-5 w-5"/></button>
       </form>
       <button v-else @click="showAddSalaForm = true" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-slate-600 bg-white rounded-md hover:bg-slate-50 border">
          <PlusIcon class="h-5 w-5" /> Añadir Sala
       </button>
    </div>
    <!-- --- FIN DE LA MODIFICACIÓN --- -->

    <div class="flex-1 overflow-y-auto px-4 pb-4">
      <PointList
        :grouped-points="puntosAgrupados"
        :can-edit="canEdit"
        :all-incidencias="allIncidencias"
        @select-point="$emit('select-point', $event)"
        @update-state="(point, newState) => $emit('update-point-state', point, newState)"
        @delete-new-point="$emit('delete-new-point', $event)"
        @update-point-nomenclatura="(point, newName) => $emit('update-point-nomenclatura', point, newName)"
        :class="{ 'pointer-events-none opacity-50': isPlacementMode || isPlanoEditingMode || isPlanoEditingModeLocal }"
      >
        <template #sala-actions="{ sala }">
          <button v-if="isPlanoEditingMode || isPlanoEditingModeLocal" @click="$emit('start-area-drawing', sala)" class="p-1 text-slate-400 hover:text-blue-600" title="Definir área de la sala">
            <MapIcon class="h-5 w-5" />
          </button>
        </template>
      </PointList>
    </div>
  </aside>
</template>