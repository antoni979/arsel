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
const planoContainer = ref(null);
const mapDimensions = ref({ x: 0, y: 0, width: 1, height: 1 });
const isGenerating = ref(false);

const draggedLabel = ref(null);
const dragOffset = ref({ x: 0, y: 0 });

const BADGE_WIDTH_RATIO = 0.04; // El ancho del badge será el 4% del ancho del plano
const BADGE_ASPECT_RATIO = 45 / 55; // Altura / Ancho

const loadData = async () => {
  reportData.value = await fetchReportData(inspeccionId, { optimizePlan: false });

  if (!reportData.value || !reportData.value.planoBase64) {
    errorState.value = "No se pudieron cargar los datos o el plano de la inspección.";
    loading.value = false;
    return;
  }
  loading.value = false;
  await nextTick();
  prepareLayout();
};

onMounted(loadData);

const prepareLayout = () => {
  const containerEl = planoContainer.value;
  if (!containerEl) {
    errorState.value = "Error: El contenedor del plano no se encontró en el DOM.";
    return;
  }
  
  const img = new Image();
  img.onload = () => {
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
      return {
        ...punto,
        nomenclatura: maestro.nomenclatura,
        // Coordenadas relativas (0 a 1) respecto al plano
        relativeX: punto.coordenada_x,
        relativeY: punto.coordenada_y,
        counts: reportData.value.incidenceCounts.get(punto.id) || { verde: 0, ambar: 0, rojo: 0 }
      };
    }).filter(Boolean);
    
    // El layout ahora trabaja con coordenadas relativas
    labels.value = calculatePlanoLayout(allPoints, { width: img.width, height: img.height }, BADGE_WIDTH_RATIO);
    layoutReady.value = true;
  };
  
  img.onerror = () => { errorState.value = "No se pudo cargar la imagen del plano."; }
  img.src = reportData.value.planoBase64;
};

const handleGeneratePdf = async () => {
    isGenerating.value = true;
    try {
      const img = new Image();
      img.src = reportData.value.planoBase64;
      await new Promise(resolve => img.onload = resolve);

      const originalDimensions = {
          width: img.width,
          height: img.height
      };
      // Pasamos las etiquetas con coordenadas relativas y las dimensiones originales
      await generatePlanPdf(inspeccionId, labels.value, originalDimensions);
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
  const badgeWidthPx = mapDimensions.value.width * BADGE_WIDTH_RATIO;
  const badgeHeightPx = badgeWidthPx * BADGE_ASPECT_RATIO;
  
  const currentLeftPx = label.position.x * mapDimensions.value.width + mapDimensions.value.x - (badgeWidthPx / 2);
  const currentTopPx = label.position.y * mapDimensions.value.height + mapDimensions.value.y - (badgeHeightPx / 2);
  
  dragOffset.value = {
    x: event.clientX - containerRect.left - currentLeftPx,
    y: event.clientY - containerRect.top - currentTopPx
  };
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
};

const onMouseMove = (event) => {
  if (!draggedLabel.value) return;
  const containerRect = planoContainer.value.getBoundingClientRect();
  const badgeWidthPx = mapDimensions.value.width * BADGE_WIDTH_RATIO;
  const badgeHeightPx = badgeWidthPx * BADGE_ASPECT_RATIO;

  const newLeftPx = event.clientX - containerRect.left - dragOffset.value.x;
  const newTopPx = event.clientY - containerRect.top - dragOffset.value.y;
  
  draggedLabel.value.position.x = (newLeftPx + (badgeWidthPx / 2) - mapDimensions.value.x) / mapDimensions.value.width;
  draggedLabel.value.position.y = (newTopPx + (badgeHeightPx / 2) - mapDimensions.value.y) / mapDimensions.value.height;
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
        <button @click="prepareLayout" :disabled="loading" class="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50">
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
              :x1="label.pointData.relativeX * mapDimensions.width + mapDimensions.x"
              :y1="label.pointData.relativeY * mapDimensions.height + mapDimensions.y"
              :x2="label.position.x * mapDimensions.width + mapDimensions.x"
              :y2="label.position.y * mapDimensions.height + mapDimensions.y"
              stroke="#94a3b8"
              stroke-width="1"
            />
          </g>
        </svg>
        
        <div
          v-for="label in labels"
          :key="'badge-' + label.pointData.id"
          v-show="layoutReady"
          @mousedown.prevent="onMouseDown(label, $event)"
          class="z-20 absolute"
          :style="{
            width: `${mapDimensions.width * BADGE_WIDTH_RATIO}px`,
            height: `${mapDimensions.width * BADGE_WIDTH_RATIO * BADGE_ASPECT_RATIO}px`,
            left: `${label.position.x * mapDimensions.width + mapDimensions.x - (mapDimensions.width * BADGE_WIDTH_RATIO / 2)}px`,
            top: `${label.position.y * mapDimensions.height + mapDimensions.y - (mapDimensions.width * BADGE_WIDTH_RATIO * BADGE_ASPECT_RATIO / 2)}px`,
          }"
        >
            <PlanoBadge :pointData="label.pointData" />
        </div>
      </div>
    </main>
  </div>
</template>