// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../supabase'

// Importación de Vistas y Componentes
import DashboardView from '../views/DashboardView.vue'
import Login from '../components/Login.vue'
import CentrosListView from '../views/CentrosListView.vue'
import CentroConfigView from '../views/CentroConfigView.vue'

// Definición de las Rutas de la Aplicación
const routes = [
  {
    path: '/',
    name: 'Login',
    component: Login,
    meta: { layout: 'Blank' } // El Login usa el layout vacío, sin barra lateral
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: { requiresAuth: true } // El resto de rutas usan el layout por defecto con la barra lateral
  },
  {
    path: '/centros',
    name: 'CentrosList',
    component: CentrosListView,
    meta: { requiresAuth: true }
  },
  {
    path: '/centros/:id/configurar',
    name: 'CentroConfig',
    component: CentroConfigView,
    meta: { requiresAuth: true }
  }
]

// Creación de la instancia del Router
const router = createRouter({
  history: createWebHistory(),
  routes
})

// Guardia de Navegación Global para la seguridad
router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  // Si la ruta requiere login y el usuario no está autenticado, se le redirige al Login
  if (requiresAuth && !session) {
    next({ name: 'Login' })
  } 
  // Si el usuario ya está logueado e intenta ir a la página de Login, se le redirige al Dashboard
  else if (session && to.name === 'Login') {
    next({ name: 'Dashboard' })
  }
  // En cualquier otro caso, se permite la navegación
  else {
    next()
  }
})

export default router