<!-- src/views/CentroConfigView.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';
import { ArrowUpTrayIcon, ArrowPathIcon } from '@heroicons/vue/24/solid';

const route = useRoute();
const router = useRouter();
const centro = ref(null);
const puntos = ref([]);
const loading = ref(true);
const centroId = route.params.id;
const selectedFile = ref(null);
const isUploading = ref(false);
const fileInput = ref(null);

// --- LÓGICA DE NOMENCLATURA (CORREGIDA) ---
const getNextNomenclature = () => {
  if (puntos.value.length === 0) {
    return 'P-1';
  }
  // Extraemos los números de las nomenclaturas existentes, ej: "P-5" -> 5
  const existingNumbers = puntos.value.map(p => parseInt(p.nomenclatura.split('-')[1] || 0));
  // Encontramos el número más alto y le sumamos 1
  const maxNumber = Math.max(...existingNumbers);
  return `P-${maxNumber + 1}`;
};

// --- MANEJADORES DE EVENTOS ---
const handleNewPoint = async (coords) => {
  const newNomenclature = getNextNomenclature();
  const { data, error } = await supabase
    .from('puntos_maestros')
    .insert({ centro_id: centroId, nomenclatura: newNomenclature, coordenada_x: coords.x, coordenada_y: coords.y })
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

// --- LÓGICA DE SUBIDA DE PLANO (sin cambios) ---
const onFileSelected = (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedFile.value = file;
    handleFileUpload();
  }
};

const handleFileUpload = async () => {
  if (!selectedFile.value) return;

  if (centro.value.url_imagen_plano) {
    if (!confirm('¡Atención! Cambiar el plano puede desalinear los puntos existentes. Se mantendrán para que puedas reajustarlos. ¿Deseas continuar?')) {
      selectedFile.value = null;
      return;
    }
  }

  isUploading.value = true;
  const fileName = `${centroId}-${Date.now()}-${selectedFile.value.name}`;
  
  const { error: uploadError } = await supabase.storage.from('planos').upload(fileName, selectedFile.value);
  if (uploadError) {
    alert('Error al subir el plano: ' + uploadError.message);
    isUploading.value = false;
    return;
  }

  const { data: { publicUrl } } = supabase.storage.from('planos').getPublicUrl(fileName);
  const { error: updateError } = await supabase.from('centros').update({ url_imagen_plano: publicUrl }).eq('id', centroId);

  if (updateError) {
    alert('Error al guardar la URL del plano: ' + updateError.message);
  } else {
    centro.value.url_imagen_plano = publicUrl;
  }

  isUploading.value = false;
  selectedFile.value = null;
};

// --- CARGA INICIAL ---
onMounted(async () => {
  const { data: centroData } = await supabase.from('centros').select('*').eq('id', centroId).single();
  centro.value = centroData;
  if (centro.value.url_imagen_plano) {
    const { data: puntosData } = await supabase.from('puntos_maestros').select('*').eq('centro_id', centroId).order('nomenclatura');
    puntos.value = puntosData || [];
  }
  loading.value = false;
});
</script>

<template>
  <div class="p-4 sm:p-8">
    <input type="file" @change="onFileSelected" accept="image/*" class="hidden" ref="fileInput">
    <div v-if="loading">...</div>
    <div v-else-if="centro">
      <!-- VISTA MAPA (SI HAY PLANO) -->
      <div v-if="centro.url_imagen_plano">
        <div class="flex justify-between items-start mb-6 gap-4">
          <div>
            <h1 class="text-3xl font-bold text-slate-800">Configurar: {{ centro.nombre }}</h1>
            <p class="text-slate-600 mt-2">Arrastra los puntos para moverlos o haz clic en el mapa para añadir nuevos.</p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
            <button @click="fileInput.click()" class="flex items-center gap-2 px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
              <ArrowPathIcon class="h-5 w-5" />
              Cambiar Plano
            </button>
            <button @click="router.push('/centros')" class="px-4 py-2 font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700">Volver</button>
          </div>
        </div>
        <div class="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
          <InteractiveMap :image-url="centro.url_imagen_plano" :points="puntos" @add-point="handleNewPoint" @delete-point="handleDeletePoint" @update-point-position="handleUpdatePosition" />
        </div>
      </div>
      <!-- VISTA SUBIR PLANO (SI NO HAY) -->
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