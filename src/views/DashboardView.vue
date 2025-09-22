<!-- src/views/DashboardView.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue';
import { supabase } from '../supabase';
import { useRouter } from 'vue-router';
import { 
  BuildingStorefrontIcon, 
  ClockIcon,
  PaperAirplaneIcon,
  CheckBadgeIcon,
  ArchiveBoxIcon
} from '@heroicons/vue/24/outline';
import { Line } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale } from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale);

const loading = ref(true);
const centros = ref([]);
const resumenInspecciones = ref([]);
const router = useRouter();

// Modal states
const showModal = ref(false);
const selectedStatus = ref(null);

const statusLabels = {
  centros: 'Centros',
  en_progreso: 'En Progreso',
  pendientes_envio: 'Pendientes de Envío',
  pendientes_cierre: 'Pendientes de Cierre',
  cerradas: 'Cerradas'
};

// ===== INICIO DE LA CORRECCIÓN: Función robusta para parsear fechas =====
function parseDate(dateString) {
  if (!dateString) return null;
  // Añadimos 'T00:00:00' para asegurar que se interprete como la medianoche en la zona horaria local,
  // evitando problemas de desplazamiento de un día.
  return new Date(`${dateString}T00:00:00`);
}
// ===== FIN DE LA CORRECCIÓN =====


onMounted(async () => {
  loading.value = true;
  const [centrosRes, resumenRes] = await Promise.all([
    supabase.from('centros').select('id, nombre'),
    supabase.from('vista_resumen_inspecciones').select('*')
  ]);
  
  centros.value = centrosRes.data || [];
  
  // ===== INICIO DE LA CORRECCIÓN: Procesamos las fechas al recibir los datos =====
  if (resumenRes.data) {
    resumenInspecciones.value = resumenRes.data.map(inspeccion => ({
      ...inspeccion,
      fecha_inspeccion_obj: parseDate(inspeccion.fecha_inspeccion),
      fecha_envio_cliente_obj: parseDate(inspeccion.fecha_envio_cliente),
    }));
  } else {
    resumenInspecciones.value = [];
  }
  // ===== FIN DE LA CORRECCIÓN =====
  
  loading.value = false;
});

const totalCentros = computed(() => centros.value.length);
const inspeccionesEnProgreso = computed(() => resumenInspecciones.value.filter(i => i.estado === 'en_progreso').length);
const inspeccionesPendientesEnvio = computed(() => resumenInspecciones.value.filter(i => i.estado === 'finalizada').length);
const inspeccionesPendientesCierre = computed(() => resumenInspecciones.value.filter(i => i.estado === 'pendiente_subsanacion').length);
const inspeccionesCerradas = computed(() => resumenInspecciones.value.filter(i => i.estado === 'cerrada').length);


const actividadMensual = computed(() => {
    const meses = {};
    const hoy = new Date();
    
    for (let i = 11; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // 'YYYY-MM'
        const etiqueta = d.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
        meses[clave] = { etiqueta, iniciales: 0, cierres: 0 };
    }
    
    // ===== INICIO DE LA CORRECCIÓN: Usamos las fechas ya procesadas =====
    resumenInspecciones.value.forEach(inspeccion => {
        if (inspeccion.fecha_inspeccion_obj) {
            const fecha = inspeccion.fecha_inspeccion_obj;
            const claveMesInicial = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
            if (meses[claveMesInicial]) {
                meses[claveMesInicial].iniciales++;
            }
        }
        
        if (inspeccion.estado === 'cerrada' && inspeccion.fecha_envio_cliente_obj) {
             const fecha = inspeccion.fecha_envio_cliente_obj;
             const claveMesCierre = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
             if (meses[claveMesCierre]) {
                meses[claveMesCierre].cierres++;
            }
        }
    });
    // ===== FIN DE LA CORRECCIÓN =====
    
    return Object.values(meses);
});

const monthlyChartData = computed(() => ({
  labels: actividadMensual.value.map(m => m.etiqueta),
  datasets: [
    { 
      label: 'Informes Iniciales', 
      backgroundColor: '#3B82F6', 
      borderColor: '#3B82F6', 
      data: actividadMensual.value.map(m => m.iniciales), 
      tension: 0.2 
    },
    { 
      label: 'Informes de Cierre', 
      backgroundColor: '#22C55E', 
      borderColor: '#22C55E', 
      data: actividadMensual.value.map(m => m.cierres), 
      tension: 0.2 
    }
  ]
}));

const monthlyChartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: 'top' } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
};

const centrosConMasRojas = computed(() => {
  const centrosConteo = {};
  resumenInspecciones.value.filter(i => i.incidencias_rojas > 0 && i.estado !== 'cerrada').forEach(i => {
    if (!centrosConteo[i.centro_id]) centrosConteo[i.centro_id] = { id: i.centro_id, nombre: i.centro_nombre, rojas: 0 };
    centrosConteo[i.centro_id].rojas += i.incidencias_rojas;
  });
  return Object.values(centrosConteo).sort((a, b) => b.rojas - a.rojas).slice(0, 5);
});

const accionesPendientes = computed(() => {
    return resumenInspecciones.value
        .filter(i => i.estado === 'finalizada')
        // Usamos la fecha procesada para ordenar
        .sort((a, b) => a.fecha_inspeccion_obj - b.fecha_inspeccion_obj);
});

const modalItems = computed(() => {
  if (!selectedStatus.value) return [];
  return resumenInspecciones.value.filter(i => {
    switch(selectedStatus.value) {
      case 'en_progreso': return i.estado === 'en_progreso';
      case 'pendientes_envio': return i.estado === 'finalizada';
      case 'pendientes_cierre': return i.estado === 'pendiente_subsanacion';
      default: return false;
    }
  });
});

const openModal = (status) => {
  selectedStatus.value = status;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  selectedStatus.value = null;
};
</script>

<template>
  <div class="h-full overflow-y-auto p-4 sm:p-8 bg-slate-50">
    <h1 class="text-3xl md:text-4xl font-bold text-slate-800 mb-6">Cuadro de Mando</h1>
    
    <div v-if="loading" class="text-center text-slate-500 py-16">Cargando datos del dashboard...</div>
    
    <div v-else class="space-y-6">
      <section>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div class="bg-gradient-to-br from-white to-slate-50 p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
            <div class="bg-blue-100 p-3 rounded-lg"><BuildingStorefrontIcon class="h-6 w-6 text-blue-600" /></div>
            <div><p class="text-2xl font-bold text-slate-800">{{ totalCentros }}</p><p class="text-slate-500 text-sm font-semibold">Centros</p></div>
          </div>
          <div @click="openModal('en_progreso')" class="cursor-pointer bg-gradient-to-br from-white to-slate-50 p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div class="bg-yellow-100 p-3 rounded-lg"><ClockIcon class="h-6 w-6 text-yellow-600" /></div>
            <div><p class="text-2xl font-bold text-slate-800">{{ inspeccionesEnProgreso }}</p><p class="text-slate-500 text-sm font-semibold">En Progreso</p></div>
          </div>
          <div @click="openModal('pendientes_envio')" class="cursor-pointer bg-gradient-to-br from-white to-slate-50 p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div class="bg-purple-100 p-3 rounded-lg"><PaperAirplaneIcon class="h-6 w-6 text-purple-600" /></div>
            <div><p class="text-2xl font-bold text-slate-800">{{ inspeccionesPendientesEnvio }}</p><p class="text-slate-500 text-sm font-semibold">Pend. Envío</p></div>
          </div>
          <div @click="openModal('pendientes_cierre')" class="cursor-pointer bg-gradient-to-br from-white to-slate-50 p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div class="bg-orange-100 p-3 rounded-lg"><ArchiveBoxIcon class="h-6 w-6 text-orange-600" /></div>
            <div><p class="text-2xl font-bold text-slate-800">{{ inspeccionesPendientesCierre }}</p><p class="text-slate-500 text-sm font-semibold">Pend. Cierre</p></div>
          </div>
          <div class="col-span-2 md:col-span-1 lg:col-span-1 bg-gradient-to-br from-white to-slate-50 p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
            <div class="bg-green-100 p-3 rounded-lg"><CheckBadgeIcon class="h-6 w-6 text-green-600" /></div>
            <div><p class="text-2xl font-bold text-slate-800">{{ inspeccionesCerradas }}</p><p class="text-slate-500 text-sm font-semibold">Cerradas</p></div>
          </div>
        </div>
      </section>
      
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
           <h2 class="text-lg font-bold text-slate-800 mb-4">Actividad Mensual</h2>
           <div class="h-80">
              <Line :data="monthlyChartData" :options="monthlyChartOptions" />
           </div>
        </div>

        <div class="lg:col-span-1 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
          <h2 class="text-lg font-bold text-slate-800 mb-4 flex-shrink-0">Puntos Críticos Activos</h2>
          <ul v-if="centrosConMasRojas.length > 0" class="divide-y divide-slate-100">
            <li v-for="centro in centrosConMasRojas" :key="centro.id" class="py-3 flex justify-between items-center group">
              <div>
                <p class="font-semibold text-slate-800 group-hover:text-blue-600">{{ centro.nombre }}</p>
                <p class="text-sm text-slate-500 flex items-center"><span class="h-2.5 w-2.5 rounded-full bg-red-500 mr-2"></span><span class="font-bold text-red-600">{{ centro.rojas }}</span>&nbsp;incidencias graves</p>
              </div>
              <router-link :to="`/centros/${centro.id}/historial`" class="opacity-0 group-hover:opacity-100 px-3 py-1 text-sm font-semibold text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-opacity">Revisar</router-link>
            </li>
          </ul>
          <div v-else class="flex-1 flex flex-col items-center justify-center text-center text-slate-500 p-4">
            <span class="text-2xl mb-2">🎉</span><p class="font-semibold">¡Todo en orden!</p><p class="text-sm">No hay incidencias graves activas.</p>
          </div>
        </div>
      </section>

      <section class="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
        <h2 class="text-lg font-bold text-slate-800 mb-4">Acciones Pendientes (Enviar a Cliente)</h2>
         <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
             <thead class="bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Centro</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden sm:table-cell">Fecha Finalización</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Técnico</th>
                <th class="relative px-4 py-3"><span class="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-200">
              <tr v-if="accionesPendientes.length === 0">
                  <td colspan="4" class="px-4 py-8 text-center text-slate-500">No hay acciones pendientes. ¡Buen trabajo!</td>
              </tr>
              <tr v-for="inspeccion in accionesPendientes" :key="inspeccion.inspeccion_id" class="hover:bg-slate-50">
                <td class="px-4 py-4 whitespace-nowrap font-semibold text-slate-800 text-sm">
                  {{ inspeccion.centro_nombre }}
                  <div class="sm:hidden text-xs text-slate-500 font-normal">{{ inspeccion.fecha_inspeccion_obj.toLocaleDateString('es-ES') }}</div>
                </td>
                <td class="px-4 py-4 whitespace-nowrap text-slate-600 hidden sm:table-cell text-sm">{{ inspeccion.fecha_inspeccion_obj.toLocaleDateString('es-ES') }}</td>
                <td class="px-4 py-4 whitespace-nowrap text-slate-600 hidden md:table-cell text-sm">{{ inspeccion.tecnico_nombre }}</td>
                <td class="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <router-link :to="`/centros/${inspeccion.centro_id}/historial`" class="font-semibold text-purple-600 hover:text-purple-800">Gestionar</router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- Modal for status details -->
    <div v-if="showModal" @click.self="closeModal" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="text-xl font-bold text-slate-800">{{ statusLabels[selectedStatus] }}</h3>
            <button @click="closeModal" class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
          </div>

          <div>
            <div v-if="modalItems.length === 0" class="text-slate-500 text-center p-8">No hay inspecciones en este estado.</div>
            <div v-else class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200">
                <thead class="bg-slate-50">
                  <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Centro</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha Inspección</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">Técnico</th>
                    <th class="relative px-4 py-3"><span class="sr-only">Acción</span></th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-slate-200">
                  <tr v-for="inspeccion in modalItems" :key="inspeccion.inspeccion_id" class="hover:bg-slate-50">
                    <td class="px-4 py-4 whitespace-nowrap font-semibold text-slate-800 text-sm">{{ inspeccion.centro_nombre }}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-slate-600 text-sm">{{ inspeccion.fecha_inspeccion_obj.toLocaleDateString('es-ES') }}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-slate-600 hidden md:table-cell text-sm">{{ inspeccion.tecnico_nombre }}</td>
                    <td class="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <router-link :to="`/centros/${inspeccion.centro_id}/historial`" class="font-semibold text-blue-600 hover:text-blue-800">Ver Detalles</router-link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>