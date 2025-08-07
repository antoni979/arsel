<!-- src/components/Login.vue -->
<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router' // <-- AÑADIR ESTA LÍNEA

const router = useRouter() // <-- AÑADIR ESTA LÍNEA
const loading = ref(false)
const email = ref('')
const password = ref('')

const handleLogin = async () => {
  try {
    loading.value = true
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    if (error) throw error
    // alert('¡Login correcto!') // <-- BORRAMOS EL ALERT
    router.push('/dashboard') // <-- AÑADIMOS LA REDIRECCIÓN
  } catch (error) {
    alert(error.error_description || error.message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- Cambiamos los colores de fondo y texto principales -->
  <div class="flex items-center justify-center min-h-screen bg-gray-100 text-gray-800">
    <!-- El contenedor del formulario ahora es blanco con una sombra sutil -->
    <div class="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
      <h1 class="text-3xl font-bold text-center text-gray-900">Inspección de Estanterías</h1>
      <p class="text-center text-gray-600">Inicia sesión para continuar</p>
      <form @submit.prevent="handleLogin" class="space-y-6">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
          <!-- Los inputs ahora tienen un fondo más claro -->
          <input 
            id="email" 
            type="email" 
            v-model="email" 
            class="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label for="password" class="block text-sm font-medium text-gray-700">Contraseña</label>
          <input 
            id="password" 
            type="password" 
            v-model="password" 
            class="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <button 
            type="submit" 
            :disabled="loading" 
            class="w-full py-2 font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {{ loading ? 'Cargando...' : 'Acceder' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>