<!-- src/views/PlanoPreviewView.vue -->
<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchReportData } from '../utils/pdf/pdf-data';
import { calculatePlanoLayout } from '../utils/plano-layout';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import PlanoBadge from '../components/PlanoBadge.vue';
import { ArrowDownTrayIcon, ArrowUturnLeftIcon } from '@heroicons/vue/24/solid';

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

// --- CORRECCIÓN DE TAMAÑO ---
// Definimos el tamaño de la tarjeta en la pantalla (en píxeles)
const BADGE_WIDTH_PX = 60; 

onMounted(async () => {
  reportData.value = await fetchReportData(inspeccionId);
  if (!reportData.value) {
    errorState.value = "No se pudieron cargar los datos de la inspección.";
    loading.value = false;
    return;
  }
  loading.value = false;
  await nextTick();
  prepareLayout();
});

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
      return {
        ...punto,
        nomenclatura: maestro.nomenclatura,
        absX: mapDimensions.value.x + (punto.coordenada_x * mapDimensions.value.width),
        absY: mapDimensions.value.y + (punto.coordenada_y * mapDimensions.value.height),
        counts: reportData.value.incidenceCounts.get(punto.id) || { verde: 0, ambar: 0, rojo: 0 }
      };
    }).filter(Boolean);
    
    // --- CORRECCIÓN DE TAMAÑO ---
    // Pasamos el tamaño en píxeles al algoritmo
    const calculatedLabels = calculatePlanoLayout(allPoints, mapDimensions.value, BADGE_WIDTH_PX);
    
    const showLabelsIncrementally = (index = 0) => {
      if (index < calculatedLabels.length) {
        labels.value.push(calculatedLabels[index]);
        requestAnimationFrame(() => showLabelsIncrementally(index + 1));
      } else {
        layoutReady.value = true;
      }
    };
    showLabelsIncrementally();
  };
  
  img.onerror = () => { errorState.value = "No se pudo cargar la imagen del plano."; }
  img.src = reportData.value.planoBase64;
};

const generatePdf = async () => {
    isGenerating.value = true;
    await nextTick();
    const elementToCapture = planoContainer.value;
    
    const canvas = await html2canvas(elementToCapture, { 
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    const { inspectionData } = reportData.value;
    const fileName = `Plano_Incidencias_${inspectionData.centros.nombre.replace(/ /g, '_')}_${inspectionData.fecha_inspeccion}.pdf`;
    pdf.save(fileName);
    isGenerating.value = false;
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
        <button @click="$router.go(-1)" class="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-md hover:bg-slate-50">
          <ArrowUturnLeftIcon class="h-4 w-4" /> Volver
        </button>
        <button @click="generatePdf" :disabled="isGenerating || !layoutReady" class="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-400">
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
          :key="'badge-' + label.pointData.id"
          @mousedown.prevent="onMouseDown(label, $event)"
          class="z-20 absolute"
          :style="{ 
            left: `${label.position.x - (label.size.width / 2)}px`,
            top: `${label.position.y - (label.size.height / 2)}px`,
            width: `${label.size.width}px`,
            height: `${label.size.height}px`,
          }"
        >
           <PlanoBadge :pointData="label.pointData" />
        </div>
      </div>
    </main>
  </div>
</template>