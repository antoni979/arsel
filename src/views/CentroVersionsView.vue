<!-- src/views/CentroVersionsView.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import { PlusIcon, PencilIcon, CheckCircleIcon, ArchiveBoxIcon } from '@heroicons/vue/24/solid';

const route = useRoute();
const router = useRouter();
const centroId = route.params.id;

const loading = ref(true);
const centro = ref(null);
const versiones = ref([]);
const newVersionName = ref('');

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

onMounted(fetchVersions);
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
              <p class="font-semibold text-slate-800 text-lg">{{ version.nombre }}</p>
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