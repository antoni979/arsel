<!-- src/components/AddPointForm.vue -->
<script setup>
import { ref } from 'vue';

defineProps({
  salas: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['save', 'cancel']);

const selectedSalaId = ref(null);

const handleSave = () => {
  if (!selectedSalaId.value) {
    alert("Por favor, selecciona una sala.");
    return;
  }
  emit('save', selectedSalaId.value);
};
</script>

<template>
  <div class="p-2 bg-slate-50 rounded-lg">
    <h4 class="font-bold text-sm mb-2">Añadir Nuevo Punto</h4>
    <select v-model="selectedSalaId" class="block w-full rounded-md border-slate-300 shadow-sm text-sm mb-2">
      <option :value="null" disabled>Selecciona una sala...</option>
      <option v-for="sala in salas" :key="sala.id" :value="sala.id">{{ sala.nombre }}</option>
    </select>
    <div class="flex gap-2">
      <button @click="$emit('cancel')" class="w-full text-sm py-1 px-2 rounded bg-white border hover:bg-slate-50">Cancelar</button>
      <button @click="handleSave" class="w-full text-sm py-1 px-2 rounded bg-blue-600 text-white hover:bg-blue-700">Guardar</button>
    </div>
  </div>
</template>