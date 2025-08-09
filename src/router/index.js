// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../supabase'

// Importación de Vistas y Componentes
import DashboardView from '../views/DashboardView.vue'
import Login from '../components/Login.vue'
import CentrosListView from '../views/CentrosListView.vue'
import CentroConfigView from '../views/CentroConfigView.vue'
import InspeccionesListView from '../views/InspeccionesListView.vue'
import InspeccionDetailView from '../views/InspeccionDetailView.vue'
import CentroHistorialView from '../views/CentroHistorialView.vue'; // <-- SE AÑADE ESTA LÍNEA

// Definición de las Rutas de la Aplicación
const routes = [
  {
    path: '/',
    name: 'Login',
    component: Login,
    meta: { layout: 'Blank' }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
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
  },
  {
    path: '/inspecciones',
    name: 'InspeccionesList',
    component: InspeccionesListView,
    meta: { requiresAuth: true }
  },
  {
    path: '/inspecciones/:id',
    name: 'InspeccionDetail',
    component: InspeccionDetailView,
    meta: { requiresAuth: true }
  },
  // --- NUEVA RUTA DE HISTORIAL ---
  {
    path: '/centros/:id/historial',
    name: 'CentroHistorial',
    component: CentroHistorialView,
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

  if (requiresAuth && !session) {
    next({ name: 'Login' })
  } 
  else if (session && to.name === 'Login') {
    next({ name: 'Dashboard' })
  }
  else {
    next()
  }
})

export default router