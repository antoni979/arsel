<!-- src/layouts/DefaultLayout.vue -->
<script setup>
import { RouterLink, useRoute } from 'vue-router';
import { HomeIcon, ListBulletIcon, DocumentTextIcon } from '@heroicons/vue/24/outline';

const route = useRoute();

const navigation = [
  { name: 'Menú Principal', href: '/dashboard', icon: HomeIcon },
  { name: 'Maestro de Centros', href: '/centros', icon: ListBulletIcon },
  // Añadiremos Inspecciones aquí después
  // { name: 'Inspecciones', href: '/inspecciones', icon: DocumentTextIcon },
];

const isActive = (href) => {
  return route.path === href || (href !== '/dashboard' && route.path.startsWith(href));
};
</script>

<template>
  <div class="flex h-screen bg-slate-100">
    <!-- Barra Lateral -->
    <aside class="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
      <div class="h-16 flex items-center justify-center border-b border-slate-200">
        <h1 class="text-xl font-bold text-slate-800">Arsel</h1>
      </div>
      <nav class="flex-1 p-4 space-y-2">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          :class="[
            'flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
            isActive(item.href)
              ? 'bg-blue-50 text-blue-600'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
          ]"
        >
          <component :is="item.icon" class="h-6 w-6 mr-3" />
          {{ item.name }}
        </RouterLink>
      </nav>
    </aside>

    <!-- Contenido Principal -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <main class="flex-1 overflow-y-auto">
        <router-view />
      </main>
    </div>
  </div>
</template>