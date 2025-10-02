--- INICIO DEL ARCHIVO: src\components\NomenclatureModal.vue ---
<!-- src/components/NomenclatureModal.vue -->
<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
isOpen: Boolean,
salaNombre: String,
suggestedNumber: Number,
existingIdentifiers: { // Renombrado de existingNumbers a existingIdentifiers
type: Array,
default: () => []
}
});

const emit = defineEmits(['save', 'close']);
const pointIdentifier = ref(''); // Renombrado de pointNumber a pointIdentifier
const error = ref('');

watch(() => props.isOpen, (newVal) => {
if (newVal) {
pointIdentifier.value = props.suggestedNumber;
error.value = '';
}
});

const handleSave = () => {
error.value = '';
const identifier = String(pointIdentifier.value).trim();

if (!identifier) {
error.value = 'Por favor, introduce un identificador válido.';
return;
}

// --- INICIO DE LA CORRECCIÓN: Lógica de validación flexible ---
// Comprobamos si el identificador exacto (sensible a mayúsculas/minúsculas) ya existe.
if (props.existingIdentifiers.includes(identifier)) {
error.value = `El punto con el identificador "${identifier}" ya existe en esta sala.`;
return;
}
// --- FIN DE LA CORRECCIÓN ---

emit('save', identifier); // Enviamos el identificador como string
};
</script>
<template>
<div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
<div class="bg-white rounded-lg shadow-xl w-full max-w-sm">
<div class="p-6">
<h2 class="text-lg font-bold text-slate-800">Añadir Nuevo Punto</h2>
<p class="text-sm text-slate-500 mt-1">
Introduce el identificador para el nuevo punto en la sala <span class="font-semibold">{{ salaNombre }}</span>.
</p>
<div class="mt-4">
<label for="pointIdentifier" class="block text-sm font-medium text-slate-700">Identificador del Punto</label>
<!-- --- INICIO DE LA CORRECCIÓN: Input de tipo texto --- -->
<input
v-model="pointIdentifier"
type="text"
id="pointIdentifier"
@keyup.enter="handleSave"
class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
>
<!-- --- FIN DE LA CORRECCIÓN --- -->
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