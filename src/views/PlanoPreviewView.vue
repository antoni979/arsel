<!-- src/views/PlanoPreviewView.vue -->
<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchReportData } from '../utils/pdf/pdf-data';
import { calculatePlanoLayout } from '../utils/plano-layout';
import { generatePlanPdf } from '../utils/pdf';
import PlanoBadge from '../components/PlanoBadge.vue';
import { ArrowDownTrayIcon, ArrowUturnLeftIcon, ArrowPathIcon } from '@heroicons/vue/24/solid';

const route = useRoute();
const router = useRouter();
const inspeccionId = Number(route.params.id);

const loading = ref(true);
const layoutReady = ref(false);
const errorState = ref(null);
const reportData = ref(null);
const labels = ref([]);
const dataVersion = ref(0); // Force reactivity updates
const planoContainer = ref(null);
const mapDimensions = ref({ x: 0, y: 0, width: 1, height: 1 });
const isGenerating = ref(false);

const draggedLabel = ref(null);
const dragOffset = ref({ x: 0, y: 0 });

// ===== CORRECCIÓN: Usamos el mismo valor base que usaremos en el PDF =====
const BADGE_WIDTH_PX = 55; 

const loadData = async () => {
  reportData.value = await fetchReportData(inspeccionId, { optimizePlan: false });

  if (!reportData.value || !reportData.value.planoBase64) {
    errorState.value = "No se pudieron cargar los datos o el plano de la inspección.";
    loading.value = false;
    return;
  }

  // Ensure incidence counts are available
  if (!reportData.value.incidenceCounts) {
    console.error('Incidence counts not available in reportData');
    errorState.value = "Error: No se pudieron calcular los datos de incidencias.";
    loading.value = false;
    return;
  }

  console.log('Report data loaded successfully, incidence counts available:', reportData.value.incidenceCounts.size);
  loading.value = false;
  await nextTick();
  prepareLayout();
};

onMounted(async () => {
  await loadData();
});

// Add method to refresh data (can be called externally if needed)
const refreshData = async () => {
  loading.value = true;
  layoutReady.value = false;
  dataVersion.value = 0; // Reset version on refresh
  await loadData();
};

// Expose refresh method for external use
defineExpose({ refreshData });

const prepareLayout = () => {
  const containerEl = planoContainer.value;
  if (!containerEl) {
    errorState.value = "Error: El contenedor del plano no se encontró en el DOM.";
    return;
  }
  
  const img = new Image();
  img.onload = async () => {
    const containerRatio = containerEl.clientWidth / containerEl.clientHeight;
    const imageRatio = img.width / img.height;
    let imgW, imgH, imgX, imgY;

    if (imageRatio > containerRatio) {
      imgW = containerEl.clientWidth;
      imgH = imgW / imageRatio;
      imgX = 0;
      imgY = (containerEl.clientHeight - imgH) / 2;
    } else {
      imgH = containerEl.clientHeight;
      imgW = imgH * imageRatio;
      imgY = 0;
      imgX = (containerEl.clientWidth - imgW) / 2;
    }
    mapDimensions.value = { x: imgX, y: imgY, width: imgW, height: imgH };

    const allPoints = reportData.value.puntosInspeccionadosData.map(punto => {
      const maestro = reportData.value.puntosMaestrosData.find(pm => pm.id === punto.punto_maestro_id);
      if (!maestro) return null;
      const counts = reportData.value.incidenceCounts.get(punto.id) || { verde: 0, ambar: 0, rojo: 0 };
      console.log(`PlanoPreviewView - Point ${punto.id} (${maestro.nomenclatura}): counts =`, counts);
      return {
        ...punto,
        nomenclatura: maestro.nomenclatura,
        absX: mapDimensions.value.x + (punto.coordenada_x * mapDimensions.value.width),
        absY: mapDimensions.value.y + (punto.coordenada_y * mapDimensions.value.height),
        counts: counts
      };
    }).filter(Boolean);
    
    labels.value = calculatePlanoLayout(allPoints, mapDimensions.value, BADGE_WIDTH_PX);
    dataVersion.value++; // Force reactivity update
    layoutReady.value = true;
    console.log('PlanoPreviewView layout ready, dataVersion:', dataVersion.value);
  };
  
  img.onerror = () => { errorState.value = "No se pudo cargar la imagen del plano."; }
  img.src = reportData.value.planoBase64;
};

const handleGeneratePdf = async () => {
    isGenerating.value = true;
    try {
        const previewDimensions = {
            width: planoContainer.value.clientWidth,
            height: planoContainer.value.clientHeight
        };
        await generatePlanPdf(inspeccionId, labels.value, previewDimensions);
    } catch (error) {
        console.error("Error al generar el PDF del plano:", error);
        alert("Hubo un error al generar el plano. Revisa la consola.");
    } finally {
        isGenerating.value = false;
    }
};

const onMouseDown = (label, event) => {
  draggedLabel.value = label;
  const containerRect = planoContainer.value.getBoundingClientRect();
  dragOffset.value = {
    x: event.clientX - containerRect.left - label.position.x,
    y: event.clientY - containerRect.top - label.position.y
  };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const onMouseMove = (event) => {
  if (!draggedLabel.value) return;
  const containerRect = planoContainer.value.getBoundingClientRect();
  const newX = event.clientX - containerRect.left - dragOffset.value.x;
  const newY = event.clientY - containerRect.top - dragOffset.value.y;
  draggedLabel.value.position.x = newX;
  draggedLabel.value.position.y = newY;
};

const onMouseUp = () => {
  draggedLabel.value = null;
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
};
</script>

<template>
  <div class="h-screen w-screen bg-slate-800 flex flex-col">
    <header class="w-full bg-white shadow-md p-3 flex justify-between items-center z-20 flex-shrink-0">
      <div class="text-slate-700">
        <h1 class="font-bold">Editor de Plano</h1>
        <p v-if="reportData" class="text-sm text-slate-500">{{ reportData.inspectionData.centros.nombre }}</p>
      </div>
      <div class="flex items-center gap-4">
        <button @click="router.go(-1)" class="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-md hover:bg-slate-50">
          <ArrowUturnLeftIcon class="h-4 w-4" /> Volver
        </button>
        <button @click="refreshData" :disabled="loading" class="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50">
          <ArrowPathIcon class="h-4 w-4" /> Actualizar
        </button>
        <button @click="handleGeneratePdf" :disabled="isGenerating || !layoutReady" class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-400">
          <ArrowDownTrayIcon class="h-4 w-4" />
          {{ isGenerating ? 'Generando...' : 'Generar PDF' }}
        </button>
      </div>
    </header>

    <main class="flex-1 p-4 overflow-hidden">
      <div v-if="loading" class="h-full w-full flex items-center justify-center text-white">Cargando previsualización...</div>
      <div v-else-if="errorState" class="h-full w-full flex items-center justify-center text-red-300 bg-red-900/50 p-4 text-center rounded-md">{{ errorState }}</div>
      
      <div v-else ref="planoContainer" class="relative h-full w-full bg-white select-none">
        
        <img
          :src="reportData.planoBase64"
          class="absolute pointer-events-none"
          :style="{ 
            left: `${mapDimensions.x}px`, top: `${mapDimensions.y}px`,
            width: `${mapDimensions.width}px`, height: `${mapDimensions.height}px`
          }"
        >
        
        <svg class="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
          <g v-for="label in labels" :key="'line-' + label.pointData.id">
            <line
              :x1="label.pointData.absX"
              :y1="label.pointData.absY"
              :x2="label.position.x"
              :y2="label.position.y"
              stroke="#94a3b8"
              stroke-width="1"
            />
          </g>
        </svg>
        
        <div
          v-for="label in labels"
          :key="'badge-' + label.pointData.id + '-' + dataVersion"
          v-show="layoutReady"
          @mousedown.prevent="onMouseDown(label, $event)"
          class="z-20 absolute"
          :style="{
            left: `${label.position.x - (label.size.width / 2)}px`,
            top: `${label.position.y - (label.size.height / 2)}px`,
            width: `${label.size.width}px`,
            height: `${label.size.height}px`,
          }"
        >
            <PlanoBadge :pointData="label.pointData" :key="label.pointData.id + '-' + dataVersion" />
        </div>
      </div>
    </main>
  </div>
</template>