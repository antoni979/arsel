<!-- src/components/CentroFormModal.vue -->
<script setup>
import { ref, watch, onMounted } from 'vue';
import { supabase } from '../supabase';
import { ArrowUpTrayIcon } from '@heroicons/vue/24/outline';
import { TrashIcon } from '@heroicons/vue/24/solid';

const props = defineProps({
  isOpen: Boolean,
  centro: Object,
});

const emit = defineEmits(['close', 'save', 'delete']);

const form = ref({});
const isUploadingLogo = ref(false);
const logoInput = ref(null);
const zonas = ref([]);
const provincias = ref([]); // <-- Ahora es reactivo
const selectedLogoFile = ref(null); // Archivo seleccionado antes de guardar
const previewLogoUrl = ref(null); // URL de preview temporal

onMounted(async () => {
  // Cargar las listas desde Supabase cuando el componente se monta
  const { data: zonasData } = await supabase.from('zonas').select('nombre').order('nombre');
  if (zonasData) zonas.value = zonasData.map(z => z.nombre);
  
  // Asumimos que tienes una tabla `provincias` similar, si no, la creamos.
  // Por ahora, lo mantenemos simple. Si no hay tabla, podemos volver a la lista local.
  // const { data: provinciasData } = await supabase.from('provincias').select('nombre').order('nombre');
  // if (provinciasData) provincias.value = provinciasData.map(p => p.nombre);
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = props.centro ? { ...props.centro } : { nombre: '', direccion: '', responsable_nombre: '', responsable_email: '', provincia: '', zona: '', url_logo_cliente: null };
    // Limpiar archivo y preview al abrir el modal
    selectedLogoFile.value = null;
    if (previewLogoUrl.value) {
      URL.revokeObjectURL(previewLogoUrl.value);
      previewLogoUrl.value = null;
    }
  }
});

const handleLogoSelected = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Si el centro ya existe (modo edición), subir directamente
  if (form.value.id) {
    isUploadingLogo.value = true;
    const fileName = `cliente_${form.value.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('logos-clientes').upload(fileName, file);
    if (uploadError) {
      alert("Error al subir el logo: " + uploadError.message);
      isUploadingLogo.value = false;
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('logos-clientes').getPublicUrl(fileName);
    const { error: updateError } = await supabase.from('centros').update({ url_logo_cliente: publicUrl }).eq('id', form.value.id);
    if (updateError) {
      alert("Error al guardar la URL del logo: " + updateError.message);
    } else {
      form.value.url_logo_cliente = publicUrl;
    }
    isUploadingLogo.value = false;
  } else {
    // Si es un centro nuevo, guardar el archivo para subirlo después
    selectedLogoFile.value = file;
    // Limpiar preview anterior si existe
    if (previewLogoUrl.value) {
      URL.revokeObjectURL(previewLogoUrl.value);
    }
    // Crear preview temporal
    previewLogoUrl.value = URL.createObjectURL(file);
  }
};

const handleSubmit = () => {
  // Incluir el archivo del logo si fue seleccionado
  const dataToSave = { ...form.value };
  if (selectedLogoFile.value) {
    dataToSave._logoFile = selectedLogoFile.value;
  }
  emit('save', dataToSave);
};

const handleDelete = () => {
  if (form.value.id) {
    emit('delete', form.value.id);
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
      <div class="p-6 border-b">
        <h2 class="text-2xl font-bold text-slate-800">{{ centro ? 'Editar Centro' : 'Agregar Nuevo Centro' }}</h2>
      </div>
      <form @submit.prevent="handleSubmit">
        <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="md:col-span-2">
              <label for="nombre" class="block text-sm font-medium text-slate-600">Nombre del Centro</label>
              <input v-model="form.nombre" type="text" id="nombre" required class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            </div>
            <div class="md:col-span-2">
              <label for="direccion" class="block text-sm font-medium text-slate-600">Dirección</label>
              <input v-model="form.direccion" type="text" id="direccion" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            </div>
            <div>
              <label for="responsable_nombre" class="block text-sm font-medium text-slate-600">Nombre del Responsable</label>
              <input v-model="form.responsable_nombre" type="text" id="responsable_nombre" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            </div>
            <div>
              <label for="responsable_email" class="block text-sm font-medium text-slate-600">Email del Responsable</label>
              <input v-model="form.responsable_email" type="email" id="responsable_email" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            </div>
            <div>
              <label for="provincia" class="block text-sm font-medium text-slate-600">Provincia</label>
              <input v-model="form.provincia" type="text" id="provincia" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            </div>
            <div>
              <label for="zona" class="block text-sm font-medium text-slate-600">Zona</label>
              <select v-model="form.zona" id="zona" class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option disabled value="">Selecciona una zona</option>
                <option v-for="z in zonas" :key="z" :value="z">{{ z }}</option>
              </select>
            </div>
          </div>
          
          <div class="md:col-span-1">
             <input type="file" ref="logoInput" @change="handleLogoSelected" accept="image/*" class="hidden">
             <label class="block text-sm font-medium text-slate-600 mb-1">Logo del Cliente</label>
             <div class="aspect-video bg-slate-100 rounded-md flex items-center justify-center border-2 border-dashed">
                <img v-if="previewLogoUrl || form.url_logo_cliente" :src="previewLogoUrl || form.url_logo_cliente" class="object-contain w-full h-full p-2">
                <div v-else class="text-center text-slate-500 p-4">Sin logo</div>
             </div>
             <button
                type="button"
                @click="logoInput.click()"
                :disabled="isUploadingLogo"
                class="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors
                       disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed
                       text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
              >
               <ArrowUpTrayIcon class="h-4 w-4" />
               {{ isUploadingLogo ? 'Subiendo...' : ((previewLogoUrl || form.url_logo_cliente) ? 'Cambiar Logo' : 'Subir Logo') }}
             </button>
             <p v-if="!form.id && selectedLogoFile" class="text-xs text-green-600 mt-1 text-center">Logo seleccionado. Se subirá al guardar.</p>
          </div>
        </div>
        <div class="p-6 bg-slate-50 border-t flex justify-between items-center">
          <button
            v-if="centro"
            type="button"
            @click="handleDelete"
            class="flex items-center gap-2 px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700"
          >
            <TrashIcon class="h-4 w-4" />
            Eliminar Centro
          </button>
          <div v-else></div>
          <div class="flex space-x-4">
            <button type="button" @click="$emit('close')" class="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancelar</button>
            <button type="submit" class="px-4 py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Guardar Cambios</button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>