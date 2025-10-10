<!-- src/views/CentrosListView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { supabase } from '../supabase';
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
import SkeletonLoader from '../components/SkeletonLoader.vue';

const centros = ref([]);
const loading = ref(true);
const isModalOpen = ref(false);
const selectedCentro = ref(null);
const filterZona = ref('');
const searchTerm = ref('');
const zonas = ref([]); // <-- Ahora es reactivo

const getZonaColor = (zona) => {
const colors = {
'Norte': 'bg-sky-100 text-sky-800', 'Levante Norte': 'bg-sky-100 text-sky-800', 'Noroeste': 'bg-sky-100 text-sky-800',
'Sur': 'bg-amber-100 text-amber-800', 'Levante Sur': 'bg-amber-100 text-amber-800', 'Suroeste': 'bg-amber-100 text-amber-800',
'Sureste': 'bg-orange-100 text-orange-800',
'Extremadura-Cord': 'bg-rose-100 text-rose-800',
'Madrid Oeste': 'bg-indigo-100 text-indigo-800', 'Madrid Este y Aragón': 'bg-indigo-100 text-indigo-800',
'Centro': 'bg-slate-100 text-slate-800',
'Cataluña Norte': 'bg-teal-100 text-teal-800', 'Cataluña Sur': 'bg-teal-100 text-teal-800',
'Castilla León': 'bg-lime-100 text-lime-800',
'Baleares-Canarias': 'bg-cyan-100 text-cyan-800',
};
return colors[zona] || 'bg-gray-100 text-gray-800';
};

const filteredCentros = computed(() => {
let results = centros.value;
if (filterZona.value) {
results = results.filter(c => c.zona === filterZona.value);
}
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

// ===== CAMBIO REALIZADO: Lógica de guardado simplificada y corregida =====
const handleSaveCentro = async (centroData) => {
// Copiamos los datos para no modificar el objeto original
const dataToSave = { ...centroData };

// --- INICIO DE LA CORRECCIÓN ---
// Estas propiedades son calculadas en el cliente y no existen en la tabla 'centros'.
// Debemos eliminarlas antes de intentar guardar los datos en Supabase para evitar el error.
delete dataToSave.numero_informes;
delete dataToSave.ultima_revision;

// Extraer el archivo del logo si existe (propiedad especial)
const logoFile = dataToSave._logoFile;
delete dataToSave._logoFile;
// --- FIN DE LA CORRECCIÓN ---

let error;
let centroId = dataToSave.id;

if (dataToSave.id) {
// --- LÓGICA DE ACTUALIZACIÓN ---
const { id, ...updateData } = dataToSave; // Separamos el id del resto de los datos
const { error: updateError } = await supabase
.from('centros')
.update(updateData)
.eq('id', id);
error = updateError;
} else {
// --- LÓGICA DE CREACIÓN ---
delete dataToSave.id; // Nos aseguramos de que no haya un id (aunque sea null)
const { data: insertData, error: insertError } = await supabase
.from('centros')
.insert(dataToSave)
.select()
.single();
error = insertError;

if (!error && insertData) {
centroId = insertData.id;

// Si hay un logo seleccionado, subirlo ahora que tenemos el ID
if (logoFile) {
const fileName = `cliente_${centroId}/${Date.now()}_${logoFile.name}`;
const { error: uploadError } = await supabase.storage
.from('logos-clientes')
.upload(fileName, logoFile);

if (!uploadError) {
const { data: { publicUrl } } = supabase.storage
.from('logos-clientes')
.getPublicUrl(fileName);

// Actualizar el centro con la URL del logo
await supabase.from('centros')
.update({ url_logo_cliente: publicUrl })
.eq('id', centroId);
}
}
}
}

if (error) {
alert(error.message);
} else {
isModalOpen.value = false;
await fetchCentros(); // Recargamos la lista para ver los cambios
}
};

const fetchCentros = async () => {
loading.value = true;
const { data, error } = await supabase
.from('centros')
.select('*, url_logo_cliente')
.order('nombre');

if (error) {
centros.value = [];
} else if(data) {
const centrosConInspecciones = await Promise.all(data.map(async (centro) => {
const { data: inspecciones, error: inspError } = await supabase
.from('inspecciones')
.select('fecha_inspeccion')
.eq('centro_id', centro.id);

let numero_informes = 0;
let ultima_revision = null;

if (!inspError && inspecciones && inspecciones.length > 0) {
numero_informes = inspecciones.length;
const fechas = inspecciones.map(i => new Date(i.fecha_inspeccion)).sort((a, b) => b - a);
ultima_revision = fechas[0].toLocaleDateString('es-ES');
}

return {
...centro,
numero_informes,
ultima_revision,
};
}));
centros.value = centrosConInspecciones;
}

const { data: zonasData } = await supabase.from('zonas').select('nombre').order('nombre');
if (zonasData) zonas.value = zonasData.map(z => z.nombre);

loading.value = false;
};

onMounted(fetchCentros);
</script>
<template>
<div class="p-4 md:p-8">
<div class="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
<h1 class="text-3xl md:text-4xl font-bold text-slate-800">Maestro de Centros</h1>
<div class="flex items-center gap-x-2 w-full md:w-auto">
<div class="relative flex-grow">
<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
<MagnifyingGlassIcon class="h-5 w-5 text-slate-400" />
</div>
<input
v-model="searchTerm"
type="search"
placeholder="Buscar..."
class="block w-full rounded-md border-slate-300 py-2 pl-10 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
>
</div>
<select v-model="filterZona" class="rounded-md border-slate-300 shadow-sm text-sm py-2">
<option value="">Todas las Zonas</option>
<option v-for="z in zonas" :key="z" :value="z">{{ z }}</option>
</select>
<button @click="openCreateModal" class="flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm flex-shrink-0">
<PlusIcon class="h-5 w-5" />
<span class="hidden sm:inline">Agregar Centro</span>
</button>
</div>
</div>
<div v-if="loading" class="space-y-4">
  <div v-for="i in 5" :key="i" class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-24">
    <SkeletonLoader />
  </div>
</div>

<div v-else class="space-y-4">
  <div v-if="filteredCentros.length === 0" class="p-8 text-center text-slate-500 bg-white rounded-xl shadow-sm border">
    No se han encontrado centros que coincidan con los filtros.
  </div>
  
  <div v-for="centro in filteredCentros" :key="centro.id" class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 transition-all hover:border-blue-400 hover:shadow-md">
    <div class="grid grid-cols-6 md:grid-cols-12 gap-y-4 md:gap-x-6 items-center">
      <div class="col-span-6 md:col-span-4 flex items-center gap-4">
        <div class="flex-shrink-0 w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden border">
          <img v-if="centro.url_logo_cliente" :src="centro.url_logo_cliente" class="object-contain h-full w-full" loading="lazy">
          <span v-else class="text-slate-400 text-xs font-semibold">Logo</span>
        </div>
        <div>
          <p class="text-lg font-bold text-slate-900">{{ centro.nombre }}</p>
          <p class="text-sm text-slate-500">{{ centro.direccion }}</p>
        </div>
      </div>
      
      <div class="col-span-3 md:col-span-3 text-sm text-slate-600 space-y-1">
         <div class="flex items-center gap-2">
            <DocumentChartBarIcon class="h-5 w-5 text-slate-400"/>
            <span>Informes: <span class="font-bold text-slate-800">{{ centro.numero_informes }}</span></span>
          </div>
          <div v-if="centro.ultima_revision" class="flex items-center gap-2">
            <CalendarDaysIcon class="h-5 w-5 text-slate-400" />
            <span>Última: <span class="font-semibold text-slate-800">{{ centro.ultima_revision }}</span></span>
          </div>
      </div>

      <div class="col-span-3 md:col-span-2">
        <span :class="['inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', getZonaColor(centro.zona)]">
          {{ centro.zona }}
        </span>
      </div>
      
      <div class="col-span-6 md:col-span-3 flex items-center justify-start md:justify-end flex-wrap gap-2">
        <button @click="openEditModal(centro)" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
          <PencilIcon class="h-4 w-4" /> Editar
        </button>
        <router-link :to="`/centros/${centro.id}/historial`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
          <ArchiveBoxIcon class="h-4 w-4" /> Historial
        </router-link>
        <router-link :to="`/centros/${centro.id}/versiones`" class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700">
          <DocumentDuplicateIcon class="h-4 w-4" /> Planos
        </router-link>
      </div>
    </div>
  </div>
</div>

<CentroFormModal :is-open="isModalOpen" :centro="selectedCentro" @close="isModalOpen = false" @save="handleSaveCentro" />
</div>
</template>