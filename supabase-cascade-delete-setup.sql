-- ============================================================================
-- Script de Configuración de Eliminación en Cascada - Arsel Inspecciones
-- ============================================================================
--
-- PROPÓSITO:
-- Este script configura todas las claves foráneas de la base de datos para que
-- soporten eliminación en cascada (ON DELETE CASCADE). Esto significa que cuando
-- elimines un registro padre, automáticamente se eliminarán todos los registros
-- hijos que dependen de él.
--
-- EJEMPLO:
-- Si eliminas un centro, automáticamente se eliminarán:
--   - Todas las versiones de plano de ese centro
--   - Todas las salas de esas versiones
--   - Todos los puntos maestros de esas salas
--   - Todas las inspecciones de ese centro
--   - Todos los puntos inspeccionados de esas inspecciones
--   - Todas las incidencias de esos puntos
--
-- SEGURIDAD:
-- Este script usa DROP CONSTRAINT IF EXISTS antes de crear cada constraint,
-- por lo que es seguro ejecutarlo múltiples veces (es idempotente).
--
-- CÓMO EJECUTAR:
-- 1. Ve a tu proyecto de Supabase
-- 2. Abre el "SQL Editor"
-- 3. Copia y pega este script completo
-- 4. Haz clic en "Run" o presiona Ctrl/Cmd + Enter
--
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SALAS -> VERSIONES_PLANO
-- ----------------------------------------------------------------------------
-- Cuando se elimina una versión de plano, se eliminan todas sus salas
--
-- Relación: salas.version_id -> versiones_plano.id
-- Impacto: Eliminar versión de plano → Elimina todas las salas de esa versión
-- ----------------------------------------------------------------------------
ALTER TABLE salas
DROP CONSTRAINT IF EXISTS salas_version_id_fkey;

ALTER TABLE salas
ADD CONSTRAINT salas_version_id_fkey
FOREIGN KEY (version_id)
REFERENCES versiones_plano(id)
ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- 2. PUNTOS_MAESTROS -> SALAS
-- ----------------------------------------------------------------------------
-- Cuando se elimina una sala, se eliminan todos sus puntos maestros
--
-- Relación: puntos_maestros.sala_id -> salas.id
-- Impacto: Eliminar sala → Elimina todos los puntos maestros de esa sala
-- ----------------------------------------------------------------------------
ALTER TABLE puntos_maestros
DROP CONSTRAINT IF EXISTS puntos_maestros_sala_id_fkey;

ALTER TABLE puntos_maestros
ADD CONSTRAINT puntos_maestros_sala_id_fkey
FOREIGN KEY (sala_id)
REFERENCES salas(id)
ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- 3. PUNTOS_MAESTROS -> VERSIONES_PLANO
-- ----------------------------------------------------------------------------
-- Cuando se elimina una versión de plano, se eliminan todos sus puntos maestros
--
-- Relación: puntos_maestros.version_id -> versiones_plano.id
-- Impacto: Eliminar versión de plano → Elimina todos los puntos maestros
--          asociados a esa versión (incluso los que no tengan sala asignada)
-- ----------------------------------------------------------------------------
ALTER TABLE puntos_maestros
DROP CONSTRAINT IF EXISTS puntos_maestros_version_id_fkey;

ALTER TABLE puntos_maestros
ADD CONSTRAINT puntos_maestros_version_id_fkey
FOREIGN KEY (version_id)
REFERENCES versiones_plano(id)
ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- 4. PUNTOS_INSPECCIONADOS -> PUNTOS_MAESTROS
-- ----------------------------------------------------------------------------
-- Cuando se elimina un punto maestro, se eliminan todos los puntos
-- inspeccionados que hacen referencia a él
--
-- Relación: puntos_inspeccionados.punto_maestro_id -> puntos_maestros.id
-- Impacto: Eliminar punto maestro → Elimina todos los puntos inspeccionados
--          que se crearon a partir de ese punto maestro
-- ----------------------------------------------------------------------------
ALTER TABLE puntos_inspeccionados
DROP CONSTRAINT IF EXISTS puntos_inspeccionados_punto_maestro_id_fkey;

ALTER TABLE puntos_inspeccionados
ADD CONSTRAINT puntos_inspeccionados_punto_maestro_id_fkey
FOREIGN KEY (punto_maestro_id)
REFERENCES puntos_maestros(id)
ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- 5. PUNTOS_INSPECCIONADOS -> INSPECCIONES
-- ----------------------------------------------------------------------------
-- Cuando se elimina una inspección, se eliminan todos sus puntos inspeccionados
--
-- Relación: puntos_inspeccionados.inspeccion_id -> inspecciones.id
-- Impacto: Eliminar inspección → Elimina todos los puntos inspeccionados
--          de esa inspección
-- ----------------------------------------------------------------------------
ALTER TABLE puntos_inspeccionados
DROP CONSTRAINT IF EXISTS puntos_inspeccionados_inspeccion_id_fkey;

ALTER TABLE puntos_inspeccionados
ADD CONSTRAINT puntos_inspeccionados_inspeccion_id_fkey
FOREIGN KEY (inspeccion_id)
REFERENCES inspecciones(id)
ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- 6. INCIDENCIAS -> PUNTOS_INSPECCIONADOS
-- ----------------------------------------------------------------------------
-- Cuando se elimina un punto inspeccionado, se eliminan todas sus incidencias
--
-- Relación: incidencias.punto_inspeccionado_id -> puntos_inspeccionados.id
-- Impacto: Eliminar punto inspeccionado → Elimina todas las incidencias
--          (verde/ámbar/rojo) de ese punto
-- ----------------------------------------------------------------------------
ALTER TABLE incidencias
DROP CONSTRAINT IF EXISTS incidencias_punto_inspeccionado_id_fkey;

ALTER TABLE incidencias
ADD CONSTRAINT incidencias_punto_inspeccionado_id_fkey
FOREIGN KEY (punto_inspeccionado_id)
REFERENCES puntos_inspeccionados(id)
ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- 7. INCIDENCIAS -> INSPECCIONES
-- ----------------------------------------------------------------------------
-- Cuando se elimina una inspección, se eliminan todas sus incidencias
--
-- Relación: incidencias.inspeccion_id -> inspecciones.id
-- Impacto: Eliminar inspección → Elimina todas las incidencias asociadas
--          directamente a esa inspección
-- ----------------------------------------------------------------------------
ALTER TABLE incidencias
DROP CONSTRAINT IF EXISTS incidencias_inspeccion_id_fkey;

ALTER TABLE incidencias
ADD CONSTRAINT incidencias_inspeccion_id_fkey
FOREIGN KEY (inspeccion_id)
REFERENCES inspecciones(id)
ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- 8. INSPECCIONES -> VERSIONES_PLANO
-- ----------------------------------------------------------------------------
-- Cuando se elimina una versión de plano, se eliminan todas las inspecciones
-- que usan esa versión
--
-- Relación: inspecciones.version_id -> versiones_plano.id
-- Impacto: Eliminar versión de plano → Elimina todas las inspecciones
--          realizadas con esa versión del plano
-- ----------------------------------------------------------------------------
ALTER TABLE inspecciones
DROP CONSTRAINT IF EXISTS inspecciones_version_id_fkey;

ALTER TABLE inspecciones
ADD CONSTRAINT inspecciones_version_id_fkey
FOREIGN KEY (version_id)
REFERENCES versiones_plano(id)
ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- 9. INSPECCIONES -> CENTROS
-- ----------------------------------------------------------------------------
-- Cuando se elimina un centro, se eliminan todas sus inspecciones
--
-- Relación: inspecciones.centro_id -> centros.id
-- Impacto: Eliminar centro → Elimina todas las inspecciones de ese centro
-- ----------------------------------------------------------------------------
ALTER TABLE inspecciones
DROP CONSTRAINT IF EXISTS inspecciones_centro_id_fkey;

ALTER TABLE inspecciones
ADD CONSTRAINT inspecciones_centro_id_fkey
FOREIGN KEY (centro_id)
REFERENCES centros(id)
ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
-- 10. VERSIONES_PLANO -> CENTROS
-- ----------------------------------------------------------------------------
-- Cuando se elimina un centro, se eliminan todas sus versiones de plano
--
-- Relación: versiones_plano.centro_id -> centros.id
-- Impacto: Eliminar centro → Elimina todas las versiones de plano de ese centro
-- ----------------------------------------------------------------------------
ALTER TABLE versiones_plano
DROP CONSTRAINT IF EXISTS versiones_plano_centro_id_fkey;

ALTER TABLE versiones_plano
ADD CONSTRAINT versiones_plano_centro_id_fkey
FOREIGN KEY (centro_id)
REFERENCES centros(id)
ON DELETE CASCADE;


-- ============================================================================
-- VERIFICACIÓN (OPCIONAL)
-- ============================================================================
-- Ejecuta esta query para verificar que todas las constraints se crearon
-- correctamente con ON DELETE CASCADE
-- ============================================================================

SELECT
    tc.table_name AS tabla_hija,
    kcu.column_name AS columna_fk,
    ccu.table_name AS tabla_padre,
    ccu.column_name AS columna_padre,
    rc.delete_rule AS regla_eliminacion
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN (
        'salas',
        'puntos_maestros',
        'puntos_inspeccionados',
        'incidencias',
        'inspecciones',
        'versiones_plano'
    )
ORDER BY
    CASE tc.table_name
        WHEN 'incidencias' THEN 1
        WHEN 'puntos_inspeccionados' THEN 2
        WHEN 'puntos_maestros' THEN 3
        WHEN 'salas' THEN 4
        WHEN 'inspecciones' THEN 5
        WHEN 'versiones_plano' THEN 6
    END;

-- ============================================================================
-- RESULTADO ESPERADO DE LA VERIFICACIÓN:
-- ============================================================================
-- Deberías ver todas las foreign keys con delete_rule = 'CASCADE'
-- Si alguna tiene delete_rule = 'NO ACTION' o 'RESTRICT', significa que
-- esa constraint no se actualizó correctamente.
-- ============================================================================
