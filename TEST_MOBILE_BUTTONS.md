# Test Manual: Botones Móvil - Agregar Salas y Puntos

## Preparación del Test

### 1. Limpiar caché del PWA
**MUY IMPORTANTE:** El service worker cachea los archivos, necesitas limpiar el caché:

1. Abre DevTools en Chrome/Edge
2. Ve a Application → Storage
3. Click en "Clear site data"
4. Recarga la página (F5 o Ctrl+R)

O también:
1. DevTools → Application → Service Workers
2. Click en "Unregister"
3. Recarga la página

### 2. Activar modo móvil en DevTools
1. Abre DevTools (F12)
2. Click en el icono de dispositivo móvil (Ctrl+Shift+M)
3. Selecciona un dispositivo móvil (ej: iPhone 12 Pro)

---

## Test 1: Agregar Sala en Móvil

### Pasos:
1. **Navega a una inspección en progreso**
   - Abre `/inspecciones/:id` (reemplaza :id con una inspección real)
   - Asegúrate de que la inspección tenga `estado = 'en_progreso'`

2. **Verifica el header móvil**
   - ✓ Debes ver un header compacto arriba (NO el header desktop grande)
   - ✓ Debe haber botones pequeños en el header

3. **Activa modo edición de plano**
   - Si estás en vista LISTA: Click en botón de mapa (icono MapIcon)
   - En vista MAPA: Click en botón de lápiz (PencilSquareIcon) en el header móvil
   - ✓ El botón debe cambiar a color naranja cuando está activo

4. **Verifica que aparece el panel naranja**
   - ✓ Debe aparecer un panel naranja con el texto "Modo Edición de Plano"
   - ✓ Debe haber un botón blanco que dice "Añadir Sala"

5. **Abre el formulario de sala**
   - Click en "Añadir Sala"
   - ✓ Debe aparecer un input de texto
   - ✓ Debe aparecer un botón verde (✓) a la derecha del input
   - ✓ Debe aparecer un botón rojo (X) a la derecha del botón verde

6. **Crea la sala**
   - Escribe un nombre de sala (ej: "Sala Test")
   - Click en el botón verde (✓)
   - ✓ El formulario debe cerrarse
   - ✓ Debe aparecer una notificación de éxito
   - ✓ Se debe activar modo de dibujo para definir el área

### Resultado esperado:
✅ PASA: Si puedes ver todos los botones y crear la sala
❌ FALLA: Si falta algún botón o no funciona

---

## Test 2: Agregar Punto en Móvil

### Pasos:
1. **Navega a una inspección en progreso**
   - Abre `/inspecciones/:id` (reemplaza :id con una inspección real)

2. **Activa vista de mapa**
   - Si estás en vista LISTA: Click en botón de mapa
   - ✓ Debes ver el plano/mapa de la inspección

3. **Abre formulario de agregar punto**
   - Click en botón (+) PlusIcon en el header móvil
   - ✓ Debe aparecer un panel azul con el formulario "AddPointForm"
   - ✓ Debe haber un selector de sala
   - ✓ Debe haber botones "Guardar" y "Cancelar"

4. **Selecciona sala y guarda**
   - Selecciona una sala del dropdown
   - Click en "Guardar"
   - ✓ El formulario debe cerrarse
   - ✓ Debe activarse el modo "placement" (modo de colocación)

5. **Verifica botón de cancelar colocación**
   - ✓ Debe aparecer un botón ROJO grande que dice "Cancelar Colocación"
   - ✓ El botón debe tener un icono X (XCircleIcon)
   - ✓ El botón debe estar debajo del header móvil

6. **Prueba la funcionalidad**
   - OPCIÓN A: Click en el mapa para colocar el punto
     - ✓ Se debe crear el punto en las coordenadas seleccionadas
     - ✓ El modo placement debe desactivarse automáticamente

   - OPCIÓN B: Click en "Cancelar Colocación"
     - ✓ El botón rojo debe desaparecer
     - ✓ El modo placement debe cancelarse sin crear punto

### Resultado esperado:
✅ PASA: Si puedes ver el botón "Cancelar Colocación" y funciona correctamente
❌ FALLA: Si el botón rojo no aparece después de seleccionar sala

---

## Debugging

### Si los botones no aparecen:

1. **Verifica el console del navegador**
   ```
   F12 → Console → busca errores en rojo
   ```

2. **Verifica el estado de las variables**
   Abre Vue DevTools y verifica:
   - `isPlanoEditingMode` debe ser `true` para ver panel de sala
   - `isPlacementMode` debe ser `true` para ver botón cancelar
   - `isMobileAddPointOpen` debe ser `true` para ver formulario de punto
   - `canEdit` debe ser `true` (inspeccion.estado === 'en_progreso')

3. **Verifica las clases CSS**
   - Busca el botón en Elements de DevTools
   - Verifica que no tenga `display: none` o `hidden`
   - Verifica que tenga `lg:hidden` (visible solo en móvil)

4. **Verifica el ancho de pantalla**
   - Tailwind `lg:` = ≥1024px
   - Para móvil necesitas < 1024px de ancho

---

## Comandos útiles

```bash
# Limpiar todo y rebuilding
rm -rf dist/
rm -rf node_modules/.vite/
npm run build

# Desarrollo con reload
npm run dev
```

---

## Estado esperado del código

### InspectionSidebar.vue debe tener:

**Botón cancelar en móvil (líneas ~131-136):**
```vue
<div v-if="canEdit && !isPlanoEditingMode && isPlacementMode" class="lg:hidden p-4 flex-shrink-0 border-b">
   <button @click="handleCancelPlacement" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-white bg-red-600 rounded-md hover:bg-red-700">
      <XCircleIcon class="h-5 w-5" />
      Cancelar Colocación
   </button>
</div>
```

**Panel edición móvil (líneas ~139-149):**
```vue
<div v-if="canEdit && isPlanoEditingMode" class="lg:hidden p-3 bg-orange-50 border-b border-orange-200 space-y-3">
   <h3 class="font-bold text-orange-800 text-center">Modo Edición de Plano</h3>
   <form v-if="showAddSalaForm" @submit.prevent="handleAddSala" class="flex gap-2">
      <input v-model="newSalaName" type="text" placeholder="Nombre nueva sala..." class="flex-1 block w-full rounded-md border-slate-300 shadow-sm text-sm">
      <button type="submit" class="p-2 bg-green-600 text-white rounded-md hover:bg-green-700"><CheckCircleIcon class="h-5 w-5"/></button>
      <button @click="showAddSalaForm = false" type="button" class="p-2 bg-red-600 text-white rounded-md hover:bg-red-700"><XCircleIcon class="h-5 w-5"/></button>
   </form>
   <button v-else @click="showAddSalaForm = true" class="w-full flex items-center justify-center gap-2 px-4 py-2 font-semibold text-slate-600 bg-white rounded-md hover:bg-slate-50 border">
      <PlusIcon class="h-5 w-5" /> Añadir Sala
   </button>
</div>
```
