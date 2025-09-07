<!-- src/views/CentrosListView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { supabase } from '../supabase';
import { PlusIcon, PencilIcon, MapPinIcon, ArchiveBoxIcon, DocumentDuplicateIcon } from '@heroicons/vue/24/solid';
import CentroFormModal from '../components/CentroFormModal.vue';

const centros = ref([]);
const loading = ref(true);
const isModalOpen = ref(false);
const selectedCentro = ref(null);
const filterZona = ref('');

const zonas = ['Norte', 'Sur', 'Este', 'Oeste', 'Centro', 'Noreste', 'Noroeste', 'Sureste', 'Islas Baleares', 'Islas Canarias'];

const filteredCentros = computed(() => {
  if (!filterZona.value) return centros.value;
  return centros.value.filter(c => c.zona === filterZona.value);
});

const openCreateModal = () => {
  selectedCentro.value = null;
  isModalOpen.value = true;
};

const openEditModal = (centro) => {
  selectedCentro.value = centro;
  isModalOpen.value = true;
};

const handleSaveCentro = async (centroData) => {
  const dataToSave = { ...centroData };
  let error;
  if (dataToSave.id) {
    const { error: updateError } = await supabase.from('centros').update(dataToSave).eq('id', dataToSave.id);
    error = updateError;
  } else {
    delete dataToSave.id;
    const { error: insertError } = await supabase.from('centros').insert(dataToSave);
    error = insertError;
  }
  if (error) alert(error.message);
  else {
    isModalOpen.value = false;
    fetchCentros();
  }
};

const fetchCentros = async () => {
  loading.value = true;
  const { data } = await supabase.from('centros').select('*').order('nombre');
  if (data) centros.value = data;
  loading.value = false;
};

onMounted(fetchCentros);
</script>

<template>
  <div class="p-8">
    <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
      <h1 class="text-4xl font-bold text-slate-800">Maestro de Centros</h1>
      <div class="flex items-center gap-4">
        <select v-model="filterZona" class="rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm">
          <option value="">Todas las Zonas</option>
          <option v-for="z in zonas" :key="z" :value="z">{{ z }}</option>
        </select>
        <button @click="openCreateModal" class="flex items-center gap-2 px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm">
          <PlusIcon class="h-5 w-5" />
          Agregar Centro
        </button>
      </div>
    </div>
    
    <div v-if="loading" class="text-center text-slate-500">Cargando...</div>
    <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="min-w-full">
        <div class="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div class="col-span-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro / Dirección</div>
          <div class="col-span-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsable</div>
          <div class="col-span-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Zona</div>
          <div class="col-span-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</div>
        </div>

        <ul class="divide-y divide-slate-200">
          <li v-for="centro in filteredCentros" :key="centro.id" class="px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div class="col-span-1 md:col-span-4">
              <p class="text-lg font-bold text-slate-900">{{ centro.nombre }}</p>
              <p class="text-sm text-slate-500">{{ centro.direccion }}</p>
            </div>
            <div class="col-span-1 md:col-span-3">
              <p class="text-sm font-medium text-slate-800">{{ centro.responsable_nombre }}</p>
              <p class="text-sm text-slate-500">{{ centro.responsable_email }}</p>
            </div>
            <div class="col-span-1 md:col-span-2">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                {{ centro.zona }}
              </span>
            </div>
            <div class="col-span-1 md:col-span-3 flex justify-end items-center flex-wrap gap-2">
              <button @click="openEditModal(centro)" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                <PencilIcon class="h-4 w-4" />
                Editar
              </button>
              <router-link :to="`/centros/${centro.id}/historial`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                <ArchiveBoxIcon class="h-4 w-4" />
                Historial
              </router-link>
              <!-- === CAMBIO: El botón ahora apunta a la nueva vista de versiones === -->
              <router-link :to="`/centros/${centro.id}/versiones`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">
                <DocumentDuplicateIcon class="h-4 w-4" />
                Planos
              </router-link>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <CentroFormModal :is-open="isModalOpen" :centro="selectedCentro" @close="isModalOpen = false" @save="handleSaveCentro" />
  </div>
</template>