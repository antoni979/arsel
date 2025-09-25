<!-- src/views/InspeccionDetailView.vue -->
<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';
import ChecklistModal from '../components/ChecklistModal.vue';
import InspectionSidebar from '../components/InspectionSidebar.vue';
import { CheckCircleIcon, InformationCircleIcon } from '@heroicons/vue/24/solid';
import { generateTextReport } from '../utils/pdf';

const showNotification = inject('showNotification');
const showConfirm = inject('showConfirm');
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

const isPlacementMode = ref(false);
const newPointSalaId = ref(null);
const isAreaDrawingMode = ref(false);
const salaParaDibujar = ref(null);

const canEditInspection = computed(() => {
  return inspeccion.value?.estado === 'en_progreso';
});

onMounted(async () => {
  loading.value = true;
  const { data: inspectionData, error: inspectionError } = await supabase.from('inspecciones').select('*, centros(*), versiones_plano(*)').eq('id', inspeccionId).single();
  if (inspectionError || !inspectionData || !inspectionData.versiones_plano) {
      showNotification('Error: No se pudo cargar la inspección.', 'error');
      loading.value = false; return;
  }
  inspeccion.value = inspectionData;
  centro.value = inspectionData.centros;
  version.value = inspectionData.versiones_plano;
  if (version.value) {
    const [salasRes, puntosMaestrosRes] = await Promise.all([
      supabase.from('salas').select('*').eq('version_id', version.value.id).order('nombre'),
      supabase.from('puntos_maestros').select('*').eq('version_id', version.value.id)
    ]);
    salas.value = salasRes.data || [];
    puntosMaestros.value = puntosMaestrosRes.data || [];
    await initializeInspectionPoints();
  }
  loading.value = false;
});

const initializeInspectionPoints = async () => {
  const { data: existingPoints } = await supabase.from('puntos_inspeccionados').select('*').eq('inspeccion_id', inspeccionId);
  puntosInspeccionados.value = existingPoints || [];
  if (canEditInspection.value && puntosInspeccionados.value.length === 0 && puntosMaestros.value.length > 0) {
    const pointsToCreate = puntosMaestros.value.map(pm => ({
      inspeccion_id: inspeccionId, punto_maestro_id: pm.id, nomenclatura: pm.nomenclatura,
      coordenada_x: pm.coordenada_x, coordenada_y: pm.coordenada_y,
      estado: 'existente', tiene_placa_caracteristicas: true
    }));
    if (pointsToCreate.length > 0) {
      const { data: newPoints } = await supabase.from('puntos_inspeccionados').insert(pointsToCreate).select();
      if (newPoints) puntosInspeccionados.value = newPoints;
    }
  }
};

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

const createNewPointAt = async (coords, salaId) => {
  const salaSeleccionada = salas.value.find(s => s.id === salaId);
  const puntosDeLaSala = puntosMaestros.value.filter(p => p.sala_id === salaId);
  const ultimoNumero = Math.max(0, ...puntosDeLaSala.map(p => {
      const num = parseInt(p.nomenclatura.split('-').pop());
      return isNaN(num) ? 0 : num;
  }));
  const nuevaNomenclatura = `${salaSeleccionada.nombre}-${ultimoNumero + 1}`;
  
  const { data: nuevoPuntoMaestro, error: maestroError } = await supabase.from('puntos_maestros')
    .insert({ version_id: version.value.id, sala_id: salaId, nomenclatura: nuevaNomenclatura, coordenada_x: coords.x, coordenada_y: coords.y })
    .select().single();
  if (maestroError) {
    showNotification('Error al crear el punto maestro: ' + maestroError.message, 'error');
    return;
  }
  puntosMaestros.value.push(nuevoPuntoMaestro);

  const { data: nuevoPuntoIns, error: inspError } = await supabase.from('puntos_inspeccionados')
    .insert({
      inspeccion_id: inspeccionId, punto_maestro_id: nuevoPuntoMaestro.id,
      nomenclatura: nuevoPuntoMaestro.nomenclatura, coordenada_x: nuevoPuntoMaestro.coordenada_x,
      coordenada_y: nuevoPuntoMaestro.coordenada_y, estado: 'nuevo',
      tiene_placa_caracteristicas: true
    }).select().single();
  if (inspError) {
      showNotification('Error al crear el punto de inspección: ' + inspError.message, 'error');
      return;
  }
  if (nuevoPuntoIns) {
    puntosInspeccionados.value.push(nuevoPuntoIns);
    const { error: incidenciaError } = await supabase.from('incidencias').insert({
        inspeccion_id: inspeccionId, punto_inspeccionado_id: nuevoPuntoIns.id,
        item_checklist: 3, gravedad: 'ambar', observaciones: 'Alineación de nueva implantación.'
    });
    if (incidenciaError) {
        showNotification('El punto se creó, pero falló la creación de la incidencia automática.', 'error');
    } else {
        showNotification(`Punto ${nuevoPuntoIns.nomenclatura} añadido.`, 'success', 1500);
    }
  }
};

const updatePuntoEstado = async (punto, nuevoEstado) => {
  const { error } = await supabase.from('puntos_inspeccionados').update({ estado: nuevoEstado }).eq('id', punto.id);
  if (error) { showNotification('No se pudo actualizar el estado del punto.', 'error'); }
  else {
    const pointInArray = puntosInspeccionados.value.find(p => p.id === punto.id);
    if (pointInArray) { pointInArray.estado = nuevoEstado; }
  }
};

const handleDeleteNewPoint = async (punto) => {
  if (!canEditInspection.value) return;
  if (confirm(`¿Estás seguro de que quieres borrar permanentemente el punto "${punto.nomenclatura}"?`)) {
      const { error: inspError } = await supabase.from('puntos_inspeccionados').delete().eq('id', punto.id);
      if (inspError) { showNotification("Error al borrar el punto de la inspección: " + inspError.message, 'error'); return; }
      const { error: maestroError } = await supabase.from('puntos_maestros').delete().eq('id', punto.punto_maestro_id);
      if (maestroError) { showNotification("Advertencia: No se pudo borrar el punto del plano maestro.", 'error'); }
      puntosInspeccionados.value = puntosInspeccionados.value.filter(p => p.id !== punto.id);
      puntosMaestros.value = puntosMaestros.value.filter(p => p.id !== punto.punto_maestro_id);
      showNotification(`Punto ${punto.nomenclatura} borrado con éxito.`);
  }
};

const openChecklistFor = (punto) => {
  if (isPlacementMode.value || isAreaDrawingMode.value) return;
  selectedPunto.value = punto; 
  isModalOpen.value = true;
};

const handleTogglePlanoEditing = (isActive) => {
  if (!isActive) {
    isAreaDrawingMode.value = false;
    salaParaDibujar.value = null;
  }
};

const handleAddSala = async (name) => {
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

const handleAreaDrawn = async (points) => {
    const { error } = await supabase.from('salas').update({ area_puntos: points }).eq('id', salaParaDibujar.value.id);
    if (error) { showNotification('Error al guardar el área.', 'error'); }
    else {
        const salaInArray = salas.value.find(s => s.id === salaParaDibujar.value.id);
        if (salaInArray) salaInArray.area_puntos = points;
        showNotification(`Área de "${salaParaDibujar.value.nombre}" guardada.`, 'success');
    }
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
  if (isPlacementMode.value) { 
    createNewPointAt(coords, newPointSalaId.value);
  }
};

const handleUpdatePointNomenclatura = async (puntoMaestro, newNomenclature) => {
    const trimmedNomenclature = newNomenclature.trim();
    if (!trimmedNomenclature) {
        showNotification('El nombre no puede estar vacío.', 'error');
        return;
    }

    const nameExists = puntosMaestros.value.some(p => 
        p.sala_id === puntoMaestro.sala_id && 
        p.nomenclatura.toLowerCase() === trimmedNomenclature.toLowerCase() && 
        p.id !== puntoMaestro.id
    );
    if (nameExists) {
        showNotification(`Ya existe un punto con el nombre "${trimmedNomenclature}" en esta sala.`, 'error');
        return;
    }

    const puntoInspeccionado = puntosInspeccionados.value.find(pi => pi.punto_maestro_id === puntoMaestro.id);
    if (!puntoInspeccionado) {
        showNotification('Error: no se encontró el punto de inspección correspondiente.', 'error');
        return;
    }

    const { error: maestroError } = await supabase.from('puntos_maestros').update({ nomenclatura: trimmedNomenclature }).eq('id', puntoMaestro.id);
    const { error: inspeccionadoError } = await supabase.from('puntos_inspeccionados').update({ nomenclatura: trimmedNomenclature }).eq('id', puntoInspeccionado.id);

    if (maestroError || inspeccionadoError) {
        showNotification('Error al actualizar el nombre del punto.', 'error');
    } else {
        const maestro = puntosMaestros.value.find(p => p.id === puntoMaestro.id);
        if (maestro) maestro.nomenclatura = trimmedNomenclature;
        if (puntoInspeccionado) puntoInspeccionado.nomenclatura = trimmedNomenclature;
        showNotification('Nombre del punto actualizado.', 'success');
    }
};

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
    const confirmed = await showConfirm('Finalizar Inspección', '¿Estás seguro de que quieres finalizar esta inspección? Se generará y archivará el informe PDF, y la inspección quedará bloqueada.');
    if (!confirmed) {
        return;
    }
    isFinalizing.value = true;
    try {
        const report = await generateTextReport(inspeccionId, 'initial', 'blob');
        if (!report || !report.blob) throw new Error("La generación del PDF falló.");

        const base64File = await blobToBase64(report.blob);
        
        const centroId = centro.value.id;
        const fileNameWithId = `${inspeccionId}-${report.fileName}`;
        const finalFileName = `centro_${centroId}/${fileNameWithId}`;

        const { data, error: invokeError } = await supabase.functions.invoke('upload-pdf-to-b2', {
          body: { file: base64File, fileName: finalFileName, contentType: 'application/pdf' }
        });
        
        if (invokeError) throw new Error(`Error al contactar con la función Edge: ${invokeError.message}.`);
        if (data.error) throw new Error(`Error en el servidor al subir el archivo: ${data.error}`);
        if (!data.publicUrl) throw new Error('La función Edge no devolvió una URL válida.');

        const publicUrl = data.publicUrl;
        
        const { error: updateError } = await supabase
            .from('inspecciones')
            .update({ estado: 'finalizada', url_pdf_informe_inicial: publicUrl })
            .eq('id', inspeccionId);
        if (updateError) throw updateError;

        // Clear the cache for the center history to ensure the new PDF URL is visible
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
    <div v-if="loading" class="flex-1 flex items-center justify-center text-slate-500">Cargando...</div>
    
    <div v-else-if="inspeccion && centro && version" class="flex-1 flex flex-col min-h-0">
      <header class="flex-shrink-0 px-4 md:px-8 pt-6 pb-4 bg-slate-100/80 backdrop-blur-sm border-b border-slate-200 z-10">
        <div class="flex flex-col md:flex-row justify-between items-start gap-4">
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
          :can-edit="canEditInspection"
          :salas="salas"
          :puntos-agrupados="puntosAgrupadosPorSala"
          @toggle-plano-editing="handleTogglePlanoEditing"
          @add-sala="handleAddSala"
          @start-area-drawing="handleStartAreaDrawing"
          @start-placement-mode="handleStartPlacementMode"
          @cancel-placement-mode="handleCancelPlacementMode"
          @select-point="openChecklistFor"
          @update-point-state="updatePuntoEstado"
          @delete-new-point="handleDeleteNewPoint"
          @update-point-nomenclatura="handleUpdatePointNomenclatura"
        />
        
        <main class="flex-1 bg-slate-100 min-w-0 h-1/2 lg:h-full overflow-auto">
          <InteractiveMap
            :key="inspeccionId"
            :image-url="version.url_imagen_plano"
            :points="puntosParaMostrar.filter(p => p.estado !== 'suprimido')"
            :salas="salas"
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
      :is-open="isModalOpen" 
      :punto="selectedPunto"
      :inspeccion-id="inspeccionId" 
      @close="isModalOpen = false" 
      @save="initializeInspectionPoints"
      @update-nomenclatura="handleUpdatePointNomenclatura"
    />
  </div>
</template>