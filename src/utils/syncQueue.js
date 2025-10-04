// src/utils/syncQueue.js

import { ref } from 'vue';
import { supabase } from '../supabase';
import { useNotification } from './notification';

const { showNotification } = useNotification();

export const syncQueue = ref([]);
export const isProcessing = ref(false);

const QUEUE_STORAGE_KEY = 'arsel-sync-queue';
const FILE_STORAGE_KEY_PREFIX = 'arsel-offline-file-';

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

async function getFileLocally(fileId) {
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

const tempIdMap = new Map();

export async function processQueue() {
  if (isProcessing.value || !navigator.onLine) {
    return;
  }

  isProcessing.value = true;
  // --- MODIFICACIÓN: Esta notificación se mantiene, es útil y poco frecuente. ---
  if(syncQueue.value.length > 0) {
    showNotification('Sincronizando...', 'info', 1500);
  }

  while (syncQueue.value.length > 0) {
    const action = syncQueue.value[0];
    let success = false;

    try {
      if (action.payload) {
        for (const key in action.payload) {
          if (typeof action.payload[key] === 'string' && action.payload[key].startsWith('temp_')) {
            if (tempIdMap.has(action.payload[key])) {
              action.payload[key] = tempIdMap.get(action.payload[key]);
            } else {
              throw new Error(`Dependencia de ID temporal (${action.payload[key]}) no resuelta. Reintentando...`);
            }
          }
        }
      }

      const sanitizedPayload = { ...action.payload };
      delete sanitizedPayload.id;
      delete sanitizedPayload.created_at;

      let query;
      switch (action.type) {
        case 'insert':
          const { data: insertData, error: insertError } = await supabase
            .from(action.table)
            .insert(sanitizedPayload)
            .select()
            .single();
          if (insertError) throw insertError;
          if (action.tempId) {
            tempIdMap.set(action.tempId, insertData.id);
          }
          break;

        case 'update':
          let updateId = action.id;
          if (typeof updateId === 'string' && updateId.startsWith('temp_')) {
             if (!tempIdMap.has(updateId)) {
                throw new Error(`ID temporal ${updateId} no encontrado para actualizar.`);
             }
             updateId = tempIdMap.get(updateId);
          }
          const { error: updateError } = await supabase.from(action.table).update(sanitizedPayload).eq('id', updateId);
          if (updateError) throw updateError;
          break;
        
        case 'uploadAndUpdate':
          const file = await getFileLocally(action.fileId);
          if (!file) throw new Error("Archivo local no encontrado para subir.");
          const { error: uploadError } = await supabase.storage.from(action.bucket).upload(action.path, file, { upsert: true });
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from(action.bucket).getPublicUrl(action.path);
          let recordId = action.recordId;
          if (typeof recordId === 'string' && recordId.startsWith('temp_')) {
            if (!tempIdMap.has(recordId)) throw new Error(`ID temporal ${recordId} no encontrado para actualizar URL.`);
            recordId = tempIdMap.get(recordId);
          }
          const updateUrlPayload = {};
          updateUrlPayload[action.urlColumn] = publicUrl;
          const { error: urlUpdateError } = await supabase.from(action.table).update(updateUrlPayload).eq('id', recordId);
          if (urlUpdateError) throw urlUpdateError;
          await deleteFileLocally(action.fileId);
          break;

        default:
          throw new Error(`Tipo de acción desconocido: ${action.type}`);
      }
      
      success = true;
    } catch (error) {
      console.error('Error al procesar la acción de la cola:', error);
      if (!error.message.includes('Reintentando')) {
        showNotification(`Error de sincronización: ${error.message}`, 'error');
      }
      break; 
    }

    if (success) {
      syncQueue.value.shift();
      saveQueueToStorage();
    }
  }

  // --- MODIFICACIÓN: Eliminada la notificación de "Sincronización completada" ---
  // if (syncQueue.value.length === 0 && isProcessing.value) {
  //   showNotification('Sincronización completada.', 'success', 2000);
  // }
  isProcessing.value = false;
}

export async function addToQueue(action) {
  if (action.type === 'uploadAndUpdate' && action.file) {
      const fileId = `${FILE_STORAGE_KEY_PREFIX}${Date.now()}`;
      try {
          await saveFileLocally(fileId, action.file);
          action.fileId = fileId;
          delete action.file;
      } catch(e) {
          showNotification(e, 'error');
          return;
      }
  }

  syncQueue.value.push(action);
  saveQueueToStorage();
  // --- MODIFICACIÓN: Eliminada la notificación de "Cambio guardado localmente" ---
  // showNotification('Cambio guardado localmente.', 'info', 2000);
  processQueue(); 
}

export function initializeQueue() {
  const savedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
  if (savedQueue) {
    syncQueue.value = JSON.parse(savedQueue);
  }
  processQueue();
}