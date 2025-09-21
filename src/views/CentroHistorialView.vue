<!-- src/views/CentroHistorialView.vue -->
<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { 
  EyeIcon, 
  TrashIcon, 
  PaperAirplaneIcon, 
  ArchiveBoxIcon, 
  MapIcon, 
  ArrowDownCircleIcon,
  ArrowUturnLeftIcon,
  UserIcon,
  ChevronDownIcon
} from '@heroicons/vue/24/outline';
import MarkAsSentModal from '../components/MarkAsSentModal.vue';

const showNotification = inject('showNotification');
const showConfirm = inject('showConfirm');
const route = useRoute();
const router = useRouter();
const centroId = route.params.id;

const loading = ref(true);
const centro = ref(null);
const inspecciones = ref([]);
const isProcessing = ref(null);
const isSentModalOpen = ref(false);
const selectedInspeccion = ref(null);

const availableYears = ref([]);
const selectedYear = ref(null);
const expandedInspectionId = ref(null);

const toggleDetails = (inspeccionId) => {
  if (expandedInspectionId.value === inspeccionId) {
    expandedInspectionId.value = null;
  } else {
    expandedInspectionId.value = inspeccionId;
  }
};

const estadoInfo = computed(() => (estado) => {
  switch (estado) {
    case 'en_progreso': return { text: 'En Progreso', class: 'bg-blue-100 text-blue-800' };
    case 'finalizada': return { text: 'Pendiente de Envío', class: 'bg-orange-100 text-orange-800' };
    case 'pendiente_subsanacion': return { text: 'Pendiente de Cierre', class: 'bg-yellow-100 text-yellow-800' };
    case 'cerrada': return { text: 'Cerrada', class: 'bg-green-100 text-green-800' };
    default: return { text: estado, class: 'bg-slate-100 text-slate-800' };
  }
});

const filteredInspecciones = computed(() => {
  if (selectedYear.value === null) {
    return inspecciones.value;
  }
  return inspecciones.value.filter(inspeccion => {
    return new Date(inspeccion.fecha_inspeccion).getFullYear() === selectedYear.value;
  });
});

const fetchData = async () => {
  loading.value = true;
  const { data: centroData } = await supabase.from('centros').select('nombre').eq('id', centroId).single();
  centro.value = centroData;
  
  const { data: inspeccionesData } = await supabase
    .from('inspecciones')
    .select(`
      *,
      versiones_plano(id, nombre),
      puntos_inspeccionados(
        id, nomenclatura, punto_maestro_id,
        puntos_maestros(id, sala_id, salas(id, nombre)),
        incidencias(gravedad)
      )
    `)
    .eq('centro_id', centroId)
    .order('fecha_inspeccion', { ascending: false });

  if (!inspeccionesData) {
    inspecciones.value = [];
    loading.value = false;
    return;
  }

  const detailedInspections = inspeccionesData.map(inspeccion => {
    const puntos = inspeccion.puntos_inspeccionados || [];
    const salasMap = new Map();
    const salaCountsMap = new Map();

    puntos.forEach(punto => {
      const salaId = punto.puntos_maestros?.sala_id;
      const salaNombre = punto.puntos_maestros?.salas?.nombre;
      if (salaId && salaNombre) {
        if (!salasMap.has(salaId)) {
          salasMap.set(salaId, { id: salaId, nombre: salaNombre, puntos: [] });
          salaCountsMap.set(salaId, { verde: 0, ambar: 0, rojo: 0 });
        }
        const counts = { verde: 0, ambar: 0, rojo: 0 };
        (punto.incidencias || []).forEach(inc => {
          if (counts[inc.gravedad] !== undefined) counts[inc.gravedad]++;
        });
        salasMap.get(salaId).puntos.push({ ...punto, counts });
        const salaCounts = salaCountsMap.get(salaId);
        salaCounts.verde += counts.verde;
        salaCounts.ambar += counts.ambar;
        salaCounts.rojo += counts.rojo;
      }
    });

    const salasConPuntos = Array.from(salasMap.values()).map(sala => ({
      ...sala,
      puntos: sala.puntos.sort((a,b) => a.nomenclatura.localeCompare(b.nomenclatura, undefined, {numeric: true})),
      counts: salaCountsMap.get(sala.id)
    })).filter(s => s.puntos.length > 0);

    const totalCounts = salasConPuntos.reduce((acc, sala) => {
      acc.verde += sala.counts.verde;
      acc.ambar += sala.counts.ambar;
      acc.rojo += sala.counts.rojo;
      return acc;
    }, { verde: 0, ambar: 0, rojo: 0 });

    return { ...inspeccion, details: salasConPuntos, totalCounts };
  });
  
  inspecciones.value = detailedInspections;

  if (inspecciones.value.length > 0) {
    const years = new Set(inspecciones.value.map(i => new Date(i.fecha_inspeccion).getFullYear()));
    availableYears.value = Array.from(years).sort((a, b) => b - a);
  }

  loading.value = false;
};

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
    showNotification('Registro de envío guardado con éxito.', 'success');
  } catch (error) {
    showNotification('Error al registrar el envío: ' + error.message, 'error');
  } finally {
    isProcessing.value = null;
  }
};

const openArchivedPdf = (url) => {
  if (url) {
    window.open(url, '_blank');
  } else {
    showNotification('El informe PDF para esta inspección aún no ha sido generado o archivado.', 'warning');
  }
};

const reabrirInspeccion = async (inspeccion) => {
    const confirmed = await showConfirm('Reabrir Inspección', `¿Estás seguro de que quieres reabrir la inspección del ${new Date(inspeccion.fecha_inspeccion).toLocaleDateString()}? El PDF archivado será invalidado y deberás volver a finalizarla.`);
    if (!confirmed) return;
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
        showNotification('Inspección reabierta. Ahora puedes editarla de nuevo.', 'success');
    } catch (error) {
        showNotification('Error al reabrir la inspección: ' + error.message, 'error');
    } finally {
        isProcessing.value = null;
    }
}

const handleDelete = async (inspeccionId) => {
  const confirmed = await showConfirm('Borrar Inspección', '¿Estás seguro de que quieres borrar esta inspección? Esta acción es permanente y eliminará todos los datos y fotos asociados.');
  if (!confirmed) return;
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
    showNotification('Inspección borrada con éxito.', 'success');
  } catch (error) {
    showNotification('Ocurrió un error al borrar la inspección: ' + error.message, 'error');
  }
};

onMounted(fetchData);
</script>

<template>
  <div class="p-4 md:p-8">
    <div v-if="loading" class="text-center p-10">Cargando historial...</div>
    <div v-else-if="centro">
      <div class="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-4">
        <div>
          <h1 class="text-3xl md:text-4xl font-bold text-slate-800">Historial de Inspecciones</h1>
          <p class="text-xl text-slate-600 mt-2">{{ centro.nombre }}</p>
        </div>
        <button @click="router.push('/centros')" class="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 self-start md:self-center">Volver</button>
      </div>

      <div v-if="availableYears.length > 0" class="mb-6 pb-4 border-b border-slate-200">
        <h3 class="text-sm font-semibold text-slate-500 mb-2">Filtrar por año:</h3>
        <div class="flex flex-wrap gap-2">
          <button 
            @click="selectedYear = null"
            :class="['px-3 py-1 text-sm font-semibold rounded-full transition-colors', selectedYear === null ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300']">
            Todos
          </button>
          <button 
            v-for="year in availableYears" 
            :key="year"
            @click="selectedYear = year"
            :class="['px-3 py-1 text-sm font-semibold rounded-full transition-colors', selectedYear === year ? 'bg-blue-600 text-white shadow' : 'bg-slate-200 text-slate-700 hover:bg-slate-300']">
            {{ year }}
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <div v-if="filteredInspecciones.length === 0" class="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border">
          No hay inspecciones para el año seleccionado.
        </div>
        
        <div v-for="inspeccion in filteredInspecciones" :key="inspeccion.id" class="bg-white rounded-xl shadow-sm border border-slate-200 transition-all">
          <div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
            
            <div class="space-y-2">
              <div>
                <p class="text-xs font-semibold text-slate-500">Fecha Inspección</p>
                <p class="font-semibold text-slate-800">{{ new Date(inspeccion.fecha_inspeccion).toLocaleDateString() }}</p>
              </div>
              <div class="flex items-center gap-2">
                <UserIcon class="h-4 w-4 text-slate-400" />
                <span class="text-sm text-slate-600">{{ inspeccion.tecnico_nombre }}</span>
              </div>
            </div>
            
            <div class="space-y-2">
               <div>
                 <p class="text-xs font-semibold text-slate-500">Estado</p>
                 <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize" :class="estadoInfo(inspeccion.estado).class">
                    {{ estadoInfo(inspeccion.estado).text }}
                 </span>
               </div>
               <div class="flex items-center gap-x-3" title="Incidencias: Leves / Moderadas / Graves">
                  <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-green-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.totalCounts.verde }}</span></div>
                  <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.totalCounts.ambar }}</span></div>
                  <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-red-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.totalCounts.rojo }}</span></div>
              </div>
            </div>

            <div class="lg:col-span-2 flex justify-start lg:justify-end items-center flex-wrap gap-2">
              <button v-if="inspeccion.estado === 'finalizada'" @click="openSentModal(inspeccion)" :disabled="isProcessing === inspeccion.id" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 disabled:opacity-50">
                <PaperAirplaneIcon class="h-4 w-4" /> Marcar Envío
              </button>
              
              <router-link v-if="inspeccion.estado === 'pendiente_subsanacion'" :to="`/inspecciones/${inspeccion.id}/cierre`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200">
                <ArchiveBoxIcon class="h-4 w-4" /> Cierre
              </router-link>
              
              <router-link :to="`/inspecciones/${inspeccion.id}/plano-preview`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200">
                  <MapIcon class="h-4 w-4"/>Plano
              </router-link>

              <button @click="openArchivedPdf(inspeccion.url_pdf_informe_inicial)" :disabled="!inspeccion.url_pdf_informe_inicial" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowDownCircleIcon class="h-4 w-4" /> Inf. Inicial
              </button>

              <button v-if="inspeccion.estado === 'cerrada'" @click="openArchivedPdf(inspeccion.url_pdf_informe_final)" :disabled="!inspeccion.url_pdf_informe_final" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-green-700 bg-green-100 hover:bg-green-200 border border-green-200 disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowDownCircleIcon class="h-4 w-4" /> Inf. Cierre
              </button>

              <div class="flex items-center gap-1 border-l pl-2 ml-1">
                <router-link :to="`/inspecciones/${inspeccion.id}`" class="p-2 text-slate-500 hover:text-blue-600" title="Ver/Editar Inspección"><EyeIcon class="h-5 w-5" /></router-link>
                <button v-if="inspeccion.estado !== 'en_progreso'" @click="reabrirInspeccion(inspeccion)" :disabled="isProcessing === inspeccion.id" class="p-2 text-slate-500 hover:text-orange-600 disabled:opacity-50" title="Reabrir Inspección">
                    <ArrowUturnLeftIcon class="h-5 w-5" />
                </button>
                <button @click="handleDelete(inspeccion.id)" class="p-2 text-slate-500 hover:text-red-600" title="Borrar Inspección"><TrashIcon class="h-5 w-5" /></button>
              </div>
            </div>
          </div>

          <div class="px-4 pb-2 text-center">
            <button @click="toggleDetails(inspeccion.id)" class="w-full text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center justify-center gap-1 py-1 border-t border-slate-200">
              <span>{{ expandedInspectionId === inspeccion.id ? 'Ocultar Detalles' : 'Mostrar Detalles' }}</span>
              <ChevronDownIcon class="h-4 w-4 transition-transform" :class="{'rotate-180': expandedInspectionId === inspeccion.id}" />
            </button>
          </div>

          <div v-if="expandedInspectionId === inspeccion.id" class="border-t border-slate-200 p-4 bg-slate-50/50">
            <div class="space-y-3">
              <div v-if="inspeccion.details.length === 0" class="text-center text-sm text-slate-500 py-4">
                  No hay puntos con incidencias en esta inspección.
              </div>
              <div v-for="sala in inspeccion.details" :key="sala.id" class="bg-white p-3 rounded-md border">
                <div class="flex justify-between items-center mb-2">
                  <h4 class="font-bold text-slate-800">{{ sala.nombre }}</h4>
                  <div class="flex items-center gap-x-3" title="Incidencias: Leves / Moderadas / Graves">
                    <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-green-500"></span><span class="font-bold text-sm text-slate-700">{{ sala.counts.verde }}</span></div>
                    <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span><span class="font-bold text-sm text-slate-700">{{ sala.counts.ambar }}</span></div>
                    <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-red-500"></span><span class="font-bold text-sm text-slate-700">{{ sala.counts.rojo }}</span></div>
                  </div>
                </div>
                <ul class="divide-y divide-slate-100">
                  <li v-for="punto in sala.puntos" :key="punto.id" class="py-1.5 flex justify-between items-center text-sm">
                    <span class="text-slate-600">{{ punto.nomenclatura }}</span>
                     <div class="flex items-center gap-x-3">
                      <div class="flex items-center gap-1.5 w-8 justify-end"><span class="h-2 w-2 rounded-full bg-green-500"></span><span class="font-medium text-xs text-slate-700">{{ punto.counts.verde }}</span></div>
                      <div class="flex items-center gap-1.5 w-8 justify-end"><span class="h-2 w-2 rounded-full bg-amber-500"></span><span class="font-medium text-xs text-slate-700">{{ punto.counts.ambar }}</span></div>
                      <div class="flex items-center gap-1.5 w-8 justify-end"><span class="h-2 w-2 rounded-full bg-red-500"></span><span class="font-medium text-xs text-slate-700">{{ punto.counts.rojo }}</span></div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <MarkAsSentModal :is-open="isSentModalOpen" :inspeccion-id="selectedInspeccion?.id" @close="isSentModalOpen = false" @save="handleMarkAsSent" />
  </div>
</template>