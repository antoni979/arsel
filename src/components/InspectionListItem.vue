<!-- src/components/InspectionListItem.vue -->
<script setup>
import { ref, computed } from 'vue';
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
import { useRouter } from 'vue-router';

const props = defineProps({
inspeccion: {
type: Object,
required: true
},
isProcessing: Boolean,
});

const emit = defineEmits(['mark-as-sent', 'reopen', 'delete']);

const router = useRouter();
const isExpanded = ref(false);

const estadoInfo = computed(() => {
const estado = props.inspeccion.estado;
switch (estado) {
case 'en_progreso': return { text: 'En Progreso', class: 'bg-blue-100 text-blue-800' };
case 'finalizada': return { text: 'Pendiente de Envío', class: 'bg-orange-100 text-orange-800' };
case 'pendiente_subsanacion': return { text: 'Pendiente de Cierre', class: 'bg-yellow-100 text-yellow-800' };
case 'cerrada': return { text: 'Cerrada', class: 'bg-green-100 text-green-800' };
default: return { text: estado, class: 'bg-slate-100 text-slate-800' };
}
});

const toggleDetails = () => {
isExpanded.value = !isExpanded.value;
if (isExpanded.value) {
// La carga de detalles se dispara desde el padre, que maneja la lógica de datos
}
};

const openArchivedPdf = (url) => {
if (url) {
window.open(url, '_blank');
} else {
// Podríamos emitir un evento para mostrar una notificación si es necesario
console.warn('El informe PDF para esta inspección aún no ha sido generado o archivado.');
}
};
</script>
<template>
<div class="bg-white rounded-xl shadow-sm border border-slate-200 transition-all">
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
       <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize" :class="estadoInfo.class">
          {{ estadoInfo.text }}
       </span>
     </div>
     <div class="flex items-center gap-x-3" title="Incidencias: Leves / Moderadas / Graves">
        <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-green-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.totalCounts.verde }}</span></div>
        <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.totalCounts.ambar }}</span></div>
        <div class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full bg-red-500"></span><span class="font-bold text-sm text-slate-700">{{ inspeccion.totalCounts.rojo }}</span></div>
    </div>
  </div>

  <div class="lg:col-span-2 flex justify-start lg:justify-end items-center flex-wrap gap-2">
    <button v-if="inspeccion.estado === 'finalizada'" @click="$emit('mark-as-sent', inspeccion)" :disabled="isProcessing" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 disabled:opacity-50">
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
      <button v-if="inspeccion.estado !== 'en_progreso'" @click="$emit('reopen', inspeccion)" :disabled="isProcessing" class="p-2 text-slate-500 hover:text-orange-600 disabled:opacity-50" title="Reabrir Inspección">
          <ArrowUturnLeftIcon class="h-5 w-5" />
      </button>
      <button @click="$emit('delete', inspeccion.id)" class="p-2 text-slate-500 hover:text-red-600" title="Borrar Inspección"><TrashIcon class="h-5 w-5" /></button>
    </div>
  </div>
</div>

<div class="px-4 pb-2 text-center">
  <button @click="toggleDetails" class="w-full text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center justify-center gap-1 py-1 border-t border-slate-200">
    <span>{{ isExpanded ? 'Ocultar Detalles' : 'Mostrar Detalles' }}</span>
    <ChevronDownIcon class="h-4 w-4 transition-transform" :class="{'rotate-180': isExpanded}" />
  </button>
</div>

<div v-if="isExpanded" class="border-t border-slate-200 p-4 bg-slate-50/50">
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
</template>