<!-- src/views/CentrosListView.vue -->
<script setup>
import { ref, onMounted } from 'vue';
import { supabase } from '../supabase';
import { useRouter } from 'vue-router';

const router = useRouter();
const centros = ref([]);
const loading = ref(true);

onMounted(async () => {
  loading.value = true;
  const { data } = await supabase.from('centros').select('*');
  if (data) centros.value = data;
  loading.value = false;
});
</script>

<template>
  <div class="p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold text-slate-800">Maestro de Centros</h1>
      <!-- Botón de Volver -->
      <button @click="router.push('/dashboard')" class="px-4 py-2 font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700">
        Volver al Menú
      </button>
    </div>
    <p class="text-slate-600 mb-8">
      Desde aquí puedes configurar los puntos de inspección para cada centro.
    </p>

    <div v-if="loading" class="text-center text-slate-500">Cargando...</div>
    <div v-else class="bg-white rounded-lg shadow-sm border border-slate-200">
      <ul>
        <li v-for="(centro, index) in centros" :key="centro.id" :class="['flex items-center justify-between p-4', { 'border-b border-slate-200': index < centros.length - 1 }]">
          <span class="text-lg font-medium text-slate-700">{{ centro.nombre }}</span>
          <router-link :to="`/centros/${centro.id}/configurar`" class="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
            Configurar Puntos
          </router-link>
        </li>
      </ul>
    </div>
  </div>
</template>