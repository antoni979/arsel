<!-- src/views/DashboardView.vue -->
<script setup>
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'

const router = useRouter()

const handleLogout = async () => {
  await supabase.auth.signOut()
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <h1 class="text-3xl font-bold text-gray-900">Menú Principal</h1>
        <button @click="handleLogout" class="px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
          Cerrar Sesión
        </button>
      </div>
    </header>
    <main>
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Tarjeta para ir a Centros -->
          <router-link to="/centros" class="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <h2 class="text-2xl font-bold text-gray-800">Maestro de Centros</h2>
            <p class="text-gray-600 mt-2">Configurar los centros y definir los puntos de inspección en el plano.</p>
          </router-link>

          <!-- Tarjeta para ir a Inspecciones -->
          <router-link to="/inspecciones" class="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <h2 class="text-2xl font-bold text-gray-800">Inspecciones</h2>
            <p class="text-gray-600 mt-2">Iniciar o continuar una inspección basada en una plantilla de centro.</p>
          </router-link>
        </div>
      </div>
    </main>
  </div>
</template>