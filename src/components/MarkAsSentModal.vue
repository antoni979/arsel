<!-- src/components/MarkAsSentModal.vue -->
<script setup>
import { ref, watch } from 'vue';
import { PaperAirplaneIcon } from '@heroicons/vue/24/solid';

const props = defineProps({
  isOpen: Boolean,
  inspeccionId: Number,
});

const emit = defineEmits(['close', 'save']);

const formData = ref({
  fecha_envio: '',
  responsable_envio: '',
});

// Cuando el modal se abre, pre-rellenamos la fecha con el día de hoy
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    formData.value = {
      fecha_envio: new Date().toISOString().slice(0, 10), // Formato YYYY-MM-DD
      responsable_envio: '',
    };
  }
});

const handleSubmit = () => {
  if (!formData.value.fecha_envio || !formData.value.responsable_envio) {
    alert('Por favor, completa todos los campos.');
    return;
  }
  emit('save', formData.value);
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md transform transition-all">
      <div class="p-6 border-b border-slate-200 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <PaperAirplaneIcon class="h-6 w-6 text-blue-600" aria-hidden="true" />
        </div>
        <h2 class="mt-4 text-xl font-bold text-slate-800">Confirmar Envío a Cliente</h2>
        <p class="text-sm text-slate-500 mt-1">Registra la fecha y el responsable del envío.</p>
      </div>
      <form @submit.prevent="handleSubmit">
        <div class="p-6 space-y-4">
          <div>
            <label for="fecha_envio" class="block text-sm font-medium text-slate-600">Fecha de Envío</label>
            <input 
              v-model="formData.fecha_envio" 
              type="date" 
              id="fecha_envio" 
              required 
              class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
          </div>
          <div>
            <label for="responsable_envio" class="block text-sm font-medium text-slate-600">Enviado por</label>
            <input 
              v-model="formData.responsable_envio" 
              type="text" 
              id="responsable_envio" 
              placeholder="Nombre del responsable" 
              required 
              class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
          </div>
        </div>
        <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-3">
          <button type="button" @click="$emit('close')" class="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancelar</button>
          <button type="submit" class="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Guardar y Marcar</button>
        </div>
      </form>
    </div>
  </div>
</template>