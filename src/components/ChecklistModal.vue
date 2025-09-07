<!-- src/components/ChecklistModal.vue -->
<script setup>
import { ref, watch, computed } from 'vue';
import { supabase } from '../supabase';
import { checklistItems } from '../utils/checklist';
import { ArrowUpTrayIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/vue/24/solid';

const props = defineProps({
  isOpen: Boolean,
  punto: Object,
  inspeccionId: Number,
});

const emit = defineEmits(['close', 'save']);

const incidencias = ref([]);
const loading = ref(false);
const isUploading = ref(false);
const puntoInspeccionado = ref(null);

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

const loadData = async () => {
  if (!props.punto || !props.inspeccionId) return;
  loading.value = true;
  
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
    // Si no existe, lo creamos con el valor por defecto para la placa
    const { data: nuevoPunto, error: createError } = await supabase
      .from('puntos_inspeccionados')
      .insert({
        inspeccion_id: props.inspeccionId,
        punto_maestro_id: props.punto.id,
        nomenclatura: props.punto.nomenclatura,
        coordenada_x: props.punto.coordenada_x,
        coordenada_y: props.punto.coordenada_y,
        tiene_placa_caracteristicas: true, // <-- El valor por defecto se mantiene aquí como respaldo
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

  const incidenciaPlaca = getIncidenciaForItem(2);

  if (status === true) {
    if (incidenciaPlaca) {
      await supabase.from('incidencias').delete().eq('id', incidenciaPlaca.id);
      incidencias.value = incidencias.value.filter(inc => inc.id !== incidenciaPlaca.id);
    }
  } else {
    if (!incidenciaPlaca) {
      const { data: newIncidencia } = await supabase
        .from('incidencias')
        .insert({
          punto_inspeccionado_id: puntoInspeccionado.value.id,
          inspeccion_id: props.inspeccionId,
          item_checklist: 2,
          gravedad: 'verde',
          observaciones: 'No dispone de placa de características.',
        }).select().single();
      
      if (newIncidencia) {
        incidencias.value.push(newIncidencia);
      }
    }
  }
};

const getIncidenciaForItem = (itemId) => {
  return incidencias.value.find(inc => inc.item_checklist === itemId);
};

const toggleStatus = async (itemId) => {
  if (itemId === 2) {
    alert("El estado de este punto se gestiona automáticamente con la pregunta sobre la placa de características.");
    return;
  }

  const incidencia = getIncidenciaForItem(itemId);
  if (incidencia) {
    const { error } = await supabase.from('incidencias').delete().eq('id', incidencia.id);
    if (!error) {
      incidencias.value = incidencias.value.filter(inc => inc.id !== incidencia.id);
    }
  } else {
    const { data: newIncidencia } = await supabase
      .from('incidencias')
      .insert({
        punto_inspeccionado_id: puntoInspeccionado.value.id,
        inspeccion_id: props.inspeccionId,
        item_checklist: itemId,
        gravedad: 'verde',
      }).select().single();
      
    if (newIncidencia) {
      incidencias.value.push(newIncidencia);
    }
  }
};

const handleFileChange = async (event, incidencia) => {
  const file = event.target.files[0];
  if (!file) return;
  isUploading.value = true;
  const fileName = `inspeccion_${props.inspeccionId}/punto_${puntoInspeccionado.value.id}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from('incidencias').upload(fileName, file);
  if (uploadError) {
    alert("Error al subir la foto: " + uploadError.message);
    isUploading.value = false;
    return;
  }
  const { data: { publicUrl } } = supabase.storage.from('incidencias').getPublicUrl(fileName);
  incidencia.url_foto_antes = publicUrl;
  await saveIncidencia(incidencia);
  isUploading.value = false;
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
  <div v-if="isOpen" @click.self="handleClose" class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
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
            <div class="flex gap-4">
              <button @click="tienePlaca = true" 
                      :class="['w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold transition-all', 
                               tienePlaca === true ? 'bg-green-600 text-white shadow-md ring-2 ring-offset-2 ring-green-500' : 'bg-white border text-slate-700 hover:bg-slate-100']">
                <CheckCircleIcon class="h-5 w-5" />
                Sí, dispone de placa
              </button>
              <button @click="tienePlaca = false"
                      :class="['w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md font-semibold transition-all',
                               tienePlaca === false ? 'bg-red-600 text-white shadow-md ring-2 ring-offset-2 ring-red-500' : 'bg-white border text-slate-700 hover:bg-slate-100']">
                <XCircleIcon class="h-5 w-5" />
                No, no dispone de placa
              </button>
            </div>
            <p v-if="tienePlaca !== null" class="text-xs text-slate-500 mt-3 text-center">
              El estado del punto "2. Tiene las placas de identificación..." se ha actualizado automáticamente.
            </p>
          </div>

          <div v-for="item in checklistItems" :key="item.id" class="bg-white rounded-lg shadow-sm border transition-all duration-300">
            <div class="p-3 flex items-center justify-between">
              <p class="text-slate-700">{{ item.id }}. {{ item.text }}</p>
              <button 
                @click="toggleStatus(item.id)"
                :disabled="item.id === 2"
                :class="['px-3 py-1 text-xs font-bold rounded-full disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500', 
                         getIncidenciaForItem(item.id) ? 'bg-red-100 text-red-800 hover:bg-red-200' : 'bg-green-100 text-green-800 hover:bg-green-200']"
              >
                {{ getIncidenciaForItem(item.id) ? 'INSATISFACTORIO' : 'SATISFACTORIO' }}
              </button>
            </div>
            
            <div v-if="getIncidenciaForItem(item.id)" class="border-t bg-slate-50 p-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-medium text-slate-600">Gravedad</label>
                    <select v-model="getIncidenciaForItem(item.id).gravedad" @change="saveIncidencia(getIncidenciaForItem(item.id))" 
                            :disabled="item.id === 2"
                            class="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm disabled:bg-slate-200">
                      <option v-for="opt in gravedadOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-slate-600">Observaciones</label>
                    <textarea v-model="getIncidenciaForItem(item.id).observaciones" @blur="saveIncidencia(getIncidenciaForItem(item.id))" rows="3" 
                              :disabled="item.id === 2"
                              class="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm disabled:bg-slate-200"></textarea>
                  </div>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Foto de la Incidencia</label>
                  
                  <div v-if="item.id === 2" class="aspect-video bg-slate-200 rounded-md flex items-center justify-center text-center p-4">
                     <p class="text-sm text-slate-600">No se requiere fotografía para esta incidencia.</p>
                  </div>
                  <div v-else class="aspect-video bg-slate-200 rounded-md flex items-center justify-center overflow-hidden relative group">
                    <img v-if="getIncidenciaForItem(item.id).url_foto_antes" :src="getIncidenciaForItem(item.id).url_foto_antes" class="object-cover w-full h-full">
                    <div v-else>
                      <input type="file" @change="handleFileChange($event, getIncidenciaForItem(item.id))" class="hidden" :id="'fileInput-' + item.id">
                      <label :for="'fileInput-' + item.id" :disabled="isUploading" class="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                        <ArrowUpTrayIcon class="h-4 w-4" />
                        {{ isUploading ? 'Subiendo...' : 'Subir Foto' }}
                      </label>
                    </div>
                    <div v-if="getIncidenciaForItem(item.id).url_foto_antes" class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                       <input type="file" @change="handleFileChange($event, getIncidenciaForItem(item.id))" class="hidden" :id="'fileInput-change-' + item.id">
                       <label :for="'fileInput-change-' + item.id" class="cursor-pointer text-white text-sm font-semibold">Cambiar Foto</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer class="p-4 bg-white border-t rounded-b-lg flex justify-end">
        <button @click="handleClose" class="px-5 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
          Cerrar
        </button>
      </footer>
    </div>
  </div>
</template>