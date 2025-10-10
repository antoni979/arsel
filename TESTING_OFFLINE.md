# Guía de Pruebas - Sistema Offline Robusto

## Resumen de Mejoras Implementadas

Se ha implementado un sistema robusto para trabajar completamente offline con incidencias. El sistema ahora maneja correctamente todos los escenarios posibles de creación, modificación y borrado de incidencias con o sin fotos.

## Casos de Uso Soportados

### ✅ Escenarios Offline
1. **Crear incidencia sin foto offline** → Sincroniza al recuperar conexión
2. **Crear incidencia con foto offline** → Guarda foto en IndexedDB, sincroniza al recuperar conexión
3. **Crear incidencia offline → Borrarla offline** → Se cancelan todas las operaciones localmente (no sincroniza)
4. **Crear incidencia con foto offline → Borrarla offline** → Se cancelan operaciones y se limpia foto de IndexedDB
5. **Crear incidencia offline → Modificarla offline** → Sincroniza insert + update al recuperar conexión
6. **Crear incidencia offline → Agregar foto offline** → Sincroniza insert + foto al recuperar conexión

### ✅ Escenarios Online
7. **Crear incidencia online** → Sincroniza inmediatamente
8. **Crear incidencia online con foto** → Sincroniza inmediatamente
9. **Borrar incidencia online** → Sincroniza inmediatamente

### ✅ Escenarios Mixtos
10. **Crear incidencia online → Perder conexión → Modificarla offline** → Sincroniza cambios al recuperar conexión
11. **Crear incidencia online → Perder conexión → Borrarla offline** → Sincroniza borrado al recuperar conexión
12. **Crear incidencia online con foto → Perder conexión → Cambiar foto offline** → Borra foto antigua y sube nueva al recuperar conexión

## Cómo Probar

### Preparación
1. Abre la aplicación en Chrome/Edge
2. Abre DevTools (F12) → Pestaña Console
3. Verifica que estés en una inspección

### Prueba 1: Crear y Borrar Offline (Sin Foto)
1. En DevTools → Network → Selecciona "Offline"
2. Crea una nueva incidencia en cualquier punto
3. Verás el mensaje: "Foto guardada localmente" (si agregaste foto)
4. Sin cerrar el modal, borra la incidencia que acabas de crear
5. **Resultado esperado:** Mensaje "Operaciones locales de la incidencia canceladas"
6. Vuelve a "Online"
7. **Resultado esperado:** No se sincronizan operaciones (la cola está vacía)

### Prueba 2: Crear con Foto y Borrar Offline
1. En DevTools → Network → "Offline"
2. Crea una incidencia y agrégale una foto
3. Verás el mensaje: "Foto guardada localmente"
4. Borra la incidencia
5. **Resultado esperado:** Mensaje "Operaciones locales de la incidencia canceladas"
6. Abre DevTools → Application → IndexedDB → ArselOfflineFiles
7. **Resultado esperado:** No hay archivos guardados (se limpió automáticamente)
8. Vuelve a "Online"
9. **Resultado esperado:** No se sincronizan operaciones

### Prueba 3: Crear Offline → Modificar → Sincronizar
1. Network → "Offline"
2. Crea una incidencia sin foto
3. Cambia la gravedad de "Verde" a "Rojo"
4. Cierra el modal
5. Abre localStorage → busca "arsel-sync-queue"
6. **Resultado esperado:** Verás 1 insert + 1 update en la cola
7. Network → "Online"
8. Espera unos segundos
9. **Resultado esperado:** La incidencia se sincroniza correctamente en Supabase

### Prueba 4: Crear con Foto Offline → Sincronizar
1. Network → "Offline"
2. Crea incidencia y agrégale una foto
3. Cierra el modal
4. Verifica localStorage → "arsel-sync-queue"
5. **Resultado esperado:** 1 insert + 1 uploadAndUpdate
6. Verifica IndexedDB → ArselOfflineFiles
7. **Resultado esperado:** 1 archivo con clave "arsel-offline-file-..."
8. Network → "Online"
9. Espera unos segundos
10. **Resultado esperado:**
    - Incidencia creada en Supabase
    - Foto subida a Supabase Storage
    - URL actualizada en la incidencia
    - Archivo eliminado de IndexedDB

### Prueba 5: Recuperación de Errores (Caso Extremo)
1. Cierra completamente el navegador con la cola llena
2. Reabre la aplicación
3. **Resultado esperado:** La cola se procesa automáticamente al iniciar

## Mensajes de la Consola

Durante las pruebas, verás estos mensajes en la consola:

### ✅ Mensajes Normales
- `"Procesando cola de sincronización..."`
- `"Operaciones locales de la incidencia canceladas."`
- `"Foto guardada localmente."`

### ⚠️ Mensajes de Advertencia (Esperados)
- `"Reordenando acción por dependencia no resuelta"` - La cola está esperando que se resuelva un ID temporal
- `"Removiendo acción huérfana de ID temporal..."` - Limpieza de cola al iniciar
- `"Registro no encontrado, removiendo acción de la cola"` - El registro ya fue borrado

### ❌ Mensajes de Error (Investigar)
- `"Error de sincronización grave"` - Error inesperado, reportar
- `"ID temporal temp_XXX no encontrado"` - Si ves esto, el sistema robusto falló (no debería pasar)

## Verificación de Datos

### LocalStorage
```javascript
// En DevTools Console
console.log(JSON.parse(localStorage.getItem('arsel-sync-queue')))
```

### IndexedDB
1. DevTools → Application → IndexedDB → ArselOfflineFiles → files
2. Verifica que los archivos se guarden y se eliminen correctamente

### Supabase
1. Ve a tu panel de Supabase
2. Table Editor → incidencias
3. Verifica que las incidencias sincronizadas estén correctas
4. Storage → incidencias
5. Verifica que las fotos se hayan subido

## Problemas Conocidos Resueltos

✅ **Error anterior:** "ID temporal temp_XXX no encontrado para actualizar"
**Solución:** El sistema ahora cancela todas las operaciones relacionadas con un ID temporal cuando se borra offline

✅ **Error anterior:** Archivos huérfanos en IndexedDB
**Solución:** Se limpian automáticamente al borrar incidencias offline

✅ **Error anterior:** Cola bloqueada por dependencias circulares
**Solución:** Sistema de reordenamiento automático y límite de ciclos

## Contacto para Reportar Bugs

Si encuentras algún error durante las pruebas:
1. Anota el escenario exacto que causó el error
2. Copia los mensajes de la consola
3. Toma screenshot del estado de localStorage/IndexedDB
4. Reporta con toda esta información
