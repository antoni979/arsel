<!-- src/views/InspeccionDetailView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';
import ChecklistModal from '../components/ChecklistModal.vue';
import PointList from '../components/PointList.vue';
import AddPointForm from '../components/AddPointForm.vue';
import { CheckCircleIcon, PlusIcon, XCircleIcon } from '@heroicons/vue/24/solid';

const route = useRoute();
const router = useRouter();
const inspeccionId = Number(route.params.id);

const loading = ref(true);
const inspeccion = ref(null);
const centro = ref(null);
const salas = ref([]);
const puntosMaestros = ref([]);
const puntosInspeccionados = ref([]);

const isModalOpen = ref(false);
const selectedPunto = ref(null);
const showAddPointForm = ref(false);

const isPlacementMode = ref(false);
const newPointSalaId = ref(null);

const handleMapClick = (coords) => {
  if (!isPlacementMode.value) return;
  createNewPointAt(coords, newPointSalaId.value);
};

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
      estado: 'existente'
    }));
    
    if (pointsToCreate.length > 0) {
      const { data: newPoints, error } = await supabase.from('puntos_inspeccionados').insert(pointsToCreate).select();
      if (error) console.error("Error al hidratar la inspección:", error);
      else puntosInspeccionados.value = newPoints;
    }
  }
};

const getSalaColor = (salaId) => {
  const sala = salas.value.find(s => s.id === salaId);
  return sala ? sala.color : '#9CA3AF';
};

const puntosParaMostrar = computed(() => {
  return puntosInspeccionados.value.map(pi => {
    const maestro = puntosMaestros.value.find(pm => pm.id === pi.punto_maestro_id);
    return { ...pi, sala_id: maestro?.sala_id, color: getSalaColor(maestro?.sala_id) };
  });
});

const puntosAgrupadosPorSala = computed(() => {
  if (!salas.value.length) return [];
  return salas.value.map(sala => ({
    ...sala,
    puntos: puntosParaMostrar.value
      .filter(p => p.sala_id === sala.id)
      .sort((a,b) => a.nomenclatura.localeCompare(b.nomenclatura, undefined, {numeric: true}))
  })).filter(g => g.puntos.length > 0);
});

const updatePuntoEstado = async (punto, nuevoEstado) => {
  const puntoOriginal = puntosInspeccionados.value.find(p => p.id === punto.id);
  if (!puntoOriginal) return;

  const estadoAnterior = puntoOriginal.estado;
  puntoOriginal.estado = nuevoEstado;

  const { error } = await supabase
    .from('puntos_inspeccionados')
    .update({ estado: nuevoEstado })
    .eq('id', punto.id);

  if (error) {
    alert("Error al actualizar el estado del punto.");
    puntoOriginal.estado = estadoAnterior;
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
}

const createNewPointAt = async (coords, salaId) => {
  isPlacementMode.value = false;
  newPointSalaId.value = null;

  const salaSeleccionada = salas.value.find(s => s.id === salaId);
  const puntosDeLaSala = puntosMaestros.value.filter(p => p.sala_id === salaId);
  const ultimoNumero = Math.max(0, ...puntosDeLaSala.map(p => parseInt(p.nomenclatura.split('-').pop() || 0)));
  const nuevaNomenclatura = `${salaSeleccionada.nombre}-${ultimoNumero + 1}`;

  const { data: nuevoPuntoMaestro, error: maestroError } = await supabase
    .from('puntos_maestros')
    .insert({
      centro_id: centro.value.id,
      sala_id: salaId,
      nomenclatura: nuevaNomenclatura,
      coordenada_x: coords.x,
      coordenada_y: coords.y,
    }).select().single();

  if (maestroError) {
    alert("Error al crear el punto maestro: " + maestroError.message);
    return;
  }
  puntosMaestros.value.push(nuevoPuntoMaestro);

  const { data: nuevoPuntoIns, error: insError } = await supabase
    .from('puntos_inspeccionados')
    .insert({
      inspeccion_id: inspeccionId,
      punto_maestro_id: nuevoPuntoMaestro.id,
      nomenclatura: nuevoPuntoMaestro.nomenclatura,
      coordenada_x: nuevoPuntoMaestro.coordenada_x,
      coordenada_y: nuevoPuntoMaestro.coordenada_y,
      estado: 'nuevo'
    }).select().single();
  
  if (insError) {
    alert("Error al registrar el nuevo punto en la inspección: " + insError.message);
    return;
  }
  puntosInspeccionados.value.push(nuevoPuntoIns);
};

// === INICIO DEL CAMBIO: Nueva función para borrar puntos nuevos ===
const handleDeleteNewPoint = async (punto) => {
  if (confirm(`¿Estás seguro de que quieres borrar permanentemente el punto "${punto.nomenclatura}"?`)) {
    // Es crucial borrar ambos registros, el de la inspección y el maestro.
    // Usamos Promise.all para que se ejecuten en paralelo.
    const [inspeccionadoRes, maestroRes] = await Promise.all([
      supabase.from('puntos_inspeccionados').delete().eq('id', punto.id),
      supabase.from('puntos_maestros').delete().eq('id', punto.punto_maestro_id)
    ]);

    if (inspeccionadoRes.error || maestroRes.error) {
      alert("Error al borrar el punto. Revisa la consola.");
      console.error("Error borrando punto inspeccionado:", inspeccionadoRes.error);
      console.error("Error borrando punto maestro:", maestroRes.error);
    } else {
      // Si todo va bien, actualizamos el estado local para que desaparezca de la UI.
      puntosInspeccionados.value = puntosInspeccionados.value.filter(p => p.id !== punto.id);
      puntosMaestros.value = puntosMaestros.value.filter(p => p.id !== punto.punto_maestro_id);
    }
  }
};
// === FIN DEL CAMBIO ===

const openChecklistFor = (punto) => {
  if (isPlacementMode.value) return;
  selectedPunto.value = puntosMaestros.value.find(pm => pm.id === punto.punto_maestro_id);
  isModalOpen.value = true;
};

const finalizarInspeccion = async () => {
  if (confirm('¿Estás seguro de que quieres finalizar esta inspección? Una vez finalizada, no podrás editar las incidencias iniciales.')) {
    const { error } = await supabase
      .from('inspecciones')
      .update({ estado: 'finalizada' })
      .eq('id', inspeccionId);

    if (error) {
      alert('Error al finalizar la inspección: ' + error.message);
    } else {
      alert('Inspección finalizada correctamente.');
      router.push('/inspecciones');
    }
  }
};

onMounted(async () => {
  loading.value = true;
  const { data: inspectionData } = await supabase.from('inspecciones').select('*, centros(*)').eq('id', inspeccionId).single();
  
  if (!inspectionData) {
      alert('Error: No se pudo cargar la inspección o no tienes permiso para verla.');
      loading.value = false;
      return;
  }

  inspeccion.value = inspectionData;
  centro.value = inspectionData.centros;
  
  if (centro.value) {
    const [salasRes, puntosMaestrosRes] = await Promise.all([
      supabase.from('salas').select('*').eq('centro_id', centro.value.id).order('nombre'),
      supabase.from('puntos_maestros').select('*').eq('centro_id', centro.value.id)
    ]);
    salas.value = salasRes.data || [];
    puntosMaestros.value = puntosMaestrosRes.data || [];
    await initializeInspectionPoints();
  }
  loading.value = false;
});
</script>

<template>
  <div class="p-8 h-full flex flex-col">
    <div v-if="loading" class="text-center text-slate-500">Cargando...</div>
    <div v-else-if="centro && inspeccion" class="flex-1 flex flex-col">
      <div class="flex-shrink-0 mb-8">
        <div class="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 class="text-4xl font-bold text-slate-800 mb-2">Inspección: {{ centro.nombre }}</h1>
            <p class="text-slate-500">Técnico: <span class="font-medium">{{ inspeccion.tecnico_nombre }}</span> | Fecha: <span class="font-medium">{{ new Date(inspeccion.fecha_inspeccion).toLocaleDateString() }}</span></p>
          </div>
          <button 
            v-if="inspeccion.estado === 'en_progreso'"
            @click="finalizarInspeccion" 
            class="flex items-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm">
            <CheckCircleIcon class="h-5 w-5" />
            Finalizar Inspección
          </button>
        </div>
      </div>
      
      <div class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8 overflow-hidden">
        <div class="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
          <h2 class="text-xl font-bold text-slate-800 mb-4 flex-shrink-0">Puntos de Inspección</h2>
          <div class="flex-1 overflow-y-auto -mr-4 pr-4">
            <!-- === INICIO DEL CAMBIO: Escuchando el nuevo evento === -->
            <PointList 
              :grouped-points="puntosAgrupadosPorSala"
              @select-point="openChecklistFor"
              @update-state="updatePuntoEstado"
              @delete-new-point="handleDeleteNewPoint"
            />
            <!-- === FIN DEL CAMBIO === -->
          </div>
          <div class="mt-4 flex-shrink-0 border-t pt-4">
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

        <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-2">
          <InteractiveMap 
            :image-url="centro.url_imagen_plano" 
            :points="puntosParaMostrar.filter(p => p.estado !== 'suprimido')"
            :salas="salas"
            :is-read-only="true"
            :is-placement-mode="isPlacementMode"
            @point-click="openChecklistFor"
            @add-point="handleMapClick"
          />
        </div>
      </div>
    </div>
    <div v-else class="text-center text-red-500">No se encontraron datos para esta inspección.</div>

    <ChecklistModal 
      :is-open="isModalOpen" 
      :punto="selectedPunto"
      :inspeccion-id="inspeccionId" 
      @close="isModalOpen = false" 
    />
  </div>
</template>