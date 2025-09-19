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
import CentroHistorialView from '../views/CentroHistorialView.vue';
import CentroVersionsView from '../views/CentroVersionsView.vue';
// ===== INICIO DE LA CORRECCIÓN: Importamos el nuevo componente =====
import CierreInformeView from '../views/CierreInformeView.vue';

const routes = [
  { path: '/', name: 'Login', component: Login, meta: { layout: 'Blank' } },
  { path: '/dashboard', name: 'Dashboard', component: DashboardView, meta: { requiresAuth: true } },
  { path: '/centros', name: 'CentrosList', component: CentrosListView, meta: { requiresAuth: true } },
  { path: '/centros/:id/versiones', name: 'CentroVersions', component: CentroVersionsView, meta: { requiresAuth: true } },
  { path: '/versiones/:id/configurar', name: 'VersionConfig', component: CentroConfigView, meta: { requiresAuth: true } },
  { path: '/inspecciones', name: 'InspeccionesList', component: InspeccionesListView, meta: { requiresAuth: true } },
  { path: '/inspecciones/:id', name: 'InspeccionDetail', component: InspeccionDetailView, meta: { requiresAuth: true } },
  { path: '/centros/:id/historial', name: 'CentroHistorial', component: CentroHistorialView, meta: { requiresAuth: true } },
  {
    path: '/inspecciones/:id/plano-preview',
    name: 'PlanoPreview',
    component: () => import('../views/PlanoPreviewView.vue'),
    meta: { layout: 'Blank' }
  },
  // ===== INICIO DE LA CORRECCIÓN: Actualizamos la ruta =====
  {
    path: '/inspecciones/:id/cierre',
    name: 'CierreInforme',
    component: CierreInformeView,
    meta: { requiresAuth: true }
  }
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