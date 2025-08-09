<!-- src/views/InspeccionesListView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../supabase';

const router = useRouter();
const centros = ref([]);
const loading = ref(true); // Para la carga inicial de centros
const isStarting = ref(false); // Para la acción de comenzar una inspección
const searchTerm = ref('');
const tecnicoNombre = ref('');

// Propiedad computada para filtrar los centros en tiempo real según la búsqueda
const filteredCentros = computed(() => {
  if (!searchTerm.value) {
    return centros.value;
  }
  return centros.value.filter(centro =>
    centro.nombre.toLowerCase().includes(searchTerm.value.toLowerCase())
  );
});

// Función que se ejecuta al hacer clic en un centro de la lista
const startInspection = async (centroId) => {
  if (!tecnicoNombre.value.trim()) {
    alert('Por favor, introduce el nombre del técnico para continuar.');
    return;
  }
  isStarting.value = true;

  // 1. Buscar una inspección 'en_progreso' para este centro
  let { data: inspection, error: findError } = await supabase
    .from('inspecciones')
    .select('id')
    .eq('centro_id', centroId)
    .eq('estado', 'en_progreso')
    .maybeSingle();

  if (findError) {
    alert('Error buscando inspección: ' + findError.message);
    isStarting.value = false;
    return;
  }

  // 2. Si no existe, crear una nueva con los datos del técnico y la fecha
  if (!inspection) {
    const { data: newInspection, error: createError } = await supabase
      .from('inspecciones')
      .insert({ 
        centro_id: centroId, 
        estado: 'en_progreso',
        tecnico_nombre: tecnicoNombre.value.trim(),
        fecha_inspeccion: new Date().toISOString().slice(0, 10) // Fecha de hoy
      })
      .select('id')
      .single();
    
    if (createError) {
      alert('Error creando inspección: ' + createError.message);
      isStarting.value = false;
      return;
    }
    inspection = newInspection;
  } else {
    // Si ya existía, actualizamos los datos por si ha cambiado el técnico o el día
    await supabase.from('inspecciones').update({ 
      tecnico_nombre: tecnicoNombre.value.trim(),
      fecha_inspeccion: new Date().toISOString().slice(0, 10)
    }).eq('id', inspection.id);
  }

  // 3. Navegar a la página de detalle de la inspección
  router.push(`/inspecciones/${inspection.id}`);
};

// Carga inicial de todos los centros
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
      
      <!-- Paso 1: Nombre del Técnico -->
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

      <!-- Paso 2: Buscador y Lista de Centros -->
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
      
      <!-- Lista de Resultados -->
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