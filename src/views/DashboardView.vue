<!-- src/views/DashboardView.vue -->

<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'

const router = useRouter()
const centros = ref([])
const loading = ref(true)

const getCentros = async () => {
  try {
    loading.value = true
    const { data, error } = await supabase
      .from('centros')
      .select('*')

    if (error) throw error
    centros.value = data
  } catch (error) {
    alert(error.message)
  } finally {
    loading.value = false
  }
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  router.push('/')
}

onMounted(() => {
  getCentros()
})
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <h1 class="text-3xl font-bold text-gray-900">
          Seleccionar Centro
        </h1>
        <button @click="handleLogout" class="px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
          Cerrar Sesión
        </button>
      </div>
    </header>
    <main>
      <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div class="space-y-4">
          <div v-if="loading" class="text-center text-gray-500">
            Cargando centros...
          </div>
          
          <div 
            v-else-if="centros.length > 0" 
            v-for="centro in centros" 
            :key="centro.id"
            class="bg-white shadow-md rounded-lg p-4 flex justify-between items-center"
          >
            <span class="text-lg font-medium text-gray-800">{{ centro.nombre }}</span>
            
            <!-- --- ESTE ES EL CAMBIO PRINCIPAL --- -->
            <router-link 
              :to="'/inspeccion/' + centro.id" 
              class="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Realizar Inspección
            </router-link>

          </div>

          <div v-else class="text-center text-gray-500 bg-white p-8 rounded-lg shadow-md">
            No hay centros registrados. Añade uno desde el panel de Supabase.
          </div>
        </div>
      </div>
    </main>
  </div>
</template>