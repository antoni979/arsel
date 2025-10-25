<!-- src/components/EditSalaModal.vue -->
<script setup>
import { ref, watch } from 'vue';
import { ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/vue/24/solid';

const props = defineProps({
  isOpen: Boolean,
  sala: {
    type: Object,
    default: () => ({ id: null, nombre: '' })
  },
  allSalas: {
    type: Array,
    default: () => []
  },
  canEdit: Boolean,
  usageCount: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['save', 'close']);
const salaName = ref('');
const error = ref('');

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    salaName.value = props.sala?.nombre || '';
    error.value = '';
  }
});

const handleSave = () => {
  error.value = '';
  const trimmedName = salaName.value.trim();

  // Validation 1: Name cannot be empty
  if (!trimmedName) {
    error.value = 'El nombre de la sala no puede estar vacío.';
    return;
  }

  // Validation 2: Name must be different from current name
  if (trimmedName === props.sala?.nombre) {
    error.value = 'El nuevo nombre debe ser diferente del nombre actual.';
    return;
  }

  // Validation 3: Name cannot already exist (case-insensitive)
  const nameExists = props.allSalas.some(
    s => s.id !== props.sala?.id && s.nombre.toLowerCase() === trimmedName.toLowerCase()
  );

  if (nameExists) {
    error.value = `Ya existe una sala con el nombre "${trimmedName}".`;
    return;
  }

  // All validations passed
  emit('save', trimmedName);
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
      <div class="p-6">
        <h2 class="text-lg font-bold text-slate-800">Editar Nombre de Sala</h2>

        <!-- Cannot Edit - Informational Message -->
        <div v-if="!canEdit" class="mt-4">
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div class="flex items-start gap-3">
              <ExclamationTriangleIcon class="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div class="flex-1">
                <h3 class="text-sm font-semibold text-amber-900 mb-2">
                  No se puede editar esta sala
                </h3>
                <div class="text-sm text-amber-800 space-y-2">
                  <p>
                    Esta sala ha sido utilizada en <strong>{{ usageCount }}</strong>
                    {{ usageCount === 1 ? 'inspección' : 'inspecciones' }}.
                  </p>
                  <p>
                    No se puede renombrar para mantener la consistencia de los datos históricos y evitar confusiones en los informes existentes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <div class="flex items-start gap-3">
              <InformationCircleIcon class="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div class="text-sm text-blue-800">
                <p class="font-semibold mb-1">Recomendación:</p>
                <p>
                  Si necesitas cambiar la estructura de salas, te recomendamos crear una nueva versión del plano con la configuración actualizada.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Can Edit - Form -->
        <div v-else class="mt-4">
          <p class="text-sm text-slate-500 mb-4">
            Introduce el nuevo nombre para la sala <span class="font-semibold">{{ sala?.nombre }}</span>.
          </p>

          <div>
            <label for="salaName" class="block text-sm font-medium text-slate-700 mb-1">
              Nombre de la Sala
            </label>
            <input
              v-model="salaName"
              type="text"
              id="salaName"
              @keyup.enter="handleSave"
              class="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Nombre de la sala"
            >
            <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="p-4 bg-slate-50 border-t flex justify-end space-x-3">
        <button
          v-if="!canEdit"
          type="button"
          @click="$emit('close')"
          class="px-4 py-2 font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700"
        >
          Cerrar
        </button>

        <template v-else>
          <button
            type="button"
            @click="$emit('close')"
            class="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            @click="handleSave"
            class="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Guardar Cambios
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
