<!-- src/views/CentroHistorialView.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { EyeIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/outline';
import { generateReport } from '../utils/pdfGenerator'; // <-- IMPORTAMOS NUESTRO GENERADOR

const route = useRoute();
const router = useRouter();
const centroId = route.params.id;

const loading = ref(true);
const centro = ref(null);
const inspecciones = ref([]);
const isGeneratingPdf = ref(false);

const handleGeneratePdf = async (inspeccionId) => {
  isGeneratingPdf.value = true;
  await generateReport(inspeccionId);
  isGeneratingPdf.value = false;
};

const fetchData = async () => {
  loading.value = true;
  const { data: centroData } = await supabase.from('centros').select('nombre').eq('id', centroId).single();
  centro.value = centroData;
  const { data: inspeccionesData } = await supabase.from('inspecciones').select('*').eq('centro_id', centroId).order('fecha_inspeccion', { ascending: false });
  inspecciones.value = inspeccionesData || [];
  loading.value = false;
};

const handleDelete = async (inspeccionId) => {
  if (confirm('¿Estás seguro de que quieres borrar esta inspección y todas sus incidencias?')) {
    const { error } = await supabase.from('inspecciones').delete().eq('id', inspeccionId);
    if (error) {
      alert('Error al borrar la inspección: ' + error.message);
    } else {
      inspecciones.value = inspecciones.value.filter(i => i.id !== inspeccionId);
    }
  }
};

onMounted(fetchData);
</script>

<template>
  <div class="p-8">
    <div v-if="loading">Cargando historial...</div>
    <div v-else-if="centro">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-4xl font-bold text-slate-800">Historial de Inspecciones</h1>
          <p class="text-xl text-slate-600 mt-2">{{ centro.nombre }}</p>
        </div>
        <button @click="router.push('/centros')" class="px-4 py-2 font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700">
          Volver a Centros
        </button>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <ul class="divide-y divide-slate-200">
          <li v-if="inspecciones.length === 0" class="p-8 text-center text-slate-500">
            No se han encontrado inspecciones para este centro.
          </li>
          <li v-for="inspeccion in inspecciones" :key="inspeccion.id" class="p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
            <div class="md:col-span-1">
              <p class="font-semibold text-slate-800">Fecha:</p>
              <p class="text-slate-600">{{ new Date(inspeccion.fecha_inspeccion).toLocaleDateString() }}</p>
            </div>
            <div class="md:col-span-1">
              <p class="font-semibold text-slate-800">Técnico:</p>
              <p class="text-slate-600">{{ inspeccion.tecnico_nombre }}</p>
            </div>
            <div class="md:col-span-1">
              <p class="font-semibold text-slate-800">Estado:</p>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="{ 'bg-blue-100 text-blue-800': inspeccion.estado === 'en_progreso', 'bg-green-100 text-green-800': inspeccion.estado === 'finalizada', 'bg-slate-100 text-slate-800': inspeccion.estado === 'cerrada' }">
                {{ inspeccion.estado.replace('_', ' ') }}
              </span>
            </div>
            <div class="md:col-span-2 flex justify-end items-center gap-2">
              <!-- === BOTÓN DE DESCARGA AÑADIDO === -->
              <button 
                v-if="inspeccion.estado !== 'en_progreso'" 
                @click="handleGeneratePdf(inspeccion.id)" 
                :disabled="isGeneratingPdf"
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-400"
              >
                <ArrowDownTrayIcon class="h-4 w-4" />
                {{ isGeneratingPdf ? 'Generando...' : 'Informe' }}
              </button>
              <router-link :to="`/inspecciones/${inspeccion.id}`" class="p-2 text-slate-500 hover:text-blue-600" title="Ver Inspección">
                <EyeIcon class="h-5 w-5" />
              </router-link>
              <button @click="handleDelete(inspeccion.id)" class="p-2 text-slate-500 hover:text-red-600" title="Borrar Inspección">
                <TrashIcon class="h-5 w-5" />
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>