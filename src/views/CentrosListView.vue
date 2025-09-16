<!-- src/views/CentrosListView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { supabase } from '../supabase';
// --- INICIO DE CAMBIOS: Importamos los nuevos iconos ---
import { 
  PlusIcon, 
  PencilIcon, 
  ArchiveBoxIcon, 
  DocumentDuplicateIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  DocumentChartBarIcon
} from '@heroicons/vue/24/solid';
import CentroFormModal from '../components/CentroFormModal.vue';

const centros = ref([]);
const loading = ref(true);
const isModalOpen = ref(false);
const selectedCentro = ref(null);
const filterZona = ref('');
// --- INICIO DE CAMBIOS: Añadimos una ref para el término de búsqueda ---
const searchTerm = ref('');

const zonas = ['Norte', 'Sur', 'Este', 'Oeste', 'Centro', 'Noreste', 'Noroeste', 'Sureste', 'Islas Baleares', 'Islas Canarias'];

// --- INICIO DE CAMBIOS: Actualizamos la lógica de filtrado ---
const filteredCentros = computed(() => {
  let results = centros.value;

  // Filtrar por zona
  if (filterZona.value) {
    results = results.filter(c => c.zona === filterZona.value);
  }

  // Filtrar por término de búsqueda
  if (searchTerm.value.trim()) {
    const searchLower = searchTerm.value.toLowerCase();
    results = results.filter(c => c.nombre.toLowerCase().includes(searchLower));
  }

  return results;
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
    await fetchCentros(); // Usamos await para asegurar que se recargan los datos
  }
};

// --- INICIO DE CAMBIOS: Modificamos la función para obtener y procesar los datos ---
const fetchCentros = async () => {
  loading.value = true;
  // Pedimos los centros y, anidadas, todas sus inspecciones (solo la fecha)
  const { data, error } = await supabase
    .from('centros')
    .select('*, inspecciones(fecha_inspeccion)')
    .order('nombre');

  if (error) {
    console.error("Error fetching centros:", error);
    centros.value = [];
    loading.value = false;
    return;
  }

  if (data) {
    // Procesamos los datos para añadir los campos que necesitamos
    centros.value = data.map(centro => {
      const inspecciones = centro.inspecciones || [];
      let ultima_revision = null;
      let proxima_revision = null;

      if (inspecciones.length > 0) {
        // Ordenamos para encontrar la más reciente
        const fechas = inspecciones.map(i => new Date(i.fecha_inspeccion)).sort((a, b) => b - a);
        const ultimaFecha = fechas[0];
        ultima_revision = ultimaFecha.toLocaleDateString('es-ES');
        
        // Calculamos la próxima revisión (1 año después)
        const proximaFecha = new Date(ultimaFecha);
        proximaFecha.setFullYear(proximaFecha.getFullYear() + 1);
        proxima_revision = proximaFecha.toLocaleDateString('es-ES');
      }

      return {
        ...centro,
        numero_informes: inspecciones.length,
        ultima_revision,
        proxima_revision
      };
    });
  }
  
  loading.value = false;
};
// --- FIN DE CAMBIOS ---

onMounted(fetchCentros);
</script>

<template>
  <div class="p-8">
    <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
      <h1 class="text-4xl font-bold text-slate-800">Maestro de Centros</h1>
      <div class="flex items-center gap-4 flex-wrap">
        <!-- INICIO DE CAMBIOS: Añadimos el campo de búsqueda -->
        <div class="relative">
          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon class="h-5 w-5 text-slate-400" />
          </div>
          <input 
            v-model="searchTerm"
            type="search"
            placeholder="Buscar por nombre..."
            class="block w-full rounded-md border-slate-300 py-2 pl-10 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
        </div>
        <!-- FIN DE CAMBIOS -->

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
        <!-- INICIO DE CAMBIOS: Ajustamos la cabecera de la tabla -->
        <div class="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div class="col-span-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro / Dirección</div>
          <div class="col-span-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Responsable</div>
          <div class="col-span-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estadísticas</div>
          <div class="col-span-1 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Zona</div>
          <div class="col-span-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</div>
        </div>
        <!-- FIN DE CAMBIOS -->

        <ul class="divide-y divide-slate-200">
           <li v-if="filteredCentros.length === 0" class="p-8 text-center text-slate-500">
            No se han encontrado centros que coincidan con la búsqueda.
          </li>
          <!-- INICIO DE CAMBIOS: Ajustamos el bucle y las columnas de cada centro -->
          <li v-for="centro in filteredCentros" :key="centro.id" class="px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div class="col-span-1 md:col-span-3">
              <p class="text-lg font-bold text-slate-900">{{ centro.nombre }}</p>
              <p class="text-sm text-slate-500">{{ centro.direccion }}</p>
            </div>
            <div class="col-span-1 md:col-span-2">
              <p class="text-sm font-medium text-slate-800">{{ centro.responsable_nombre }}</p>
              <p class="text-sm text-slate-500">{{ centro.responsable_email }}</p>
            </div>

            <!-- Columna de Estadísticas (NUEVA) -->
            <div class="col-span-1 md:col-span-3 text-sm text-slate-600 space-y-2">
              <div class="flex items-center gap-2">
                <DocumentChartBarIcon class="h-5 w-5 text-slate-400"/>
                <span>Informes: <span class="font-bold text-slate-800">{{ centro.numero_informes }}</span></span>
              </div>
              <div v-if="centro.ultima_revision" class="flex items-center gap-2">
                <CalendarDaysIcon class="h-5 w-5 text-slate-400" />
                <div>
                  Última: <span class="font-semibold text-slate-800">{{ centro.ultima_revision }}</span> <br>
                  Próxima: <span class="font-semibold text-blue-600">{{ centro.proxima_revision }}</span>
                </div>
              </div>
               <div v-else class="flex items-center gap-2 text-slate-400 italic">
                <span>(Sin inspecciones)</span>
              </div>
            </div>

            <div class="col-span-1 md:col-span-1">
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
              <router-link :to="`/centros/${centro.id}/versiones`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">
                <DocumentDuplicateIcon class="h-4 w-4" />
                Planos
              </router-link>
            </div>
          </li>
          <!-- FIN DE CAMBIOS -->
        </ul>
      </div>
    </div>

    <CentroFormModal :is-open="isModalOpen" :centro="selectedCentro" @close="isModalOpen = false" @save="handleSaveCentro" />
  </div>
</template>