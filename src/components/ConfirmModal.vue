<!-- src/components/ConfirmModal.vue -->
<script setup>
import { XMarkIcon } from '@heroicons/vue/24/solid';

defineProps({
  isOpen: Boolean,
  title: String,
  message: String,
});

const emit = defineEmits(['confirm', 'cancel']);

const handleConfirm = () => {
  emit('confirm');
};

const handleCancel = () => {
  emit('cancel');
};
</script>

<template>
  <div v-if="isOpen" @click.self="handleCancel" class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
      <div class="p-4 border-b flex justify-between items-center">
        <h2 class="text-lg font-bold text-slate-800">{{ title || 'Confirmar' }}</h2>
        <button @click="handleCancel" class="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
      </div>
      <div class="p-4">
        <p class="text-slate-600">{{ message }}</p>
      </div>
      <div class="p-4 border-t flex justify-end gap-2">
        <button @click="handleCancel" class="px-4 py-2 font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200">Cancelar</button>
        <button @click="handleConfirm" class="px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">Confirmar</button>
      </div>
    </div>
  </div>
</template>