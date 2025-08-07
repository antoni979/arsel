<!-- src/views/InspectionView.vue -->

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../supabase'
import InteractiveMap from '../components/InteractiveMap.vue'

const route = useRoute()
const router = useRouter()

const centro = ref(null)
const puntos = ref([])
const inspeccionId = ref(null)
const loading = ref(true)

const handleNewPoint = async (coords) => {
  if (!inspeccionId.value) return;

  const newNomenclature = `P-${puntos.value.length + 1}`;

  const { data, error } = await supabase
    .from('puntos_inspeccion')
    .insert({
      inspeccion_id: inspeccionId.value,
      nomenclatura: newNomenclature,
      coordenada_x: coords.x,
      coordenada_y: coords.y,
    })
    .select()
    .single();
  
  if (error) {
    alert(error.message);
  } else {
    puntos.value.push(data);
  }
};

onMounted(async () => {
  const centroId = route.params.id;

  const { data: centroData, error: centroError } = await supabase
    .from('centros')
    .select('*')
    .eq('id', centroId)
    .single();

  if (centroError) {
    alert('Error cargando el centro');
    router.push('/dashboard');
    return;
  }
  centro.value = centroData;

  let { data: inspeccionActiva } = await supabase
    .from('inspecciones')
    .select('id')
    .eq('centro_id', centroId)
    .eq('estado', 'en_progreso')
    .single();

  if (!inspeccionActiva) {
    const { data: nuevaInspeccion, error: insertError } = await supabase
      .from('inspecciones')
      .insert({ centro_id: centroId, estado: 'en_progreso' })
      .select('id')
      .single();
    
    if (insertError) {
      alert("No se pudo crear una nueva inspección.");
      return;
    }
    inspeccionActiva = nuevaInspeccion;
  }

  inspeccionId.value = inspeccionActiva.id;

  const { data: puntosData, error: puntosError } = await supabase
    .from('puntos_inspeccion')
    .select('*')
    .eq('inspeccion_id', inspeccionId.value);
  
  if (puntosData) {
    puntos.value = puntosData;
  }
  
  loading.value = false;
});
</script>

<template>
  <div class="min-h-screen bg-gray-100 p-8">
    <div v-if="loading" class="text-center">Cargando datos de la inspección...</div>
    <div v-else-if="centro">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Inspección: {{ centro.nombre }}</h1>
      <p class="text-gray-600 mb-6">Haz clic en el plano para añadir una nueva estantería a inspeccionar.</p>
      
      <InteractiveMap 
        :image-url="centro.url_imagen_plano"
        :points="puntos"
        @add-point="handleNewPoint"
      />
      
      <!-- Próximamente: Lista de puntos y botón para finalizar -->
    </div>
  </div>
</template>