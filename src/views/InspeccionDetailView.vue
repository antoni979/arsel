<!-- src/views/InspeccionDetailView.vue -->
<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';
import ChecklistModal from '../components/ChecklistModal.vue';
import InspectionSidebar from '../components/InspectionSidebar.vue';
import GlobalStatusIndicator from '../components/GlobalStatusIndicator.vue';
import AddPointForm from '../components/AddPointForm.vue';
import { CheckCircleIcon, InformationCircleIcon, MapIcon, PlusIcon, PencilSquareIcon, ArrowLeftIcon, ListBulletIcon, Bars3Icon, XCircleIcon } from '@heroicons/vue/24/solid';
import { generateTextReport } from '../utils/pdf';
import SkeletonLoader from '../components/SkeletonLoader.vue';
import { addToQueue, processQueue, syncQueue, waitForQueueToEmpty } from '../utils/syncQueue';

const showNotification = inject('showNotification');
const showConfirm = inject('showConfirm');
const toggleSidebar = inject('toggleSidebar', null);
const route = useRoute();
const router = useRouter();
const inspeccionId = Number(route.params.id);

const loading = ref(true);
const isFinalizing = ref(false);
const inspeccion = ref(null);
const centro = ref(null);
const version = ref(null);
const salas = ref([]);
const puntosMaestros = ref([]);
const puntosInspeccionados = ref([]);
const isModalOpen = ref(false);
const selectedPunto = ref(null);
const allIncidencias = ref([]);
const allCustomFields = ref([]);
const isPlacementMode = ref(false);
const newPointSalaId = ref(null);
const isAreaDrawingMode = ref(false);
const salaParaDibujar = ref(null);
const isPlanoEditingMode = ref(false);
const isMobileAddPointOpen = ref(false);
const showMapInMobile = ref(false);
const showAddSalaForm = ref(false);
const newSalaName = ref('');

const canEditInspection = computed(() => {
  return inspeccion.value?.estado === 'en_progreso';
});

// --- INICIO DE LA CORRECCIÓN: Nueva propiedad computada para la validación ---
const existingIdentifiersInSala = computed(() => {
  if (!selectedPunto.value) return [];
  
  // 1. Encontrar el punto maestro correspondiente al punto de inspección seleccionado.
  const puntoMaestroSeleccionado = puntosMaestros.value.find(pm => pm.id === selectedPunto.value.punto_maestro_id);
  if (!puntoMaestroSeleccionado) return [];

  const salaId = puntoMaestroSeleccionado.sala_id;

  // 2. Obtener todos los puntos maestros de esa misma sala.
  return puntosMaestros.value
    .filter(pm => 
      // Que pertenezcan a la misma sala
      pm.sala_id === salaId && 
      // Y que no sea el punto que estamos editando actualmente
      pm.id !== puntoMaestroSeleccionado.id
    )
    .map(pm => pm.nomenclatura.split('-').pop() || ''); // 3. Extraer solo el identificador final (ej: "10", "Picking-A").
});
// --- FIN DE LA CORRECCIÓN ---


const refreshInspectedPoints = async () => {
  if (!navigator.onLine) {
    return;
  }
  const { data: updatedPoints, error: pointsError } = await supabase.from('puntos_inspeccionados').select('*').eq('inspeccion_id', inspeccionId);
  if (pointsError) {
    showNotification('Error al refrescar los datos de los puntos.', 'error');
  } else {
    puntosInspeccionados.value = updatedPoints || [];
  }
  
  const { data: updatedIncidencias, error: incidenciasError } = await supabase.from('incidencias').select('*').eq('inspeccion_id', inspeccionId);
  if (incidenciasError) {
      showNotification('Error al refrescar las incidencias.', 'error');
  } else {
      allIncidencias.value = updatedIncidencias || [];
  }
};

const loadAllData = async () => {
  loading.value = true;
  
  const { data: inspectionData, error: inspectionError } = await supabase
    .from('inspecciones')
    .select('*, centros(*), versiones_plano(*)')
    .eq('id', inspeccionId)
    .single();

  if (inspectionError || !inspectionData) {
    showNotification('Error crítico: No se pudo cargar la inspección.', 'error');
    loading.value = false;
    return;
  }
  
  inspeccion.value = inspectionData;
  centro.value = inspectionData.centros;
  version.value = inspectionData.versiones_plano;

  if (!version.value) {
      showNotification('Error: La inspección no tiene una versión de plano asociada.', 'error');
      loading.value = false;
      return;
  }
  
  const [salasRes, puntosMaestrosRes, puntosInspeccionadosRes, incidenciasRes, customFieldsRes] = await Promise.all([
    supabase.from('salas').select('*').eq('version_id', version.value.id).order('nombre'),
    supabase.from('puntos_maestros').select('*').eq('version_id', version.value.id),
    supabase.from('puntos_inspeccionados').select('*').eq('inspeccion_id', inspeccionId),
    supabase.from('incidencias').select('*').eq('inspeccion_id', inspeccionId),
    supabase.from('checklist_custom_fields').select('*').order('point_id, id')
  ]);
  
  salas.value = salasRes.data || [];
  puntosMaestros.value = puntosMaestrosRes.data || [];
  puntosInspeccionados.value = puntosInspeccionadosRes.data || [];
  allIncidencias.value = incidenciasRes.data || [];
  allCustomFields.value = customFieldsRes.data || [];

  await initializeInspectionPoints();

  loading.value = false;
};

const initializeInspectionPoints = async () => {
  if (canEditInspection.value && puntosInspeccionados.value.length === 0 && puntosMaestros.value.length > 0) {
    if (!navigator.onLine) {
        showNotification("Se necesita conexión a internet para iniciar una inspección por primera vez.", "warning", 5000);
        return;
    }
    const pointsToCreate = puntosMaestros.value.map(pm => ({
      inspeccion_id: inspeccionId, punto_maestro_id: pm.id, nomenclatura: pm.nomenclatura,
      coordenada_x: pm.coordenada_x, coordenada_y: pm.coordenada_y,
      estado: 'existente', tiene_placa_caracteristicas: true
    }));
    if (pointsToCreate.length > 0) {
      const { data: newPoints, error } = await supabase.from('puntos_inspeccionados').insert(pointsToCreate).select();
      if (newPoints) {
        puntosInspeccionados.value = newPoints;
      }
      if(error) {
        showNotification('Error al inicializar los puntos de la inspección.', 'error');
      }
    }
  }
};

onMounted(loadAllData);

const getSalaColor = (salaId) => salas.value.find(s => s.id === salaId)?.color || '#9CA3AF';

const puntosParaMostrar = computed(() => {
  return puntosInspeccionados.value.map(pi => {
    const maestro = puntosMaestros.value.find(pm => pm.id === pi.punto_maestro_id);
    return { ...pi, sala_id: maestro?.sala_id, color: getSalaColor(maestro?.sala_id) };
  });
});

const puntosAgrupadosPorSala = computed(() => {
  return salas.value.map(sala => ({
    ...sala,
    puntos: puntosParaMostrar.value
      .filter(p => p.sala_id === sala.id)
      .sort((a,b) => a.nomenclatura.localeCompare(b.nomenclatura, undefined, {numeric: true}))
  })).filter(g => g.puntos.length > 0 || g.isNew);
});

const incidenciasDelPuntoSeleccionado = computed(() => {
    if (!selectedPunto.value) return [];
    return allIncidencias.value.filter(inc => inc.punto_inspeccionado_id === selectedPunto.value.id);
});

const handleIncidenciasUpdate = (nuevasIncidenciasDelPunto) => {
  if (!selectedPunto.value) return;

  const otrasIncidencias = allIncidencias.value.filter(
    inc => inc.punto_inspeccionado_id !== selectedPunto.value.id
  );

  allIncidencias.value = [...otrasIncidencias, ...nuevasIncidenciasDelPunto];
};

const createNewPointAt = async (coords, salaId) => {
  const salaSeleccionada = salas.value.find(s => s.id === salaId);
  const puntosDeLaSala = puntosMaestros.value.filter(p => p.sala_id === salaId);
  const ultimoNumero = Math.max(0, ...puntosDeLaSala.map(p => {
      const num = parseInt(p.nomenclatura.split('-').pop());
      return isNaN(num) ? 0 : num;
  }));
  const nuevaNomenclatura = `${salaSeleccionada.nombre}-${ultimoNumero + 1}`;

  const tempMaestroId = `temp_maestro_${Date.now()}`;
  const nuevoPuntoMaestro = {
    id: tempMaestroId, version_id: version.value.id, sala_id: salaId, 
    nomenclatura: nuevaNomenclatura, coordenada_x: coords.x, coordenada_y: coords.y
  };
  const tempInspeccionadoId = `temp_inspeccionado_${Date.now()}`;
  const nuevoPuntoIns = {
    id: tempInspeccionadoId, inspeccion_id: inspeccionId, punto_maestro_id: tempMaestroId,
    nomenclatura: nuevaNomenclatura, coordenada_x: coords.x, coordenada_y: coords.y,
    estado: 'nuevo', tiene_placa_caracteristicas: true
  };

  puntosMaestros.value.push(nuevoPuntoMaestro);
  puntosInspeccionados.value.push(nuevoPuntoIns);

  const { id: idM, ...payloadM } = nuevoPuntoMaestro;
  addToQueue({ table: 'puntos_maestros', type: 'insert', tempId: tempMaestroId, payload: payloadM });

  const { id: idI, ...payloadI } = nuevoPuntoIns;
  addToQueue({ table: 'puntos_inspeccionados', type: 'insert', tempId: tempInspeccionadoId, payload: payloadI });

  const tempIncidenciaId = `temp_incidencia_${Date.now()}`;
  const nuevaIncidencia = {
      id: tempIncidenciaId, inspeccion_id: inspeccionId, punto_inspeccionado_id: tempInspeccionadoId,
      item_checklist: 3, gravedad: 'ambar', observaciones: 'Alineación de nueva implantación.'
  };
  allIncidencias.value.push(nuevaIncidencia);

  const { id: idInc, ...payloadInc } = nuevaIncidencia;
  addToQueue({ table: 'incidencias', type: 'insert', tempId: tempIncidenciaId, payload: payloadInc });

  showNotification(`Punto ${nuevaNomenclatura} añadido localmente.`, 'success', 1500);
};

const openChecklistFor = (punto) => {
  if (isPlacementMode.value || isAreaDrawingMode.value) return;
  selectedPunto.value = punto; 
  isModalOpen.value = true;
};
const updatePuntoEstado = async (punto, nuevoEstado) => {
  const puntoEnArray = puntosInspeccionados.value.find(p => p.id === punto.id);
  if(puntoEnArray) puntoEnArray.estado = nuevoEstado;
  addToQueue({
      table: 'puntos_inspeccionados', type: 'update', id: punto.id, payload: { estado: nuevoEstado }
  });
};
const handleDeleteNewPoint = async (punto) => {
  if (!canEditInspection.value) return;
  if(!navigator.onLine){ showNotification("Necesitas conexión para borrar un punto.", "warning"); return; }
  if (confirm(`¿Estás seguro de que quieres borrar permanentemente el punto "${punto.nomenclatura}"?`)) {
      const { error: inspError } = await supabase.from('puntos_inspeccionados').delete().eq('id', punto.id);
      if (inspError) { showNotification("Error al borrar el punto de la inspección: " + inspError.message, 'error'); return; }
      const { error: maestroError } = await supabase.from('puntos_maestros').delete().eq('id', punto.punto_maestro_id);
      if (maestroError) { showNotification("Advertencia: No se pudo borrar el punto del plano maestro.", 'error'); }
      puntosInspeccionados.value = puntosInspeccionados.value.filter(p => p.id !== punto.id);
      puntosMaestros.value = puntosMaestros.value.filter(p => p.id !== punto.punto_maestro_id);
      allIncidencias.value = allIncidencias.value.filter(i => i.punto_inspeccionado_id !== punto.id);
      showNotification(`Punto ${punto.nomenclatura} borrado con éxito.`);
  }
};
const handleTogglePlanoEditing = (isActive) => {
  isPlanoEditingMode.value = isActive;
  if (!isActive) {
    isAreaDrawingMode.value = false;
    salaParaDibujar.value = null;
    showAddSalaForm.value = false;
    newSalaName.value = '';
  }
};

// Función para manejar el toggle desde el header móvil
const toggleMobilePlanoEditing = () => {
  isPlanoEditingMode.value = !isPlanoEditingMode.value;
  handleTogglePlanoEditing(isPlanoEditingMode.value);
};

// Función para hacer toggle del mapa en móvil
const toggleMapInMobile = () => {
  showMapInMobile.value = !showMapInMobile.value;
  // Si estamos mostrando el mapa, desactivamos el modo de agregar puntos
  if (showMapInMobile.value) {
    isMobileAddPointOpen.value = false;
  }
};
const handleAddSala = async (name) => {
    if(!navigator.onLine){ showNotification("Necesitas conexión para añadir salas.", "warning"); return; }
    const { data: newSala, error } = await supabase.from('salas').insert({ version_id: version.value.id, nombre: name, color: '#808080' }).select().single();
    if (error) { showNotification('Error al crear la sala: ' + error.message, 'error'); return; }
    newSala.isNew = true;
    salas.value.push(newSala);
    salas.value.sort((a,b) => a.nombre.localeCompare(b.nombre));
    showNotification(`Sala "${name}" creada en el plano.`, 'success');
    handleStartAreaDrawing(newSala);
};
const handleStartAreaDrawing = (sala) => {
    salaParaDibujar.value = sala;
    isAreaDrawingMode.value = true;
    showNotification(`Modo dibujo activado para "${sala.nombre}". Haz clic en el mapa para definir su área.`, 'success', 4000);
};
const handleAreaDrawn = (points) => {
    const salaInArray = salas.value.find(s => s.id === salaParaDibujar.value.id);
    if (salaInArray) salaInArray.area_puntos = points;
    addToQueue({ table: 'salas', type: 'update', id: salaParaDibujar.value.id, payload: { area_puntos: points } });
    showNotification(`Área de "${salaParaDibujar.value.nombre}" guardada localmente.`, 'success');
    isAreaDrawingMode.value = false;
    salaParaDibujar.value = null;
};
const handleDrawingCancelled = () => {
    isAreaDrawingMode.value = false;
    salaParaDibujar.value = null;
    showNotification('Dibujo cancelado.', 'success', 2000);
};
const handleStartPlacementMode = (salaId) => {
  isPlacementMode.value = true;
  newPointSalaId.value = salaId;
};
const handleCancelPlacementMode = () => {
  isPlacementMode.value = false;
  newPointSalaId.value = null;
};
const handleMapClick = (coords) => {
  if (isPlacementMode.value) { createNewPointAt(coords, newPointSalaId.value); }
};

// --- INICIO DE LA CORRECCIÓN: Función simplificada sin validación ---
const handleUpdatePointNomenclatura = async (puntoMaestro, newNomenclature) => {
    // La validación ahora ocurre dentro del modal, por lo que aquí simplemente confiamos y procedemos.
    const puntoInspeccionado = puntosInspeccionados.value.find(pi => pi.punto_maestro_id === puntoMaestro.id);
    if (!puntoInspeccionado) { 
      showNotification('Error interno: no se encontró el punto de inspección correspondiente.', 'error'); 
      return; 
    }

    // Actualizamos el estado local para reflejar el cambio inmediatamente en la UI.
    const maestro = puntosMaestros.value.find(p => p.id === puntoMaestro.id);
    if (maestro) maestro.nomenclatura = newNomenclature;
    if (puntoInspeccionado) puntoInspeccionado.nomenclatura = newNomenclature;

    // Encolamos las acciones para sincronizarlas con la base de datos.
    addToQueue({ table: 'puntos_maestros', type: 'update', id: puntoMaestro.id, payload: { nomenclatura: newNomenclature } });
    addToQueue({ table: 'puntos_inspeccionados', type: 'update', id: puntoInspeccionado.id, payload: { nomenclatura: newNomenclature } });
    
    showNotification('Nombre del punto actualizado localmente.', 'success');
};
// --- FIN DE LA CORRECCIÓN ---

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}
const finalizarInspeccion = async () => {
    if(!navigator.onLine){ showNotification("Necesitas conexión para finalizar y generar el PDF.", "error"); return; }
    const confirmed = await showConfirm('Finalizar Inspección', '¿Estás seguro de que quieres finalizar esta inspección? Se generará y archivará el informe PDF, y la inspección quedará bloqueada.');
    if (!confirmed) return;
    isFinalizing.value = true;
    try {
        // Wait for sync queue to be processed before generating PDF
        if (syncQueue.value.length > 0) {
            showNotification(`Sincronizando ${syncQueue.value.length} cambios pendientes...`, 'info', 3000);

            try {
                // Trigger queue processing
                await processQueue();
                // Wait for queue to be completely empty
                await waitForQueueToEmpty();
                showNotification('Sincronización completa', 'success', 2000);
            } catch (syncError) {
                console.error('Error during sync:', syncError);
                const continueAnyway = await showConfirm(
                    'Error de sincronización',
                    `No se pudieron sincronizar todos los cambios: ${syncError.message}\n\n¿Deseas continuar de todos modos? El PDF podría no incluir todos los cambios offline.`
                );
                if (!continueAnyway) {
                    isFinalizing.value = false;
                    return;
                }
            }
        }

        const report = await generateTextReport(inspeccionId, 'initial', 'blob');
        if (!report || !report.blob) throw new Error("La generación del PDF falló.");
        const base64File = await blobToBase64(report.blob);
        const centroId = centro.value.id;
        const fileNameWithId = `${inspeccionId}-${report.fileName}`;
        const finalFileName = `centro_${centroId}/${fileNameWithId}`;
        const { data, error: invokeError } = await supabase.functions.invoke('upload-pdf-to-b2', { body: { file: base64File, fileName: finalFileName, contentType: 'application/pdf' } });
        if (invokeError) throw new Error(`Error al contactar con la función Edge: ${invokeError.message}.`);
        if (data.error) throw new Error(`Error en el servidor al subir el archivo: ${data.error}`);
        if (!data.publicUrl) throw new Error('La función Edge no devolvió una URL válida.');
        const publicUrl = data.publicUrl;
        const { error: updateError } = await supabase.from('inspecciones').update({ estado: 'finalizada', url_pdf_informe_inicial: publicUrl }).eq('id', inspeccionId);
        if (updateError) throw updateError;
        const CACHE_KEY = `inspections_${centro.value.id}`;
        localStorage.removeItem(CACHE_KEY);
        showNotification('Inspección finalizada y archivada con éxito.');
        router.push(`/centros/${centro.value.id}/historial`);
    } catch (error) {
        console.error("Error completo al finalizar la inspección:", error);
        showNotification('Ocurrió un error al finalizar y archivar: ' + error.message, 'error');
    } finally {
        isFinalizing.value = false;
    }
};
</script>

<template>
  <div class="h-full flex flex-col">
    <div v-if="loading" class="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <header class="flex-shrink-0 px-4 md:px-8 pt-6 pb-4 bg-slate-100/80 border-b border-slate-200 z-10">
         <div class="flex flex-col md:flex-row justify-between items-start gap-4">
            <div class="flex-1 space-y-2">
               <SkeletonLoader class="h-8 w-3/4" />
               <SkeletonLoader class="h-5 w-1/2" />
            </div>
            <div class="w-full md:w-auto">
               <SkeletonLoader class="h-10 w-48" />
            </div>
         </div>
      </header>
      <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
         <aside class="w-full lg:w-80 xl:w-96 flex-shrink-0 bg-white border-r border-slate-200 p-4 space-y-4">
            <SkeletonLoader class="h-10 w-full" />
            <div class="space-y-2 pt-4">
               <SkeletonLoader v-for="i in 5" :key="i" class="h-12 w-full" />
            </div>
         </aside>
         <main class="flex-1 bg-slate-100 min-w-0 h-1/2 lg:h-full p-4">
            <SkeletonLoader class="h-full w-full" />
         </main>
      </div>
    </div>
    
    <div v-else-if="inspeccion && centro && version" class="flex-1 flex flex-col min-h-0">
      <!-- ============ HEADER MÓVIL CONTEXTUAL (visible solo < lg) ============ -->
      <header class="lg:hidden flex-shrink-0 px-3 py-2 bg-white border-b border-slate-200 z-10">
        <!-- === VISTA MAPA === -->
        <div v-if="showMapInMobile" class="flex items-center justify-between gap-2">
          <button v-if="toggleSidebar" @click="toggleSidebar" class="p-2 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200" title="Abrir Menú"><Bars3Icon class="h-5 w-5" /></button>
          <GlobalStatusIndicator mode="mobile" />
          <div class="flex items-center gap-1">
            <button v-if="canEditInspection" @click="toggleMobilePlanoEditing" :class="['p-2 rounded-md transition-colors', isPlanoEditingMode ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600']" title="Editar Plano"><PencilSquareIcon class="h-5 w-5" /></button>
            <button v-if="canEditInspection && !isPlanoEditingMode" @click="isMobileAddPointOpen = !isMobileAddPointOpen" :class="['p-2 rounded-md transition-colors', isMobileAddPointOpen ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600']" title="Agregar Punto"><PlusIcon class="h-5 w-5" /></button>
            <button @click="toggleMapInMobile" class="p-2 rounded-md bg-blue-500 text-white" title="Ver Lista"><ListBulletIcon class="h-5 w-5" /></button>
            <button v-if="canEditInspection" @click="finalizarInspeccion" :disabled="isFinalizing" class="p-2 rounded-md bg-green-600 text-white disabled:bg-slate-400" title="Finalizar Inspección"><CheckCircleIcon class="h-5 w-5" /></button>
          </div>
        </div>
        <!-- === VISTA LISTA === -->
        <div v-else class="flex items-center justify-between gap-2">
           <button v-if="toggleSidebar" @click="toggleSidebar" class="p-2 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200" title="Abrir Menú"><Bars3Icon class="h-5 w-5" /></button>
           <GlobalStatusIndicator mode="mobile" />
           <div class="flex items-center gap-1">
             <button @click="toggleMapInMobile" class="p-2 rounded-md bg-slate-100 text-slate-600" title="Ver Plano"><MapIcon class="h-5 w-5" /></button>
             <button @click="router.push(`/centros/${centro.id}/historial`)" class="p-2 rounded-md bg-slate-100 text-slate-600" title="Volver al Historial"><ArrowLeftIcon class="h-5 w-5" /></button>
           </div>
        </div>
         <!-- Aviso de solo lectura compacto (móvil) -->
        <div v-if="!canEditInspection" class="mt-2 flex items-center gap-2 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1">
          <InformationCircleIcon class="h-4 w-4 flex-shrink-0" />
          <span>Solo lectura</span>
        </div>
      </header>

      <!-- ============ HEADER DESKTOP COMPLETO (visible solo >= lg) ============ -->
      <header class="hidden lg:flex flex-shrink-0 px-4 md:px-8 pt-6 pb-4 bg-slate-100/80 backdrop-blur-sm border-b border-slate-200 z-10">
        <div class="flex flex-col md:flex-row justify-between items-start gap-4 w-full">
          <div class="flex-1">
            <h1 class="text-2xl md:text-3xl font-bold text-slate-800 mb-1">Inspección: {{ centro.nombre }}</h1>
            <p class="text-slate-500 text-sm">
              Técnico: <span class="font-medium">{{ inspeccion.tecnico_nombre }}</span> |
              Fecha: <span class="font-medium">{{ new Date(inspeccion.fecha_inspeccion).toLocaleDateString() }}</span> |
              Plano: <strong class="text-blue-600">{{ version.nombre }}</strong>
            </p>
            <div v-if="!canEditInspection" class="mt-2 flex items-center gap-2 text-sm font-semibold text-orange-700 bg-orange-100 border border-orange-200 rounded-md p-2 max-w-md">
                <InformationCircleIcon class="h-5 w-5 flex-shrink-0" />
                <span>Esta inspección está bloqueada (modo solo lectura).</span>
            </div>
          </div>
          <div class="w-full md:w-auto flex items-center flex-col sm:flex-row gap-2">
            <button v-if="canEditInspection" @click="finalizarInspeccion" :disabled="isFinalizing" class="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm disabled:bg-slate-400">
              <CheckCircleIcon class="h-5 w-5" />
              {{ isFinalizing ? 'Finalizando...' : 'Finalizar Inspección' }}
            </button>
            <button v-else @click="router.push(`/centros/${centro.id}/historial`)" class="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
              Volver al Historial
            </button>
          </div>
        </div>
      </header>
      
      <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">

        <InspectionSidebar
          :class="[
            'lg:block',
            showMapInMobile ? 'hidden' : 'block'
          ]"
          :can-edit="canEditInspection"
          :salas="salas"
          :puntos-agrupados="puntosAgrupadosPorSala"
          :all-incidencias="allIncidencias"
          :is-plano-editing-mode="isPlanoEditingMode"
          :is-mobile-add-point-open="isMobileAddPointOpen"
          @toggle-plano-editing="handleTogglePlanoEditing"
          @add-sala="handleAddSala"
          @start-area-drawing="handleStartAreaDrawing"
          @start-placement-mode="handleStartPlacementMode"
          @cancel-placement-mode="handleCancelPlacementMode"
          @select-point="openChecklistFor"
          @update-point-state="updatePuntoEstado"
          @delete-new-point="handleDeleteNewPoint"
          @update-point-nomenclatura="handleUpdatePointNomenclatura"
          @update:is-mobile-add-point-open="isMobileAddPointOpen = $event"
        />

        <main
          :class="[
            'flex-1 bg-slate-100 min-w-0 lg:h-full overflow-auto',
            showMapInMobile ? 'block' : 'hidden lg:block'
          ]"
        >
          <!-- Panels for mobile map view - Only visible on mobile when showMapInMobile = true -->
          <div v-if="showMapInMobile" class="lg:hidden">
            <!-- Panel for adding sala (plano editing mode) -->
            <div v-if="canEditInspection && isPlanoEditingMode" class="p-3 bg-orange-50 border-b border-orange-200 space-y-3">
              <h3 class="font-bold text-orange-800 text-center">Modo Edición de Plano</h3>
              <form v-if="showAddSalaForm" @submit.prevent="handleAddSala(newSalaName)" class="flex gap-2">
                <input v-model="newSalaName" type="text" placeholder="Nombre nueva sala..." class="flex-1 block w-full rounded-md border-slate-300 shadow-sm text-sm">
                <button type="submit" class="p-2 bg-green-600 text-white rounded-md hover:bg-green-700"><CheckCircleIcon class="h-5 w-5"/></button>
                <button @click="showAddSalaForm = false" type="button" class="p-2 bg-red-600 text-white rounded-md hover:bg-red-700"><XCircleIcon class="h-5 w-5"/></button>
              </form>
              <button v-else @click="showAddSalaForm = true" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-slate-600 bg-white rounded-md hover:bg-slate-50 border">
                <PlusIcon class="h-5 w-5" /> Añadir Sala
              </button>
            </div>

            <!-- Panel for adding point (add point mode) -->
            <div v-if="canEditInspection && !isPlanoEditingMode && isMobileAddPointOpen" class="p-4 bg-blue-50 border-b">
              <AddPointForm
                :salas="salas"
                @save="handleStartPlacementMode"
                @cancel="isMobileAddPointOpen = false"
              />
            </div>

            <!-- Button to cancel placement mode -->
            <div v-if="canEditInspection && !isPlanoEditingMode && isPlacementMode" class="p-4 border-b">
              <button @click="handleCancelPlacementMode" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
                <XCircleIcon class="h-5 w-5" />
                Cancelar Colocación
              </button>
            </div>
          </div>

          <InteractiveMap
            v-if="!loading && version?.url_imagen_plano"
            :key="inspeccionId"
            :image-url="version.url_imagen_plano"
            :points="puntosParaMostrar.filter(p => p.estado !== 'suprimido')"
            :salas="salas"
            :all-incidencias="allIncidencias"
            :is-read-only="!canEditInspection || (!isPlacementMode && !isAreaDrawingMode)"
            :is-placement-mode="isPlacementMode"
            :is-area-drawing-mode="isAreaDrawingMode"
            @point-click="openChecklistFor"
            @add-point="handleMapClick"
            @delete-point="handleDeleteNewPoint"
            @area-drawn="handleAreaDrawn"
            @drawing-cancelled="handleDrawingCancelled"
          />
        </main>
      </div>
    </div>
    
    <div v-else class="flex-1 flex items-center justify-center text-red-500">No se encontraron datos válidos para esta inspección.</div>

    <ChecklistModal 
      v-if="isModalOpen"
      :is-open="isModalOpen" 
      :punto="selectedPunto"
      :inspeccion-id="inspeccionId"
      :initial-incidencias="incidenciasDelPuntoSeleccionado"
      :available-custom-fields="allCustomFields"
      :existing-identifiers-in-sala="existingIdentifiersInSala"
      @close="isModalOpen = false" 
      @save="refreshInspectedPoints"
      @update-nomenclatura="handleUpdatePointNomenclatura"
      @update:incidencias="handleIncidenciasUpdate"
    />
  </div>
</template>