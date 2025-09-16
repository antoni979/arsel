<!-- src/layouts/DefaultLayout.vue -->
<script setup>
import { ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { HomeIcon, ListBulletIcon, DocumentMagnifyingGlassIcon, Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline';
import { supabase } from '../supabase';
import { useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const isSidebarOpen = ref(false);

const navigation = [
  { name: 'Menú Principal', href: '/dashboard', icon: HomeIcon },
  { name: 'Maestro de Centros', href: '/centros', icon: ListBulletIcon },
  { name: 'Inspecciones', href: '/inspecciones', icon: DocumentMagnifyingGlassIcon },
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
    <!-- ===== INICIO DE CAMBIOS: Barra Lateral Adaptable ===== -->
    <!-- Overlay para móvil -->
    <div v-if="isSidebarOpen" @click="isSidebarOpen = false" class="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"></div>

    <!-- Barra Lateral -->
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
      <div class="p-4 border-t border-slate-700">
        <button @click="handleLogout" class="w-full px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
          Cerrar Sesión
        </button>
      </div>
    </aside>
    <!-- ===== FIN DE CAMBIOS: Barra Lateral Adaptable ===== -->

    <!-- Contenido Principal -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- ===== INICIO DE CAMBIOS: Barra Superior para Móvil ===== -->
      <header class="md:hidden h-16 bg-white shadow-sm flex items-center justify-between px-4 flex-shrink-0">
        <button @click="isSidebarOpen = true" class="text-slate-600">
          <Bars3Icon class="h-6 w-6" />
        </button>
        <h2 class="text-lg font-bold text-slate-800">{{ route.name }}</h2>
        <div class="w-6"></div> <!-- Espaciador -->
      </header>
      <!-- ===== FIN DE CAMBIOS: Barra Superior para Móvil ===== -->
      
      <main class="flex-1 overflow-y-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>