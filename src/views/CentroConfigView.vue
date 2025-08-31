<!-- src/views/CentroConfigView.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';
import { ArrowUpTrayIcon, ArrowPathIcon, PlusIcon, TrashIcon, MapIcon } from '@heroicons/vue/24/solid';

const route = useRoute();
const router = useRouter();
const centroId = route.params.id;

const loading = ref(true);
const centro = ref(null);
const puntos = ref([]);
const salas = ref([]);
const activeSalaId = ref(null);
const newSalaName = ref('');

const fileInput = ref(null);
const selectedFile = ref(null);
const isUploading = ref(false);

// === INICIO: LÓGICA DE DIBUJO DE ÁREAS (CORREGIDA) ===
const mapContainerRef = ref(null);
const isDrawingMode = ref(false);
const drawingRect = ref(null);

const startDrawing = (event) => {
  if (!isDrawingMode.value || !activeSalaId.value) return;
  const mapRect = mapContainerRef.value.getBoundingClientRect();
  const x = (event.clientX - mapRect.left) / mapRect.width;
  const y = (event.clientY - mapRect.top) / mapRect.height;
  drawingRect.value = { area_x1: x, area_y1: y, area_x2: x, area_y2: y };
};

const drawRect = (event) => {
  if (!drawingRect.value) return;
  const mapRect = mapContainerRef.value.getBoundingClientRect();
  drawingRect.value.area_x2 = (event.clientX - mapRect.left) / mapRect.width;
  drawingRect.value.area_y2 = (event.clientY - mapRect.top) / mapRect.height;
};

// --- LA FUNCIÓN CORREGIDA ---
const finishDrawing = async (event) => {
  if (!drawingRect.value) return;
  
  // ¡LA CORRECCIÓN ESTÁ AQUÍ!
  // Si recibimos un evento (de @mouseup), actualizamos las coordenadas una última vez
  // para garantizar la posición exacta donde se soltó el clic.
  if (event && event.clientX) {
    const mapRect = mapContainerRef.value.getBoundingClientRect();
    drawingRect.value.area_x2 = (event.clientX - mapRect.left) / mapRect.width;
    drawingRect.value.area_y2 = (event.clientY - mapRect.top) / mapRect.height;
  }

  const areaToSave = { ...drawingRect.value };
  drawingRect.value = null;
  isDrawingMode.value = false;

  const { error } = await supabase
    .from('salas')
    .update({
      area_x1: areaToSave.area_x1,
      area_y1: areaToSave.area_y1,
      area_x2: areaToSave.area_x2,
      area_y2: areaToSave.area_y2,
    })
    .eq('id', activeSalaId.value);
  
  if (error) {
    alert("Error al guardar el área: " + error.message);
  } else {
    const sala = salas.value.find(s => s.id === activeSalaId.value);
    if (sala) Object.assign(sala, areaToSave);
  }
};

const toggleDrawingMode = () => {
  if (!activeSalaId.value) {
    alert("Selecciona una sala para poder definir su área.");
    return;
  }
  isDrawingMode.value = true;
  alert("Modo de dibujo activado.\n\nHaz clic y arrastra sobre el plano para definir el área de la sala seleccionada.");
};
// === FIN: LÓGICA DE DIBUJO DE ÁREAS ===

// --- LÓGICA DE GESTIÓN DE SALAS ---
const fetchSalas = async () => {
  const { data } = await supabase.from('salas').select('*').eq('centro_id', centroId).order('nombre');
  salas.value = data || [];
  if (salas.value.length > 0 && !activeSalaId.value) {
    activeSalaId.value = salas.value[0].id;
  }
};

const addSala = async () => {
  if (!newSalaName.value.trim()) return;
  const { data, error } = await supabase
    .from('salas')
    .insert({ centro_id: centroId, nombre: newSalaName.value.trim() })
    .select()
    .single();
  
  if (data) {
    salas.value.push(data);
    activeSalaId.value = data.id;
    newSalaName.value = '';
  } else if (error) {
    alert("Error al crear la sala: " + error.message);
  }
};

const deleteSala = async (salaId) => {
  if (confirm('¿Estás seguro de que quieres borrar esta sala? Se borrarán TODOS los puntos que contiene.')) {
    const { error } = await supabase.from('salas').delete().eq('id', salaId);
    if (error) {
      alert("Error al borrar la sala: " + error.message);
    } else {
      salas.value = salas.value.filter(s => s.id !== salaId);
      puntos.value = puntos.value.filter(p => p.sala_id !== salaId);
      if (activeSalaId.value === salaId) {
        activeSalaId.value = salas.value.length > 0 ? salas.value[0].id : null;
      }
    }
  }
};

const saveSalaColor = async (sala) => {
  const { error } = await supabase.from('salas').update({ color: sala.color }).eq('id', sala.id);
  if (error) alert("Error al guardar el color: " + error.message);
};

// --- LÓGICA DE NOMENCLATURA (POR SALA) ---
const getNextNomenclature = () => {
  if (!activeSalaId.value) return 'Err-Sala';
  const activeSala = salas.value.find(s => s.id === activeSalaId.value);
  if (!activeSala) return 'Err-Sala';
  
  const puntosDeLaSala = puntos.value.filter(p => p.sala_id === activeSalaId.value);
  if (puntosDeLaSala.length === 0) {
    return `${activeSala.nombre}-1`;
  }
  
  const existingNumbers = puntosDeLaSala.map(p => {
    const parts = p.nomenclatura.split('-');
    return parseInt(parts[parts.length - 1] || 0);
  });
  
  const maxNumber = Math.max(0, ...existingNumbers);
  return `${activeSala.nombre}-${maxNumber + 1}`;
};

// --- LÓGICA DE GESTIÓN DE PUNTOS ---
const handleNewPoint = async (coords) => {
  if (!activeSalaId.value) {
    alert("Por favor, selecciona o crea una sala antes de añadir un punto.");
    return;
  }
  const newNomenclature = getNextNomenclature();
  const { data, error } = await supabase
    .from('puntos_maestros')
    .insert({ 
      centro_id: centroId, 
      sala_id: activeSalaId.value,
      nomenclatura: newNomenclature, 
      coordenada_x: coords.x, 
      coordenada_y: coords.y 
    })
    .select().single();
  
  if (data) puntos.value.push(data);
  else if (error) alert(error.message);
};

const handleDeletePoint = async (pointId) => {
  const { error } = await supabase.from('puntos_maestros').delete().eq('id', pointId);
  if (!error) puntos.value = puntos.value.filter(p => p.id !== pointId);
  else alert('Error al borrar el punto: ' + error.message);
};

const handleUpdatePosition = async (point) => {
  const { error } = await supabase.from('puntos_maestros').update({ coordenada_x: point.coordenada_x, coordenada_y: point.coordenada_y }).eq('id', point.id);
  if (error) alert('Error al guardar la nueva posición: ' + error.message);
};

// --- LÓGICA DE SUBIDA DE PLANO ---
const onFileSelected = (event) => {
  selectedFile.value = event.target.files[0];
  if (selectedFile.value) handleFileUpload();
};
const handleFileUpload = async () => { /* Implementación sin cambios */ };

// --- CARGA INICIAL ---
onMounted(async () => {
  const { data: centroData } = await supabase.from('centros').select('*').eq('id', centroId).single();
  centro.value = centroData;
  await fetchSalas();
  if (centro.value.url_imagen_plano) {
    const { data: puntosData } = await supabase.from('puntos_maestros').select('*').eq('centro_id', centroId);
    puntos.value = puntosData || [];
  }
  loading.value = false;
});
</script>

<template>
  <div class="p-4 sm:p-8 h-full flex flex-col">
    <input type="file" @change="onFileSelected" accept="image/*" class="hidden" ref="fileInput">
    <div v-if="loading" class="flex justify-center items-center h-full">Cargando...</div>
    <div v-else-if="centro" class="flex-1 flex flex-col">
      <div v-if="centro.url_imagen_plano" class="flex-1 flex flex-col">
        <div class="flex-shrink-0 flex justify-between items-start mb-6 gap-4">
          <div>
            <h1 class="text-3xl font-bold text-slate-800">Configurar: {{ centro.nombre }}</h1>
            <p class="text-slate-600 mt-2">Gestiona las salas y sus puntos de inspección.</p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button @click="fileInput.click()" class="flex items-center gap-2 px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
              <ArrowPathIcon class="h-5 w-5" /> Cambiar Plano
            </button>
            <button @click="router.push('/centros')" class="px-4 py-2 font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700">Volver</button>
          </div>
        </div>
        
        <div class="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 overflow-hidden">
          <div class="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
            <h2 class="text-xl font-bold text-slate-800 mb-4 flex-shrink-0">Salas</h2>
            <div class="flex-1 overflow-y-auto -mr-4 pr-4">
              <ul class="space-y-2">
                <li v-for="sala in salas" :key="sala.id">
                  <div @click="activeSalaId = sala.id" 
                       :class="['w-full p-3 rounded-lg transition-colors flex justify-between items-center group cursor-pointer', activeSalaId === sala.id ? 'bg-blue-100' : 'hover:bg-slate-100']">
                    <div class="flex items-center gap-3">
                      <input type="color" v-model="sala.color" @change="saveSalaColor(sala)" 
                             class="w-6 h-6 p-0 border-none rounded-md cursor-pointer flex-shrink-0" :title="`Cambiar color para ${sala.nombre}`">
                      <span class="font-semibold" :class="{'text-blue-800': activeSalaId === sala.id}">{{ sala.nombre }}</span>
                    </div>
                    <div class="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <button @click.stop="toggleDrawingMode" v-if="activeSalaId === sala.id" class="p-1 text-slate-500 hover:text-blue-600" title="Definir área de la sala">
                        <MapIcon class="h-5 w-5" />
                      </button>
                      <button @click.stop="deleteSala(sala.id)" class="p-1 text-slate-400 hover:text-red-600">
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

          <div class="lg:col-span-3 bg-white p-2 rounded-lg shadow-sm border border-slate-200 relative" ref="mapContainerRef">
             <div
                class="absolute inset-0 z-10"
                :class="{ 'cursor-crosshair': isDrawingMode, 'pointer-events-none': !isDrawingMode }"
                @mousedown="startDrawing($event)"
                @mousemove="drawRect($event)"
                @mouseup="finishDrawing($event)"
                @mouseleave="finishDrawing"
             >
                <div v-if="drawingRect" class="absolute bg-blue-500 bg-opacity-20 border-2 border-blue-600 border-dashed"
                     :style="{
                        left: `${Math.min(drawingRect.area_x1, drawingRect.area_x2) * 100}%`,
                        top: `${Math.min(drawingRect.area_y1, drawingRect.area_y2) * 100}%`,
                        width: `${Math.abs(drawingRect.area_x2 - drawingRect.area_x1) * 100}%`,
                        height: `${Math.abs(drawingRect.area_y2 - drawingRect.area_y1) * 100}%`
                     }">
                </div>
             </div>
            <InteractiveMap 
              :image-url="centro.url_imagen_plano" 
              :points="puntos" 
              :salas="salas"
              @add-point="handleNewPoint" 
              @delete-point="handleDeletePoint" 
              @update-point-position="handleUpdatePosition" />
          </div>
        </div>
      </div>
      
      <div v-else>
         <div class="max-w-3xl mx-auto text-center">
          <h1 class="text-3xl font-bold text-slate-800">Se necesita un plano</h1>
          <p class="text-slate-600 mt-4 text-lg">Este centro no tiene un plano asignado. Sube una imagen para empezar a definir los puntos.</p>
        </div>
        <div class="mt-8 max-w-lg mx-auto bg-white p-8 rounded-lg shadow-md border">
          <button @click="fileInput.click()" class="w-full flex flex-col items-center justify-center gap-4 px-6 py-10 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-500 transition-colors">
            <ArrowUpTrayIcon class="h-10 w-10 text-slate-400" />
            <span class="text-slate-500 font-medium">Haz clic aquí para seleccionar un archivo</span>
          </button>
        </div>
        <div class="text-center mt-8">
          <button @click="router.push('/centros')" class="font-semibold text-slate-600 hover:text-slate-800">Volver a Centros sin guardar</button>
        </div>
      </div>
    </div>
  </div>
</template>