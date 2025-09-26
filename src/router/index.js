// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../supabase'

// Importación de Vistas y Componentes
import Login from '../components/Login.vue'

const routes = [
  { path: '/', name: 'Login', component: Login, meta: { layout: 'Blank' } },
  { path: '/dashboard', name: 'Dashboard', component: () => import('../views/DashboardView.vue'), meta: { requiresAuth: true } },
  { path: '/gestion', name: 'Gestion', component: () => import('../views/GestionView.vue'), meta: { requiresAuth: true } },
  { path: '/centros', name: 'CentrosList', component: () => import('../views/CentrosListView.vue'), meta: { requiresAuth: true } },
  { path: '/centros/:id/versiones', name: 'CentroVersions', component: () => import('../views/CentroVersionsView.vue'), meta: { requiresAuth: true } },
  { path: '/versiones/:id/configurar', name: 'VersionConfig', component: () => import('../views/CentroConfigView.vue'), meta: { requiresAuth: true } },
  { path: '/inspecciones', name: 'InspeccionesList', component: () => import('../views/InspeccionesListView.vue'), meta: { requiresAuth: true } },
  { path: '/inspecciones/:id', name: 'InspeccionDetail', component: () => import('../views/InspeccionDetailView.vue'), meta: { requiresAuth: true } },
  { path: '/centros/:id/historial', name: 'CentroHistorial', component: () => import('../views/CentroHistorialView.vue'), meta: { requiresAuth: true } },
  {
    path: '/inspecciones/:id/plano-preview',
    name: 'PlanoPreview',
    component: () => import('../views/PlanoPreviewView.vue'),
    meta: { layout: 'Blank' }
  },
  {
    path: '/inspecciones/:id/cierre',
    name: 'CierreInforme',
    component: () => import('../views/CierreInformeView.vue'),
    meta: { requiresAuth: true }
  },
  { path: '/admin', name: 'Admin', component: () => import('../views/AdminView.vue'), meta: { requiresAuth: true } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  console.log(`[Router] Navegando de '${from.fullPath}' a '${to.fullPath}'`);
  
  const { data: { session } } = await supabase.auth.getSession()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth && !session) { next({ name: 'Login' }) } 
  else if (session && to.name === 'Login') { next({ name: 'Dashboard' }) }
  else { next() }
})

export default router