// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../supabase'
import DashboardView from '../views/DashboardView.vue'
import Login from '../components/Login.vue'
import InspectionView from '../views/InspectionView.vue' // <-- Se añade la nueva vista

const routes = [
  {
    path: '/',
    name: 'Login',
    component: Login
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: DashboardView,
    meta: { requiresAuth: true }
  },
  // --- NUEVA RUTA AÑADIDA ---
  {
    path: '/inspeccion/:id', // La URL será dinámica, ej: /inspeccion/1
    name: 'Inspection',
    component: InspectionView,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

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