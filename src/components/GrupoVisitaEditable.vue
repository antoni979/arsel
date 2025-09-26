<!-- src/components/GrupoVisitaEditable.vue -->
<script setup>
import { ref, nextTick } from 'vue';
import { PencilIcon, CheckIcon } from '@heroicons/vue/24/solid';

const props = defineProps({
  value: [String, Number],
  inspeccionId: Number
});

const emit = defineEmits(['save']);

const isEditing = ref(false);
const localValue = ref(props.value);
const inputRef = ref(null);

const startEditing = () => {
  if (!props.inspeccionId) return; // No se puede editar si no hay inspección
  localValue.value = props.value;
  isEditing.value = true;
  nextTick(() => {
    inputRef.value?.focus();
  });
};

const saveEdit = () => {
  if (localValue.value !== props.value) {
    emit('save', {
      inspeccionId: props.inspeccionId,
      newValue: localValue.value
    });
  }
  isEditing.value = false;
};
</script>

<template>
  <div class="flex items-center justify-center group">
    <div v-if="!isEditing" @click="startEditing" class="cursor-pointer min-h-[2rem] flex items-center justify-center px-2">
      <span v-if="value">{{ value }}</span>
      <span v-else class="text-slate-400 italic text-xs">N/A</span>
      <PencilIcon v-if="inspeccionId" class="h-3 w-3 ml-2 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
    <div v-else class="flex items-center gap-1">
      <input
        ref="inputRef"
        v-model="localValue"
        type="text"
        @keyup.enter="saveEdit"
        @keyup.esc="isEditing = false"
        @blur="saveEdit"
        class="w-20 text-center text-sm p-1 border-blue-400 ring-1 ring-blue-400 rounded-md"
      />
      <button @click="saveEdit" class="p-1 text-green-600 hover:bg-green-100 rounded">
        <CheckIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>