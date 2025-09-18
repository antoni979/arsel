<!-- src/components/ChecklistModal.vue -->
<script setup>
import { ref, watch, computed } from 'vue';
import { supabase } from '../supabase';
import { checklistItems } from '../utils/checklist';
import { 
  ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon, PlusCircleIcon, TrashIcon, 
  ArrowTrendingUpIcon, ArrowTrendingDownIcon, StopCircleIcon, ChevronUpIcon, ChevronDownIcon 
} from '@heroicons/vue/24/solid';

const props = defineProps({
  isOpen: Boolean,
  punto: Object,
  inspeccionId: Number,
});

const emit = defineEmits(['close', 'save']);

const incidencias = ref([]);
const loading = ref(false);
const isUploading = ref(null);
const puntoInspeccionado = ref(null);
const openItemId = ref(null);

const gravedadOptions = [
  { label: 'Leve', value: 'verde' },
  { label: 'Moderado', value: 'ambar' },
  { label: 'Grave', value: 'rojo' },
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

const loadData = async () => {
  if (!props.punto || !props.inspeccionId) return;
  loading.value = true;
  openItemId.value = null; 
  
  const { data: puntoRelacionado, error: findError } = await supabase
    .from('puntos_inspeccionados')
    .select('*')
    .eq('inspeccion_id', props.inspeccionId)
    .eq('punto_maestro_id', props.punto.id)
    .maybeSingle();

  if (findError) {
    console.error("Error buscando punto inspeccionado:", findError);
    loading.value = false;
    return;
  }
  
  if (puntoRelacionado) {
    puntoInspeccionado.value = puntoRelacionado;
  } else {
    const { data: nuevoPunto, error: createError } = await supabase
      .from('puntos_inspeccionados')
      .insert({
        inspeccion_id: props.inspeccionId,
        punto_maestro_id: props.punto.id,
        nomenclatura: props.punto.nomenclatura,
        coordenada_x: props.punto.coordenada_x,
        coordenada_y: props.punto.coordenada_y,
        tiene_placa_caracteristicas: true,
      })
      .select('*')
      .single();
    
    if (createError) {
      console.error("Error crítico al crear el punto de inspección:", createError);
      loading.value = false;
      return;
    }
    puntoInspeccionado.value = nuevoPunto;
  }

  const { data: incidenciasData } = await supabase
    .from('incidencias')
    .select('*')
    .eq('punto_inspeccionado_id', puntoInspeccionado.value.id);
    
  incidencias.value = incidenciasData || [];
  loading.value = false;
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) loadData();
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
          observaciones: 'FALTA PLACA. Se debe solicitar e instalar una nueva placa con las características validadas.',
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

const addIncidencia = async (itemId, defaults = {}) => {
  if (!puntoInspeccionado.value) return;
  const { data: newIncidencia } = await supabase
    .from('incidencias')
    .insert({
      punto_inspeccionado_id: puntoInspeccionado.value.id,
      inspeccion_id: props.inspeccionId,
      item_checklist: itemId,
      gravedad: defaults.gravedad || 'verde',
      observaciones: defaults.observaciones || null
    }).select().single();
    
  if (newIncidencia) {
    incidencias.value.push(newIncidencia);
  }
};

const deleteIncidencia = async (incidenciaId) => {
    const { error } = await supabase.from('incidencias').delete().eq('id', incidenciaId);
    if (!error) {
      incidencias.value = incidencias.value.filter(inc => inc.id !== incidenciaId);
    } else {
      alert("Error al borrar la incidencia: " + error.message);
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
                if(openItemId.value === itemId) {
                    openItemId.value = null;
                }
            }
        }
    } else {
        await addIncidencia(itemId);
        openItemId.value = itemId;
    }
};

const isItemOpen = (itemId) => {
  return openItemId.value === itemId;
};

const toggleCollapse = (itemId) => {
  openItemId.value = isItemOpen(itemId) ? null : itemId;
};

const handleFileChange = async (event, incidencia) => {
  const file = event.target.files[0];
  if (!file) return;
  isUploading.value = incidencia.id;
  const fileName = `inspeccion_${props.inspeccionId}/punto_${puntoInspeccionado.value.id}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from('incidencias').upload(fileName, file);
  if (uploadError) {
    alert("Error al subir la foto: " + uploadError.message);
    isUploading.value = null;
    return;
  }
  const { data: { publicUrl } } = supabase.storage.from('incidencias').getPublicUrl(fileName);
  incidencia.url_foto_antes = publicUrl;
  await saveIncidencia(incidencia);
  isUploading.value = null;
};

const saveIncidencia = async (incidencia) => {
  const { id, ...dataToUpdate } = incidencia;
  await supabase.from('incidencias').update(dataToUpdate).eq('id', id);
};

const handleClose = () => {
  emit('save');
  emit('close');
};
</script>

<template>
  <!-- ===== INICIO DE LA CORRECCIÓN: Se restaura @click.self="handleClose" ===== -->
  <div v-if="isOpen" @click.self="handleClose" class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
  <!-- ===== FIN DE LA CORRECCIÓN ===== -->
    <div class="bg-slate-50 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
      <header class="p-4 border-b bg-white rounded-t-lg flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">Checklist para Punto: {{ punto?.nomenclatura }}</h2>
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
                <component :is="isItemOpen(item.id) ? ChevronUpIcon : ChevronDownIcon" class="h-5 w-5 text-slate-500" />
              </div>

              <div v-show="isItemOpen(item.id)" class="bg-slate-50 p-4 space-y-4">
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
                      <div>
                        <label class="block text-xs font-medium text-slate-600">Observaciones</label>
                        <textarea v-model="incidencia.observaciones" @blur="saveIncidencia(incidencia)" rows="3" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm"></textarea>
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 mb-1">Foto de la Incidencia</label>
                      <div class="aspect-video bg-slate-200 rounded-md flex items-center justify-center overflow-hidden relative group">
                        <img v-if="incidencia.url_foto_antes" :src="incidencia.url_foto_antes" class="object-cover w-full h-full">
                        <div v-else class="text-center">
                          <p v-if="isUploading === incidencia.id" class="text-sm text-slate-600">Subiendo...</p>
                          <label v-else :for="'fileInput-' + incidencia.id" class="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"><ArrowUpTrayIcon class="h-4 w-4" />Subir Foto</label>
                          <input type="file" @change="handleFileChange($event, incidencia)" class="hidden" :id="'fileInput-' + incidencia.id">
                        </div>
                        <div v-if="incidencia.url_foto_antes" class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                           <input type="file" @change="handleFileChange($event, incidencia)" class="hidden" :id="'fileInput-change-' + incidencia.id">
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