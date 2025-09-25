<!-- src/views/CentroHistorialView.vue -->
<script setup>
import { ref, onMounted, onUnmounted, computed, inject } from 'vue';
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

// Real-time subscription
let realtimeSubscription = null;

const availableYears = ref([]);
const selectedYear = ref(null);
const expandedInspectionId = ref(null);

// Pagination state
const pageSize = 20;
const currentPage = ref(1);
const totalInspecciones = ref(0);
const hasMorePages = ref(false);
const loadingMore = ref(false);

// Caching
const CACHE_KEY = `inspections_${centroId}`;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getCachedData = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data;
      }
    }
  } catch (error) {
    console.warn('Error reading cache:', error);
  }
  return null;
};

const setCachedData = (data) => {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Error writing cache:', error);
  }
};

const toggleDetails = async (inspeccionId) => {
  if (expandedInspectionId.value === inspeccionId) {
    expandedInspectionId.value = null;
  } else {
    // Load details if not already loaded
    const inspeccion = inspecciones.value.find(i => i.id === inspeccionId);
    if (inspeccion && (!inspeccion.details || inspeccion.details.length === 0)) {
      await loadInspectionDetails(inspeccion);
    }
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

// Performance monitoring
const performanceMarks = ref([]);

const markPerformance = (name) => {
  if (window.performance && window.performance.mark) {
    window.performance.mark(name);
    performanceMarks.value.push(name);
  }
};

const measurePerformance = (startMark, endMark) => {
  if (window.performance && window.performance.measure) {
    try {
      window.performance.measure(`${startMark}-to-${endMark}`, startMark, endMark);
      const measure = window.performance.getEntriesByName(`${startMark}-to-${endMark}`, 'measure')[0];
      console.log(`Performance: ${startMark}-to-${endMark}: ${measure.duration.toFixed(2)}ms`);
    } catch (error) {
      console.warn('Performance measurement failed:', error);
    }
  }
};

const fetchData = async (page = 1, append = false, silent = false) => {
  markPerformance(`fetchData-start-page-${page}`);
  if (!append && !silent) {
    loading.value = true;
  } else if (append && !silent) {
    loadingMore.value = true;
  }

  // Check cache for first page
  if (page === 1 && !append) {
    const cachedData = getCachedData();
    if (cachedData) {
      centro.value = cachedData.centro;
      inspecciones.value = cachedData.inspecciones;
      totalInspecciones.value = cachedData.totalInspecciones;
      availableYears.value = cachedData.availableYears;
      hasMorePages.value = cachedData.hasMorePages;
      loading.value = false;
      return;
    }
  }

  // First, get center data and total count
  const [centroRes, countRes] = await Promise.all([
    supabase.from('centros').select('nombre').eq('id', centroId).single(),
    supabase.from('inspecciones').select('id', { count: 'exact', head: true }).eq('centro_id', centroId)
  ]);

  centro.value = centroRes.data;
  totalInspecciones.value = countRes.count || 0;

  // Calculate pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Fetch paginated inspections with optimized query (selective fields)
  const { data: inspeccionesData } = await supabase
    .from('inspecciones')
    .select(`
      id, fecha_inspeccion, estado, tecnico_nombre, centro_id,
      fecha_envio_cliente, responsable_envio_cliente,
      url_pdf_informe_inicial, url_pdf_informe_final,
      versiones_plano(id, nombre)
    `)
    .eq('centro_id', centroId)
    .order('fecha_inspeccion', { ascending: false })
    .range(from, to);

  if (!inspeccionesData) {
    if (!append) inspecciones.value = [];
    loading.value = false;
    loadingMore.value = false;
    return;
  }

  // Process inspections (simplified - details loaded on demand)
  const processedInspections = inspeccionesData.map(inspeccion => ({
    ...inspeccion,
    details: [], // Will be loaded lazily
    totalCounts: { verde: 0, ambar: 0, rojo: 0 } // Will be calculated lazily
  }));

  if (append) {
    inspecciones.value = [...inspecciones.value, ...processedInspections];
  } else {
    inspecciones.value = processedInspections;
  }

  // Check if there are more pages
  hasMorePages.value = (page * pageSize) < totalInspecciones.value;

  // Extract available years from current data
  if (inspecciones.value.length > 0) {
    const years = new Set(inspecciones.value.map(i => new Date(i.fecha_inspeccion).getFullYear()));
    availableYears.value = Array.from(years).sort((a, b) => b - a);
  }

  // Cache the data for first page
  if (page === 1 && !append) {
    setCachedData({
      centro: centro.value,
      inspecciones: inspecciones.value,
      totalInspecciones: totalInspecciones.value,
      availableYears: availableYears.value,
      hasMorePages: hasMorePages.value
    });
  }

  if (!silent) {
    loading.value = false;
    loadingMore.value = false;
  }

  markPerformance(`fetchData-end-page-${page}`);
  measurePerformance(`fetchData-start-page-${page}`, `fetchData-end-page-${page}`);
};

// Web Worker for processing inspection details
const createProcessingWorker = () => {
  const workerCode = `
    self.onmessage = function(e) {
      const { puntosData } = e.data;

      const salasMap = new Map();
      const salaCountsMap = new Map();

      puntosData.forEach(punto => {
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

      self.postMessage({ salasConPuntos, totalCounts });
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

// Load inspection details on demand
const loadInspectionDetails = async (inspeccion) => {
  if (inspeccion.details && inspeccion.details.length > 0) return; // Already loaded

  const { data: puntosData } = await supabase
    .from('puntos_inspeccionados')
    .select(`
      id, nomenclatura,
      puntos_maestros!inner(id, sala_id, salas!inner(id, nombre)),
      incidencias(gravedad)
    `)
    .eq('inspeccion_id', inspeccion.id);

  if (!puntosData) return;

  // Use Web Worker for processing
  const worker = createProcessingWorker();
  return new Promise((resolve) => {
    worker.onmessage = (e) => {
      const { salasConPuntos, totalCounts } = e.data;

      // Update the inspection object
      const index = inspecciones.value.findIndex(i => i.id === inspeccion.id);
      if (index !== -1) {
        inspecciones.value[index] = { ...inspeccion, details: salasConPuntos, totalCounts };
      }

      worker.terminate();
      resolve();
    };

    worker.postMessage({ puntosData });
  });
};

// Prefetch next page
let prefetchPromise = null;

const prefetchNextPage = () => {
  if (hasMorePages.value && !prefetchPromise) {
    prefetchPromise = fetchData(currentPage.value + 1, false, true); // silent fetch
  }
};

// Load more inspections
const loadMoreInspecciones = async () => {
  if (!hasMorePages.value || loadingMore.value) return;

  // If we have a prefetched page, use it
  if (prefetchPromise) {
    try {
      await prefetchPromise;
      prefetchPromise = null;
    } catch (error) {
      console.warn('Prefetch failed:', error);
    }
  }

  currentPage.value++;
  await fetchData(currentPage.value, true);

  // Start prefetching the next page
  prefetchNextPage();
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
    
    // Refresh current page data
    await fetchData(currentPage.value, false);
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

        // Clear cache to ensure UI updates immediately
        localStorage.removeItem(CACHE_KEY);

        // Refresh current page data
        await fetchData(currentPage.value, false);
        showNotification('Inspección reabierta. Ahora puedes editarla de nuevo.', 'success');
    } catch (error) {
        showNotification('Error al reabrir la inspección: ' + error.message, 'error');
    } finally {
        isProcessing.value = null;
    }
}

// ======================= INICIO DE LA LÓGICA DE BORRADO DEFINITIVA =======================
const handleDelete = async (inspeccionId) => {
  const confirmed = await showConfirm('Borrar Inspección', '¿Estás seguro de que quieres borrar esta inspección? Esta acción es permanente y eliminará todos los datos y fotos asociados.');
  if (!confirmed) return;

  try {
    // 1. Obtener la lista de incidencias para saber qué archivos borrar.
    const { data: incidencias, error: getIncidenciasError } = await supabase
      .from('incidencias')
      .select('url_foto_antes, url_foto_despues')
      .eq('inspeccion_id', inspeccionId);
    if (getIncidenciasError) throw getIncidenciasError;

    // 2. Preparar la lista de archivos a borrar del Storage.
    const filesToDelete = [];
    if (incidencias) {
      incidencias.forEach(inc => {
        // Extraemos el path del archivo desde la URL completa.
        if (inc.url_foto_antes) {
          const path = inc.url_foto_antes.substring(inc.url_foto_antes.lastIndexOf('/incidencias/') + 1);
          filesToDelete.push(path);
        }
        if (inc.url_foto_despues) {
          const path = inc.url_foto_despues.substring(inc.url_foto_despues.lastIndexOf('/incidencias/') + 1);
          filesToDelete.push(path);
        }
      });
    }

    // 3. Borrar los archivos del Storage si hay alguno.
    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage.from('incidencias').remove(filesToDelete);
      if (storageError) {
        // Advertimos del error pero continuamos, para no dejar datos huérfanos en la BBDD.
        showNotification('Advertencia: No se pudieron borrar algunos archivos de imagen, pero se continuará con el borrado de datos.', 'warning');
        console.error("Storage Error:", storageError);
      }
    }

    // 4. Borrar en cascada desde la base de datos (Supabase lo gestiona si está configurado en las FK, pero lo haremos explícito para más seguridad).
    // Ya no es necesario borrar `incidencias` y `puntos_inspeccionados` primero si tienes ON DELETE CASCADE en la base de datos.
    // Si no, este es el orden seguro:
    await supabase.from('incidencias').delete().eq('inspeccion_id', inspeccionId);
    await supabase.from('puntos_inspeccionados').delete().eq('inspeccion_id', inspeccionId);

    // 5. Finalmente, borrar la inspección.
    const { error: inspeccionError } = await supabase.from('inspecciones').delete().eq('id', inspeccionId);
    if (inspeccionError) throw inspeccionError;

    // 6. Actualizar la UI.
    inspecciones.value = inspecciones.value.filter(i => i.id !== inspeccionId);
    totalInspecciones.value = Math.max(0, totalInspecciones.value - 1);
    showNotification('Inspección borrada con éxito.', 'success');

  } catch (error) {
    showNotification('Ocurrió un error al borrar la inspección: ' + error.message, 'error');
  }
};
// ======================= FIN DE LA LÓGICA DE BORRADO DEFINITIVA =======================

const setupRealtimeSubscription = () => {
  // Clean up existing subscription
  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
  }

  // Set up real-time subscription for inspections in this center
  realtimeSubscription = supabase
    .channel(`inspections_${centroId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'inspecciones',
      filter: `centro_id=eq.${centroId}`
    }, (payload) => {
      console.log('Real-time update received:', payload);

      // Clear cache and refresh data when inspection changes
      localStorage.removeItem(CACHE_KEY);
      fetchData(currentPage.value, false, true); // Silent refresh
    })
    .subscribe();
};

const cleanupRealtimeSubscription = () => {
  if (realtimeSubscription) {
    realtimeSubscription.unsubscribe();
    realtimeSubscription = null;
  }
};

onMounted(async () => {
  await fetchData(1, false);
  // Start prefetching the next page
  prefetchNextPage();
  // Set up real-time subscription after initial data load
  setupRealtimeSubscription();
});

onUnmounted(() => {
  cleanupRealtimeSubscription();
});
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

        <!-- Load More Button -->
        <div v-if="hasMorePages && !loadingMore" class="text-center py-4">
          <button @click="loadMoreInspecciones" class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">
            Cargar más inspecciones
          </button>
        </div>
        <div v-if="loadingMore" class="text-center py-4">
          <div class="inline-flex items-center gap-2 text-slate-600">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            Cargando más inspecciones...
          </div>
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