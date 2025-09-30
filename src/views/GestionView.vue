<!-- src/views/GestionView.vue -->
<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { supabase } from '../supabase';
import { useRouter } from 'vue-router';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import GrupoVisitaEditable from '../components/GrupoVisitaEditable.vue';
// ===== CAMBIO 1: Importamos la nueva función para generar Excel =====
import { generateGestionExcel } from '../utils/excel/excel-module-gestion';
import { ArrowPathIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/solid';

const showNotification = inject('showNotification');
const router = useRouter();

const loading = ref(true);
const refreshing = ref(false);
const isGeneratingExcel = ref(false); // Renombramos la variable de estado
const resumenData = ref([]);
const searchTerm = ref('');

const filteredData = computed(() => {
  if (!searchTerm.value) {
    return resumenData.value;
  }
  const searchLower = searchTerm.value.toLowerCase();
  return resumenData.value.filter(item => 
    item.centro_nombre.toLowerCase().includes(searchLower)
  );
});

const estadoInfo = (estado) => {
  switch (estado) {
    case 'en_progreso': return { text: 'En Progreso', class: 'bg-blue-100 text-blue-800' };
    case 'finalizada': return { text: 'Pend. Envío', class: 'bg-orange-100 text-orange-800' };
    case 'pendiente_subsanacion': return { text: 'Pend. Cierre', class: 'bg-yellow-100 text-yellow-800' };
    case 'cerrada': return { text: 'Cerrada', class: 'bg-green-100 text-green-800' };
    default: return { text: 'Sin Inspección', class: 'bg-slate-100 text-slate-600' };
  }
};

const fetchData = async () => {
  const { data, error } = await supabase
    .from('vista_gestion_centros')
    .select('*');
  
  if (error) {
    showNotification(`Error al cargar los datos: ${error.message}`, 'error');
    console.error(error);
    return [];
  }
  return data;
};

const refreshView = async () => {
  refreshing.value = true;
  const { error: rpcError } = await supabase.rpc('refrescar_vista_gestion');
  if (rpcError) {
    showNotification(`Error al refrescar los datos: ${rpcError.message}`, 'error');
  } else {
    resumenData.value = await fetchData();
    showNotification('Datos actualizados correctamente.', 'success');
  }
  refreshing.value = false;
};

const handleSaveGrupo = async ({ inspeccionId, newValue }) => {
  const { error } = await supabase
    .from('inspecciones')
    .update({ grupo_visita: newValue })
    .eq('id', inspeccionId);

  if (error) {
    showNotification('Error al guardar el grupo: ' + error.message, 'error');
  } else {
    const item = resumenData.value.find(i => i.inspeccion_id === inspeccionId);
    if (item) item.grupo_visita = newValue;
    showNotification('Grupo de visita guardado.', 'success', 2000);
  }
};

// ===== CAMBIO 2: La función ahora llama al generador de Excel =====
const handleDownloadExcel = async () => {
  isGeneratingExcel.value = true;
  showNotification('Generando archivo XLSX, por favor espera...', 'info');
  try {
    await generateGestionExcel(filteredData.value);
  } catch (error) {
    showNotification('Hubo un error al generar el archivo Excel.', 'error');
  } finally {
    isGeneratingExcel.value = false;
  }
};

onMounted(async () => {
  loading.value = true;
  resumenData.value = await fetchData();
  loading.value = false;
});

</script>

<template>
  <div class="p-4 md:p-8">
    <div class="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
      <h1 class="text-3xl md:text-4xl font-bold text-slate-800">Panel de Gestión Anual</h1>
      
      <div class="flex items-center gap-x-2 w-full md:w-auto">
        <div class="relative flex-grow">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon class="h-5 w-5 text-slate-400" />
          </div>
          <input 
            v-model="searchTerm"
            type="search"
            placeholder="Buscar centro..."
            class="block w-full rounded-md border-slate-300 py-2 pl-10 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
        </div>
        <button @click="refreshView" :disabled="refreshing || isGeneratingExcel" class="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm flex-shrink-0 disabled:bg-slate-400">
          <ArrowPathIcon class="h-5 w-5" :class="{'animate-spin': refreshing}" />
          <span class="hidden sm:inline">Actualizar</span>
        </button>
        <!-- ===== CAMBIO 3: El botón ahora llama a la función de Excel y tiene un texto más claro ===== -->
        <button @click="handleDownloadExcel" :disabled="refreshing || isGeneratingExcel" class="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm flex-shrink-0 disabled:bg-slate-400">
          <ArrowDownTrayIcon class="h-5 w-5" />
          <span class="hidden sm:inline">Descargar XLSX</span>
        </button>
      </div>

    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 10" :key="i" class="bg-white rounded-lg shadow-sm border border-slate-200 h-16"><SkeletonLoader/></div>
    </div>

    <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="sticky left-0 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">Centro</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Región</th>
            <th class="px-4 py-3 text-center font-semibold text-slate-600">Última Inspección</th>
            <th class="px-4 py-3 text-center font-semibold text-slate-600">Grupo Visita</th>
            <th class="px-4 py-3 text-center font-semibold text-slate-600">Estado Informe</th>
            <th class="px-4 py-3 text-center font-semibold text-slate-600">Cambios Alineaciones</th>
            <th class="px-4 py-3 text-center font-semibold text-slate-600">Faltan Fichas</th>
            <th colspan="3" class="px-4 py-3 text-center font-semibold text-slate-600 border-l border-r">Daños</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600"></th>
          </tr>
          <tr class="bg-slate-100">
             <th colspan="7"></th>
             <th class="w-16 text-center font-medium text-xs text-green-700 bg-green-100 py-1">V</th>
             <th class="w-16 text-center font-medium text-xs text-amber-700 bg-amber-100 py-1">A</th>
             <th class="w-16 text-center font-medium text-xs text-red-700 bg-red-100 py-1 border-r">R</th>
             <th></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          <tr v-for="item in filteredData" :key="item.centro_id" class="hover:bg-slate-50">
            <td class="sticky left-0 bg-white hover:bg-slate-50 px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
              <router-link :to="`/centros/${item.centro_id}/historial`" class="hover:underline text-blue-700">
                {{ item.centro_nombre }}
              </router-link>
            </td>
            <td class="px-4 py-3 text-slate-600 whitespace-nowrap">{{ item.region }}</td>
            <td class="px-4 py-3 text-center text-slate-600 whitespace-nowrap">
              {{ item.fecha_inspeccion ? new Date(item.fecha_inspeccion + 'T00:00:00').toLocaleDateString() : '-' }}
            </td>
            <td class="px-4 py-3 text-center text-slate-800">
              <GrupoVisitaEditable :value="item.grupo_visita" :inspeccion-id="item.inspeccion_id" @save="handleSaveGrupo" />
            </td>
            <td class="px-4 py-3 text-center">
              <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', estadoInfo(item.estado_informe).class]">
                {{ estadoInfo(item.estado_informe).text }}
              </span>
            </td>
            <td class="px-4 py-3 text-center font-medium text-slate-800">{{ item.cambios_en_alineaciones }}</td>
            <td class="px-4 py-3 text-center font-medium" :class="item.faltan_fichas ? 'text-red-600' : 'text-slate-800'">
              {{ item.faltan_fichas ? 'SI' : 'NO' }}
            </td>
            <td class="px-4 py-3 text-center font-bold text-green-600 bg-green-50/50">{{ item.danos_verdes }}</td>
            <td class="px-4 py-3 text-center font-bold text-amber-600 bg-amber-50/50">{{ item.danos_ambares }}</td>
            <td class="px-4 py-3 text-center font-bold text-red-600 bg-red-50/50 border-r">{{ item.danos_rojos }}</td>
            <td class="px-4 py-3 text-center">
              <router-link :to="`/centros/${item.centro_id}/historial`" class="font-semibold text-blue-600 hover:text-blue-800">
                Ver
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>