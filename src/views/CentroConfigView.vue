<!-- src/views/CentroConfigView.vue -->
<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { supabase } from '../supabase';
import InteractiveMap from '../components/InteractiveMap.vue';
import { ArrowPathIcon, ArrowUpTrayIcon, PlusIcon, TrashIcon, MapIcon, XCircleIcon, PencilIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/vue/24/solid';
import NomenclatureModal from '../components/NomenclatureModal.vue';
import EditSalaModal from '../components/EditSalaModal.vue';

const route = useRoute();
const router = useRouter();
const versionId = route.params.id;

const loading = ref(true);
const version = ref(null);
const centro = ref(null);
const puntos = ref([]);
const salas = ref([]);
const activeSalaId = ref(null);
const newSalaName = ref('');
const fileInput = ref(null);

const isDrawingMode = ref(false);
const isPointEditingMode = ref(false);
const isSavingArea = ref(false);
const channel = ref(null);
const activeSala = computed(() => salas.value.find(s => s.id === activeSalaId.value));

const isNomenclatureModalOpen = ref(false);
const newPointCoords = ref(null);

const isEditSalaModalOpen = ref(false);
const salaToEdit = ref(null);
const salaEditPermission = ref({ canEdit: false, usageCount: 0 });

const existingIdentifiersInActiveSala = computed(() => {
    if (!activeSalaId.value) return [];
    return puntos.value
        .filter(p => p.sala_id === activeSalaId.value)
        .map(p => p.nomenclatura.split('-').pop() || '');
});

// --- INICIO DE LA CORRECCIÓN: Lógica de sugerencia de número robusta ---
const suggestedNextNumber = computed(() => {
    if (!activeSalaId.value) return 1;

    // 1. Filtramos los identificadores para quedarnos solo con aquellos
    //    que son representaciones de números enteros puros.
    const numericIdentifiers = existingIdentifiersInActiveSala.value
        .filter(id => {
            const num = parseInt(id, 10);
            // La condición clave: un identificador es puramente numérico si al convertirlo a número
            // y luego de vuelta a string, es idéntico al original.
            // "1" -> parseInt -> 1 -> String -> "1". ('1' === '1') -> true.
            // "1,2" -> parseInt -> 1 -> String -> "1". ('1' === '1,2') -> false.
            // "Picking" -> parseInt -> NaN. -> false.
            return !isNaN(num) && String(num) === id;
        })
        // 2. Convertimos los strings validados a números reales.
        .map(id => parseInt(id, 10));

    if (numericIdentifiers.length === 0) return 1;

    // 3. El resto de la lógica para encontrar el siguiente número disponible funciona perfectamente.
    const sortedNumbers = [...numericIdentifiers].sort((a, b) => a - b);
    
    for (let i = 0; i < sortedNumbers.length; i++) {
        if (sortedNumbers[i] !== i + 1) {
            return i + 1;
        }
    }
    return sortedNumbers.length + 1;
});
// --- FIN DE LA CORRECCIÓN ---


const instructionText = computed(() => {
    if (isDrawingMode.value) {
        const salaName = activeSala.value?.nombre || 'la sala';
        return `Definiendo área para "${salaName}": Haz clic para añadir puntos. Haz clic en el primer punto para cerrar la forma.`;
    }
    if (isPointEditingMode.value) {
        const salaName = activeSala.value?.nombre || 'NINGUNA';
        return `Modo Edición de Puntos: Haz clic en el plano para añadir puntos en la sala "${salaName.toUpperCase()}".`;
    }
    return null;
});

onMounted(async () => {
  loading.value = true;
  const { data: versionData } = await supabase.from('versiones_plano').select('*, centros(*)').eq('id', versionId).single();
  if (!versionData) {
    alert("Error: No se pudo cargar la versión del plano o no existe.");
    loading.value = false; return;
  }
  version.value = versionData;
  centro.value = versionData.centros;
  const [salasRes, puntosRes] = await Promise.all([
      supabase.from('salas').select('*').eq('version_id', versionId).order('nombre'),
      supabase.from('puntos_maestros').select('*').eq('version_id', versionId)
  ]);
  salas.value = salasRes.data || [];
  puntos.value = puntosRes.data || [];
  if (salas.value.length > 0 && !activeSalaId.value) {
      activeSalaId.value = salas.value[0].id;
  }
  loading.value = false;

  // Suscripción en tiempo real
  channel.value = supabase.channel(`version-${versionId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'salas', filter: `version_id=eq.${versionId}` }, (payload) => {
      if (payload.eventType === 'INSERT') {
        salas.value.push(payload.new);
        salas.value.sort((a, b) => a.nombre.localeCompare(b.nombre));
      } else if (payload.eventType === 'UPDATE') {
        const index = salas.value.findIndex(s => s.id === payload.new.id);
        if (index !== -1) salas.value[index] = payload.new;
      } else if (payload.eventType === 'DELETE') {
        salas.value = salas.value.filter(s => s.id !== payload.old.id);
        if (activeSalaId.value === payload.old.id) {
          activeSalaId.value = salas.value.length > 0 ? salas.value[0].id : null;
        }
      }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'puntos_maestros', filter: `version_id=eq.${versionId}` }, (payload) => {
      if (payload.eventType === 'INSERT') {
        puntos.value.push(payload.new);
      } else if (payload.eventType === 'UPDATE') {
        const index = puntos.value.findIndex(p => p.id === payload.new.id);
        if (index !== -1) puntos.value[index] = payload.new;
      } else if (payload.eventType === 'DELETE') {
        puntos.value = puntos.value.filter(p => p.id !== payload.old.id);
      }
    })
    .subscribe();
});

onUnmounted(() => {
  if (channel.value) {
    channel.value.unsubscribe();
  }
});

const togglePointEditingMode = () => {
    if (!isPointEditingMode.value && !activeSalaId.value) {
        alert('Por favor, selecciona primero una sala para empezar a editar sus puntos.');
        return;
    }
    isPointEditingMode.value = !isPointEditingMode.value;
    isDrawingMode.value = false;
};

const cancelAllModes = () => {
    isDrawingMode.value = false;
    isPointEditingMode.value = false;
};

const onFileSelected = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileName = `planos/centro_${centro.value.id}/version_${versionId}/${Date.now()}_${file.name}`;
    
    const { error: uploadError } = await supabase.storage.from('planos-clientes').upload(fileName, file, { upsert: true });
    if (uploadError) {
      alert("Error al subir el plano: " + uploadError.message);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('planos-clientes').getPublicUrl(fileName);
    const { error: updateError } = await supabase.from('versiones_plano').update({ url_imagen_plano: publicUrl }).eq('id', versionId);
    if(updateError) {
        alert("Error al guardar la URL del plano: " + updateError.message);
    } else {
        version.value.url_imagen_plano = publicUrl;
        alert("Plano actualizado correctamente.");
    }
};


const enterDrawingMode = () => {
  if (!activeSalaId.value) { 
    alert("Selecciona una sala para poder definir su área."); 
    return; 
  }
  isDrawingMode.value = true;
  isPointEditingMode.value = false;
};

const handleAreaDrawn = async (points) => {
    console.log('Area drawn for sala', activeSalaId.value, 'points:', points);
    if (!activeSalaId.value) return;
    isSavingArea.value = true;
    try {
        console.log('Updating sala', activeSalaId.value, 'with points', points);
        const { error } = await supabase.from('salas').update({ area_puntos: points }).eq('id', activeSalaId.value);
        if (error) throw error;
        console.log('Area saved successfully');
        const sala = salas.value.find(s => s.id === activeSalaId.value);
        if (sala) sala.area_puntos = points;
        isDrawingMode.value = false;
    } catch (error) {
        console.error('Error saving area:', error);
        alert('Error al guardar el área: ' + error.message);
    } finally {
        isSavingArea.value = false;
    }
};

const clearArea = async () => {
    if (!activeSalaId.value) return;
    const { error } = await supabase.from('salas').update({ area_puntos: null }).eq('id', activeSalaId.value);
    if (error) {
        alert('Error al limpiar el área: ' + error.message);
    } else {
        const sala = salas.value.find(s => s.id === activeSalaId.value);
        if (sala) sala.area_puntos = null;
    }
};


const handleMapClick = (coords) => {
  if (isPointEditingMode.value) {
    newPointCoords.value = coords;
    isNomenclatureModalOpen.value = true;
  }
};

const handleSaveNomenclature = async (pointIdentifier) => {
  isNomenclatureModalOpen.value = false;
  const coords = newPointCoords.value;
  if (!coords || !activeSalaId.value) return;

  const sala = salas.value.find(s => s.id === activeSalaId.value);
  const newNomenclature = `${sala.nombre}-${pointIdentifier}`;

  const { data, error } = await supabase.from('puntos_maestros').insert({ 
    version_id: versionId, 
    sala_id: activeSalaId.value, 
    nomenclatura: newNomenclature, 
    coordenada_x: coords.x, 
    coordenada_y: coords.y
  }).select().single();
  
  if (data) {
    puntos.value.push(data);
  } else if (error) {
    alert(error.message);
  }
  newPointCoords.value = null;
};

const handleDeletePoint = async (point) => {
    if (confirm(`¿Estás seguro de que quieres borrar el punto "${point.nomenclatura}" de este plano?`)) {
        // Check if point is referenced in any inspections
        const { count, error: checkError } = await supabase
            .from('puntos_inspeccionados')
            .select('*', { count: 'exact', head: true })
            .eq('punto_maestro_id', point.id);

        if (checkError) {
            alert('Error al verificar el punto: ' + checkError.message);
            return;
        }

        if (count > 0) {
            alert(`No se puede borrar el punto "${point.nomenclatura}" porque ha sido usado en ${count} inspección(es). Los puntos con datos históricos no pueden eliminarse.`);
            return;
        }

        // Proceed with deletion if no references found
        const { error } = await supabase.from('puntos_maestros').delete().eq('id', point.id);
        if (error) {
            alert('Error al borrar el punto: ' + error.message);
        } else {
            puntos.value = puntos.value.filter(p => p.id !== point.id);
        }
    }
};

const addSala = async () => {
  const name = newSalaName.value.trim();
  if (!name) {
    alert('El nombre de la sala no puede estar vacío.');
    return;
  }
  
  const nameExists = salas.value.some(s => s.nombre.toLowerCase() === name.toLowerCase());
  if (nameExists) {
    alert(`La sala "${name}" ya existe en esta versión del plano.`);
    return;
  }

  const { data: newSala, error } = await supabase
    .from('salas')
    .insert({
      version_id: versionId,
      nombre: name,
      color: '#CCCCCC' // Un color gris por defecto
    })
    .select()
    .single();

  if (error) {
    alert('Error al crear la nueva sala: ' + error.message);
  } else {
    salas.value.push(newSala);
    salas.value.sort((a, b) => a.nombre.localeCompare(b.nombre)); // Mantener el orden alfabético
    newSalaName.value = ''; // Limpiar el input
  }
};

const deleteSala = async (salaId) => {
  const sala = salas.value.find(s => s.id === salaId);
  if (!sala) return;
  
  const puntosEnSala = puntos.value.filter(p => p.sala_id === salaId).length;
  if (puntosEnSala > 0) {
    alert(`No se puede borrar la sala "${sala.nombre}" porque contiene ${puntosEnSala} puntos. Bórralos primero.`);
    return;
  }

  if (confirm(`¿Estás seguro de que quieres borrar la sala "${sala.nombre}"? Esta acción no se puede deshacer.`)) {
    const { error } = await supabase.from('salas').delete().eq('id', salaId);

    if (error) {
      alert('Error al borrar la sala: ' + error.message);
    } else {
      salas.value = salas.value.filter(s => s.id !== salaId);
      if (activeSalaId.value === salaId) {
        activeSalaId.value = salas.value.length > 0 ? salas.value[0].id : null;
      }
    }
  }
};

const handleUpdatePosition = async (point) => {
  const { error } = await supabase
    .from('puntos_maestros')
    .update({ 
        coordenada_x: point.coordenada_x, 
        coordenada_y: point.coordenada_y 
    })
    .eq('id', point.id);

  if (error) {
    alert('Error al actualizar la posición del punto: ' + error.message);
    // Opcional: recargar los datos para revertir el cambio visual
    // fetchData(); 
  }
};

const saveSalaColor = async (sala) => {
  await supabase.from('salas').update({ color: sala.color }).eq('id', sala.id);
};

const checkIfSalaCanBeEdited = async (salaId) => {
  // Get all puntos_maestros for the sala
  const { data: puntosMaestrosIds, error: puntosError } = await supabase
    .from('puntos_maestros')
    .select('id')
    .eq('sala_id', salaId);

  if (puntosError) {
    console.error('Error checking puntos_maestros:', puntosError);
    return { canEdit: false, usageCount: 0 };
  }

  // If no puntos_maestros exist, sala can be edited
  if (!puntosMaestrosIds || puntosMaestrosIds.length === 0) {
    return { canEdit: true, usageCount: 0 };
  }

  // Check if any punto_maestro is referenced in puntos_inspeccionados
  const { count, error: countError } = await supabase
    .from('puntos_inspeccionados')
    .select('id', { count: 'exact', head: true })
    .in('punto_maestro_id', puntosMaestrosIds.map(p => p.id));

  if (countError) {
    console.error('Error checking puntos_inspeccionados:', countError);
    return { canEdit: false, usageCount: 0 };
  }

  return {
    canEdit: count === 0,
    usageCount: count || 0
  };
};

const handleEditSala = async (sala) => {
  salaToEdit.value = sala;
  salaEditPermission.value = await checkIfSalaCanBeEdited(sala.id);
  isEditSalaModalOpen.value = true;
};

const handleSaveSalaName = async (newName) => {
  if (!salaToEdit.value) return;

  try {
    const { error } = await supabase
      .from('salas')
      .update({ nombre: newName })
      .eq('id', salaToEdit.value.id);

    if (error) {
      alert('Error al actualizar el nombre de la sala: ' + error.message);
    } else {
      // Update local state
      const sala = salas.value.find(s => s.id === salaToEdit.value.id);
      if (sala) {
        sala.nombre = newName;
      }

      // Update puntos nomenclatura for this sala
      const puntosInSala = puntos.value.filter(p => p.sala_id === salaToEdit.value.id);
      for (const punto of puntosInSala) {
        const identifier = punto.nomenclatura.split('-').pop();
        const newNomenclature = `${newName}-${identifier}`;

        const { error: updateError } = await supabase
          .from('puntos_maestros')
          .update({ nomenclatura: newNomenclature })
          .eq('id', punto.id);

        if (!updateError) {
          punto.nomenclatura = newNomenclature;
        }
      }

      // Close modal and reset
      isEditSalaModalOpen.value = false;
      salaToEdit.value = null;
      salaEditPermission.value = { canEdit: false, usageCount: 0 };

      alert(`Sala renombrada exitosamente a "${newName}".`);
    }
  } catch (err) {
    console.error('Error updating sala name:', err);
    alert('Error inesperado al actualizar el nombre de la sala.');
  }
};
</script>


<template>
  <div class="p-4 sm:p-8 h-full flex flex-col">
    <input type="file" @change="onFileSelected" accept="image/*" class="hidden" ref="fileInput">
    <div v-if="loading" class="flex justify-center items-center h-full">Cargando...</div>
    <div v-else-if="centro && version" class="flex-1 flex flex-col">
      <div v-if="version.url_imagen_plano" class="flex-1 flex flex-col">
        <div class="flex-shrink-0 flex justify-between items-start mb-6 gap-4">
          <div>
            <h1 class="text-3xl font-bold text-slate-800">Configurar: {{ centro.nombre }}</h1>
            <p class="text-slate-600 mt-2">
              Editando versión: <strong class="text-blue-600">{{ version.nombre }}</strong> 
              <span v-if="version.es_activa" class="ml-2 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">ACTIVA</span>
              <span v-else class="ml-2 text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">ARCHIVADA</span>
            </p>
          </div>
          <div class="flex gap-2 flex-shrink-0">
             <button @click="fileInput.click()" class="flex items-center gap-2 px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                <ArrowPathIcon class="h-5 w-5" /> Cambiar Plano
             </button>
             <button v-if="isDrawingMode || isPointEditingMode" @click="cancelAllModes" class="flex items-center gap-2 px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
                <XCircleIcon class="h-5 w-5" /> Cancelar
             </button>
            <button @click="router.push(`/centros/${centro.id}/versiones`)" class="px-4 py-2 font-semibold text-white bg-slate-600 rounded-md hover:bg-slate-700">Volver a Versiones</button>
          </div>
        </div>
        
        <div class="flex-grow h-full grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div class="lg:col-span-1 lg:sticky lg:top-8 self-start bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-slate-800">Salas</h2>
                <button 
                    @click="togglePointEditingMode" 
                    :disabled="salas.length === 0"
                    :class="[
                        'flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white rounded-md transition-colors',
                        'disabled:bg-slate-400 disabled:cursor-not-allowed',
                        isPointEditingMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                    ]">
                    <component :is="isPointEditingMode ? CheckCircleIcon : PencilIcon" class="h-4 w-4" />
                    {{ isPointEditingMode ? 'Finalizar Edición' : 'Gestionar Puntos' }}
                </button>
            </div>
            <ul class="space-y-2">
              <li v-for="sala in salas" :key="sala.id">
                <div @click="activeSalaId = sala.id" :class="['w-full p-3 rounded-lg transition-colors flex justify-between items-center group cursor-pointer', activeSalaId === sala.id ? 'bg-blue-100 ring-2 ring-blue-300' : 'hover:bg-slate-100']">
                  <div class="flex items-center gap-3">
                    <input type="color" v-model="sala.color" @input="saveSalaColor(sala)" class="w-6 h-6 p-0 border-none rounded-md cursor-pointer flex-shrink-0">
                    <span class="font-semibold" :class="{'text-blue-800': activeSalaId === sala.id}">{{ sala.nombre }}</span>
                  </div>
                  <button
                    @click.stop="handleEditSala(sala)"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Editar nombre de la sala">
                    <PencilIcon class="h-4 w-4 text-slate-500 hover:text-blue-600" />
                  </button>
                </div>
                <div v-if="activeSalaId === sala.id" class="pl-10 pt-1 pb-2 flex items-center space-x-4">
                    <button @click="enterDrawingMode" :disabled="isPointEditingMode || isSavingArea" class="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 disabled:text-slate-400 disabled:cursor-not-allowed">
                       <MapIcon class="h-4 w-4" /> <span>Definir Área</span>
                     </button>
                     <button v-if="sala.area_puntos" @click="clearArea" :disabled="isPointEditingMode || isSavingArea" class="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 disabled:text-slate-400 disabled:cursor-not-allowed">
                        <XCircleIcon class="h-4 w-4" /> <span>Limpiar</span>
                     </button>
                     <button @click="deleteSala(sala.id)" :disabled="isPointEditingMode || isSavingArea" class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-600 disabled:text-slate-400 disabled:cursor-not-allowed">
                        <TrashIcon class="h-4 w-4" /> <span>Borrar</span>
                     </button>
                 </div>
              </li>
            </ul>
            <form @submit.prevent="addSala" class="mt-4 flex-shrink-0 flex gap-2">
              <input v-model="newSalaName" type="text" placeholder="Nueva sala..." class="flex-1 block w-full rounded-md border-slate-300 shadow-sm text-sm">
              <button type="submit" class="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                <PlusIcon class="h-5 w-5" />
              </button>
            </form>
          </div>
          
          <div class="lg:col-span-3 relative">
            <div v-if="instructionText" class="bg-blue-600 text-white text-sm font-semibold py-2 px-4 flex items-center gap-2 mb-4">
              <InformationCircleIcon class="h-5 w-5 flex-shrink-0" />
              <span>{{ instructionText }}</span>
            </div>
            <InteractiveMap
              class="h-full"
              :image-url="version.url_imagen_plano"
              :points="puntos"
              :salas="salas"
              :is-read-only="!isPointEditingMode && !isDrawingMode"
              :is-placement-mode="isPointEditingMode"
              :is-area-drawing-mode="isDrawingMode"
              @add-point="handleMapClick"
              @delete-point="handleDeletePoint"
              @update-point-position="handleUpdatePosition"
              @area-drawn="handleAreaDrawn"
              @drawing-cancelled="cancelAllModes"
            />
          </div>
        </div>
      </div>
      
      <div v-else class="flex-1 flex flex-col items-center justify-center">
         <div class="max-w-3xl mx-auto text-center">
          <h1 class="text-3xl font-bold text-slate-800">Se necesita un plano para esta versión</h1>
          <p class="text-slate-600 mt-4 text-lg">La versión <strong class="text-blue-600">{{ version.nombre }}</strong> no tiene un plano asignado.</p>
        </div>
        <div class="mt-8 max-w-lg w-full mx-auto bg-white p-8 rounded-lg shadow-md border">
          <button @click="fileInput.click()" class="w-full flex flex-col items-center justify-center gap-4 p-6 border-2 border-dashed border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            <ArrowUpTrayIcon class="h-10 w-10 text-slate-400" />
            <span class="text-slate-500 font-medium">Haz clic aquí para seleccionar un archivo</span>
          </button>
        </div>
        <div class="text-center mt-8">
          <button @click="router.push(`/centros/${centro.id}/versiones`)" class="font-semibold text-slate-600 hover:text-slate-800">Volver a Versiones</button>
        </div>
      </div>
    </div>

    <NomenclatureModal
      :is-open="isNomenclatureModalOpen"
      :sala-nombre="activeSala?.nombre"
      :suggested-number="suggestedNextNumber"
      :existing-identifiers="existingIdentifiersInActiveSala"
      @close="isNomenclatureModalOpen = false"
      @save="handleSaveNomenclature"
    />

    <EditSalaModal
      :is-open="isEditSalaModalOpen"
      :sala="salaToEdit"
      :all-salas="salas"
      :can-edit="salaEditPermission.canEdit"
      :usage-count="salaEditPermission.usageCount"
      @close="isEditSalaModalOpen = false"
      @save="handleSaveSalaName"
    />
  </div>
</template>