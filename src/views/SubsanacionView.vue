<!-- src/views/SubsanacionView.vue -->
<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { checklistItems } from '../utils/checklist';
import { generateTextReport } from '../utils/pdf';
import { ArrowUpTrayIcon, CheckCircleIcon } from '@heroicons/vue/24/solid';

const showNotification = inject('showNotification');
const route = useRoute();
const router = useRouter();
const inspeccionId = Number(route.params.id);

const loading = ref(true);
const isFinalizing = ref(false);
const inspeccion = ref(null);
const incidencias = ref([]);
const isUploading = ref(null);

onMounted(async () => {
  loading.value = true;
  const { data: inspectionData } = await supabase.from('inspecciones').select('*, centros(nombre, id)').eq('id', inspeccionId).single();
  inspeccion.value = inspectionData;
  const { data: incidenciasData } = await supabase.from('incidencias').select('*').eq('inspeccion_id', inspeccionId).neq('item_checklist', 2).order('item_checklist', { ascending: true });
  incidencias.value = incidenciasData || [];
  loading.value = false;
});

const getItemText = (itemId) => {
  const item = checklistItems.find(i => i.id === itemId);
  return item ? `${item.id}. ${item.text}` : 'Item desconocido';
};
const handleFileChange = async (event, incidencia) => {
  const file = event.target.files[0];
  if (!file) return;
  isUploading.value = incidencia.id;
  const fileName = `subsanacion_${inspeccionId}/incidencia_${incidencia.id}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage.from('incidencias').upload(fileName, file, { upsert: true });
  if (uploadError) {
    showNotification("Error al subir la foto: " + uploadError.message, 'error');
    isUploading.value = null;
    return;
  }
  const { data: { publicUrl } } = supabase.storage.from('incidencias').getPublicUrl(fileName);
  const { error: updateError } = await supabase.from('incidencias').update({ url_foto_despues: publicUrl }).eq('id', incidencia.id);
  if (updateError) {
    showNotification("Error al guardar la URL: " + updateError.message, 'error');
  } else {
    incidencia.url_foto_despues = publicUrl;
  }
  isUploading.value = null;
};
const todasSubsanadas = computed(() => {
  if (incidencias.value.length === 0) return true;
  return incidencias.value.every(inc => !!inc.url_foto_despues);
});

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

const finalizarSubsanacion = async () => {
  if (!confirm('¿Estás seguro de que quieres generar el informe final, archivarlo y cerrar esta inspección?')) {
      return;
  }
  isFinalizing.value = true;
  try {
    const report = await generateTextReport(inspeccionId, 'remediation', 'blob');
    if (!report || !report.blob) throw new Error("La generación del PDF de subsanación falló.");

    const base64File = await blobToBase64(report.blob);

    const centroId = inspeccion.value.centros.id;
    const fileNameWithId = `${inspeccionId}-${report.fileName}`;
    const finalFileName = `centro_${centroId}/${fileNameWithId}`;

    console.log("Invocando función Edge 'upload-pdf-to-b2' para subsanación con la ruta:", finalFileName);
    const { data, error: invokeError } = await supabase.functions.invoke('upload-pdf-to-b2', {
      body: { 
        file: base64File,
        // --- INICIO DE LA CORRECCIÓN ---
        fileName: finalFileName,
        // --- FIN DE LA CORRECCIÓN ---
        contentType: 'application/pdf'
      }
    });

    if (invokeError) throw new Error(`Error al contactar con la función Edge: ${invokeError.message}.`);
    if (data.error) throw new Error(data.error);
    if (!data.publicUrl) throw new Error('La función Edge no devolvió una URL válida.');
    
    const publicUrl = data.publicUrl;
    
    const { error: updateError } = await supabase.from('inspecciones').update({ estado: 'cerrada', url_pdf_informe_final: publicUrl }).eq('id', inspeccionId);
    if (updateError) throw updateError;
    
    showNotification('Inspección cerrada y archivada con éxito.');
    router.push(`/centros/${inspeccion.value.centros.id}/historial`);
  } catch (error) {
    console.error("Error al finalizar subsanación:", error);
    showNotification('Ocurrió un error al finalizar la subsanación: ' + error.message, 'error');
  } finally {
    isFinalizing.value = false;
  }
};
</script>

<template>
  <div class="h-full flex flex-col">
    <div v-if="loading" class="flex-1 flex items-center justify-center">Cargando datos de subsanación...</div>
    <div v-else-if="inspeccion" class="flex-1 flex flex-col min-h-0">
      <header class="flex-shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 bg-slate-100/80 backdrop-blur-sm border-b border-slate-200 z-10">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-slate-800">Gestión de Subsanación</h1>
            <p class="text-lg text-slate-600 mt-1">{{ inspeccion.centros.nombre }}</p>
            <p class="text-sm text-slate-500 mt-1">Inspección del {{ new Date(inspeccion.fecha_inspeccion).toLocaleDateString() }}</p>
          </div>
          <div class="flex gap-4 w-full sm:w-auto">
            <button @click="router.go(-1)" class="flex-1 sm:flex-none px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Volver</button>
            <button @click="finalizarSubsanacion" :disabled="!todasSubsanadas || isFinalizing" class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed">
              <CheckCircleIcon class="h-5 w-5" />
              {{ isFinalizing ? 'Finalizando...' : 'Finalizar y Cerrar' }}
            </button>
          </div>
        </div>
      </header>
      <main class="flex-1 overflow-y-auto p-4 sm:p-8">
        <div class="space-y-6 max-w-7xl mx-auto">
          <div v-if="incidencias.length === 0" class="bg-white p-8 rounded-lg shadow-sm text-center">
              <h3 class="text-lg font-medium text-slate-700">¡No hay incidencias que subsanar!</h3>
              <p class="text-slate-500">Esta inspección no tiene incidencias que requieran una foto de subsanación. Puedes cerrarla directamente.</p>
          </div>
          <div v-for="incidencia in incidencias" :key="incidencia.id" class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 class="font-bold text-lg text-slate-800 border-b pb-3 mb-4">{{ getItemText(incidencia.item_checklist) }}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p class="text-sm font-semibold text-slate-600 mb-2">ANTES (Incidencia Original)</p>
                <div class="aspect-video bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                  <img v-if="incidencia.url_foto_antes" :src="incidencia.url_foto_antes" class="w-full h-full object-contain">
                  <p v-else class="text-slate-500 text-sm p-4">No se adjuntó foto de la incidencia.</p>
                </div>
                <div v-if="incidencia.observaciones" class="mt-3 text-sm bg-slate-50 p-3 rounded-md">
                  <strong>Observaciones:</strong> {{ incidencia.observaciones }}
                </div>
              </div>
              <div>
                <p class="text-sm font-semibold text-slate-600 mb-2">DESPUÉS (Evidencia de Subsanación)</p>
                <div class="aspect-video bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden relative group">
                  <img v-if="incidencia.url_foto_despues" :src="incidencia.url_foto_despues" class="w-full h-full object-contain">
                  <div v-else-if="isUploading === incidencia.id" class="text-center text-slate-600">Subiendo foto...</div>
                  <div v-else class="text-center">
                    <input type="file" @change="handleFileChange($event, incidencia)" class="hidden" :id="'fileInput-' + incidencia.id" accept="image/*">
                    <label :for="'fileInput-' + incidencia.id" class="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                      <ArrowUpTrayIcon class="h-4 w-4" />
                      Subir Foto
                    </label>
                  </div>
                   <div v-if="incidencia.url_foto_despues" class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                     <input type="file" @change="handleFileChange($event, incidencia)" class="hidden" :id="'fileInputChange-' + incidencia.id" accept="image/*">
                     <label :for="'fileInputChange-' + incidencia.id" class="cursor-pointer text-white font-semibold">Cambiar Foto</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>