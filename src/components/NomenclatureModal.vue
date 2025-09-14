<!-- src/components/NomenclatureModal.vue -->
<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  isOpen: Boolean,
  salaNombre: String,
  suggestedNumber: Number,
  existingNumbers: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['save', 'close']);
const pointNumber = ref('');
const error = ref('');

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    pointNumber.value = props.suggestedNumber;
    error.value = '';
  }
});

const handleSave = () => {
  error.value = '';
  const num = parseInt(pointNumber.value, 10);

  if (isNaN(num) || num <= 0) {
    error.value = 'Por favor, introduce un número válido.';
    return;
  }

  if (props.existingNumbers.includes(num)) {
    error.value = `El punto número ${num} ya existe en esta sala.`;
    return;
  }

  emit('save', num);
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-sm">
      <div class="p-6">
        <h2 class="text-lg font-bold text-slate-800">Añadir Nuevo Punto</h2>
        <p class="text-sm text-slate-500 mt-1">
          Introduce el número para el nuevo punto en la sala <span class="font-semibold">{{ salaNombre }}</span>.
        </p>
        <div class="mt-4">
          <label for="pointNumber" class="block text-sm font-medium text-slate-700">Número del Punto</label>
          <input
            v-model="pointNumber"
            type="number"
            id="pointNumber"
            @keyup.enter="handleSave"
            class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
          <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
        </div>
      </div>
      <div class="p-4 bg-slate-50 border-t flex justify-end space-x-3">
        <button type="button" @click="$emit('close')" class="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
          Cancelar
        </button>
        <button type="button" @click="handleSave" class="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
          Guardar Punto
        </button>
      </div>
    </div>
  </div>
</template>