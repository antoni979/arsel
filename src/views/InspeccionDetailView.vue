<!-- src/views/InspeccionDetailView.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';
import ChecklistModal from '../components/ChecklistModal.vue';

const route = useRoute();
const inspeccionId = route.params.id;

const inspeccion = ref(null);
const centro = ref(null);
const puntos = ref([]);
const loading = ref(true);
const isModalOpen = ref(false);
const selectedPunto = ref(null);

const openChecklistFor = (punto) => {
  selectedPunto.value = punto;
  isModalOpen.value = true;
};

onMounted(async () => {
  // 1. Cargar los datos de la inspección actual
  const { data: inspectionData, error: inspectionError } = await supabase
    .from('inspecciones')
    .select('*, centros(*)') // Cargamos la inspección y la info del centro asociado
    .eq('id', inspeccionId)
    .single();
  
  if (inspectionError || !inspectionData) {
    alert('Error: No se pudo cargar la inspección.');
    loading.value = false;
    return;
  }
  
  inspeccion.value = inspectionData;
  centro.value = inspectionData.centros;

  // 2. Cargar los puntos maestros para ese centro
  if (centro.value) {
    const { data: puntosData } = await supabase
      .from('puntos_maestros')
      .select('*')
      .eq('centro_id', centro.value.id)
      .order('nomenclatura');
    puntos.value = puntosData || [];
  }
  
  loading.value = false;
});
</script>

<template>
  <div class="p-8 h-full flex flex-col">
    <div v-if="loading" class="text-center text-slate-500">Cargando datos de la inspección...</div>
    <div v-else-if="centro && inspeccion" class="flex-1 flex flex-col">
      <h1 class="text-4xl font-bold text-slate-800 mb-2">Inspección: {{ centro.nombre }}</h1>
      <p class="text-slate-500 mb-8">Selecciona un punto de la lista o del mapa para rellenar su checklist.</p>
      
      <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
        <!-- Panel Izquierdo: Lista de Puntos -->
        <div class="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
          <h2 class="text-xl font-bold text-slate-800 mb-4 flex-shrink-0">Puntos de Inspección</h2>
          <div class="flex-1 overflow-y-auto -mr-4 pr-4">
            <ul class="space-y-2">
              <li v-for="punto in puntos" :key="punto.id">
                <button @click="openChecklistFor(punto)" class="w-full text-left p-3 rounded-lg hover:bg-slate-100 transition-colors">
                  <span class="font-semibold text-slate-700">{{ punto.nomenclatura }}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <!-- Panel Derecho: Mapa -->
        <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-2">
          <InteractiveMap :image-url="centro.url_imagen_plano" :points="puntos" />
        </div>
      </div>
    </div>
    <div v-else class="text-center text-red-500">No se encontraron datos para esta inspección.</div>

    <ChecklistModal 
      :is-open="isModalOpen" 
      :punto="selectedPunto" 
      @close="isModalOpen = false" 
    />
  </div>
</template>