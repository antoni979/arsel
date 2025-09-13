<!-- src/layouts/DefaultLayout.vue -->
<script setup>
import { RouterLink, useRoute } from 'vue-router';
import { HomeIcon, ListBulletIcon, DocumentMagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { supabase } from '../supabase';
import { useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

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
  <div class="flex h-screen bg-slate-100">
    <!-- Barra Lateral Oscura -->
    <aside class="w-64 flex-shrink-0 bg-slate-800 flex flex-col">
      <div class="h-20 flex items-center justify-center">
        <h1 class="text-2xl font-bold text-white tracking-wider">Arsel</h1>
      </div>
      <nav class="flex-1 px-4 py-2 space-y-2">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
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

    <!-- Contenido Principal -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <main class="flex-1 overflow-hidden">
        <!-- 
          Este es el punto de montaje para el contenido de la página 
          (Dashboard, CentrosList, etc.) cuando se usa el layout por defecto.
        -->
        <router-view />
      </main>
    </div>
  </div>
</template>