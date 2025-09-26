// src/composables/useInspections.js

import { ref, onMounted, onUnmounted, readonly } from 'vue';
import { supabase } from '../supabase';

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

      self.postMessage({ salasConPuntos });
    };
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

export function useInspections(centroId) {
  const loading = ref(true);
  const loadingMore = ref(false);
  const centro = ref(null);
  const inspecciones = ref([]);
  const realtimeSubscription = ref(null);
  const availableYears = ref([]);
  
  const pageSize = 20;
  const currentPage = ref(1);
  const totalInspecciones = ref(0);
  const hasMorePages = ref(false);

  const CACHE_KEY = `inspections_${centroId}`;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const getCachedData = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) return data;
      }
    } catch (error) { console.warn('Error reading cache:', error); }
    return null;
  };

  const setCachedData = (data) => {
    try {
      const cacheData = { data, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) { console.warn('Error writing cache:', error); }
  };

  const fetchData = async (page = 1, append = false, silent = false) => {
    if (!append && !silent) loading.value = true;
    else if (append && !silent) loadingMore.value = true;

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

    const [centroRes, countRes] = await Promise.all([
      supabase.from('centros').select('nombre').eq('id', centroId).single(),
      supabase.from('inspecciones').select('id', { count: 'exact', head: true }).eq('centro_id', centroId)
    ]);

    centro.value = centroRes.data;
    totalInspecciones.value = countRes.count || 0;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: inspeccionesData } = await supabase
      .from('inspecciones')
      .select('id, fecha_inspeccion, estado, tecnico_nombre, centro_id, fecha_envio_cliente, responsable_envio_cliente, url_pdf_informe_inicial, url_pdf_informe_final, versiones_plano(id, nombre)')
      .eq('centro_id', centroId)
      .order('fecha_inspeccion', { ascending: false })
      .range(from, to);

    if (!inspeccionesData) {
      if (!append) inspecciones.value = [];
      loading.value = false;
      loadingMore.value = false;
      return;
    }

    const inspectionIds = inspeccionesData.map(i => i.id);
    const countsMap = new Map();
    inspectionIds.forEach(id => countsMap.set(id, { verde: 0, ambar: 0, rojo: 0 }));

    if (inspectionIds.length > 0) {
      const { data: countsData } = await supabase.from('incidencias').select('inspeccion_id, gravedad').in('inspeccion_id', inspectionIds);
      if (countsData) {
        countsData.forEach(inc => {
          const counts = countsMap.get(inc.inspeccion_id);
          if (counts && counts[inc.gravedad] !== undefined) counts[inc.gravedad]++;
        });
      }
    }

    const processedInspections = inspeccionesData.map(inspeccion => ({
      ...inspeccion,
      details: [],
      totalCounts: countsMap.get(inspeccion.id) || { verde: 0, ambar: 0, rojo: 0 }
    }));

    if (append) inspecciones.value.push(...processedInspections);
    else inspecciones.value = processedInspections;
    
    hasMorePages.value = (page * pageSize) < totalInspecciones.value;
    
    if (inspecciones.value.length > 0) {
      const years = new Set(inspecciones.value.map(i => new Date(i.fecha_inspeccion).getFullYear()));
      availableYears.value = Array.from(years).sort((a, b) => b - a);
    }

    if (page === 1 && !append) {
      setCachedData({ centro: centro.value, inspecciones: inspecciones.value, totalInspecciones: totalInspecciones.value, availableYears: availableYears.value, hasMorePages: hasMorePages.value });
    }

    if (!silent) {
      loading.value = false;
      loadingMore.value = false;
    }
  };

  const loadInspectionDetails = async (inspeccionId) => {
    const inspeccion = inspecciones.value.find(i => i.id === inspeccionId);
    if (!inspeccion || (inspeccion.details && inspeccion.details.length > 0)) return;

    const { data: puntosData } = await supabase.from('puntos_inspeccionados').select('id, nomenclatura, puntos_maestros!inner(id, sala_id, salas!inner(id, nombre)), incidencias(gravedad)').eq('inspeccion_id', inspeccionId);
    if (!puntosData) return;

    const worker = createProcessingWorker();
    worker.onmessage = (e) => {
      const { salasConPuntos } = e.data;
      const index = inspecciones.value.findIndex(i => i.id === inspeccionId);
      if (index !== -1) {
        inspecciones.value[index].details = salasConPuntos;
      }
      worker.terminate();
    };
    worker.postMessage({ puntosData });
  };
  
  const loadMore = async () => {
    if (!hasMorePages.value || loadingMore.value) return;
    currentPage.value++;
    await fetchData(currentPage.value, true);
  };

  const setupRealtime = () => {
    if (realtimeSubscription.value) realtimeSubscription.value.unsubscribe();
    realtimeSubscription.value = supabase.channel(`inspections_${centroId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inspecciones', filter: `centro_id=eq.${centroId}` }, () => {
        localStorage.removeItem(CACHE_KEY);
        fetchData(currentPage.value, false, true);
      }).subscribe();
  };
  
  onMounted(async () => {
    await fetchData(1);
    setupRealtime();
  });
  
  onUnmounted(() => {
    if (realtimeSubscription.value) realtimeSubscription.value.unsubscribe();
  });

  return {
    loading: readonly(loading),
    loadingMore: readonly(loadingMore),
    centro: readonly(centro),
    inspecciones, // Return as ref for updates
    availableYears: readonly(availableYears),
    hasMorePages: readonly(hasMorePages),
    totalInspecciones: readonly(totalInspecciones),
    loadMore,
    loadInspectionDetails,
    refreshData: () => fetchData(1, false),
    updateInspectionInList: (updatedInspection) => {
      const index = inspecciones.value.findIndex(i => i.id === updatedInspection.id);
      if (index !== -1) {
        inspecciones.value[index] = { ...inspecciones.value[index], ...updatedInspection };
      }
    },
    removeInspectionFromList: (inspectionId) => {
      inspecciones.value = inspecciones.value.filter(i => i.id !== inspectionId);
      totalInspecciones.value--;
    }
  };
}