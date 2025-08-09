<!-- src/views/DashboardView.vue -->
<script setup>
import { BuildingStorefrontIcon, DocumentMagnifyingGlassIcon } from '@heroicons/vue/24/outline';
</script>

<template>
  <div class="p-8">
    <h1 class="text-4xl font-bold text-slate-800 mb-8">Menú Principal</h1>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- Tarjeta para Maestro de Centros -->
      <router-link to="/centros" class="group block bg-white p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow border border-slate-200">
        <div class="flex items-center gap-6">
          <div class="bg-blue-100 p-4 rounded-lg">
            <BuildingStorefrontIcon class="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 class="text-2xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Maestro de Centros</h2>
            <p class="text-slate-500 mt-1">Configurar los centros y definir los puntos de inspección en el plano.</p>
          </div>
        </div>
      </router-link>

      <!-- Tarjeta para Inspecciones -->
      <router-link to="/inspecciones" class="group block bg-white p-8 rounded-xl shadow-sm hover:shadow-lg transition-shadow border border-slate-200">
        <div class="flex items-center gap-6">
          <div class="bg-teal-100 p-4 rounded-lg">
            <DocumentMagnifyingGlassIcon class="h-8 w-8 text-teal-600" />
          </div>
          <div>
            <h2 class="text-2xl font-bold text-slate-800 group-hover:text-teal-600 transition-colors">Inspecciones</h2>
            <p class="text-slate-500 mt-1">Iniciar o continuar una inspección basada en una plantilla de centro.</p>
          </div>
        </div>
      </router-link>
    </div>
  </div>
</template>