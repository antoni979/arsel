<!-- src/components/ChecklistModal.vue -->
<script setup>
import { ref, watch } from 'vue';
import { supabase } from '../supabase';
import { checklistItems } from '../utils/checklist';
import { ArrowUpTrayIcon } from '@heroicons/vue/24/solid';

const props = defineProps({
  isOpen: Boolean,
  punto: Object,
  inspeccionId: Number,
});

const emit = defineEmits(['close', 'save']);

const incidencias = ref([]);
const loading = ref(false);
const isUploading = ref(false);

const gravedadOptions = [
  { label: 'Leve', value: 'verde' },
  { label: 'Moderado', value: 'ambar' },
  { label: 'Grave', value: 'rojo' },
];

const loadIncidencias = async () => {
  if (!props.punto || !props.inspeccionId) return;
  loading.value = true;
  const { data } = await supabase
    .from('incidencias')
    .select('*')
    .eq('inspeccion_id', props.inspeccionId)
    .eq('punto_maestro_id', props.punto.id);
  incidencias.value = data || [];
  loading.value = false;
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) loadIncidencias();
});

const getIncidenciaForItem = (itemId) => {
  return incidencias.value.find(inc => inc.item_checklist === itemId);
};

const toggleStatus = async (itemId) => {
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
        inspeccion_id: props.inspeccionId,
        punto_maestro_id: props.punto.id,
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
  const fileName = `inspeccion_${props.inspeccionId}/punto_${props.punto.id}/${Date.now()}_${file.name}`;
  
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
}
</script>

<template>
  <div v-if="isOpen" @click.self="handleClose" class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
    <div class="bg-slate-50 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
      <header class="p-4 border-b bg-white rounded-t-lg flex justify-between items-center">
        <h2 class="text-xl font-bold text-slate-800">Checklist para Punto: {{ punto?.nomenclatura }}</h2>
        <button @click="handleClose" class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
      </header>
      
      <main class="flex-1 overflow-y-auto p-6 space-y-3">
        <div v-if="loading">Cargando...</div>
        <div v-else v-for="item in checklistItems" :key="item.id" class="bg-white rounded-lg shadow-sm border transition-all duration-300">
          <div class="p-3 flex items-center justify-between">
            <p class="text-slate-700">{{ item.id }}. {{ item.text }}</p>
            <button 
              @click="toggleStatus(item.id)"
              :class="['px-3 py-1 text-xs font-bold rounded-full', getIncidenciaForItem(item.id) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800']"
            >
              {{ getIncidenciaForItem(item.id) ? 'INSATISFACTORIO' : 'SATISFACTORIO' }}
            </button>
          </div>
          
          <div v-if="getIncidenciaForItem(item.id)" class="border-t bg-slate-50 p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-medium text-slate-600">Gravedad</label>
                  <select v-model="getIncidenciaForItem(item.id).gravedad" @change="saveIncidencia(getIncidenciaForItem(item.id))" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm">
                    <option v-for="opt in gravedadOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600">Observaciones</label>
                  <textarea v-model="getIncidenciaForItem(item.id).observaciones" @blur="saveIncidencia(getIncidenciaForItem(item.id))" rows="3" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm text-sm"></textarea>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-slate-600 mb-1">Foto de la Incidencia</label>
                <div class="aspect-video bg-slate-200 rounded-md flex items-center justify-center overflow-hidden relative group">
                  <img v-if="getIncidenciaForItem(item.id).url_foto_antes" :src="getIncidenciaForItem(item.id).url_foto_antes" class="object-cover w-full h-full">
                  
                  <!-- === INICIO DEL ARREGLO === -->
                  <div v-else class="text-center">
                    <input type="file" @change="handleFileChange($event, getIncidenciaForItem(item.id))" class="hidden" :id="'fileInput-' + item.id">
                    <!-- El botón ahora es una etiqueta <label> que activa el input -->
                    <label :for="'fileInput-' + item.id" :disabled="isUploading" class="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                      <ArrowUpTrayIcon class="h-4 w-4" />
                      {{ isUploading ? 'Subiendo...' : 'Subir Foto' }}
                    </label>
                  </div>
                  
                  <div v-if="getIncidenciaForItem(item.id).url_foto_antes" class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                     <input type="file" @change="handleFileChange($event, getIncidenciaForItem(item.id))" class="hidden" :id="'fileInput-change-' + item.id">
                     <!-- El botón para cambiar también es una etiqueta <label> -->
                     <label :for="'fileInput-change-' + item.id" class="cursor-pointer text-white text-sm font-semibold">Cambiar Foto</label>
                  </div>
                  <!-- === FIN DEL ARREGLO === -->
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