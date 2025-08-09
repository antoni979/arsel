<!-- src/views/InspeccionesListView.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { supabase } from '../supabase';

const router = useRouter();
const centros = ref([]);
const selectedCentroId = ref(null);
const loading = ref(false);

onMounted(async () => {
  const { data } = await supabase.from('centros').select('id, nombre').order('nombre');
  if (data) centros.value = data;
});

const startInspection = async () => {
  if (!selectedCentroId.value) {
    alert('Por favor, selecciona un centro.');
    return;
  }
  loading.value = true;

  // 1. Buscar una inspección 'en_progreso' para este centro
  let { data: inspection, error: findError } = await supabase
    .from('inspecciones')
    .select('id')
    .eq('centro_id', selectedCentroId.value)
    .eq('estado', 'en_progreso')
    .maybeSingle(); // .maybeSingle() no da error si no encuentra nada

  if (findError) {
    alert('Error buscando inspección: ' + findError.message);
    loading.value = false;
    return;
  }

  // 2. Si no existe, crear una nueva
  if (!inspection) {
    const { data: newInspection, error: createError } = await supabase
      .from('inspecciones')
      .insert({ centro_id: selectedCentroId.value, estado: 'en_progreso' })
      .select('id')
      .single();
    
    if (createError) {
      alert('Error creando inspección: ' + createError.message);
      loading.value = false;
      return;
    }
    inspection = newInspection;
  }

  // 3. Navegar a la página de detalle de la inspección
  router.push(`/inspecciones/${inspection.id}`);
};
</script>

<template>
  <div class="p-8">
    <h1 class="text-4xl font-bold text-slate-800 mb-8">Inspecciones</h1>
    <div class="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
      <h2 class="text-2xl font-bold text-slate-800">Iniciar Nueva Inspección</h2>
      <p class="text-slate-500 mt-2 mb-6">Selecciona un centro para comenzar una nueva inspección o continuar una en progreso.</p>
      
      <div class="flex items-center gap-4">
        <select v-model="selectedCentroId" class="flex-grow rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
          <option :value="null" disabled>-- Selecciona un centro --</option>
          <option v-for="centro in centros" :key="centro.id" :value="centro.id">{{ centro.nombre }}</option>
        </select>
        <button @click="startInspection" :disabled="loading" class="px-6 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-400">
          {{ loading ? 'Cargando...' : 'Comenzar' }}
        </button>
      </div>
    </div>
  </div>
</template>