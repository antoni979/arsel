// src/utils/pdf/pdf-data.js

import { supabase } from '../../supabase';
// Importamos el helper para cargar imágenes
import { loadImageAsBase64 } from './pdf-helpers';

/**
 * Obtiene todos los datos necesarios de Supabase para generar un informe.
 * @param {number} inspeccionId - El ID de la inspección a buscar.
 * @returns {Promise<object>} Un objeto con todos los datos del informe.
 */
export async function fetchReportData(inspeccionId) {
  // 1. Obtener la inspección, el centro y la versión del plano asociada
  const { data: inspectionData, error: inspectionError } = await supabase
    .from('inspecciones')
    .select('*, centros(*), versiones_plano(*)')
    .eq('id', inspeccionId)
    .single();
  
  if (inspectionError) {
    throw new Error(`Error al obtener la inspección: ${inspectionError.message}`);
  }
  
  if (!inspectionData.centros) {
    throw new Error('Datos del centro no encontrados para esta inspección.');
  }

  const centroId = inspectionData.centros.id;
  const versionId = inspectionData.versiones_plano?.id;

  // --- INICIO DE CAMBIOS: Cargamos la imagen del plano aquí ---
  const planoUrl = inspectionData.versiones_plano?.url_imagen_plano;
  const planoBase64 = planoUrl ? await loadImageAsBase64(planoUrl) : null;
  // --- FIN DE CAMBIOS ---

  // 2. Obtener el resto de datos en paralelo
  const [
    { data: salasData, error: salasError },
    { data: puntosMaestrosData, error: puntosMaestrosError },
    { data: puntosInspeccionadosData, error: puntosInspeccionadosError },
    { data: incidenciasData, error: incidenciasError }
  ] = await Promise.all([
    supabase.from('salas').select('*').eq('version_id', versionId).order('nombre'),
    supabase.from('puntos_maestros').select('*').eq('version_id', versionId),
    supabase.from('puntos_inspeccionados').select('*').eq('inspeccion_id', inspeccionId),
    supabase.from('incidencias').select('*').eq('inspeccion_id', inspeccionId)
  ]);

  if (salasError || puntosMaestrosError || puntosInspeccionadosError || incidenciasError) {
    console.error({ salasError, puntosMaestrosError, puntosInspeccionadosError, incidenciasError });
    throw new Error('Error al obtener datos relacionados con la inspección.');
  }
  
  const incidenceCounts = new Map();
  (puntosInspeccionadosData || []).forEach(pi => {
      incidenceCounts.set(pi.id, { verde: 0, ambar: 0, rojo: 0 });
  });
  (incidenciasData || []).forEach(inc => {
      const counts = incidenceCounts.get(inc.punto_inspeccionado_id);
      if (counts && counts[inc.gravedad] !== undefined) {
          counts[inc.gravedad]++;
      }
  });


  // 3. Devolver un objeto bien estructurado
  return {
    inspectionData,
    salasData: salasData || [],
    puntosMaestrosData: puntosMaestrosData || [],
    puntosInspeccionadosData: puntosInspeccionadosData || [],
    incidenciasData: incidenciasData || [],
    planoBase64, // <-- Devolvemos la imagen ya cargada
    incidenceCounts, // <-- Devolvemos el conteo pre-calculado
  };
}