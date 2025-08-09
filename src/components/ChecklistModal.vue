<!-- src/components/ChecklistModal.vue -->
<script setup>
import { ref, watchEffect } from 'vue';
import { checklistItems } from '../utils/checklist';

const props = defineProps({
  isOpen: Boolean,
  punto: Object,
});

const emit = defineEmits(['close']);

const statuses = ref({});

watchEffect(() => {
  if (props.isOpen) {
    checklistItems.forEach(item => {
      statuses.value[item.id] = 'S';
    });
  }
});

const toggleStatus = (itemId) => {
  statuses.value[itemId] = statuses.value[itemId] === 'S' ? 'I' : 'S';
};
</script>

<template>
  <div v-if="isOpen" @click.self="$emit('close')" class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
    <div class="bg-slate-50 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
      <header class="p-4 border-b bg-white rounded-t-lg flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">Checklist para Punto: {{ punto?.nomenclatura }}</h2>
        <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600">&times;</button>
      </header>
      
      <main class="flex-1 overflow-y-auto p-6 space-y-3">
        <div v-for="item in checklistItems" :key="item.id" class="bg-white p-3 rounded-lg shadow-sm border flex items-center justify-between">
          <p class="text-slate-700">{{ item.id }}. {{ item.text }}</p>
          <div class="flex items-center gap-2">
            <button 
              @click="toggleStatus(item.id)"
              :class="[
                'px-3 py-1 text-xs font-bold rounded-full transition-colors', 
                statuses[item.id] === 'S' 
                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                  : 'bg-red-100 text-red-800 hover:bg-red-200'
              ]"
            >
              {{ statuses[item.id] === 'S' ? 'SATISFACTORIO' : 'INSATISFACTORIO' }}
            </button>
          </div>
        </div>
      </main>

      <footer class="p-4 bg-white border-t rounded-b-lg flex justify-end">
        <button @click="$emit('close')" class="px-5 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
          Cerrar y Guardar
        </button>
      </footer>
    </div>
  </div>
</template>