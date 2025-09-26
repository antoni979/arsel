<!-- src/views/CentroHistorialView.vue -->
<script setup>
import { ref, computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { useInspections } from '../composables/useInspections';
import InspectionListItem from '../components/InspectionListItem.vue';
import MarkAsSentModal from '../components/MarkAsSentModal.vue';

const showNotification = inject('showNotification');
const showConfirm = inject('showConfirm');
const route = useRoute();
const router = useRouter();
const centroId = route.params.id;

const {
loading,
loadingMore,
centro,
inspecciones,
availableYears,
hasMorePages,
loadMore,
loadInspectionDetails,
updateInspectionInList,
removeInspectionFromList
} = useInspections(centroId);

const isProcessing = ref(null);
const isSentModalOpen = ref(false);
const selectedInspeccion = ref(null);
const selectedYear = ref(null);

const filteredInspecciones = computed(() => {
if (selectedYear.value === null) {
return inspecciones.value;
}
return inspecciones.value.filter(inspeccion => {
return new Date(inspeccion.fecha_inspeccion).getFullYear() === selectedYear.value;
});
});

const openSentModal = (inspeccion) => {
selectedInspeccion.value = inspeccion;
isSentModalOpen.value = true;
};

const handleMarkAsSent = async (formData) => {
if (!selectedInspeccion.value) return;

isProcessing.value = selectedInspeccion.value.id;
isSentModalOpen.value = false;

try {
const { data, error } = await supabase
.from('inspecciones')
.update({
fecha_envio_cliente: formData.fecha_envio,
responsable_envio_cliente: formData.responsable_envio,
estado: 'pendiente_subsanacion'
})
.eq('id', selectedInspeccion.value.id)
.select()
.single();

if (error) throw error;

updateInspectionInList(data);
showNotification('Registro de envío guardado con éxito.', 'success');
} catch (error) {
showNotification('Error al registrar el envío: ' + error.message, 'error');
} finally {
isProcessing.value = null;
}
};

const reabrirInspeccion = async (inspeccion) => {
const confirmed = await showConfirm('Reabrir Inspección', `¿Estás seguro de que quieres reabrir la inspección del ${new Date(inspeccion.fecha_inspeccion).toLocaleDateString()}? El PDF archivado será invalidado y deberás volver a finalizarla.`);
if (!confirmed) return;
isProcessing.value = inspeccion.id;
try {
const { data, error } = await supabase
.from('inspecciones')
.update({
estado: 'en_progreso',
url_pdf_informe_inicial: null,
url_pdf_informe_final: null
})
.eq('id', inspeccion.id)
.select()
.single();

if (error) throw error;

updateInspectionInList(data);
showNotification('Inspección reabierta. Ahora puedes editarla de nuevo.', 'success');
} catch (error) {
showNotification('Error al reabrir la inspección: ' + error.message, 'error');
} finally {
isProcessing.value = null;
}
}

const handleDelete = async (inspeccionId) => {
const confirmed = await showConfirm('Borrar Inspección', '¿Estás seguro de que quieres borrar esta inspección? Esta acción es permanente y eliminará todos los datos y fotos asociados.');
if (!confirmed) return;

try {
const { data: incidencias, error: getIncidenciasError } = await supabase.from('incidencias').select('url_foto_antes, url_foto_despues').eq('inspeccion_id', inspeccionId);
if (getIncidenciasError) throw getIncidenciasError;

const filesToDelete = [];
if (incidencias) {
incidencias.forEach(inc => {
if (inc.url_foto_antes) filesToDelete.push(inc.url_foto_antes.substring(inc.url_foto_antes.lastIndexOf('/incidencias/') + 1));
if (inc.url_foto_despues) filesToDelete.push(inc.url_foto_despues.substring(inc.url_foto_despues.lastIndexOf('/incidencias/') + 1));
});
}

if (filesToDelete.length > 0) {
const { error: storageError } = await supabase.storage.from('incidencias').remove(filesToDelete);
if (storageError) {
showNotification('Advertencia: No se pudieron borrar algunos archivos de imagen.', 'warning');
}
}

await supabase.from('incidencias').delete().eq('inspeccion_id', inspeccionId);
await supabase.from('puntos_inspeccionados').delete().eq('inspeccion_id', inspeccionId);
const { error: inspeccionError } = await supabase.from('inspecciones').delete().eq('id', inspeccionId);
if (inspeccionError) throw inspeccionError;

removeInspectionFromList(inspeccionId);
showNotification('Inspección borrada con éxito.', 'success');
} catch (error) {
showNotification('Ocurrió un error al borrar la inspección: ' + error.message, 'error');
}
};
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
    
    <InspectionListItem
      v-for="inspeccion in filteredInspecciones"
      :key="inspeccion.id"
      :inspeccion="inspeccion"
      :is-processing="isProcessing === inspeccion.id"
      @mouseenter="loadInspectionDetails(inspeccion.id)"
      @mark-as-sent="openSentModal"
      @reopen="reabrirInspeccion"
      @delete="handleDelete"
    />

    <div v-if="hasMorePages && !loadingMore" class="text-center py-4">
      <button @click="loadMore" class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">
        Cargar más inspecciones
      </button>
    </div>
    <div v-if="loadingMore" class="text-center py-4">
      <div class="inline-flex items-center gap-2 text-slate-600">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        Cargando más inspecciones...
      </div>
    </div>
  </div>
</div>
<MarkAsSentModal :is-open="isSentModalOpen" :inspeccion-id="selectedInspeccion?.id" @close="isSentModalOpen = false" @save="handleMarkAsSent" />
</div>
</template>