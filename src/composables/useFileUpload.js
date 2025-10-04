// src/composables/useFileUpload.js

import { ref } from 'vue';
import { useNotification } from '../utils/notification';
import { addToQueue } from '../utils/syncQueue';

// --- INICIO DE LA MODIFICACIÓN: Nuevo helper para leer archivos ---
/**
 * Lee un objeto File y lo convierte en un ArrayBuffer.
 * Esto es crucial para la persistencia en iOS, que puede revocar BlobURLs.
 * @param {File} file El archivo a leer.
 * @returns {Promise<ArrayBuffer>} El contenido del archivo como ArrayBuffer.
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result);
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsArrayBuffer(file);
  });
}
// --- FIN DE LA MODIFICACIÓN ---

export function useFileUpload(inspeccionId, puntoId) {
  const { showNotification } = useNotification();
  const isUploading = ref(null);

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
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
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        }, 'image/jpeg', 0.6);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (file, incidencia) => {
    if (!file.type.startsWith('image/')) {
      showNotification('Solo se permiten archivos de imagen.', 'error');
      return;
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showNotification('El archivo es demasiado grande. Máximo 10MB.', 'error');
      return;
    }

    isUploading.value = incidencia.id;

    try {
      let fileToUpload = file;
      if (file.size > 500 * 1024) {
        showNotification('Comprimiendo imagen...', 'info');
        fileToUpload = await compressImage(file);
      }

      // --- INICIO DE LA MODIFICACIÓN: Leemos el archivo a un formato estable ---
      // 1. Leemos el contenido del archivo a un ArrayBuffer
      const arrayBuffer = await readFileAsArrayBuffer(fileToUpload);
      // 2. Creamos un nuevo Blob y una nueva URL a partir del ArrayBuffer.
      //    Este nuevo Blob es más estable que el original del input.
      const stableBlob = new Blob([arrayBuffer], { type: fileToUpload.type });
      const stableBlobUrl = URL.createObjectURL(stableBlob);
      // --- FIN DE LA MODIFICACIÓN ---

      const fileName = `inspeccion_${inspeccionId}/punto_${puntoId}/${Date.now()}_${file.name}`;
      
      // Actualización optimista de la UI con la URL estable
      incidencia.url_foto_antes = stableBlobUrl;

      // Encolar la acción de subida y actualización
      // Pasamos el Blob estable, que es lo que IndexedDB guardará.
      await addToQueue({
        type: 'uploadAndUpdate',
        bucket: 'incidencias',
        path: fileName,
        file: stableBlob, // <-- Pasamos el Blob estable
        table: 'incidencias',
        recordId: incidencia.id,
        urlColumn: 'url_foto_antes',
      });

      showNotification('Foto guardada localmente. Se subirá al recuperar la conexión.', 'success');
    } catch (error) {
      console.error('Error procesando imagen para guardado local:', error);
      showNotification('Error al procesar la imagen: ' + error.message, 'error');
    } finally {
      isUploading.value = null;
    }
  };

  return {
    isUploading,
    handleFileUpload,
  };
}