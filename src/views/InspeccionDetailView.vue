<!-- src/views/InspeccionDetailView.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router'; // Importamos useRouter
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';
import ChecklistModal from '../components/ChecklistModal.vue';
import { CheckCircleIcon } from '@heroicons/vue/24/solid'; // Importamos un icono para el nuevo botón

const route = useRoute();
const router = useRouter(); // Inicializamos el router para poder navegar
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

const onChecklistSaved = () => {
  console.log("Checklist guardado.");
};

// --- NUEVA FUNCIÓN PARA FINALIZAR LA INSPECCIÓN ---
const finalizarInspeccion = async () => {
  if (confirm('¿Estás seguro de que quieres finalizar esta inspección? Una vez finalizada, no podrás editar las incidencias iniciales.')) {
    const { error } = await supabase
      .from('inspecciones')
      .update({ estado: 'finalizada' }) // Cambiamos el estado a 'finalizada'
      .eq('id', inspeccionId);

    if (error) {
      alert('Error al finalizar la inspección: ' + error.message);
    } else {
      alert('Inspección finalizada correctamente.');
      router.push('/inspecciones'); // Redirigimos a la lista de inspecciones
    }
  }
};

onMounted(async () => {
  const { data: inspectionData, error: inspectionError } = await supabase
    .from('inspecciones')
    .select('*, centros(*)')
    .eq('id', inspeccionId)
    .single();
  
  if (inspectionError || !inspectionData) {
    alert('Error: No se pudo cargar la inspección.');
    loading.value = false;
    return;
  }
  
  inspeccion.value = inspectionData;
  centro.value = inspectionData.centros;

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
      <div class="flex-shrink-0 mb-8">
        <div class="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 class="text-4xl font-bold text-slate-800 mb-2">Inspección: {{ centro.nombre }}</h1>
            <p class="text-slate-500">Técnico: <span class="font-medium">{{ inspeccion.tecnico_nombre }}</span> | Fecha: <span class="font-medium">{{ new Date(inspeccion.fecha_inspeccion).toLocaleDateString() }}</span></p>
          </div>
          <!-- === BOTÓN DE FINALIZAR AÑADIDO AQUÍ === -->
          <!-- Se muestra solo si la inspección está 'en_progreso' -->
          <button 
            v-if="inspeccion.estado === 'en_progreso'"
            @click="finalizarInspeccion" 
            class="flex items-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm"
          >
            <CheckCircleIcon class="h-5 w-5" />
            Finalizar Inspección
          </button>
        </div>
      </div>
      
      <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
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

        <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-2">
          <InteractiveMap 
            :image-url="centro.url_imagen_plano" 
            :points="puntos"
            :is-read-only="true"
            @point-click="openChecklistFor"
          />
        </div>
      </div>
    </div>
    <div v-else class="text-center text-red-500">No se encontraron datos para esta inspección.</div>

    <ChecklistModal 
      :is-open="isModalOpen" 
      :punto="selectedPunto"
      :inspeccion-id="inspeccion ? inspeccion.id : null"
      @close="isModalOpen = false" 
      @save="onChecklistSaved"
    />
  </div>
</template>