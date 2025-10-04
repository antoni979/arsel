<!-- src/layouts/DefaultLayout.vue -->
<script setup>
import { ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
// --- INICIO DE LA CORRECCIÓN ---
// Ambos iconos, WifiIcon y SignalSlashIcon, están en el paquete 'outline'
import { 
  HomeIcon, 
  ListBulletIcon, 
  DocumentMagnifyingGlassIcon, 
  Cog6ToothIcon, 
  Bars3Icon, 
  TableCellsIcon, 
  WifiIcon, 
  SignalSlashIcon // <-- ESTE ES EL NOMBRE CORRECTO DEL ICONO
} from '@heroicons/vue/24/outline';
// --- FIN DE LA CORRECCIÓN ---
import { supabase } from '../supabase';
import { useRouter } from 'vue-router';
import SyncStatusIndicator from '../components/SyncStatusIndicator.vue';
import { useOnlineStatus } from '../composables/useOnlineStatus';

const { isOnline } = useOnlineStatus();

const route = useRoute();
const router = useRouter();
const isSidebarOpen = ref(false);

const navigation = [
  { name: 'Menú Principal', href: '/dashboard', icon: HomeIcon },
  { name: 'Gestión', href: '/gestion', icon: TableCellsIcon },
  { name: 'Maestro de Centros', href: '/centros', icon: ListBulletIcon },
  { name: 'Inspecciones', href: '/inspecciones', icon: DocumentMagnifyingGlassIcon },
  { name: 'Admin', href: '/admin', icon: Cog6ToothIcon },
];

const isActive = (href) => {
  return route.path === href || (href !== '/dashboard' && route.path.startsWith(href));
};

const handleLogout = async () => {
  await supabase.auth.signOut();
  router.push('/');
};
</script>
<template>
<div class="relative h-screen flex overflow-hidden bg-slate-100">
  <aside 
    :class="[
      'absolute inset-y-0 left-0 w-64 bg-slate-800 flex flex-col z-30 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0',
      isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <div class="h-16 flex-shrink-0 flex items-center justify-center">
      <h1 class="text-2xl font-bold text-white tracking-wider">Arsel</h1>
    </div>
    <nav class="flex-1 px-4 py-2 space-y-2">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          @click="isSidebarOpen = false"
          :class="[
            'flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors',
            isActive(item.href)
              ? 'bg-blue-600 text-white shadow-inner'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white',
          ]"
        >
          <component :is="item.icon" class="h-6 w-6 mr-3" />
          {{ item.name }}
        </RouterLink>
    </nav>
    
    <div class="px-4 py-2 border-t border-slate-700">
      <div 
        :class="['flex items-center justify-center gap-2 p-2 rounded-md text-xs font-bold', isOnline ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300']">
        <!-- --- INICIO DE LA CORRECCIÓN --- -->
        <component :is="isOnline ? WifiIcon : SignalSlashIcon" class="h-4 w-4" />
        <!-- --- FIN DE LA CORRECCIÓN --- -->
        <span>{{ isOnline ? 'Conectado' : 'Sin Conexión' }}</span>
      </div>
    </div>

    <div class="p-4 border-t border-slate-700">
      <button @click="handleLogout" class="w-full px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
        Cerrar Sesión
      </button>
    </div>
  </aside>

  <div class="flex-1 flex flex-col overflow-hidden">
      <header class="md:hidden h-16 bg-white shadow-sm flex items-center justify-between px-4 flex-shrink-0">
        <button @click="isSidebarOpen = true" class="text-slate-600">
          <Bars3Icon class="h-6 w-6" />
        </button>
        <h2 class="text-lg font-bold text-slate-800">{{ route.name }}</h2>
        <div class="w-6"></div> <!-- Espaciador -->
      </header>
      
      <main class="flex-1 overflow-y-auto">
        <router-view />
      </main>
    </div>
  </div>
  
  <SyncStatusIndicator />
</template>