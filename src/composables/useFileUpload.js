// src/composables/useFileUpload.js

import { ref } from 'vue';
import { useNotification } from '../utils/notification';
import { addToQueue } from '../utils/syncQueue';

export function useFileUpload(inspeccionId, puntoId) {
  const { showNotification } = useNotification();
  const isUploading = ref(null); // ID de la incidencia que se está procesando

  // Función de compresión de imagen (movida aquí desde el modal)
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

      const fileName = `inspeccion_${inspeccionId}/punto_${puntoId}/${Date.now()}_${file.name}`;
      
      // Actualización optimista de la UI
      incidencia.url_foto_antes = URL.createObjectURL(fileToUpload);

      // Encolar la acción de subida y actualización
      await addToQueue({
        type: 'uploadAndUpdate',
        bucket: 'incidencias',
        path: fileName,
        file: fileToUpload,
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