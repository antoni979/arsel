// src/composables/useFileUpload.js

import { ref } from 'vue';
import { useNotification } from '../utils/notification';
import { addToQueue, FILE_STORAGE_KEY_PREFIX } from '../utils/syncQueue';
import { createLogger } from '../utils/logger';

const logger = createLogger('FileUpload');

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export function useFileUpload(inspeccionId, puntoId) {
  const { showNotification } = useNotification();
  const isUploading = ref(null);

  const compressImage = (file) => {
    // ... (función de compresión no cambia)
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 1024;
        if (width > height) {
          if (width > maxDimension) { height = (height * maxDimension) / width; width = maxDimension; }
        } else {
          if (height > maxDimension) { width = (width * maxDimension) / height; height = maxDimension; }
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
            resolve(compressedFile);
          } else { reject(new Error('Failed to compress image')); }
        }, 'image/jpeg', 0.6);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (file, incidencia) => {
    if (!file.type.startsWith('image/')) {
      showNotification('Solo se permiten archivos de imagen.', 'error'); return null;
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showNotification('El archivo es demasiado grande. Máximo 10MB.', 'error'); return null;
    }

    isUploading.value = incidencia.id;

    try {
      let fileToUpload = file;
      if (file.size > 500 * 1024) {
        showNotification('Comprimiendo imagen...', 'info');
        fileToUpload = await compressImage(file);
      }
      
      const arrayBuffer = await readFileAsArrayBuffer(fileToUpload);
      const stableBlob = new Blob([arrayBuffer], { type: fileToUpload.type });
      const stableBlobUrl = URL.createObjectURL(stableBlob);

      const fileName = `inspeccion_${inspeccionId}/punto_${puntoId}/${Date.now()}_${file.name}`;

      // addToQueue manejará la creación del fileId internamente
      const queueAction = {
        type: 'uploadAndUpdate',
        bucket: 'incidencias',
        path: fileName,
        file: stableBlob,
        table: 'incidencias',
        recordId: incidencia.id,
        urlColumn: 'url_foto_antes',
      };

      await addToQueue(queueAction);

      showNotification('Foto guardada localmente.', 'success');

      // addToQueue modifica el objeto queueAction y le añade el fileId
      return {
          offlinePhotoKey: queueAction.fileId, // Usamos el fileId que addToQueue creó
          previewUrl: stableBlobUrl,
      };

    } catch (error) {
      logger.error('Error procesando imagen para guardado local:', error);
      showNotification('Error al procesar la imagen: ' + error.message, 'error');
      return null;
    } finally {
      isUploading.value = null;
    }
  };

  return {
    isUploading,
    handleFileUpload,
  };
}