<!-- src/views/InspeccionesListView.vue -->
<script setup>
import { ref, onMounted, computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../supabase';

const router = useRouter();
const showNotification = inject('showNotification');
const centros = ref([]);
const loading = ref(true);
const isStarting = ref(false);
const searchTerm = ref('');
const tecnicoNombre = ref('');
const fechaInspeccion = ref(new Date().toISOString().slice(0, 10));

const filteredCentros = computed(() => {
  if (!searchTerm.value) return centros.value;
  return centros.value.filter(centro =>
    centro.nombre.toLowerCase().includes(searchTerm.value.toLowerCase())
  );
});

// === INICIO DE LA LÓGICA CORREGIDA ===
const startInspection = async (centroId) => {
  if (!tecnicoNombre.value.trim()) {
    showNotification('Por favor, introduce el nombre del técnico para continuar.', 'warning');
    return;
  }
  if (!fechaInspeccion.value) {
    showNotification('Por favor, selecciona una fecha de inspección.', 'warning');
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (fechaInspeccion.value > today) {
    showNotification('La fecha de inspección no puede ser futura.', 'warning');
    return;
  }
  isStarting.value = true;

  // 1. Buscar la VERSIÓN ACTIVA para el centro seleccionado.
  const { data: activeVersion, error: versionError } = await supabase
    .from('versiones_plano')
    .select('id')
    .eq('centro_id', centroId)
    .eq('es_activa', true)
    .single();

  if (versionError || !activeVersion) {
    showNotification('Error: Este centro no tiene una versión de plano activa. Por favor, configúralo en el Maestro de Centros.', 'error');
    console.error("Error buscando versión activa:", versionError);
    isStarting.value = false;
    return;
  }
  const versionId = activeVersion.id;

  // 2. Buscar si ya existe una inspección en progreso para este centro
  let { data: inspection, error: findError } = await supabase
    .from('inspecciones')
    .select('id')
    .eq('centro_id', centroId)
    .eq('estado', 'en_progreso')
    .maybeSingle();

  if (findError) {
    showNotification('Error buscando inspección existente: ' + findError.message, 'error');
    isStarting.value = false;
    return;
  }

  // 3. Si no existe, crear una nueva asociándola a la versión activa
  if (!inspection) {
    const { data: newInspection, error: createError } = await supabase
      .from('inspecciones')
      .insert({
        centro_id: centroId,
        version_id: versionId, // <-- Guardamos la versión correcta
        estado: 'en_progreso',
        tecnico_nombre: tecnicoNombre.value.trim(),
        fecha_inspeccion: fechaInspeccion.value
      })
      .select('id')
      .single();

    if (createError) {
      showNotification('Error creando inspección: ' + createError.message, 'error');
      isStarting.value = false;
      return;
    }
    inspection = newInspection;
  } else {
    // Si ya existía, la actualizamos para asegurarnos de que usa la última versión activa
     await supabase.from('inspecciones').update({
       tecnico_nombre: tecnicoNombre.value.trim(),
       fecha_inspeccion: fechaInspeccion.value,
       version_id: versionId // <-- Actualizamos también la versión
     }).eq('id', inspection.id);
  }

  // 4. Navegar a la página de detalle
  router.push(`/inspecciones/${inspection.id}`);
};
// === FIN DE LA LÓGICA CORREGIDA ===

onMounted(async () => {
  loading.value = true;
  const { data } = await supabase.from('centros').select('id, nombre').order('nombre');
  if (data) centros.value = data;
  loading.value = false;
});
</script>

<template>
  <div class="p-8">
    <h1 class="text-4xl font-bold text-slate-800 mb-8">Iniciar Inspección</h1>
    <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-3xl mx-auto">
      
      <div class="mb-6">
        <label for="tecnico" class="block text-sm font-medium text-slate-700 mb-1">Nombre del Técnico</label>
        <input
          v-model="tecnicoNombre"
          id="tecnico"
          type="text"
          placeholder="Escribe tu nombre..."
          class="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
      </div>

      <div class="mb-6">
        <label for="fecha" class="block text-sm font-medium text-slate-700 mb-1">Fecha de Inspección</label>
        <input
          v-model="fechaInspeccion"
          id="fecha"
          type="date"
          class="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
      </div>

      <div>
        <label for="search" class="block text-sm font-medium text-slate-700 mb-1">Buscar y Seleccionar Centro</label>
        <input 
          v-model="searchTerm" 
          id="search" 
          type="search" 
          placeholder="Escribe para buscar un centro..." 
          class="block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        >
      </div>
      
      <div class="mt-4 max-h-60 overflow-y-auto border rounded-md">
        <div v-if="loading" class="p-4 text-center text-slate-500">Cargando centros...</div>
        <ul v-else-if="filteredCentros.length > 0">
          <li v-for="centro in filteredCentros" :key="centro.id" class="border-b last:border-b-0">
            <button 
              @click="startInspection(centro.id)" 
              :disabled="isStarting"
              class="w-full text-left p-4 hover:bg-blue-50 transition-colors disabled:bg-slate-100 disabled:cursor-wait"
            >
              {{ centro.nombre }}
            </button>
          </li>
        </ul>
        <div v-else class="p-4 text-center text-slate-500">No se encontraron centros.</div>
      </div>

    </div>
  </div>
</template>