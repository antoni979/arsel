<!-- src/components/CentroFormModal.vue -->
<script setup>
import { ref, watchEffect } from 'vue';
import { provincias } from '../utils/provincias';

const props = defineProps({
  isOpen: Boolean,
  centro: Object, // Será null si es para crear, o un objeto si es para editar
});

const emit = defineEmits(['close', 'save']);

const form = ref({});
const zonas = ['Norte', 'Sur', 'Este', 'Oeste', 'Centro', 'Noreste', 'Noroeste', 'Sureste', 'Islas Baleares', 'Islas Canarias'];

// Cuando el modal se abre o el centro a editar cambia, reseteamos el formulario
watchEffect(() => {
  if (props.isOpen) {
    form.value = props.centro ? { ...props.centro } : { nombre: '', direccion: '', responsable_nombre: '', responsable_email: '', provincia: '', zona: '' };
  }
});

const handleSubmit = () => {
  emit('save', form.value);
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div class="p-6 border-b">
        <h2 class="text-2xl font-bold text-slate-800">{{ centro ? 'Editar Centro' : 'Agregar Nuevo Centro' }}</h2>
      </div>
      <form @submit.prevent="handleSubmit">
        <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Campos del formulario -->
          <div class="md:col-span-2">
            <label for="nombre" class="block text-sm font-medium text-slate-600">Nombre del Centro</label>
            <input v-model="form.nombre" type="text" id="nombre" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
          </div>
          <div class="md:col-span-2">
            <label for="direccion" class="block text-sm font-medium text-slate-600">Dirección</label>
            <input v-model="form.direccion" type="text" id="direccion" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
          </div>
          <div>
            <label for="responsable_nombre" class="block text-sm font-medium text-slate-600">Nombre del Responsable</label>
            <input v-model="form.responsable_nombre" type="text" id="responsable_nombre" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
          </div>
          <div>
            <label for="responsable_email" class="block text-sm font-medium text-slate-600">Email del Responsable</label>
            <input v-model="form.responsable_email" type="email" id="responsable_email" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
          </div>
          <div>
            <label for="provincia" class="block text-sm font-medium text-slate-600">Provincia</label>
            <select v-model="form.provincia" id="provincia" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option disabled value="">Selecciona una provincia</option>
              <option v-for="p in provincias" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div>
            <label for="zona" class="block text-sm font-medium text-slate-600">Zona</label>
            <select v-model="form.zona" id="zona" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option disabled value="">Selecciona una zona</option>
              <option v-for="z in zonas" :key="z" :value="z">{{ z }}</option>
            </select>
          </div>
        </div>
        <div class="p-6 bg-slate-50 border-t flex justify-end space-x-4">
          <button type="button" @click="$emit('close')" class="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancelar</button>
          <button type="submit" class="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Guardar Cambios</button>
        </div>
      </form>
    </div>
  </div>
</template>