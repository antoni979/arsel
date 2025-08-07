<!-- src/views/CentroConfigView.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';

const route = useRoute();
const router = useRouter();
const centro = ref(null);
const puntos = ref([]);
const loading = ref(true);
const centroId = route.params.id;

// --- MANEJADORES DE EVENTOS ---
const handleNewPoint = async (coords) => {
  const newNomenclature = `P-${puntos.value.length + 1}`;
  const { data } = await supabase.from('puntos_maestros').insert({ centro_id: centroId, nomenclatura: newNomenclature, coordenada_x: coords.x, coordenada_y: coords.y }).select().single();
  if (data) puntos.value.push(data);
};

const handleDeletePoint = async (pointId) => {
  const { error } = await supabase.from('puntos_maestros').delete().eq('id', pointId);
  if (!error) {
    puntos.value = puntos.value.filter(p => p.id !== pointId);
  } else {
    alert('Error al borrar el punto: ' + error.message);
  }
};

const handleUpdatePosition = async (point) => {
  const { error } = await supabase.from('puntos_maestros').update({ coordenada_x: point.coordenada_x, coordenada_y: point.coordenada_y }).eq('id', point.id);
  if (error) {
    alert('Error al guardar la nueva posición: ' + error.message);
  }
};

// --- CARGA INICIAL (CON EL BUG ARREGLADO) ---
onMounted(async () => {
  const { data: centroData } = await supabase.from('centros').select('*').eq('id', centroId).single();
  centro.value = centroData;

  // === ¡AQUÍ ESTÁ EL ARREGLO! ===
  // Buscamos donde 'centro_id' es igual al id del centro, no donde 'id' es igual.
  const { data: puntosData } = await supabase.from('puntos_maestros').select('*').eq('centro_id', centroId).order('nomenclatura');
  puntos.value = puntosData || [];

  loading.value = false;
});
</script>

<template>
  <div class="p-4 sm:p-8">
    <div v-if="loading" class="text-center text-slate-500">Cargando...</div>
    <div v-else-if="centro">
      <div class="flex justify-between items-start mb-6">
        <div>
          <h1 class="text-3xl font-bold text-slate-800">Configurar: {{ centro.nombre }}</h1>
          <p class="text-slate-600 mt-2">Arrastra los puntos para moverlos o haz clic en el mapa para añadir nuevos.</p>
        </div>
        <button @click="router.push('/centros')" class="px-4 py-2 font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700 flex-shrink-0">
          Volver a Centros
        </button>
      </div>
      
      <div class="bg-white p-2 rounded-lg shadow-sm border border-slate-200">
        <InteractiveMap 
          :image-url="centro.url_imagen_plano"
          :points="puntos"
          @add-point="handleNewPoint"
          @delete-point="handleDeletePoint"
          @update-point-position="handleUpdatePosition"
        />
      </div>
    </div>
  </div>
</template>