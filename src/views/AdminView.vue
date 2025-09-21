<!-- src/views/AdminView.vue -->
<script setup>
import { ref, onMounted, inject, computed } from 'vue';
import { supabase } from '../supabase';
import { checklistItems } from '../utils/checklist';

const showNotification = inject('showNotification');
const defaults = ref([]);
const customFields = ref([]);
const loading = ref(true);
const saving = ref(false);

// Modal states
const showPointModal = ref(false);
const showFieldModal = ref(false);
const editingField = ref(null);
const selectedPoint = ref(null);
const currentPointId = ref(null);
const fieldForm = ref({
  field_name: '',
  field_type: 'text',
  required: false,
  options: []
});

const gravedadOptions = [
  { label: 'Verde', value: 'verde' },
  { label: 'Ambar', value: 'ambar' },
  { label: 'Rojo', value: 'rojo' },
];

const fieldTypes = [
  { label: 'Texto', value: 'text' },
  { label: 'Selección Múltiple', value: 'select' },
  { label: 'Número', value: 'number' }
];

const pointsWithFields = computed(() => {
  const fieldsMap = new Map();
  customFields.value.forEach(field => {
    if (!fieldsMap.has(field.point_id)) fieldsMap.set(field.point_id, []);
    fieldsMap.get(field.point_id).push(field);
  });

  return defaults.value.map(point => ({
    ...point,
    fields: fieldsMap.get(point.id) || []
  }));
});

const loadData = async () => {
  loading.value = true;
  const [defaultsRes, fieldsRes] = await Promise.all([
    supabase.from('checklist_defaults').select('*').order('point_id'),
    supabase.from('checklist_custom_fields').select('*').order('point_id, id')
  ]);

  if (defaultsRes.error) {
    showNotification('Error al cargar gravedades: ' + defaultsRes.error.message, 'error');
  } else {
    const defaultsMap = new Map(defaultsRes.data.map(d => [d.point_id, d]));
    defaults.value = checklistItems.map(item => ({
      ...item,
      default_severity: defaultsMap.get(item.id)?.default_severity || 'ambar'
    }));
  }

  if (fieldsRes.error) {
    showNotification('Error al cargar campos personalizados: ' + fieldsRes.error.message, 'error');
  } else {
    customFields.value = fieldsRes.data;
  }

  loading.value = false;
};

const saveDefaults = async () => {
  saving.value = true;
  const updates = defaults.value.map(item => ({
    point_id: item.id,
    default_severity: item.default_severity
  }));

  const { error } = await supabase
    .from('checklist_defaults')
    .upsert(updates, { onConflict: 'point_id' });

  if (error) {
    showNotification('Error al guardar gravedades: ' + error.message, 'error');
  } else {
    showNotification('Gravedades guardadas correctamente.', 'success');
    // Update selectedPoint if modal is open
    if (selectedPoint.value) {
      const updated = defaults.value.find(d => d.id === selectedPoint.value.id);
      if (updated) selectedPoint.value.default_severity = updated.default_severity;
    }
  }
  saving.value = false;
};

const openPointModal = (point) => {
  selectedPoint.value = { ...point };
  showPointModal.value = true;
};

const closePointModal = () => {
  showPointModal.value = false;
  selectedPoint.value = null;
};

const openFieldModal = (pointId, field = null) => {
  currentPointId.value = pointId;
  editingField.value = field;
  if (field) {
    fieldForm.value = { ...field };
  } else {
    fieldForm.value = { field_name: '', field_type: 'text', required: false, options: [] };
  }
  showFieldModal.value = true;
};

const closeFieldModal = () => {
  showFieldModal.value = false;
  editingField.value = null;
  currentPointId.value = null;
};

const saveField = async () => {
  if (!fieldForm.value.field_name.trim()) {
    showNotification('El nombre del campo es obligatorio.', 'warning');
    return;
  }

  const fieldData = {
    point_id: currentPointId.value,
    ...fieldForm.value,
    options: fieldForm.value.field_type === 'select' ? fieldForm.value.options : []
  };

  const { error } = editingField.value
    ? await supabase.from('checklist_custom_fields').update(fieldData).eq('id', editingField.value.id)
    : await supabase.from('checklist_custom_fields').insert(fieldData);

  if (error) {
    showNotification('Error al guardar campo: ' + error.message, 'error');
  } else {
    showNotification('Campo guardado correctamente.', 'success');
    await loadData();
    // Update selectedPoint fields
    if (selectedPoint.value) {
      selectedPoint.value.fields = customFields.value.filter(f => f.point_id === selectedPoint.value.id);
    }
    closeFieldModal();
  }
};

const deleteField = async (fieldId) => {
  const { error } = await supabase.from('checklist_custom_fields').delete().eq('id', fieldId);
  if (error) {
    showNotification('Error al eliminar campo: ' + error.message, 'error');
  } else {
    showNotification('Campo eliminado.', 'success');
    await loadData();
    // Update selectedPoint fields
    if (selectedPoint.value) {
      selectedPoint.value.fields = customFields.value.filter(f => f.point_id === selectedPoint.value.id);
    }
  }
};

const addOption = () => {
  fieldForm.value.options.push('');
};

const removeOption = (index) => {
  fieldForm.value.options.splice(index, 1);
};

onMounted(loadData);
</script>

<template>
  <div class="p-8">
    <h1 class="text-4xl font-bold text-slate-800 mb-8">Administración de Checklist</h1>

    <div v-if="loading" class="text-center p-10">Cargando configuraciones...</div>
    <div v-else>
      <!-- Cuadrícula de Puntos del Checklist -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
        <div
          v-for="point in pointsWithFields"
          :key="point.id"
          @click="openPointModal(point)"
          class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                   :class="{
                     'bg-green-500': point.default_severity === 'verde',
                     'bg-amber-500': point.default_severity === 'ambar',
                     'bg-red-500': point.default_severity === 'rojo'
                   }">
                {{ point.id }}
              </div>
              <div>
                <h3 class="font-semibold text-slate-800">{{ point.id }}</h3>
                <p class="text-sm text-slate-600">{{ point.fields.length }} campos</p>
              </div>
            </div>
            <div class="text-right">
              <p class="text-xs text-slate-500">Gravedad</p>
              <p class="font-medium" :class="{
                'text-green-600': point.default_severity === 'verde',
                'text-amber-600': point.default_severity === 'ambar',
                'text-red-600': point.default_severity === 'rojo'
              }">
                {{ gravedadOptions.find(o => o.value === point.default_severity)?.label }}
              </p>
            </div>
          </div>
          <p class="text-sm text-slate-700 line-clamp-2">{{ point.text }}</p>
        </div>
      </div>

      <!-- Botón de Guardar -->
      <div class="text-center">
        <button
          @click="saveDefaults"
          :disabled="saving"
          class="px-8 py-3 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-slate-400"
        >
          {{ saving ? 'Guardando...' : 'Guardar Todos los Cambios' }}
        </button>
      </div>
    </div>

    <!-- Modal para gestionar punto -->
    <div v-if="showPointModal" @click.self="closePointModal" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold text-slate-800">
              Punto {{ selectedPoint?.id }}: {{ selectedPoint?.text }}
            </h3>
            <button @click="closePointModal" class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
          </div>

          <!-- Gravedad Predeterminada -->
          <div class="mb-6">
            <h4 class="text-lg font-semibold text-slate-800 mb-3">Gravedad Predeterminada</h4>
            <select
              v-model="selectedPoint.default_severity"
              class="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option v-for="opt in gravedadOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Campos Personalizados -->
          <div>
            <div class="flex justify-between items-center mb-4">
              <h4 class="text-lg font-semibold text-slate-800">Campos Personalizados</h4>
              <button
                @click="openFieldModal(selectedPoint.id)"
                class="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Agregar Campo
              </button>
            </div>

            <div v-if="selectedPoint.fields.length === 0" class="text-slate-500 text-sm p-4 bg-slate-50 rounded-md">
              No hay campos personalizados configurados para este punto.
            </div>
            <div v-else class="space-y-3">
              <div v-for="field in selectedPoint.fields" :key="field.id" class="flex justify-between items-center p-4 bg-slate-50 rounded-md">
                <div>
                  <p class="font-medium text-slate-800">{{ field.field_name }}</p>
                  <p class="text-sm text-slate-600">
                    {{ fieldTypes.find(t => t.value === field.field_type)?.label }}
                    {{ field.required ? '(Obligatorio)' : '(Opcional)' }}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button @click="openFieldModal(selectedPoint.id, field)" class="px-3 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded">Editar</button>
                  <button @click="deleteField(field.id)" class="px-3 py-1 text-sm text-red-600 hover:bg-red-100 rounded">Eliminar</button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-3 mt-6 pt-6 border-t">
            <button @click="closePointModal" class="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200">Cerrar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal para editar campos -->
    <div v-if="showFieldModal" @click.self="closeFieldModal" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div class="p-6">
          <h3 class="text-lg font-bold text-slate-800 mb-4">{{ editingField ? 'Editar Campo' : 'Nuevo Campo' }}</h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Nombre del Campo</label>
              <input
                v-model="fieldForm.field_name"
                type="text"
                class="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Ej: Bastidor, Larguero..."
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Tipo de Campo</label>
              <select
                v-model="fieldForm.field_type"
                class="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option v-for="type in fieldTypes" :key="type.value" :value="type.value">
                  {{ type.label }}
                </option>
              </select>
            </div>

            <div v-if="fieldForm.field_type === 'select'" class="space-y-2">
              <label class="block text-sm font-medium text-slate-700">Opciones</label>
              <div v-for="(option, index) in fieldForm.options" :key="index" class="flex gap-2">
                <input
                  v-model="fieldForm.options[index]"
                  type="text"
                  class="flex-1 rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Opción..."
                >
                <button @click="removeOption(index)" class="px-2 py-1 text-red-600 hover:bg-red-100 rounded">×</button>
              </div>
              <button @click="addOption" class="text-sm text-blue-600 hover:underline">+ Agregar Opción</button>
            </div>

            <div class="flex items-center">
              <input
                v-model="fieldForm.required"
                type="checkbox"
                class="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              >
              <label class="ml-2 text-sm text-slate-700">Campo obligatorio</label>
            </div>
          </div>

          <div class="flex justify-end gap-3 mt-6">
            <button @click="closeFieldModal" class="px-4 py-2 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200">Cancelar</button>
            <button @click="saveField" class="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>