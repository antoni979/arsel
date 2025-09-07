<!-- src/views/InspeccionDetailView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';
import ChecklistModal from '../components/ChecklistModal.vue';
import PointList from '../components/PointList.vue';
import AddPointForm from '../components/AddPointForm.vue';
import { CheckCircleIcon, PlusIcon, XCircleIcon, ChevronDownIcon } from '@heroicons/vue/24/solid';

const route = useRoute();
const router = useRouter();
const inspeccionId = Number(route.params.id);

const loading = ref(true);
const inspeccion = ref(null);
const centro = ref(null);
const version = ref(null);
const salas = ref([]);
const puntosMaestros = ref([]);
const puntosInspeccionados = ref([]);
const isModalOpen = ref(false);
const selectedPunto = ref(null);
const showAddPointForm = ref(false);
const isPlacementMode = ref(false);
const newPointSalaId = ref(null);

const canEditInspection = computed(() => {
  return inspeccion.value?.estado === 'en_progreso';
});

onMounted(async () => {
  loading.value = true;
  const { data: inspectionData, error: inspectionError } = await supabase.from('inspecciones').select('*, centros(*), versiones_plano(*)').eq('id', inspeccionId).single();
  if (inspectionError || !inspectionData || !inspectionData.versiones_plano) {
      alert('Error: No se pudo cargar la inspección. Puede que no tenga una versión de plano asignada.');
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
  if (puntosInspeccionados.value.length === 0 && puntosMaestros.value.length > 0) {
    const pointsToCreate = puntosMaestros.value.map(pm => ({
      inspeccion_id: inspeccionId,
      punto_maestro_id: pm.id,
      nomenclatura: pm.nomenclatura,
      coordenada_x: pm.coordenada_x,
      coordenada_y: pm.coordenada_y,
      estado: 'existente',
      tiene_placa_caracteristicas: true // <-- ¡AQUÍ ESTÁ LA CORRECCIÓN CLAVE!
    }));
    if (pointsToCreate.length > 0) {
      const { data: newPoints } = await supabase.from('puntos_inspeccionados').insert(pointsToCreate).select();
      if (newPoints) puntosInspeccionados.value = newPoints;
    }
  }
};

const getSalaColor = (salaId) => {
  const sala = salas.value.find(s => s.id === salaId);
  return sala ? sala.color : '#9CA3AF';
};
const puntosParaMostrar = computed(() => {
  if (!puntosInspeccionados.value || !puntosMaestros.value) return [];
  return puntosInspeccionados.value.map(pi => {
    const maestro = puntosMaestros.value.find(pm => pm.id === pi.punto_maestro_id);
    return { ...pi, sala_id: maestro?.sala_id, color: getSalaColor(maestro?.sala_id) };
  });
});
const puntosAgrupadosPorSala = computed(() => {
  if (!salas.value.length || !puntosParaMostrar.value.length) return [];
  return salas.value.map(sala => ({
    ...sala,
    puntos: puntosParaMostrar.value
      .filter(p => p.sala_id === sala.id)
      .sort((a,b) => a.nomenclatura.localeCompare(b.nomenclatura, undefined, {numeric: true}))
  })).filter(g => g.puntos.length > 0);
});
const createNewPointAt = async (coords, salaId) => {
  isPlacementMode.value = false;
  newPointSalaId.value = null;
  const salaSeleccionada = salas.value.find(s => s.id === salaId);
  const puntosDeLaSala = puntosMaestros.value.filter(p => p.sala_id === salaId);
  const ultimoNumero = Math.max(0, ...puntosDeLaSala.map(p => parseInt(p.nomenclatura.split('-').pop() || 0)));
  const nuevaNomenclatura = `${salaSeleccionada.nombre}-${ultimoNumero + 1}`;
  const { data: nuevoPuntoMaestro, error: maestroError } = await supabase.from('puntos_maestros').insert({ version_id: version.value.id, sala_id: salaId, nomenclatura: nuevaNomenclatura, coordenada_x: coords.x, coordenada_y: coords.y }).select().single();
  if (maestroError) { alert("Error al crear el punto maestro: " + maestroError.message); return; }
  puntosMaestros.value.push(nuevoPuntoMaestro);
  const { data: nuevoPuntoIns } = await supabase.from('puntos_inspeccionados').insert({
    inspeccion_id: inspeccionId,
    punto_maestro_id: nuevoPuntoMaestro.id,
    nomenclatura: nuevoPuntoMaestro.nomenclatura,
    coordenada_x: nuevoPuntoMaestro.coordenada_x,
    coordenada_y: nuevoPuntoMaestro.coordenada_y,
    estado: 'nuevo',
    tiene_placa_caracteristicas: true // <-- También aquí por consistencia
  }).select().single();
  if (nuevoPuntoIns) puntosInspeccionados.value.push(nuevoPuntoIns);
};
const updatePuntoEstado = async (punto, nuevoEstado) => {
    const { error } = await supabase.from('puntos_inspeccionados').update({ estado: nuevoEstado }).eq('id', punto.id);
    if (!error) {
        const puntoIndex = puntosInspeccionados.value.findIndex(p => p.id === punto.id);
        if (puntoIndex !== -1) puntosInspeccionados.value[puntoIndex].estado = nuevoEstado;
    }
};
const startPlacementMode = (salaId) => {
  showAddPointForm.value = false;
  newPointSalaId.value = salaId;
  isPlacementMode.value = true;
};
const cancelPlacementMode = () => {
  isPlacementMode.value = false;
  newPointSalaId.value = null;
};
const handleDeleteNewPoint = async (punto) => {
    if (confirm(`¿Estás seguro de que quieres borrar permanentemente el punto "${punto.nomenclatura}"? Esta acción no se puede deshacer.`)) {
        const { error: inspError } = await supabase.from('puntos_inspeccionados').delete().eq('id', punto.id);
        if (inspError) { alert("Error al borrar el punto de la inspección: " + inspError.message); return; }
        const { error: maestroError } = await supabase.from('puntos_maestros').delete().eq('id', punto.punto_maestro_id);
        if (maestroError) { alert("Advertencia: El punto se borró de la inspección pero no del plano maestro."); }
        puntosInspeccionados.value = puntosInspeccionados.value.filter(p => p.id !== punto.id);
        puntosMaestros.value = puntosMaestros.value.filter(p => p.id !== punto.punto_maestro_id);
    }
};
const openChecklistFor = (punto) => {
  if (isPlacementMode.value) return;
  selectedPunto.value = puntosMaestros.value.find(pm => pm.id === punto.punto_maestro_id);
  isModalOpen.value = true;
};
const handleMapClick = (coords) => {
  if (isPlacementMode.value) { createNewPointAt(coords, newPointSalaId.value); }
};
const finalizarInspeccion = async () => {
    if (confirm('¿Estás seguro de que quieres finalizar esta inspección? El estado cambiará a "Pendiente de Envío".')) {
        const { error } = await supabase.from('inspecciones').update({ estado: 'finalizada' }).eq('id', inspeccionId);
        if (error) { alert('Error al finalizar la inspección: ' + error.message); }
        else { router.push(`/centros/${centro.value.id}/historial`); }
    }
};
</script>

<template>
  <div class="h-full flex flex-col">
    <div v-if="loading" class="flex-1 flex items-center justify-center text-slate-500">Cargando datos de la inspección...</div>
    
    <div v-else-if="inspeccion && centro && version" class="flex-1 flex flex-col min-h-0">
      
      <!-- Encabezado Fijo -->
      <header class="flex-shrink-0 px-8 pt-8 pb-4 bg-slate-100/80 backdrop-blur-sm border-b border-slate-200 z-10">
        <div class="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 class="text-3xl font-bold text-slate-800 mb-1">Inspección: {{ centro.nombre }}</h1>
            <p class="text-slate-500 text-sm">
              Técnico: <span class="font-medium">{{ inspeccion.tecnico_nombre }}</span> | 
              Fecha: <span class="font-medium">{{ new Date(inspeccion.fecha_inspeccion).toLocaleDateString() }}</span> |
              Plano: <strong class="text-blue-600">{{ version.nombre }}</strong>
            </p>
          </div>
          <button v-if="canEditInspection" @click="finalizarInspeccion" class="flex items-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm">
            <CheckCircleIcon class="h-5 w-5" />
            Finalizar Inspección
          </button>
        </div>
      </header>
      
      <!-- Contenido Principal: Panel Lateral y Mapa -->
      <div class="flex-1 flex overflow-hidden">
        
        <!-- Panel Izquierdo Desplegable y con Scroll -->
        <aside class="w-80 lg:w-96 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <div class="p-4 flex-shrink-0">
             <div v-if="canEditInspection">
                <AddPointForm 
                   v-if="showAddPointForm"
                   :salas="salas"
                   @save="startPlacementMode"
                   @cancel="showAddPointForm = false"
                />
                <button v-else-if="!isPlacementMode" @click="showAddPointForm = true" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200">
                   <PlusIcon class="h-5 w-5" />
                   Agregar Punto Nuevo
                </button>
                <button v-if="isPlacementMode" @click="cancelPlacementMode" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
                   <XCircleIcon class="h-5 w-5" />
                   Cancelar Colocación
                </button>
             </div>
          </div>

          <div class="flex-1 overflow-y-auto px-4 pb-4">
            <PointList 
              :grouped-points="puntosAgrupadosPorSala"
              @select-point="openChecklistFor"
              @update-state="updatePuntoEstado"
              @delete-new-point="handleDeleteNewPoint"
            />
          </div>
        </aside>
        
        <!-- Mapa (Ocupa el resto del espacio) -->
        <main class="flex-1 bg-slate-100 min-w-0">
          <InteractiveMap 
            :image-url="version.url_imagen_plano" 
            :points="puntosParaMostrar.filter(p => p.estado !== 'suprimido')"
            :salas="salas"
            :is-read-only="!canEditInspection || isPlacementMode"
            :is-placement-mode="isPlacementMode"
            @point-click="openChecklistFor"
            @add-point="handleMapClick"
            @delete-point="handleDeleteNewPoint"
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
    />
  </div>
</template>