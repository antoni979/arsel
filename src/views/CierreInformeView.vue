<!-- src/views/CierreInformeView.vue -->
<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { checklistItems } from '../utils/checklist';
import { generateTextReport } from '../utils/pdf';
import { ArrowUpTrayIcon, CheckCircleIcon, TrashIcon } from '@heroicons/vue/24/solid';

const showNotification = inject('showNotification');
const route = useRoute();
const router = useRouter();
const inspeccionId = Number(route.params.id);

const loading = ref(true);
const isFinalizing = ref(false);
const inspeccion = ref(null);
const incidencias = ref([]);
const isUploading = ref(null);
const dragOverIncidenceId = ref(null);

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

const onDragOver = (event, incidenceId) => {
  event.preventDefault();
  dragOverIncidenceId.value = incidenceId;
};

const onDragLeave = (event) => {
  event.preventDefault();
  dragOverIncidenceId.value = null;
};

const onDrop = (event, incidencia) => {
  event.preventDefault();
  dragOverIncidenceId.value = null;
  const files = event.dataTransfer.files;
  if (files.length === 0) return;
  if (files.length > 1) {
    showNotification('Solo se permite subir una foto a la vez.', 'error');
    return;
  }
  const file = files[0];
  handleFileUpload(file, incidencia);
};
const handleFileChange = async (event, incidencia) => {
  const file = event.target.files[0];
  if (!file) return;
  handleFileUpload(file, incidencia);
};

const handleFileUpload = async (file, incidencia) => {
  // Validations
  if (!file.type.startsWith('image/')) {
    showNotification('Solo se permiten archivos de imagen.', 'error');
    return;
  }
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showNotification('El archivo es demasiado grande. Máximo 10MB.', 'error');
    return;
  }

  isUploading.value = incidencia.id;

  try {
    // SIEMPRE comprimir para unificar calidad (cámara y galería)
    showNotification('Comprimiendo imagen...', 'info');

    const originalSize = file.size;
    const fileToUpload = await compressImage(file);

    const compressionRatio = ((originalSize - fileToUpload.size) / originalSize * 100).toFixed(1);
    if (compressionRatio > 5) {
      showNotification(`Imagen comprimida: ${compressionRatio}% de reducción`, 'success');
    }

    // Cambiamos el nombre de la carpeta para mantener consistencia
    const fileName = `cierre_informe_${inspeccionId}/incidencia_${incidencia.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('incidencias').upload(fileName, fileToUpload, { upsert: true });
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
      showNotification('Foto subida correctamente.', 'success');
    }
    isUploading.value = null;
  } catch (error) {
    console.error('Error processing image:', error);
    showNotification('Error al procesar la imagen: ' + error.message, 'error');
    isUploading.value = null;
  }
};

// Compress image using Canvas API
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions (max 1024px on longest side for smaller files)
      let { width, height } = img;
      const maxDimension = 1024;

      if (width > height) {
        if (width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress with lower quality for much smaller files
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) {
          // Create a new file with the compressed blob
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        } else {
          reject(new Error('Failed to compress image'));
        }
      }, 'image/jpeg', 0.6); // 60% quality for smaller file sizes
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

const deletePhoto = async (incidencia) => {
  if (!incidencia.url_foto_despues) return;

  if (!confirm('¿Estás seguro de que quieres eliminar esta foto de corrección?')) {
    return;
  }

  try {
    // Extract file path from URL
    const url = new URL(incidencia.url_foto_despues);
    const pathParts = url.pathname.split('/');
    // Find the index after 'incidencias' bucket
    const bucketIndex = pathParts.findIndex(part => part === 'incidencias');
    const filePath = pathParts.slice(bucketIndex + 1).join('/');

    // Delete from storage
    const { error: storageError } = await supabase.storage.from('incidencias').remove([filePath]);
    if (storageError) {
      console.error('Storage deletion error:', storageError);
      showNotification('Advertencia: Error al eliminar del almacenamiento, pero se actualizó la base de datos.', 'warning');
      // Continue with DB update even if storage deletion fails
    }

    // Update database
    const { error: dbError } = await supabase.from('incidencias').update({ url_foto_despues: null }).eq('id', incidencia.id);
    if (dbError) {
      showNotification('Error al actualizar la base de datos: ' + dbError.message, 'error');
      return;
    }

    // Update local state
    incidencia.url_foto_despues = null;
    showNotification('Foto eliminada correctamente.', 'success');
  } catch (error) {
    console.error('Error deleting photo:', error);
    showNotification('Error al eliminar la foto: ' + error.message, 'error');
  }
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

const finalizarInforme = async () => {
  if (!confirm('¿Estás seguro de que quieres generar el Informe de Cierre, archivarlo y cerrar esta inspección?')) {
      return;
  }
  isFinalizing.value = true;
  try {
    // Llamamos a generateTextReport con el tipo 'remediation' que internamente genera el informe de cierre
    const report = await generateTextReport(inspeccionId, 'remediation', 'blob');
    if (!report || !report.blob) throw new Error("La generación del PDF de Cierre falló.");

    const base64File = await blobToBase64(report.blob);

    const centroId = inspeccion.value.centros.id;
    const fileNameWithId = `${inspeccionId}-${report.fileName}`;
    const finalFileName = `centro_${centroId}/${fileNameWithId}`;

    const { data, error: invokeError } = await supabase.functions.invoke('upload-pdf-to-b2', {
      body: { 
        file: base64File,
        fileName: finalFileName,
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
    console.error("Error al finalizar el informe de cierre:", error);
    showNotification('Ocurrió un error al finalizar: ' + error.message, 'error');
  } finally {
    isFinalizing.value = false;
  }
};
</script>

<template>
  <div class="h-full flex flex-col">
    <div v-if="loading" class="flex-1 flex items-center justify-center">Cargando datos del informe...</div>
    <div v-else-if="inspeccion" class="flex-1 flex flex-col min-h-0">
      <header class="flex-shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 bg-slate-100/80 backdrop-blur-sm border-b border-slate-200 z-10">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-slate-800">Generar Informe de Cierre</h1>
            <p class="text-lg text-slate-600 mt-1">{{ inspeccion.centros.nombre }}</p>
            <p class="text-sm text-slate-500 mt-1">Inspección del {{ new Date(inspeccion.fecha_inspeccion).toLocaleDateString() }}</p>
          </div>
          <div class="flex gap-4 w-full sm:w-auto">
            <button @click="router.go(-1)" class="flex-1 sm:flex-none px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Volver</button>
            <button @click="finalizarInforme" :disabled="!todasSubsanadas || isFinalizing" class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed">
              <CheckCircleIcon class="h-5 w-5" />
              {{ isFinalizing ? 'Finalizando...' : 'Finalizar y Cerrar' }}
            </button>
          </div>
        </div>
      </header>
      <main class="flex-1 overflow-y-auto p-4 sm:p-8">
        <div class="space-y-6 max-w-7xl mx-auto">
          <div v-if="incidencias.length === 0" class="bg-white p-8 rounded-lg shadow-sm text-center">
              <h3 class="text-lg font-medium text-slate-700">¡No hay incidencias que corregir!</h3>
              <p class="text-slate-500">Esta inspección no tiene incidencias que requieran una foto de corrección. Puedes cerrarla directamente.</p>
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
                <p class="text-sm font-semibold text-slate-600 mb-2">DESPUÉS (Evidencia de Corrección)</p>
                <div
                  class="aspect-video bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden relative group transition-colors"
                  :class="{ 'bg-blue-200 border-2 border-blue-400 border-dashed': dragOverIncidenceId === incidencia.id }"
                  @dragover="onDragOver($event, incidencia.id)"
                  @dragleave="onDragLeave"
                  @drop="onDrop($event, incidencia)"
                >
                  <img v-if="incidencia.url_foto_despues" :src="incidencia.url_foto_despues" class="w-full h-full object-contain">
                  <div v-else-if="isUploading === incidencia.id" class="text-center text-slate-600">Subiendo foto...</div>
                  <div v-else class="text-center">
                    <p v-if="dragOverIncidenceId === incidencia.id" class="text-sm text-slate-600">Suelta la foto aquí</p>
                    <label v-else :for="'fileInput-' + incidencia.id" class="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                      <ArrowUpTrayIcon class="h-4 w-4" />
                      Subir Foto
                    </label>
                    <input type="file" @change="handleFileChange($event, incidencia)" class="hidden" :id="'fileInput-' + incidencia.id" accept="image/*">
                  </div>
                   <div v-if="incidencia.url_foto_despues" class="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                     <div class="flex gap-4">
                       <input type="file" @change="handleFileChange($event, incidencia)" class="hidden" :id="'fileInputChange-' + incidencia.id" accept="image/*">
                       <label :for="'fileInputChange-' + incidencia.id" class="cursor-pointer text-white font-semibold">Cambiar Foto</label>
                       <button @click="deletePhoto(incidencia)" class="text-white font-semibold hover:text-red-300 flex items-center gap-1">
                         <TrashIcon class="h-4 w-4" />
                         Eliminar
                       </button>
                     </div>
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