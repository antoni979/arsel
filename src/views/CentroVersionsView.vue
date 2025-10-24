<!-- src/views/CentroVersionsView.vue -->
<script setup>
import { ref, onMounted, inject, nextTick, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { PlusIcon, PencilIcon, CheckCircleIcon, ArchiveBoxIcon, CheckIcon } from '@heroicons/vue/24/solid';
import { addToQueue } from '../utils/syncQueue';

const route = useRoute();
const router = useRouter();
const centroId = route.params.id;

const loading = ref(true);
const centro = ref(null);
const versiones = ref([]);
const newVersionName = ref('');

// Inline editing state
const editingVersionId = ref(null);
const tempVersionName = ref('');

// Inject notification system
const showNotification = inject('showNotification');

const fetchVersions = async () => {
  loading.value = true;
  const { data: centroData } = await supabase.from('centros').select('nombre').eq('id', centroId).single();
  centro.value = centroData;

  const { data: versionsData } = await supabase
    .from('versiones_plano')
    .select('*')
    .eq('centro_id', centroId)
    .order('fecha_creacion', { ascending: false });
  versiones.value = versionsData || [];
  loading.value = false;
};

const createNewVersion = async () => {
    if (!newVersionName.value.trim()) {
        alert('Por favor, introduce un nombre para la nueva versión.');
        return;
    }

    // Llamamos a una función RPC de Supabase que se encarga de la lógica de duplicación
    // Esta función debería:
    // 1. Poner a `false` la `es_activa` de la versión activa actual.
    // 2. Crear la nueva versión con `es_activa = true`.
    // 3. Duplicar las salas y puntos de la versión anterior a la nueva.
    // 4. Devolver el ID de la nueva versión.
    const { data, error } = await supabase.rpc('crear_nueva_version_plano', {
        centro_id_param: centroId,
        nuevo_nombre_param: newVersionName.value.trim()
    });

    if (error) {
        alert('Error al crear la nueva versión: ' + error.message);
        console.error(error);
    } else {
        alert('Nueva versión creada con éxito.');
        newVersionName.value = '';
        await fetchVersions();
        // Opcionalmente, redirigir directamente a la configuración de la nueva versión
        if (data) {
           router.push(`/versiones/${data}/configurar`);
        }
    }
};

// Inline editing functions
const startEditingName = (version) => {
  editingVersionId.value = version.id;
  tempVersionName.value = version.nombre;
  nextTick(() => {
    // Find the input element by its data attribute
    const inputElement = document.querySelector(`input[data-version-id="${version.id}"]`);
    if (inputElement) {
      inputElement.focus();
      inputElement.select(); // Also select all text for easier editing
    }
  });
};

const cancelEditingName = () => {
  editingVersionId.value = null;
  tempVersionName.value = '';
};

const saveVersionName = async (versionId) => {
  const newName = tempVersionName.value.trim();

  // Validation
  if (!newName) {
    showNotification('El nombre de la versión no puede estar vacío.', 'error');
    return;
  }

  if (newName.length > 100) {
    showNotification('El nombre es demasiado largo (máximo 100 caracteres).', 'error');
    return;
  }

  try {
    // Use sync queue for offline support
    addToQueue({
      table: 'versiones_plano',
      type: 'update',
      id: versionId,
      payload: { nombre: newName }
    });

    // Update local state immediately
    const version = versiones.value.find(v => v.id === versionId);
    if (version) {
      version.nombre = newName;
    }

    showNotification('Nombre de versión actualizado correctamente.', 'success');
    cancelEditingName();
  } catch (error) {
    console.error('Error updating version name:', error);
    showNotification('Error al actualizar el nombre: ' + error.message, 'error');
  }
};

// Handle clicking outside to cancel edit
const handleClickOutside = (event) => {
  if (editingVersionId.value === null) {
    return; // Not editing, nothing to do
  }

  // Check if click target is the pencil button itself
  const pencilButton = event.target.closest('button[title="Editar nombre"]');
  if (pencilButton) {
    return; // Ignore clicks on the pencil button
  }

  const editContainer = document.querySelector('.version-name-edit-container');
  if (editContainer && !editContainer.contains(event.target)) {
    cancelEditingName();
  }
};

onMounted(() => {
  fetchVersions();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="p-8">
    <div v-if="loading">Cargando versiones...</div>
    <div v-else-if="centro">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-4xl font-bold text-slate-800">Versiones del Plano</h1>
          <p class="text-xl text-slate-600 mt-2">{{ centro.nombre }}</p>
        </div>
        <router-link to="/centros" class="px-4 py-2 font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700">
          Volver a Centros
        </router-link>
      </div>

      <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 mb-8 max-w-3xl mx-auto">
        <h2 class="text-2xl font-bold text-slate-800 mb-4">Crear Nueva Versión</h2>
        <p class="text-slate-500 mb-4">
          Crea una nueva versión para modificar el plano, añadir o quitar salas y puntos. Se copiará la configuración de la última versión activa.
        </p>
        <form @submit.prevent="createNewVersion" class="flex flex-col sm:flex-row gap-4">
          <input 
            v-model="newVersionName" 
            type="text" 
            placeholder="Ej: Reforma Almacén 2026" 
            required
            class="flex-1 block w-full rounded-md border-slate-300 shadow-sm"
          >
          <button 
            type="submit"
            class="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm"
          >
            <PlusIcon class="h-5 w-5" />
            Crear Versión
          </button>
        </form>
      </div>

      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <ul class="divide-y divide-slate-200">
          <li v-if="versiones.length === 0" class="p-8 text-center text-slate-500">
            No se han encontrado versiones para este centro. Crea la primera.
          </li>
          <li v-for="version in versiones" :key="version.id" class="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div class="md:col-span-1">
              <!-- Editable version name -->
              <div class="flex items-center gap-2 group version-name-edit-container">
                <!-- Edit mode -->
                <div v-if="editingVersionId === version.id" class="flex items-center gap-1 flex-1">
                  <input
                    :data-version-id="version.id"
                    v-model="tempVersionName"
                    type="text"
                    @keyup.enter="saveVersionName(version.id)"
                    @keyup.esc="cancelEditingName"
                    class="font-semibold text-slate-800 text-lg px-2 py-1 border-2 border-blue-400 rounded-md focus:ring-2 focus:ring-blue-400 focus:outline-none flex-1"
                    maxlength="100"
                  />
                  <button
                    @mousedown.prevent="saveVersionName(version.id)"
                    class="p-1.5 text-green-600 hover:bg-green-100 rounded-md transition-colors"
                    title="Guardar"
                  >
                    <CheckIcon class="h-5 w-5" />
                  </button>
                </div>

                <!-- View mode -->
                <div v-else class="flex items-center gap-2 flex-1">
                  <p class="font-semibold text-slate-800 text-lg">{{ version.nombre }}</p>
                  <button
                    @click="startEditingName(version)"
                    class="p-1 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Editar nombre"
                  >
                    <PencilIcon class="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p class="text-sm text-slate-500">Creada: {{ new Date(version.fecha_creacion).toLocaleDateString() }}</p>
            </div>
            <div class="md:col-span-1">
              <span v-if="version.es_activa" class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <CheckCircleIcon class="h-4 w-4" />
                Versión Activa
              </span>
              <span v-else class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                <ArchiveBoxIcon class="h-4 w-4" />
                Archivada
              </span>
            </div>
            <div class="md:col-span-2 flex justify-end items-center gap-2">
              <router-link :to="`/versiones/${version.id}/configurar`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">
                <PencilIcon class="h-4 w-4" />
                Configurar Plano
              </router-link>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>