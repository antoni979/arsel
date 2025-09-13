<!-- src/views/CentroHistorialView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { 
  EyeIcon, 
  TrashIcon, 
  CheckBadgeIcon, 
  PaperAirplaneIcon, 
  WrenchScrewdriverIcon, 
  MapIcon, 
  ArrowDownCircleIcon,
  ArrowUturnLeftIcon
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

const estadoInfo = computed(() => (estado) => {
  switch (estado) {
    case 'en_progreso': return { text: 'En Progreso', class: 'bg-blue-100 text-blue-800' };
    case 'finalizada': return { text: 'Pendiente de Envío', class: 'bg-orange-100 text-orange-800' };
    case 'pendiente_subsanacion': return { text: 'Pendiente de Subsanación', class: 'bg-yellow-100 text-yellow-800' };
    case 'cerrada': return { text: 'Cerrada y Subsanada', class: 'bg-green-100 text-green-800' };
    default: return { text: estado, class: 'bg-slate-100 text-slate-800' };
  }
});

const openSentModal = (inspeccion) => {
  selectedInspeccion.value = inspeccion;
  isSentModalOpen.value = true;
};

const handleMarkAsSent = async (formData) => {
  if (!selectedInspeccion.value) return;
  
  isProcessing.value = selectedInspeccion.value.id;
  isSentModalOpen.value = false;

  try {
    const { error } = await supabase
      .from('inspecciones')
      .update({ 
        fecha_envio_cliente: formData.fecha_envio, 
        responsable_envio_cliente: formData.responsable_envio,
        estado: 'pendiente_subsanacion'
      })
      .eq('id', selectedInspeccion.value.id);
    if (error) throw error;
    
    await fetchData();
    alert('Registro de envío guardado con éxito.');
  } catch (error) {
    alert('Error al registrar el envío: ' + error.message);
  } finally {
    isProcessing.value = null;
  }
};

const openArchivedPdf = (url) => {
  if (url) {
    window.open(url, '_blank');
  } else {
    alert('El informe PDF para esta inspección aún no ha sido generado o archivado.');
  }
};

const reabrirInspeccion = async (inspeccion) => {
    if (!confirm(`¿Estás seguro de que quieres reabrir la inspección del ${new Date(inspeccion.fecha_inspeccion).toLocaleDateString()}? El PDF archivado será invalidado y deberás volver a finalizarla.`)) {
        return;
    }
    isProcessing.value = inspeccion.id;
    try {
        const { error } = await supabase
            .from('inspecciones')
            .update({
                estado: 'en_progreso',
                url_pdf_informe_inicial: null,
                url_pdf_informe_final: null
            })
            .eq('id', inspeccion.id);
        if (error) throw error;
        await fetchData();
        alert('Inspección reabierta. Ahora puedes editarla de nuevo.');
    } catch (error) {
        alert('Error al reabrir la inspección: ' + error.message);
    } finally {
        isProcessing.value = null;
    }
}

const fetchData = async () => {
  loading.value = true;
  const { data: centroData } = await supabase.from('centros').select('nombre').eq('id', centroId).single();
  centro.value = centroData;
  const { data: inspeccionesData } = await supabase.from('vista_historial_inspecciones').select('*').eq('centro_id', centroId).order('fecha_inspeccion', { ascending: false });
  inspecciones.value = inspeccionesData || [];
  loading.value = false;
};

const handleDelete = async (inspeccionId) => {
  if (confirm('¿Estás seguro de que quieres borrar esta inspección? Esta acción es permanente y eliminará todos los datos y fotos asociados.')) {
    try {
      const { data: incidencias, error: getError } = await supabase.from('incidencias').select('url_foto_antes, url_foto_despues').eq('inspeccion_id', inspeccionId);
      if (getError) throw getError;
      const filesToDelete = [];
      if (incidencias && incidencias.length > 0) {
        incidencias.forEach(inc => {
          if (inc.url_foto_antes) { const filePath = inc.url_foto_antes.split('/incidencias/')[1]; if (filePath) filesToDelete.push(filePath); }
          if (inc.url_foto_despues) { const filePath = inc.url_foto_despues.split('/incidencias/')[1]; if (filePath) filesToDelete.push(filePath); }
        });
      }
      if (filesToDelete.length > 0) {
        await supabase.storage.from('incidencias').remove(filesToDelete);
      }
      const { error: deleteError } = await supabase.from('inspecciones').delete().eq('id', inspeccionId);
      if (deleteError) throw deleteError;
      inspecciones.value = inspecciones.value.filter(i => i.id !== inspeccionId);
      alert('Inspección borrada con éxito.');
    } catch (error) {
      alert('Ocurrió un error al borrar la inspección: ' + error.message);
    }
  }
};

onMounted(fetchData);
</script>

<template>
  <div class="p-8">
    <div v-if="loading">Cargando...</div>
    <div v-else-if="centro">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-4xl font-bold text-slate-800">Historial de Inspecciones</h1>
          <p class="text-xl text-slate-600 mt-2">{{ centro.nombre }}</p>
        </div>
        <button @click="router.push('/centros')" class="px-4 py-2 font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700">Volver</button>
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <ul class="divide-y divide-slate-200">
          <li v-if="inspecciones.length === 0" class="p-8 text-center text-slate-500">No hay inspecciones.</li>
          <li v-for="inspeccion in inspecciones" :key="inspeccion.id" class="p-4 grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
            <div class="lg:col-span-1">
              <p class="font-semibold text-slate-800">Fecha Inspección:</p>
              <p class="text-slate-600">{{ new Date(inspeccion.fecha_inspeccion).toLocaleDateString() }}</p>
            </div>
            <div class="lg:col-span-1">
               <p class="font-semibold text-slate-800">Estado General:</p>
               <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize" :class="estadoInfo(inspeccion.estado).class">
                  {{ estadoInfo(inspeccion.estado).text }}
               </span>
            </div>
            <div class="lg:col-span-1">
              <p class="font-semibold text-slate-800 mb-1">Resumen Incidencias:</p>
              <div class="flex items-center gap-x-3">
                  <div class="flex items-center gap-1.5" title="Leves"><span class="h-2.5 w-2.5 rounded-full bg-green-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.incidencias_verdes }}</span></div>
                  <div class="flex items-center gap-1.5" title="Moderadas"><span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.incidencias_ambares }}</span></div>
                  <div class="flex items-center gap-1.5" title="Graves"><span class="h-2.5 w-2.5 rounded-full bg-red-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.incidencias_rojas }}</span></div>
              </div>
            </div>
            <div class="lg:col-span-2 flex justify-end items-center flex-wrap gap-2">
              <button v-if="inspeccion.estado === 'finalizada'" @click="openSentModal(inspeccion)" :disabled="isProcessing === inspeccion.id" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 disabled:opacity-50">
                <PaperAirplaneIcon class="h-4 w-4" /> 
                Marcar Envío
              </button>
              <router-link v-if="inspeccion.estado === 'pendiente_subsanacion'" :to="`/inspecciones/${inspeccion.id}/subsanar`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200"><WrenchScrewdriverIcon class="h-4 w-4" /> Subsanar </router-link>
              <router-link :to="`/inspecciones/${inspeccion.id}/plano-preview`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200">
                  <MapIcon class="h-4 w-4"/>Plano
              </router-link>
              <button @click="openArchivedPdf(inspeccion.url_pdf_informe_inicial)" :disabled="!inspeccion.url_pdf_informe_inicial" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowDownCircleIcon class="h-4 w-4" />
                Informe Inicial
              </button>
              <button v-if="inspeccion.estado === 'cerrada'" @click="openArchivedPdf(inspeccion.url_pdf_informe_final)" :disabled="!inspeccion.url_pdf_informe_final" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-green-700 bg-green-100 hover:bg-green-200 border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowDownCircleIcon class="h-4 w-4" />
                Informe Subsanación
              </button>
              <div class="flex items-center gap-1 border-l pl-2 ml-2">
                <router-link :to="`/inspecciones/${inspeccion.id}`" class="p-2 text-slate-500 hover:text-blue-600" title="Ver/Editar Inspección"><EyeIcon class="h-5 w-5" /></router-link>
                <button v-if="inspeccion.estado !== 'en_progreso'" @click="reabrirInspeccion(inspeccion)" :disabled="isProcessing === inspeccion.id" class="p-2 text-slate-500 hover:text-orange-600 disabled:opacity-50" title="Reabrir Inspección para editar">
                    <ArrowUturnLeftIcon class="h-5 w-5" />
                </button>
                <button @click="handleDelete(inspeccion.id)" class="p-2 text-slate-500 hover:text-red-600" title="Borrar Inspección"><TrashIcon class="h-5 w-5" /></button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <MarkAsSentModal :is-open="isSentModalOpen" :inspeccion-id="selectedInspeccion?.id" @close="isSentModalOpen = false" @save="handleMarkAsSent" />
  </div>
</template>