<!-- src/views/CentroConfigView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';
import { ArrowPathIcon, ArrowUpTrayIcon, PlusIcon, TrashIcon, MapIcon, XCircleIcon, PencilIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/vue/24/solid';

const route = useRoute();
const router = useRouter();
const versionId = route.params.id;

const loading = ref(true);
const version = ref(null);
const centro = ref(null);
const puntos = ref([]);
const salas = ref([]);
const activeSalaId = ref(null);
const newSalaName = ref('');
const fileInput = ref(null);

const isDrawingMode = ref(false);
const isPointEditingMode = ref(false);

const instructionText = computed(() => {
    if (isDrawingMode.value) {
        return "Haz clic y arrastra sobre el plano para definir el área de la sala seleccionada.";
    }
    if (isPointEditingMode.value) {
        const activeSalaName = salas.value.find(s => s.id === activeSalaId.value)?.nombre || 'NINGUNA';
        return `Modo Edición de Puntos: Haz clic en el plano para añadir puntos en la sala "${activeSalaName.toUpperCase()}".`;
    }
    return null;
});

onMounted(async () => {
  loading.value = true;
  const { data: versionData } = await supabase.from('versiones_plano').select('*, centros(*)').eq('id', versionId).single();
  if (!versionData) {
    alert("Error: No se pudo cargar la versión del plano o no existe.");
    loading.value = false; return;
  }
  version.value = versionData;
  centro.value = versionData.centros;
  const [salasRes, puntosRes] = await Promise.all([
      supabase.from('salas').select('*').eq('version_id', versionId).order('nombre'),
      supabase.from('puntos_maestros').select('*').eq('version_id', versionId)
  ]);
  salas.value = salasRes.data || [];
  puntos.value = puntosRes.data || [];
  if (salas.value.length > 0 && !activeSalaId.value) {
      activeSalaId.value = salas.value[0].id;
  }
  loading.value = false;
});

const togglePointEditingMode = () => {
    if (!isPointEditingMode.value && !activeSalaId.value) {
        alert('Por favor, selecciona primero una sala para empezar a editar sus puntos.');
        return;
    }
    isPointEditingMode.value = !isPointEditingMode.value;
    isDrawingMode.value = false;
};

const cancelAllModes = () => {
    isDrawingMode.value = false;
    isPointEditingMode.value = false;
};

const onFileSelected = (event) => {
    const file = event.target.files[0];
    if (file) handleFileUpload(file);
};
const handleFileUpload = async (file) => {
    if (!version.value) return;
    const fileName = `planos/${centro.value.id}/version_${version.value.id}_${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('planos-centros').upload(fileName, file);
    if (uploadError) { alert("Error al subir el plano: " + uploadError.message); return; }
    const { data: { publicUrl } } = supabase.storage.from('planos-centros').getPublicUrl(fileName);
    const { error: updateError } = await supabase.from('versiones_plano').update({ url_imagen_plano: publicUrl }).eq('id', version.value.id);
    if (updateError) { alert("Error al guardar la URL del plano: " + updateError.message); } 
    else {
        version.value.url_imagen_plano = publicUrl;
        alert("Plano actualizado correctamente.");
    }
};

const toggleDrawingMode = () => {
  if (!activeSalaId.value) { alert("Selecciona una sala para poder definir su área."); return; }
  isDrawingMode.value = true;
  isPointEditingMode.value = false;
};

const handleAreaDrawn = async (area) => {
  isDrawingMode.value = false;
  const { error } = await supabase.from('salas').update(area).eq('id', activeSalaId.value);
  if (error) { alert("Error al guardar el área: " + error.message); } 
  else {
    const salaIndex = salas.value.findIndex(s => s.id === activeSalaId.value);
    if (salaIndex !== -1) { salas.value[salaIndex] = { ...salas.value[salaIndex], ...area }; }
  }
};

const handleNewPoint = async (coords) => {
  if (!activeSalaId.value) { alert("Error: No se ha seleccionado ninguna sala para añadir el punto."); return; };
  const sala = salas.value.find(s => s.id === activeSalaId.value);
  if (!sala) { alert("Error: La sala seleccionada no es válida."); return; }
  
  const puntosDeLaSala = puntos.value.filter(p => p.sala_id === activeSalaId.value);
  const existingNumbers = puntosDeLaSala.map(p => {
    const match = p.nomenclatura.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const maxNumber = Math.max(0, ...existingNumbers);
  const newNomenclature = `${sala.nombre}-${maxNumber + 1}`;

  const { data, error } = await supabase.from('puntos_maestros').insert({ 
    version_id: versionId, 
    sala_id: activeSalaId.value, 
    nomenclatura: newNomenclature, 
    coordenada_x: coords.x, 
    coordenada_y: coords.y
  }).select().single();
  
  if (data) {
    puntos.value.push(data);
  } else if (error) {
    alert(error.message);
  }
};

const handleDeletePoint = async (point) => {
    if (confirm(`¿Estás seguro de que quieres borrar el punto "${point.nomenclatura}" de este plano?`)) {
        const { error } = await supabase.from('puntos_maestros').delete().eq('id', point.id);
        if (error) {
            alert('Error al borrar el punto: ' + error.message);
        } else {
            puntos.value = puntos.value.filter(p => p.id !== point.id);
        }
    }
};

const addSala = async () => {
  if (!newSalaName.value.trim()) return;
  const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  const { data, error } = await supabase.from('salas').insert({ version_id: versionId, nombre: newSalaName.value.trim(), color: randomColor }).select().single();
  if (data) { salas.value.push(data); activeSalaId.value = data.id; newSalaName.value = ''; } 
  else if (error) { alert("Error al crear la sala: " + error.message); }
};

const deleteSala = async (salaId) => {
  if (confirm('¿Estás seguro de que quieres borrar esta sala? Se borrarán TODOS los puntos que contiene.')) {
    const { error } = await supabase.from('salas').delete().eq('id', salaId);
    if (error) { alert("Error al borrar la sala: " + error.message); } 
    else {
      salas.value = salas.value.filter(s => s.id !== salaId);
      puntos.value = puntos.value.filter(p => p.sala_id !== salaId);
      if (activeSalaId.value === salaId) { activeSalaId.value = salas.value.length > 0 ? salas.value[0].id : null; }
    }
  }
};

const handleUpdatePosition = async (point) => {
  const { error } = await supabase.from('puntos_maestros').update({ coordenada_x: point.coordenada_x, coordenada_y: point.coordenada_y }).eq('id', point.id);
  if (error) alert('Error al guardar la nueva posición: ' + error.message);
};

const saveSalaColor = async (sala) => {
  const { error } = await supabase.from('salas').update({ color: sala.color }).eq('id', sala.id);
  if (error) alert("Error al guardar el color: " + error.message);
};
</script>

<template>
  <div class="p-4 sm:p-8 h-full flex flex-col">
    <input type="file" @change="onFileSelected" accept="image/*" class="hidden" ref="fileInput">
    <div v-if="loading" class="flex justify-center items-center h-full">Cargando...</div>
    <div v-else-if="centro && version" class="flex-1 flex flex-col">
      <div v-if="version.url_imagen_plano" class="flex-1 flex flex-col">
        <div class="flex-shrink-0 flex justify-between items-start mb-6 gap-4">
          <div>
            <h1 class="text-3xl font-bold text-slate-800">Configurar: {{ centro.nombre }}</h1>
            <p class="text-slate-600 mt-2">
              Editando versión: <strong class="text-blue-600">{{ version.nombre }}</strong> 
              <span v-if="version.es_activa" class="ml-2 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">ACTIVA</span>
              <span v-else class="ml-2 text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">ARCHIVADA</span>
            </p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
             <button @click="fileInput.click()" class="flex items-center gap-2 px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                <ArrowPathIcon class="h-5 w-5" /> Cambiar Plano
             </button>
             <button v-if="isDrawingMode || isPointEditingMode" @click="cancelAllModes" class="flex items-center gap-2 px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
                <XCircleIcon class="h-5 w-5" /> Cancelar
             </button>
            <button @click="router.push(`/centros/${centro.id}/versiones`)" class="px-4 py-2 font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700">Volver a Versiones</button>
          </div>
        </div>
        
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 overflow-hidden">
          <div class="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-slate-800">Salas</h2>
                <button 
                    v-if="!isPointEditingMode"
                    @click="togglePointEditingMode" 
                    :disabled="salas.length === 0"
                    class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    <PencilIcon class="h-4 w-4" />
                    Gestionar Puntos
                </button>
                <button 
                    v-else
                    @click="togglePointEditingMode" 
                    class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                    <CheckCircleIcon class="h-4 w-4" />
                    Finalizar Edición
                </button>
            </div>
            <div class="flex-1 overflow-y-auto -mr-4 pr-4">
              <ul class="space-y-2">
                <li v-for="sala in salas" :key="sala.id">
                  <div @click="activeSalaId = sala.id" :class="['w-full p-3 rounded-lg transition-colors flex justify-between items-center group cursor-pointer', activeSalaId === sala.id ? 'bg-blue-100' : 'hover:bg-slate-100']">
                    <div class="flex items-center gap-3">
                      <input type="color" v-model="sala.color" @input="saveSalaColor(sala)" class="w-6 h-6 p-0 border-none rounded-md cursor-pointer flex-shrink-0">
                      <span class="font-semibold" :class="{'text-blue-800': activeSalaId === sala.id}">{{ sala.nombre }}</span>
                    </div>
                    <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <button @click.stop="toggleDrawingMode" :disabled="isPointEditingMode" class="p-1 text-slate-500 hover:text-blue-600 disabled:text-slate-300 disabled:cursor-not-allowed" title="Definir área de la sala">
                        <MapIcon class="h-5 w-5" />
                      </button>
                      <button @click.stop="deleteSala(sala.id)" :disabled="isPointEditingMode" class="p-1 text-slate-400 hover:text-red-600 disabled:text-slate-300 disabled:cursor-not-allowed">
                        <TrashIcon class="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
            <form @submit.prevent="addSala" class="mt-4 flex-shrink-0 flex gap-2">
              <input v-model="newSalaName" type="text" placeholder="Nueva sala..." class="flex-1 block w-full rounded-md border-slate-300 shadow-sm text-sm">
              <button type="submit" class="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                <PlusIcon class="h-5 w-5" />
              </button>
            </form>
          </div>
          
          <div class="lg:col-span-3 bg-white rounded-lg shadow-sm border border-slate-200 relative">
            <div v-if="instructionText" class="absolute top-4 left-1/2 -translate-x-1/2 max-w-[90%] bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-lg z-20 pointer-events-none flex items-center gap-2">
              <InformationCircleIcon class="h-5 w-5 flex-shrink-0" />
              <span>{{ instructionText }}</span>
            </div>
            
            <InteractiveMap 
              :image-url="version.url_imagen_plano" 
              :points="puntos" 
              :salas="salas"
              :is-read-only="!isPointEditingMode"
              :is-placement-mode="isPointEditingMode"
              :is-area-drawing-mode="isDrawingMode"
              @add-point="handleNewPoint" 
              @delete-point="handleDeletePoint" 
              @update-point-position="handleUpdatePosition"
              @area-drawn="handleAreaDrawn"
            />
          </div>
        </div>
      </div>
      
      <div v-else class="flex-1 flex flex-col items-center justify-center">
         <div class="max-w-3xl mx-auto text-center">
          <h1 class="text-3xl font-bold text-slate-800">Se necesita un plano para esta versión</h1>
          <p class="text-slate-600 mt-4 text-lg">La versión <strong class="text-blue-600">{{ version.nombre }}</strong> no tiene un plano asignado. Sube una imagen para empezar a definir los puntos.</p>
        </div>
        <div class="mt-8 max-w-lg w-full mx-auto bg-white p-8 rounded-lg shadow-md border">
          <button @click="fileInput.click()" class="w-full flex flex-col items-center justify-center gap-4 px-6 py-10 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-500 transition-colors">
            <ArrowUpTrayIcon class="h-10 w-10 text-slate-400" />
            <span class="text-slate-500 font-medium">Haz clic aquí para seleccionar un archivo</span>
          </button>
        </div>
        <div class="text-center mt-8">
          <button @click="router.push(`/centros/${centro.id}/versiones`)" class="font-semibold text-slate-600 hover:text-slate-800">Volver a Versiones sin guardar</button>
        </div>
      </div>
    </div>
  </div>
</template>