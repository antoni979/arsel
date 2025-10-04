<!-- src/components/ChecklistModal.vue -->
<script setup>
import { ref, watch, computed, nextTick, inject } from 'vue';
import { supabase } from '../supabase';
import { addToQueue, getFileLocally } from '../utils/syncQueue'; // <-- Importamos getFileLocally
import { checklistItems } from '../utils/checklist';
import { useFileUpload } from '../composables/useFileUpload';
import {
  ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon, PlusCircleIcon, TrashIcon,
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, StopCircleIcon, ChevronUpIcon, ChevronDownIcon,
  PencilIcon, CheckIcon
} from '@heroicons/vue/24/solid';

const props = defineProps({
  isOpen: Boolean,
  punto: Object,
  inspeccionId: Number,
  initialIncidencias: { type: Array, required: true },
  availableCustomFields: { type: Array, required: true },
});

const emit = defineEmits(['close', 'save', 'update-nomenclatura', 'update:incidencias']);
const showNotification = inject('showNotification');

const incidencias = ref([]);
// ... (resto de refs no cambian)
const puntoInspeccionado = computed(() => props.punto);
const customFields = ref([]);
const customValues = ref({});
const collapsedItems = ref(new Set());
const isEditingName = ref(false);
const tempPointIdentifier = ref('');
const nameInputRef = ref(null);
const { isUploading, handleFileUpload: processAndUploadFile } = useFileUpload(props.inspeccionId, props.punto.id);
const dragOverIncidenceId = ref(null);


// --- INICIO DE LA MODIFICACIÓN: Lógica de Hidratación ---
const hydrateOfflineImages = async () => {
  for (const inc of incidencias.value) {
    if (inc.offlinePhotoKey_antes && !inc.url_foto_antes?.startsWith('blob:')) {
      try {
        const fileData = await getFileLocally(inc.offlinePhotoKey_antes);
        if (fileData) {
          inc.url_foto_antes = URL.createObjectURL(fileData);
        }
      } catch (error) {
        console.error(`No se pudo reconstruir la vista previa para ${inc.offlinePhotoKey_antes}:`, error);
      }
    }
  }
};

watch(() => props.isOpen, async (newVal) => {
  if (newVal) {
    incidencias.value = JSON.parse(JSON.stringify(props.initialIncidencias));
    customFields.value = props.availableCustomFields;
    customValues.value = {};
    incidencias.value.forEach(inc => {
        customValues.value[inc.id] = inc.custom_fields || {};
    });
    
    // Al abrir, hidratamos las imágenes
    await hydrateOfflineImages();

    isEditingName.value = false;
    collapsedItems.value.clear();
  }
}, { immediate: true });
// --- FIN DE LA MODIFICACIÓN ---


const handleFileChange = async (event, incidencia) => {
  const file = event.target.files[0];
  if (!file) return;
  const result = await processAndUploadFile(file, incidencia);
  if (result) {
    incidencia.url_foto_antes = result.previewUrl;
    incidencia.offlinePhotoKey_antes = result.offlinePhotoKey; // <-- Guardamos la clave
    emit('update:incidencias', incidencias.value);
  }
};

const onDrop = async (event, incidencia) => {
  event.preventDefault();
  dragOverIncidenceId.value = null;
  const files = event.dataTransfer.files;
  if (files.length === 0) return;
  const file = files[0];
  const result = await processAndUploadFile(file, incidencia);
  if (result) {
    incidencia.url_foto_antes = result.previewUrl;
    incidencia.offlinePhotoKey_antes = result.offlinePhotoKey; // <-- Guardamos la clave
    emit('update:incidencias', incidencias.value);
  }
};

const saveIncidencia = (incidencia) => {
  const { id, ...dataToUpdate } = incidencia;
  dataToUpdate.custom_fields = customValues.value[id] || {};
  emit('update:incidencias', incidencias.value);
  
  const payload = { ...dataToUpdate };
  // No enviar la URL de blob ni la clave offline a la DB
  delete payload.url_foto_antes; 
  delete payload.offlinePhotoKey_antes;
  
  addToQueue({ table: 'incidencias', type: 'update', id: id, payload });
};

// ... (El resto del script setup es idéntico, no necesita más cambios) ...
const addIncidencia = async (itemId, defaults = {}) => {
  if (!puntoInspeccionado.value) return;
  let defaultSeverity = defaults.gravedad || 'verde';
  if (!navigator.onLine && !defaults.gravedad) {
      defaultSeverity = 'ambar';
  } else if (!defaults.gravedad) {
    const { data: def } = await supabase.from('checklist_defaults').select('default_severity').eq('point_id', itemId).single();
    if (def) defaultSeverity = def.default_severity;
  }
  const tempId = `temp_${Date.now()}`;
  const newIncidencia = {
    id: tempId,
    punto_inspeccionado_id: puntoInspeccionado.value.id,
    inspeccion_id: props.inspeccionId,
    item_checklist: itemId,
    gravedad: defaultSeverity,
    observaciones: defaults.observaciones || null,
    custom_fields: {},
    url_foto_antes: null,
    url_foto_despues: null,
  };
  incidencias.value.push(newIncidencia);
  customValues.value[newIncidencia.id] = {};
  
  emit('update:incidencias', incidencias.value);

  const { id, ...payload } = newIncidencia;
  addToQueue({ table: 'incidencias', type: 'insert', tempId: tempId, payload: payload });
};
const deleteIncidencia = async (incidenciaId) => {
    if (!navigator.onLine) { showNotification("Necesitas conexión para borrar incidencias.", "warning"); return; }
    const incidencia = incidencias.value.find(inc => inc.id === incidenciaId);
    if (!incidencia) return;
    if (incidencia.url_foto_antes) {
      try {
        const url = new URL(incidencia.url_foto_antes);
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.findIndex(part => part === 'incidencias');
        if (bucketIndex !== -1) {
          const filePath = pathParts.slice(bucketIndex + 1).join('/');
          await supabase.storage.from('incidencias').remove([filePath]);
        }
      } catch (error) { console.error('Error processing photo URL for deletion:', error); }
    }
    const { error } = await supabase.from('incidencias').delete().eq('id', incidenciaId);
    if (!error) {
      incidencias.value = incidencias.value.filter(inc => inc.id !== incidenciaId);
      delete customValues.value[incidenciaId];
      emit('update:incidencias', incidencias.value);
      showNotification('Incidencia eliminada correctamente.', 'success');
    } else {
      showNotification("Error al borrar la incidencia: " + error.message, 'error');
    }
};
const toggleItemStatus = async (itemId) => {
  if (itemId === 3) {
    alert("El estado de este punto se gestiona automáticamente desde las preguntas superiores.");
    return;
  }
  const itemIncidencias = getIncidenciasForItem(itemId).value;
  if (itemIncidencias.length > 0) {
    if (!navigator.onLine) {
        showNotification("Necesitas conexión para marcar un punto como satisfactorio (requiere borrar incidencias).", "warning");
        return;
    }
    if (confirm(`¿Marcar este punto como "Satisfactorio"? Se borrarán las ${itemIncidencias.length} incidencias registradas.`)) {
      const idsToDelete = itemIncidencias.map(inc => inc.id);
      const { error } = await supabase.from('incidencias').delete().in('id', idsToDelete);
      if (!error) {
        incidencias.value = incidencias.value.filter(inc => !idsToDelete.includes(inc.id));
        emit('update:incidencias', incidencias.value);
      }
    }
  } else {
    await addIncidencia(itemId);
  }
};
const pointPrefix = computed(() => {
  if (!props.punto?.nomenclatura) return '';
  const parts = props.punto.nomenclatura.split('-');
  if (parts.length > 1) {
    parts.pop(); return `${parts.join('-')}-`;
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
  const { data: puntoMaestro, error } = await supabase.from('puntos_maestros').select('*').eq('id', props.punto.punto_maestro_id).single();
  if (puntoMaestro && !error) {
    emit('update-nomenclatura', puntoMaestro, newNomenclature);
  } else {
    alert('Error: No se pudo encontrar el punto maestro para actualizar.');
  }
};
const gravedadOptions = [{ label: 'Verde', value: 'verde' }, { label: 'Ambar', value: 'ambar' }, { label: 'Rojo', value: 'rojo' }];
const tienePlaca = computed({
  get: () => puntoInspeccionado.value?.tiene_placa_caracteristicas,
  set: (newValue) => { if (puntoInspeccionado.value) { puntoInspeccionado.value.tiene_placa_caracteristicas = newValue; handlePlacaStatusChange(newValue); } }
});
const detalleModificacion = computed({
  get: () => puntoInspeccionado.value?.detalle_modificacion,
  set: (newValue) => { if (puntoInspeccionado.value) { puntoInspeccionado.value.detalle_modificacion = newValue; handleModificationChange(newValue); } }
});
const handlePlacaStatusChange = async (status) => {
  if (!puntoInspeccionado.value) return;
  await supabase.from('puntos_inspeccionados').update({ tiene_placa_caracteristicas: status }).eq('id', puntoInspeccionado.value.id);
  const incidenciasPlaca = getIncidenciasForItem(2).value;
  if (status === true) {
    if (incidenciasPlaca.length > 0) {
      const idsToDelete = incidenciasPlaca.map(inc => inc.id);
      await supabase.from('incidencias').delete().in('id', idsToDelete);
      incidencias.value = incidencias.value.filter(inc => !idsToDelete.includes(inc.id));
      emit('update:incidencias', incidencias.value);
    }
  } else {
    if (incidenciasPlaca.length === 0) { await addIncidencia(2, { gravedad: 'verde', observaciones: 'Falta ficha' }); }
  }
};
const handleModificationChange = async (newStatus) => {
  if (!puntoInspeccionado.value) return;
  await supabase.from('puntos_inspeccionados').update({ detalle_modificacion: newStatus }).eq('id', puntoInspeccionado.value.id);
  const incidenciasModificacion = getIncidenciasForItem(3).value;
  const idsToDelete = incidenciasModificacion.map(inc => inc.id);
  if (idsToDelete.length > 0) {
    await supabase.from('incidencias').delete().in('id', idsToDelete);
    incidencias.value = incidencias.value.filter(inc => !idsToDelete.includes(inc.id));
    emit('update:incidencias', incidencias.value);
  }
  if (newStatus === 'aumentado') {
    await addIncidencia(3, { gravedad: 'ambar', observaciones: 'Se ha aumentado el número de módulos y/o niveles.' });
  } else if (newStatus === 'disminuido') {
    await addIncidencia(3, { gravedad: 'verde', observaciones: 'Se ha disminuido el número de módulos y/o niveles.' });
  }
};
const getIncidenciasForItem = (itemId) => computed(() => incidencias.value.filter(inc => inc.item_checklist === itemId));
const getCustomFieldsForItem = (itemId) => customFields.value.filter(field => field.point_id === itemId);
const isCollapsed = (itemId) => collapsedItems.value.has(itemId);
const toggleCollapse = (itemId) => { if (isCollapsed(itemId)) { collapsedItems.value.delete(itemId); } else { collapsedItems.value.add(itemId); } };
const onDragOver = (event, incidenceId) => { event.preventDefault(); dragOverIncidenceId.value = incidenceId; };
const onDragLeave = (event) => { event.preventDefault(); dragOverIncidenceId.value = null; };
const handleClose = () => {
  for (const item of checklistItems) {
    const itemFields = getCustomFieldsForItem(item.id);
    const itemIncidencias = getIncidenciasForItem(item.id).value;
    if (itemIncidencias.length > 0) {
      for (const field of itemFields) {
        if (field.required) {
          const hasFilledField = itemIncidencias.some(inc => customValues.value[inc.id]?.[field.id]);
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
    <div v-if="!punto" class="text-center p-10">Cargando datos del punto...</div>
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
                    <div v-else class="text-center p-4">
                      <p v-if="isUploading === incidencia.id" class="text-sm text-slate-600">Procesando...</p>
                      <p v-else-if="dragOverIncidenceId === incidencia.id" class="text-sm text-slate-600">Suelta la foto aquí</p>
                      
                      <div v-else class="flex flex-col gap-2">
                        <label :for="'cameraInput-' + incidencia.id" class="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                          <ArrowUpTrayIcon class="h-4 w-4" /> Hacer Foto
                        </label>
                        <label :for="'fileInput-' + incidencia.id" class="cursor-pointer text-xs text-slate-600 hover:underline">
                          o seleccionar de la galería
                        </label>
                      </div>

                      <input type="file" @change="handleFileChange($event, incidencia)" class="hidden" :id="'cameraInput-' + incidencia.id" accept="image/*" capture="environment">
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