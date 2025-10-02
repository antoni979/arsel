--- INICIO DEL ARCHIVO: src\components\ChecklistModal.vue ---
<!-- src/components/ChecklistModal.vue -->
<script setup>
import { ref, watch, computed, nextTick, inject } from 'vue';
import { supabase } from '../supabase';
import { checklistItems } from '../utils/checklist';
import {
ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon, PlusCircleIcon, TrashIcon,
ArrowTrendingUpIcon, ArrowTrendingDownIcon, StopCircleIcon, ChevronUpIcon, ChevronDownIcon,
PencilIcon, CheckIcon
} from '@heroicons/vue/24/solid';

const props = defineProps({
isOpen: Boolean,
punto: Object,
inspeccionId: Number,
});

const emit = defineEmits(['close', 'save', 'update-nomenclatura']);

const showNotification = inject('showNotification');

const incidencias = ref([]);
const loading = ref(false);
const isUploading = ref(null);
const dragOverIncidenceId = ref(null);
const puntoInspeccionado = computed(() => props.punto);
const customFields = ref([]);
const customValues = ref({});
const collapsedItems = ref(new Set());

const isEditingName = ref(false);
const tempPointIdentifier = ref('');
const nameInputRef = ref(null);

const pointPrefix = computed(() => {
if (!props.punto?.nomenclatura) return '';
const parts = props.punto.nomenclatura.split('-');
if (parts.length > 1) {
parts.pop();
return `${parts.join('-')}-`;
}
return '';
});

const startNameEditing = () => {
isEditingName.value = true;
const parts = props.punto.nomenclatura.split('-');
tempPointIdentifier.value = parts.length > 1 ? parts.pop() : props.punto.nomenclatura;
nextTick(() => nameInputRef.value?.focus());
};

const saveName = () => {
const newNomenclature = `${pointPrefix.value}${tempPointIdentifier.value.trim()}`;
if (tempPointIdentifier.value.trim() && newNomenclature !== props.punto.nomenclatura) {
findPuntoMaestroAndEmitUpdate(newNomenclature);
}
isEditingName.value = false;
};

const findPuntoMaestroAndEmitUpdate = async (newNomenclature) => {
const { data: puntoMaestro, error } = await supabase
.from('puntos_maestros')
.select('*')
.eq('id', props.punto.punto_maestro_id)
.single();

if (puntoMaestro && !error) {
emit('update-nomenclatura', puntoMaestro, newNomenclature);
} else {
alert('Error: No se pudo encontrar el punto maestro para actualizar.');
}
};

const loadData = async () => {
if (!props.punto) return;
loading.value = true;
isEditingName.value = false;
collapsedItems.value.clear();

const [incidenciasRes, fieldsRes] = await Promise.all([
supabase.from('incidencias').select('*').eq('punto_inspeccionado_id', props.punto.id),
supabase.from('checklist_custom_fields').select('*').order('point_id, id')
]);

incidencias.value = incidenciasRes.data || [];
customFields.value = fieldsRes.data || [];
customValues.value = {};

// --- INICIO DE LA CORRECCIÓN 1: Eliminar inicialización incorrecta ---
// Se elimina el bucle que inicializaba `customValues` con `item.id`, que era la causa del problema.
// El objeto `customValues` ahora solo se poblará con claves de `incidencia.id`, que son únicas.
// --- FIN DE LA CORRECCIÓN 1 ---

// Load existing custom values per incidence
incidencias.value.forEach(inc => {
customValues.value[inc.id] = inc.custom_fields || {};
});

loading.value = false;
};

watch(() => props.isOpen, (newVal) => {
if (newVal) loadData();
});

const gravedadOptions = [
{ label: 'Verde', value: 'verde' },
{ label: 'Ambar', value: 'ambar' },
{ label: 'Rojo', value: 'rojo' },
];

const tienePlaca = computed({
get: () => puntoInspeccionado.value?.tiene_placa_caracteristicas,
set: (newValue) => {
if (puntoInspeccionado.value) {
puntoInspeccionado.value.tiene_placa_caracteristicas = newValue;
handlePlacaStatusChange(newValue);
}
}
});

const detalleModificacion = computed({
get: () => puntoInspeccionado.value?.detalle_modificacion,
set: (newValue) => {
if (puntoInspeccionado.value) {
puntoInspeccionado.value.detalle_modificacion = newValue;
handleModificationChange(newValue);
}
}
});

const handlePlacaStatusChange = async (status) => {
if (!puntoInspeccionado.value) return;

await supabase
.from('puntos_inspeccionados')
.update({ tiene_placa_caracteristicas: status })
.eq('id', puntoInspeccionado.value.id);

const incidenciasPlaca = getIncidenciasForItem(2).value;

if (status === true) {
if (incidenciasPlaca.length > 0) {
const idsToDelete = incidenciasPlaca.map(inc => inc.id);
await supabase.from('incidencias').delete().in('id', idsToDelete);
incidencias.value = incidencias.value.filter(inc => !idsToDelete.includes(inc.id));
}
} else {
if (incidenciasPlaca.length === 0) {
await addIncidencia(2, {
gravedad: 'verde',
observaciones: 'Falta ficha',
});
}
}
};

const handleModificationChange = async (newStatus) => {
if (!puntoInspeccionado.value) return;

await supabase
.from('puntos_inspeccionados')
.update({ detalle_modificacion: newStatus })
.eq('id', puntoInspeccionado.value.id);

const incidenciasModificacion = getIncidenciasForItem(3).value;
const idsToDelete = incidenciasModificacion.map(inc => inc.id);

if (idsToDelete.length > 0) {
await supabase.from('incidencias').delete().in('id', idsToDelete);
incidencias.value = incidencias.value.filter(inc => !idsToDelete.includes(inc.id));
}

if (newStatus === 'aumentado') {
await addIncidencia(3, {
gravedad: 'ambar',
observaciones: 'Se ha aumentado el número de módulos y/o niveles.',
});
} else if (newStatus === 'disminuido') {
await addIncidencia(3, {
gravedad: 'verde',
observaciones: 'Se ha disminuido el número de módulos y/o niveles.',
});
}
};

const getIncidenciasForItem = (itemId) => {
return computed(() => incidencias.value.filter(inc => inc.item_checklist === itemId));
};

const getCustomFieldsForItem = (itemId) => {
return customFields.value.filter(field => field.point_id === itemId);
};

const addIncidencia = async (itemId, defaults = {}) => {
if (!puntoInspeccionado.value) return;

let defaultSeverity = defaults.gravedad || 'verde';
if (!defaults.gravedad) {
// Fetch default from DB
const { data: def } = await supabase
.from('checklist_defaults')
.select('default_severity')
.eq('point_id', itemId)
.single();
if (def) {
defaultSeverity = def.default_severity;
}
}

// --- INICIO DE LA CORRECCIÓN 2: Asegurar la independencia de los campos personalizados ---
const { data: newIncidencia } = await supabase
.from('incidencias')
.insert({
punto_inspeccionado_id: puntoInspeccionado.value.id,
inspeccion_id: props.inspeccionId,
item_checklist: itemId,
gravedad: defaultSeverity,
observaciones: defaults.observaciones || null,
custom_fields: {} // Siempre creamos la incidencia con un objeto de campos personalizados VACÍO.
}).select().single();

if (newIncidencia) {
incidencias.value.push(newIncidencia);
// Asignamos un objeto vacío e INDEPENDIENTE para los valores de la nueva incidencia.
customValues.value[newIncidencia.id] = {};
}
// --- FIN DE LA CORRECCIÓN 2 ---
};

const deleteIncidencia = async (incidenciaId) => {
const incidencia = incidencias.value.find(inc => inc.id === incidenciaId);
if (!incidencia) return;

// If the incidence has a photo, delete it from storage first
if (incidencia.url_foto_antes) {
try {
// Extract file path from Supabase URL
const url = new URL(incidencia.url_foto_antes);
const pathParts = url.pathname.split('/');
const bucketIndex = pathParts.findIndex(part => part === 'incidencias');
if (bucketIndex !== -1) {
const filePath = pathParts.slice(bucketIndex + 1).join('/');
const { error: storageError } = await supabase.storage.from('incidencias').remove([filePath]);
if (storageError) {
console.error('Error deleting photo from storage:', storageError);
// Continue with DB deletion even if storage deletion fails
}
}
} catch (error) {
console.error('Error processing photo URL for deletion:', error);
// Continue with DB deletion
}
}

// Delete from database
const { error } = await supabase.from('incidencias').delete().eq('id', incidenciaId);
if (!error) {
incidencias.value = incidencias.value.filter(inc => inc.id !== incidenciaId);
// Clean up custom values for deleted incidence
delete customValues.value[incidenciaId];
showNotification('Incidencia eliminada correctamente.', 'success');
} else {
showNotification("Error al borrar la incidencia: " + error.message, 'error');
}
}

const toggleItemStatus = async (itemId) => {
if (itemId === 3) {
alert("El estado de este punto se gestiona automáticamente desde las preguntas superiores.");
return;
}

const itemIncidencias = getIncidenciasForItem(itemId).value;

if (itemIncidencias.length > 0) {
if (confirm(`¿Marcar este punto como "Satisfactorio"? Se borrarán las ${itemIncidencias.length} incidencias registradas.`)) {
const idsToDelete = itemIncidencias.map(inc => inc.id);
const { error } = await supabase.from('incidencias').delete().in('id', idsToDelete);
if (!error) {
incidencias.value = incidencias.value.filter(inc => !idsToDelete.includes(inc.id));
}
}
} else {
await addIncidencia(itemId);
}
};

const isCollapsed = (itemId) => {
return collapsedItems.value.has(itemId);
};

const toggleCollapse = (itemId) => {
if (isCollapsed(itemId)) {
collapsedItems.value.delete(itemId);
} else {
collapsedItems.value.add(itemId);
}
};

const onDragOver = (event, incidenceId) => {
event.preventDefault();
dragOverIncidenceId.value = incidenceId;
};

const onDragLeave = (event) => {
event.preventDefault();
dragOverIncidenceId.value = null;
};

const onDrop = (event, incidencia) => {
event.preventDefault();
dragOverIncidenceId.value = null;
const files = event.dataTransfer.files;
if (files.length === 0) return;
if (files.length > 1) {
showNotification('Solo se permite subir una foto a la vez.', 'error');
return;
}
const file = files[0];
handleFileUpload(file, incidencia);
};

const handleFileChange = async (event, incidencia) => {
const file = event.target.files[0];
if (!file) return;
handleFileUpload(file, incidencia);
};

const handleFileUpload = async (file, incidencia) => {
// Validations
if (!file.type.startsWith('image/')) {
showNotification('Solo se permiten archivos de imagen.', 'error');
return;
}
const maxSize = 10 * 1024 * 1024; // 10MB
if (file.size > maxSize) {
showNotification('El archivo es demasiado grande. Máximo 10MB.', 'error');
return;
}

isUploading.value = incidencia.id;

try {
// Compress image if it's large
let fileToUpload = file;
const originalSize = file.size;

if (file.size > 500 * 1024) { // Compress if larger than 500KB
showNotification('Comprimiendo imagen...', 'info');

// Use canvas API for compression
const compressedFile = await compressImage(file);
fileToUpload = compressedFile;

const compressionRatio = ((originalSize - compressedFile.size) / originalSize * 100).toFixed(1);
if (compressionRatio > 5) {
showNotification(`Imagen comprimida: ${compressionRatio}% de reducción`, 'success');
}
}

const fileName = `inspeccion_${props.inspeccionId}/punto_${puntoInspeccionado.value.id}/${Date.now()}_${file.name}`;
const { error: uploadError } = await supabase.storage.from('incidencias').upload(fileName, fileToUpload);
if (uploadError) {
showNotification("Error al subir la foto: " + uploadError.message, 'error');
isUploading.value = null;
return;
}
const { data: { publicUrl } } = supabase.storage.from('incidencias').getPublicUrl(fileName);
incidencia.url_foto_antes = publicUrl;
await saveIncidencia(incidencia);
isUploading.value = null;
showNotification('Foto subida correctamente.', 'success');
} catch (error) {
console.error('Error processing image:', error);
showNotification('Error al procesar la imagen: ' + error.message, 'error');
isUploading.value = null;
}
};

// Compress image using Canvas API
const compressImage = (file) => {
return new Promise((resolve, reject) => {
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const img = new Image();

img.onload = () => {
// Calculate new dimensions (max 1024px on longest side for smaller files)
let { width, height } = img;
const maxDimension = 1024;

if (width > height) {
if (width > maxDimension) {
height = (height * maxDimension) / width;
width = maxDimension;
}
} else {
if (height > maxDimension) {
width = (width * maxDimension) / height;
height = maxDimension;
}
}

canvas.width = width;
canvas.height = height;

// Draw and compress with lower quality for much smaller files
ctx.drawImage(img, 0, 0, width, height);

canvas.toBlob((blob) => {
if (blob) {
// Create a new file with the compressed blob
const compressedFile = new File([blob], file.name, {
type: 'image/jpeg',
lastModified: Date.now()
});
resolve(compressedFile);
} else {
reject(new Error('Failed to compress image'));
}
}, 'image/jpeg', 0.6); // 60% quality for smaller file sizes
};

img.onerror = () => reject(new Error('Failed to load image'));
img.src = URL.createObjectURL(file);
});
};

const saveIncidencia = async (incidencia) => {
const { id, ...dataToUpdate } = incidencia;
dataToUpdate.custom_fields = customValues.value[id] || {};
await supabase.from('incidencias').update(dataToUpdate).eq('id', id);
};

const handleClose = () => {
// Check for required fields that are not filled
for (const item of checklistItems) {
const itemFields = getCustomFieldsForItem(item.id);
const itemIncidencias = getIncidenciasForItem(item.id).value;

// Only validate required fields if there are incidences for this item
if (itemIncidencias.length > 0) {
for (const field of itemFields) {
if (field.required) {
// Check if any incidence for this item has this required field filled
const hasFilledField = itemIncidencias.some(inc =>
customValues.value[inc.id]?.[field.id]
);

if (!hasFilledField) {
showNotification(`No se puede guardar sin completar los campos obligatorios. El campo "${field.field_name}" es obligatorio.`, 'error');
return;
}
}
}
}
}

emit('save');
emit('close');
};
</script>
<template>
<div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
<div class="bg-slate-50 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
<header class="p-4 border-b bg-white rounded-t-lg flex justify-between items-center">
<div class="flex items-center gap-2">
<h2 class="text-xl font-bold text-slate-800">Checklist para Punto:</h2>
<div v-if="isEditingName" class="flex items-center gap-1 bg-white border border-blue-400 rounded-md p-1">
<span class="text-slate-500 pl-1">{{ pointPrefix }}</span>
<input
ref="nameInputRef"
v-model="tempPointIdentifier"
@keyup.enter="saveName"
@keyup.esc="isEditingName = false"
type="text"
class="text-xl font-bold text-slate-800 p-0 border-none focus:ring-0 w-24"
/>
<button @click="saveName" class="p-1 text-green-600 hover:bg-green-100 rounded">
<CheckIcon class="h-5 w-5"/>
</button>
</div>
<h2 v-else class="text-xl font-bold text-slate-800">{{ punto?.nomenclatura }}</h2>
<button v-if="!isEditingName" @click="startNameEditing" class="p-1 text-slate-400 hover:text-blue-600">
<PencilIcon class="h-5 w-5"/>
</button>
</div>
<button @click="handleClose" class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
</header>
<main class="flex-1 overflow-y-auto p-6 space-y-3">
    <div v-if="loading" class="text-center p-10">Cargando datos del punto...</div>
    <div v-else>
      <div class="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
        <h3 class="font-bold text-blue-800 mb-3">¿Dispone de placa de características?</h3>
        <div class="flex flex-col sm:flex-row gap-4">
          <button @click="tienePlaca = true" :class="['w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold transition-all', tienePlaca === true ? 'bg-green-600 text-white shadow-md ring-2 ring-offset-2 ring-green-500' : 'bg-white border text-slate-700 hover:bg-slate-100']"><CheckCircleIcon class="h-5 w-5" />Sí, dispone de placa</button>
          <button @click="tienePlaca = false" :class="['w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold transition-all', tienePlaca === false ? 'bg-red-600 text-white shadow-md ring-2 ring-offset-2 ring-red-500' : 'bg-white border text-slate-700 hover:bg-slate-100']"><XCircleIcon class="h-5 w-5" />No, no dispone de placa</button>
        </div>
        <p v-if="tienePlaca !== null" class="text-xs text-slate-500 mt-3 text-center">El estado del punto "2. Tiene las placas de identificación..." se ha actualizado automáticamente.</p>
      </div>

      <div class="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 mb-6">
        <h3 class="font-bold text-orange-800 mb-3">¿Ha habido alguna modificación en los módulos/niveles?</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button @click="detalleModificacion = 'aumentado'" :class="['flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold transition-all', detalleModificacion === 'aumentado' ? 'bg-amber-500 text-white shadow-md ring-2 ring-offset-2 ring-amber-500' : 'bg-white border text-slate-700 hover:bg-slate-100']"><ArrowTrendingUpIcon class="h-5 w-5" />Ha aumentado</button>
          <button @click="detalleModificacion = 'disminuido'" :class="['flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold transition-all', detalleModificacion === 'disminuido' ? 'bg-teal-500 text-white shadow-md ring-2 ring-offset-2 ring-teal-500' : 'bg-white border text-slate-700 hover:bg-slate-100']"><ArrowTrendingDownIcon class="h-5 w-5" />Ha disminuido</button>
          <button @click="detalleModificacion = null" :class="['flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold transition-all', detalleModificacion === null ? 'bg-slate-600 text-white shadow-md ring-2 ring-offset-2 ring-slate-500' : 'bg-white border text-slate-700 hover:bg-slate-100']"><StopCircleIcon class="h-5 w-5" />No ha cambiado</button>
        </div>
        <p v-if="detalleModificacion !== undefined" class="text-xs text-slate-500 mt-3 text-center">El estado del punto "3. El número de módulos y niveles..." se ha actualizado automáticamente.</p>
      </div>

      <div v-for="item in checklistItems" :key="item.id" class="bg-white rounded-lg shadow-sm border transition-all duration-300">
        <div class="p-3 flex items-center justify-between">
          <p class="text-slate-700">{{ item.id }}. {{ item.text }}</p>
          <button
            @click="toggleItemStatus(item.id)"
            :disabled="item.id === 3"
            :class="['px-3 py-1 text-xs font-bold rounded-full disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500',
                     getIncidenciasForItem(item.id).value.length > 0 ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-green-100 text-green-800 hover:bg-green-200']"
          >
            {{ getIncidenciasForItem(item.id).value.length > 0 ? 'INSATISFACTORIO' : 'SATISFACTORIO' }}
          </button>
        </div>

        <div v-if="getIncidenciasForItem(item.id).value.length > 0" class="border-t">
          <div 
            @click="toggleCollapse(item.id)" 
            class="bg-slate-100/50 p-2 flex justify-between items-center cursor-pointer hover:bg-slate-100"
          >
            <span class="text-sm font-semibold text-slate-600">
              {{ getIncidenciasForItem(item.id).value.length }} Incidencia(s)
            </span>
            <component :is="isCollapsed(item.id) ? ChevronDownIcon : ChevronUpIcon" class="h-5 w-5 text-slate-500" />
          </div>

          <div v-show="!isCollapsed(item.id)" class="bg-slate-50 p-4 space-y-4">
            <div v-if="item.id === 3" class="text-center text-sm text-slate-600 bg-slate-200 p-2 rounded-md">
              Este parámetro se gestiona automáticamente desde las preguntas superiores.
            </div>
            <div v-for="(incidencia, index) in getIncidenciasForItem(item.id).value" :key="incidencia.id" class="bg-white border rounded-lg p-4 shadow-sm relative">
              <div class="flex justify-between items-center mb-3">
                <h4 class="font-bold text-slate-700">Incidencia #{{ index + 1 }}</h4>
                <button v-if="item.id !== 3" @click="deleteIncidencia(incidencia.id)" title="Borrar esta incidencia" class="p-1 text-slate-400 hover:text-red-500"><TrashIcon class="h-5 w-5"/></button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-medium text-slate-600">Gravedad</label>
                    <select v-model="incidencia.gravedad" @change="saveIncidencia(incidencia)" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm"><option v-for="opt in gravedadOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select>
                  </div>

                  <!-- Campos Personalizados -->
                  <div v-if="getCustomFieldsForItem(item.id).length > 0" class="space-y-3">
                    <div v-for="field in getCustomFieldsForItem(item.id)" :key="field.id">
                      <label class="block text-xs font-medium text-slate-600">
                        {{ field.field_name }}
                        <span v-if="field.required" class="text-red-500">*</span>
                      </label>
                      <input
                        v-if="field.field_type === 'text'"
                        v-model="customValues[incidencia.id][field.id]"
                        @blur="saveIncidencia(incidencia)"
                        type="text"
                        :required="field.required"
                        class="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm"
                        :placeholder="`Ingrese ${field.field_name.toLowerCase()}`"
                      >
                      <input
                        v-else-if="field.field_type === 'number'"
                        v-model.number="customValues[incidencia.id][field.id]"
                        @blur="saveIncidencia(incidencia)"
                        type="number"
                        :required="field.required"
                        class="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm"
                        :placeholder="`Ingrese ${field.field_name.toLowerCase()}`"
                      >
                      <select
                        v-else-if="field.field_type === 'select'"
                        v-model="customValues[incidencia.id][field.id]"
                        @change="saveIncidencia(incidencia)"
                        :required="field.required"
                        class="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm"
                      >
                        <option value="">Seleccionar...</option>
                        <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-slate-600">Observaciones</label>
                    <textarea v-model="incidencia.observaciones" @blur="saveIncidencia(incidencia)" rows="3" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm"></textarea>
                  </div>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Foto de la Incidencia</label>
                  <div
                    class="aspect-video bg-slate-200 rounded-md flex items-center justify-center overflow-hidden relative group transition-colors"
                    :class="{ 'bg-blue-200 border-2 border-blue-400 border-dashed': dragOverIncidenceId === incidencia.id }"
                    @dragover="onDragOver($event, incidencia.id)"
                    @dragleave="onDragLeave"
                    @drop="onDrop($event, incidencia)"
                  >
                    <img v-if="incidencia.url_foto_antes" :src="incidencia.url_foto_antes" class="object-cover w-full h-full">
                    <div v-else class="text-center">
                      <p v-if="isUploading === incidencia.id" class="text-sm text-slate-600">Subiendo...</p>
                      <p v-else-if="dragOverIncidenceId === incidencia.id" class="text-sm text-slate-600">Suelta la foto aquí</p>
                      <label v-else :for="'fileInput-' + incidencia.id" class="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"><ArrowUpTrayIcon class="h-4 w-4" />Subir Foto</label>
                      <input type="file" @change="handleFileChange($event, incidencia)" class="hidden" :id="'fileInput-' + incidencia.id" accept="image/*">
                    </div>
                    <div v-if="incidencia.url_foto_antes" class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                       <input type="file" @change="handleFileChange($event, incidencia)" class="hidden" :id="'fileInput-change-' + incidencia.id" accept="image/*">
                       <label :for="'fileInput-change-' + incidencia.id" class="cursor-pointer text-white text-sm font-semibold">Cambiar Foto</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="item.id !== 3">
              <button @click="addIncidencia(item.id)" class="w-full flex items-center justify-center gap-2 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 border border-dashed border-blue-300"><PlusCircleIcon class="h-5 w-5"/>Añadir otra incidencia</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <footer class="p-4 bg-white border-t rounded-b-lg flex justify-end">
    <button @click="handleClose" class="px-5 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Cerrar</button>
  </footer>
</div>
</div>
</template>