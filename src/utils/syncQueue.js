// src/utils/syncQueue.js

import { ref } from 'vue';
import { supabase } from '../supabase';
import { useNotification } from './notification';
import { createLogger } from './logger';

const { showNotification } = useNotification();
const logger = createLogger('SyncQueue');

export const syncQueue = ref([]);
export const isProcessing = ref(false);

const QUEUE_STORAGE_KEY = 'arsel-sync-queue';
export const FILE_STORAGE_KEY_PREFIX = 'arsel-offline-file-';

// LRU Cache para tempIdMap con límite de 500 entradas
const MAX_TEMP_ID_MAP_SIZE = 500;
const tempIdMapAccess = new Map(); // Tracking de último acceso
const tempIdMap = new Map();

const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("ArselOfflineFiles", 1);
    request.onerror = () => reject("Error al abrir IndexedDB");
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = event => {
        const db = event.target.result;
        db.createObjectStore("files");
    };
});

async function saveFileLocally(fileId, file) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");
        const request = store.put(file, fileId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject("No se pudo guardar el archivo localmente.");
    });
}

export async function getFileLocally(fileId) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["files"]);
        const store = transaction.objectStore("files");
        const request = store.get(fileId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("No se pudo leer el archivo local.");
    });
}

async function deleteFileLocally(fileId) {
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");
        store.delete(fileId);
        resolve();
    });
}

function saveQueueToStorage() {
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(syncQueue.value));
}

// Funciones LRU para tempIdMap
function setTempId(tempId, realId) {
  // Limpiar entrada más antigua si excedemos el límite
  if (tempIdMap.size >= MAX_TEMP_ID_MAP_SIZE) {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, time] of tempIdMapAccess.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      tempIdMap.delete(oldestKey);
      tempIdMapAccess.delete(oldestKey);
      logger.debug(`LRU: Removed oldest tempId ${oldestKey} to make space`);
    }
  }

  tempIdMap.set(tempId, realId);
  tempIdMapAccess.set(tempId, Date.now());
  logger.debug(`Mapped ${tempId} → ${realId}`);
}

function getTempId(tempId) {
  if (!tempIdMap.has(tempId)) return null;

  // Actualizar tiempo de acceso (LRU)
  tempIdMapAccess.set(tempId, Date.now());
  return tempIdMap.get(tempId);
}

function hasTempId(tempId) {
  return tempIdMap.has(tempId);
}

export async function processQueue() {
  if (isProcessing.value || !navigator.onLine) {
    return;
  }
  isProcessing.value = true;

  // Límite para evitar bucles infinitos
  let processedActions = 0;
  const maxActionsInCycle = syncQueue.value.length * 2;

  while (syncQueue.value.length > 0 && processedActions < maxActionsInCycle) {
    const action = syncQueue.value[0];
    let success = false;
    processedActions++;

    try {
      if (action.payload) {
        for (const key in action.payload) {
          if (typeof action.payload[key] === 'string' && action.payload[key].startsWith('temp_')) {
            const realId = getTempId(action.payload[key]);
            if (realId) {
              action.payload[key] = realId;
            } else {
              throw new Error(`Dependencia de ID temporal (${action.payload[key]}) no resuelta. Reintentando...`);
            }
          }
        }
      }

      const sanitizedPayload = action.payload ? { ...action.payload } : {};
      if(sanitizedPayload.id) delete sanitizedPayload.id;
      if(sanitizedPayload.created_at) delete sanitizedPayload.created_at;

      switch (action.type) {
        case 'insert':
          const { data: insertData, error: insertError } = await supabase.from(action.table).insert(sanitizedPayload).select().single();
          if (insertError) throw insertError;
          if (action.tempId) {
            setTempId(action.tempId, insertData.id);
          }
          success = true;
          break;

        case 'update':
          let updateId = action.id;
          if (typeof updateId === 'string' && updateId.startsWith('temp_')) {
            const realId = getTempId(updateId);
            if (!realId) {
              logger.warn(`Update de ${updateId} reordenado - esperando resolución`);
              throw new Error(`ID temporal ${updateId} no encontrado para actualizar.`);
            }
            updateId = realId;
            logger.debug(`Update resolved: ${action.id} → ${updateId}`);
          }
          const { error: updateError } = await supabase.from(action.table).update(sanitizedPayload).eq('id', updateId);
          if (updateError) throw updateError;
          success = true;
          break;
        
        case 'delete':
          if (typeof action.id === 'string' && action.id.startsWith('temp_')) {
            success = true;
          } else {
            const { error: deleteError } = await supabase.from(action.table).delete().eq('id', action.id);
            if (!deleteError || deleteError.code === 'PGRST116') {
              success = true;
            } else {
              throw deleteError;
            }
          }
          break;

        case 'deleteFile':
          try {
            const url = new URL(action.url);
            const pathParts = url.pathname.split('/');
            const bucketIndex = pathParts.findIndex(part => part === action.bucket);
            if (bucketIndex === -1) throw new Error(`Bucket '${action.bucket}' no encontrado en la URL.`);
            const filePath = pathParts.slice(bucketIndex + 1).join('/');
            const { error: fileDeleteError } = await supabase.storage.from(action.bucket).remove([filePath]);
            if (fileDeleteError && fileDeleteError.message !== 'The resource was not found') {
              logger.error('Error al borrar archivo del storage:', fileDeleteError);
            }
          } catch(e) {
              logger.error('URL de archivo inválida para borrado:', action.url, e);
          }
          success = true;
          break;

        case 'uploadAndUpdate':
          let fileData = await getFileLocally(action.fileId);
          if (!fileData) {
            logger.warn(`Archivo local ${action.fileId} no encontrado, saltando acción`);
            success = true;
            break;
          }
          const fileToUpload = new Blob([fileData], { type: fileData.type });
          const { error: uploadError } = await supabase.storage.from(action.bucket).upload(action.path, fileToUpload, { upsert: true });
          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage.from(action.bucket).getPublicUrl(action.path);

          let recordId = action.recordId;
          if (typeof recordId === 'string' && recordId.startsWith('temp_')) {
            const realRecordId = getTempId(recordId);
            if (!realRecordId) {
              logger.error(`ID temporal ${recordId} no encontrado. Map size: ${tempIdMap.size}`);
              throw new Error(`ID temporal ${recordId} no encontrado para actualizar URL.`);
            }
            logger.debug(`Resolviendo ${recordId} → ${realRecordId}`);
            recordId = realRecordId;
          }

          const updateUrlPayload = {};
          updateUrlPayload[action.urlColumn] = publicUrl;
          const { error: urlUpdateError } = await supabase.from(action.table).update(updateUrlPayload).eq('id', recordId);
          if (urlUpdateError) throw urlUpdateError;

          await deleteFileLocally(action.fileId);
          logger.debug(`Archivo subido y URL actualizada para recordId ${recordId}`);
          success = true;
          break;

        default:
          throw new Error(`Tipo de acción desconocido: ${action.type}`);
      }
    } catch (error) {
      logger.error('Error al procesar la acción de la cola:', error);

      // === MANEJO ROBUSTO DE ERRORES ===
      if (error.message.includes('Dependencia de ID temporal') || error.message.includes('ID temporal no encontrado')) {
        // Error de dependencia: la acción depende de un ID temporal que aún no se ha resuelto
        logger.warn(`Reordenando acción por dependencia no resuelta:`, action);
        const failingAction = syncQueue.value.shift();
        syncQueue.value.push(failingAction);
        // NO marcamos success=true, el bucle continuará con el siguiente elemento
      } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        // Error de red: detenemos el procesamiento para reintentar más tarde
        logger.info('Fallo de red. La sincronización se detiene y reintentará más tarde.');
        break;
      } else if (error.code === 'PGRST116' || error.message.includes('no rows returned')) {
        // El registro no existe en la BD (probablemente ya fue borrado)
        // Esto puede pasar si intentamos actualizar/borrar algo que ya no existe
        logger.warn(`Registro no encontrado, removiendo acción de la cola:`, action);
        success = true; // Marcamos como éxito para remover la acción
      } else {
        // Error grave e inesperado: detenemos la cola y notificamos
        showNotification(`Error de sincronización: ${error.message}`, 'error');
        logger.error('Error grave en cola de sincronización:', error, action);
        break;
      }
    }
    if (success) {
      syncQueue.value.shift();

      // NOTA: NO limpiamos el tempIdMap aquí
      // El mapa persiste durante toda la sesión para manejar updates tardíos
      // que puedan llegar después de que el insert se haya procesado
    }

    // Siempre guardamos el estado actual de la cola, especialmente si la hemos reordenado.
    saveQueueToStorage();
  }

  isProcessing.value = false;
}

export async function addToQueue(action) {
  // === OPTIMIZACIÓN: Borrado de registros con ID temporal ===
  // Si intentamos borrar un registro con ID temporal (creado offline),
  // eliminamos TODAS las acciones relacionadas con ese ID temporal de la cola.
  if (action.type === 'delete' && typeof action.id === 'string' && action.id.startsWith('temp_')) {
    const tempId = action.id;
    const actionsToRemove = [];

    // Buscamos todas las acciones relacionadas con este ID temporal
    syncQueue.value.forEach((item, index) => {
      // Insert con este tempId
      if (item.type === 'insert' && item.tempId === tempId) {
        actionsToRemove.push(index);
      }
      // Update con este id
      else if (item.type === 'update' && item.id === tempId) {
        actionsToRemove.push(index);
      }
      // uploadAndUpdate con este recordId
      else if (item.type === 'uploadAndUpdate' && item.recordId === tempId) {
        actionsToRemove.push(index);
        // Si hay un archivo guardado localmente, lo borramos
        if (item.fileId) {
          deleteFileLocally(item.fileId).catch(err =>
            logger.warn(`No se pudo borrar archivo local ${item.fileId}:`, err)
          );
        }
      }
    });

    // Eliminamos las acciones en orden inverso para no afectar los índices
    if (actionsToRemove.length > 0) {
      actionsToRemove.reverse().forEach(index => {
        syncQueue.value.splice(index, 1);
      });

      // Limpiamos el tempIdMap si existe
      if (hasTempId(tempId)) {
        tempIdMap.delete(tempId);
        tempIdMapAccess.delete(tempId);
      }

      showNotification('Operaciones locales de la incidencia canceladas.', 'info', 2000);
      saveQueueToStorage();
      return; // No agregamos la acción de delete
    }
  }

  // === OPTIMIZACIÓN: Borrado de archivos asociados ===
  // Si es un deleteFile, buscamos si hay una acción uploadAndUpdate pendiente con la misma ruta
  if (action.type === 'deleteFile') {
    const filePathToDelete = extractFilePathFromUrl(action.url, action.bucket);

    // Buscamos uploadAndUpdate pendientes con la misma ruta
    const uploadIndex = syncQueue.value.findIndex(
      item => item.type === 'uploadAndUpdate' &&
              item.bucket === action.bucket &&
              item.path === filePathToDelete
    );

    if (uploadIndex > -1) {
      const uploadAction = syncQueue.value[uploadIndex];
      // Borramos el archivo local si existe
      if (uploadAction.fileId) {
        await deleteFileLocally(uploadAction.fileId).catch(err =>
          logger.warn(`No se pudo borrar archivo local ${uploadAction.fileId}:`, err)
        );
      }
      // Eliminamos la acción de upload
      syncQueue.value.splice(uploadIndex, 1);
      saveQueueToStorage();
      return; // No agregamos la acción de deleteFile
    }
  }

  // === Procesamiento normal de acciones ===
  if (action.type === 'uploadAndUpdate' && action.file) {
      const fileId = `${FILE_STORAGE_KEY_PREFIX}${Date.now()}`;
      try {
          await saveFileLocally(fileId, action.file);
          action.fileId = fileId;
          delete action.file;
      } catch(e) {
          showNotification(e.message, 'error');
          return;
      }
  }

  syncQueue.value.push(action);
  saveQueueToStorage();
  processQueue();
}

// Helper para extraer el path del archivo desde una URL
function extractFilePathFromUrl(url, bucket) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.findIndex(part => part === bucket);
    if (bucketIndex === -1) return null;
    return pathParts.slice(bucketIndex + 1).join('/');
  } catch (e) {
    logger.error('Error extrayendo path de URL:', e);
    return null;
  }
}

export function initializeQueue() {
  const savedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
  if (savedQueue) {
    syncQueue.value = JSON.parse(savedQueue);

    // === LIMPIEZA DE ACCIONES HUÉRFANAS ===
    // Eliminamos acciones update/uploadAndUpdate de IDs temporales que no tienen insert
    const tempIdsWithInsert = new Set();

    // Primera pasada: recolectar todos los tempIds que tienen insert
    syncQueue.value.forEach(action => {
      if (action.type === 'insert' && action.tempId) {
        tempIdsWithInsert.add(action.tempId);
      }
    });

    // Segunda pasada: eliminar acciones huérfanas
    syncQueue.value = syncQueue.value.filter(action => {
      // Si es un update o uploadAndUpdate con ID temporal sin insert correspondiente
      if ((action.type === 'update' || action.type === 'uploadAndUpdate') &&
          typeof action.id === 'string' && action.id.startsWith('temp_') &&
          !tempIdsWithInsert.has(action.id)) {
        logger.warn(`Removiendo acción huérfana de ID temporal ${action.id}:`, action);

        // Si es uploadAndUpdate, borramos el archivo local
        if (action.type === 'uploadAndUpdate' && action.fileId) {
          deleteFileLocally(action.fileId).catch(err =>
            logger.warn(`No se pudo borrar archivo local ${action.fileId}:`, err)
          );
        }

        return false; // Filtrar esta acción
      }

      // Mismo chequeo para uploadAndUpdate con recordId
      if (action.type === 'uploadAndUpdate' &&
          typeof action.recordId === 'string' && action.recordId.startsWith('temp_') &&
          !tempIdsWithInsert.has(action.recordId)) {
        logger.warn(`Removiendo uploadAndUpdate huérfano de recordId ${action.recordId}:`, action);

        if (action.fileId) {
          deleteFileLocally(action.fileId).catch(err =>
            logger.warn(`No se pudo borrar archivo local ${action.fileId}:`, err)
          );
        }

        return false;
      }

      return true; // Mantener esta acción
    });

    saveQueueToStorage();
  }

  processQueue();
}