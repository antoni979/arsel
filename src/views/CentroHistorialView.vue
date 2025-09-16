<!-- src/views/CentroHistorialView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { 
  EyeIcon, 
  TrashIcon, 
  PaperAirplaneIcon, 
  WrenchScrewdriverIcon, 
  MapIcon, 
  ArrowDownCircleIcon,
  ArrowUturnLeftIcon,
  UserIcon // NUEVO: Icono para el técnico
} from '@heroicons/vue/24/outline';
import MarkAsSentModal from '../components/MarkAsSentModal.vue';

const route = useRoute();
const router = useRouter();
const centroId = route.params.id;

const loading = ref(true);
const centro = ref(null);
const inspecciones = ref([]);
const isProcessing = ref(null);
const isSentModalOpen = ref(false);
const selectedInspeccion = ref(null);

// NUEVO: Refs para el filtro por año
const availableYears = ref([]);
const selectedYear = ref(null); // 'null' para mostrar todos

const estadoInfo = computed(() => (estado) => {
  switch (estado) {
    case 'en_progreso': return { text: 'En Progreso', class: 'bg-blue-100 text-blue-800' };
    case 'finalizada': return { text: 'Pendiente de Envío', class: 'bg-orange-100 text-orange-800' };
    case 'pendiente_subsanacion': return { text: 'Pendiente de Subsanación', class: 'bg-yellow-100 text-yellow-800' };
    case 'cerrada': return { text: 'Cerrada y Subsanada', class: 'bg-green-100 text-green-800' };
    default: return { text: estado, class: 'bg-slate-100 text-slate-800' };
  }
});

// NUEVO: Computed property para filtrar las inspecciones
const filteredInspecciones = computed(() => {
  if (selectedYear.value === null) {
    return inspecciones.value;
  }
  return inspecciones.value.filter(inspeccion => {
    return new Date(inspeccion.fecha_inspeccion).getFullYear() === selectedYear.value;
  });
});

const openSentModal = (inspeccion) => {
  selectedInspeccion.value = inspeccion;
  isSentModalOpen.value = true;
};

const handleMarkAsSent = async (formData) => {
  // ... (sin cambios en esta función)
};

const openArchivedPdf = (url) => {
  // ... (sin cambios en esta función)
};

const reabrirInspeccion = async (inspeccion) => {
    // ... (sin cambios en esta función)
};

// MODIFICADO: Ahora también extraemos el nombre del técnico
const fetchData = async () => {
  loading.value = true;
  const { data: centroData } = await supabase.from('centros').select('nombre').eq('id', centroId).single();
  centro.value = centroData;
  const { data: inspeccionesData } = await supabase
    .from('vista_historial_inspecciones')
    .select('*') // La vista ya debería tener el tecnico_nombre
    .eq('centro_id', centroId)
    .order('fecha_inspeccion', { ascending: false });
  
  inspecciones.value = inspeccionesData || [];

  // NUEVO: Procesamos para obtener los años únicos para el filtro
  if (inspecciones.value.length > 0) {
    const years = new Set(inspecciones.value.map(i => new Date(i.fecha_inspeccion).getFullYear()));
    availableYears.value = Array.from(years).sort((a, b) => b - a); // Ordenar de más reciente a más antiguo
  }

  loading.value = false;
};

const handleDelete = async (inspeccionId) => {
  // ... (sin cambios en esta función)
};

onMounted(fetchData);
</script>

<template>
  <div class="p-4 md:p-8">
    <div v-if="loading">Cargando...</div>
    <div v-else-if="centro">
      <div class="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
        <div>
          <h1 class="text-3xl md:text-4xl font-bold text-slate-800">Historial de Inspecciones</h1>
          <p class="text-xl text-slate-600 mt-2">{{ centro.nombre }}</p>
        </div>
        <button @click="router.push('/centros')" class="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 self-start md:self-center">Volver</button>
      </div>

      <!-- NUEVO: Filtro por año -->
      <div v-if="availableYears.length > 0" class="mb-6 pb-4 border-b border-slate-200">
        <h3 class="text-sm font-semibold text-slate-500 mb-2">Filtrar por año:</h3>
        <div class="flex flex-wrap gap-2">
          <button 
            @click="selectedYear = null"
            :class="[
              'px-3 py-1 text-sm font-semibold rounded-full transition-colors',
              selectedYear === null ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            ]"
          >
            Todos
          </button>
          <button 
            v-for="year in availableYears" 
            :key="year"
            @click="selectedYear = year"
            :class="[
              'px-3 py-1 text-sm font-semibold rounded-full transition-colors',
              selectedYear === year ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            ]"
          >
            {{ year }}
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <div v-if="inspecciones.length === 0" class="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border">
          No hay inspecciones para este centro.
        </div>
        <!-- MODIFICADO: Iteramos sobre filteredInspecciones -->
        <div v-for="inspeccion in filteredInspecciones" :key="inspeccion.id" class="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <!-- MODIFICADO: Grid con nueva columna para el técnico -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
            
            <!-- Info Fecha y Técnico -->
            <div class="space-y-2">
              <div>
                <p class="text-xs font-semibold text-slate-500">Fecha Inspección</p>
                <p class="font-semibold text-slate-800">{{ new Date(inspeccion.fecha_inspeccion).toLocaleDateString() }}</p>
              </div>
              <!-- NUEVO: Mostrar nombre del técnico -->
              <div class="flex items-center gap-2">
                <UserIcon class="h-4 w-4 text-slate-400" />
                <span class="text-sm text-slate-600">{{ inspeccion.tecnico_nombre }}</span>
              </div>
            </div>
            
            <!-- Estado y Resumen -->
            <div class="space-y-2">
               <div>
                 <p class="text-xs font-semibold text-slate-500">Estado</p>
                 <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize" :class="estadoInfo(inspeccion.estado).class">
                    {{ estadoInfo(inspeccion.estado).text }}
                 </span>
               </div>
               <div class="flex items-center gap-x-3" title="Incidencias: Leves / Moderadas / Graves">
                  <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-green-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.incidencias_verdes }}</span></div>
                  <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.incidencias_ambares }}</span></div>
                  <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-red-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.incidencias_rojas }}</span></div>
              </div>
            </div>

            <!-- Acciones Principales -->
            <div class="lg:col-span-2 flex justify-start lg:justify-end items-center flex-wrap gap-2">
              <!-- Botones condicionales -->
              <button v-if="inspeccion.estado === 'finalizada'" @click="openSentModal(inspeccion)" :disabled="isProcessing === inspeccion.id" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 disabled:opacity-50">
                <PaperAirplaneIcon class="h-4 w-4" /> Marcar Envío
              </button>
              <router-link v-if="inspeccion.estado === 'pendiente_subsanacion'" :to="`/inspecciones/${inspeccion.id}/subsanar`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200"><WrenchScrewdriverIcon class="h-4 w-4" /> Subsanar </router-link>
              
              <!-- Botones de descarga -->
              <button @click="openArchivedPdf(inspeccion.url_pdf_informe_inicial)" :disabled="!inspeccion.url_pdf_informe_inicial" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowDownCircleIcon class="h-4 w-4" /> Informe Inicial
              </button>
              <button v-if="inspeccion.estado === 'cerrada'" @click="openArchivedPdf(inspeccion.url_pdf_informe_final)" :disabled="!inspeccion.url_pdf_informe_final" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-green-700 bg-green-100 hover:bg-green-200 border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowDownCircleIcon class="h-4 w-4" /> Informe Final
              </button>

              <!-- Botones de gestión -->
              <div class="flex items-center gap-1 border-l pl-2 ml-1">
                <router-link :to="`/inspecciones/${inspeccion.id}`" class="p-2 text-slate-500 hover:text-blue-600" title="Ver/Editar Inspección"><EyeIcon class="h-5 w-5" /></router-link>
                <button v-if="inspeccion.estado !== 'en_progreso'" @click="reabrirInspeccion(inspeccion)" :disabled="isProcessing === inspeccion.id" class="p-2 text-slate-500 hover:text-orange-600 disabled:opacity-50" title="Reabrir Inspección">
                    <ArrowUturnLeftIcon class="h-5 w-5" />
                </button>
                <button @click="handleDelete(inspeccion.id)" class="p-2 text-slate-500 hover:text-red-600" title="Borrar Inspección"><TrashIcon class="h-5 w-5" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <MarkAsSentModal :is-open="isSentModalOpen" :inspeccion-id="selectedInspeccion?.id" @close="isSentModalOpen = false" @save="handleMarkAsSent" />
  </div>
</template>