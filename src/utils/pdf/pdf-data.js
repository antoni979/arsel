// src/utils/pdf/pdf-data.js

import { supabase } from '../../supabase';

/**
 * Obtiene todos los datos necesarios de Supabase para generar un informe.
 * @param {number} inspeccionId - El ID de la inspección a buscar.
 * @returns {Promise<object>} Un objeto con todos los datos del informe.
 */
export async function fetchReportData(inspeccionId) {
  // 1. Obtener la inspección, el centro y la versión del plano asociada
  const { data: inspectionData, error: inspectionError } = await supabase
    .from('inspecciones')
    .select('*, centros(*), versiones_plano(*)') // Asegúrate de que versiones_plano(*) está aquí
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

  // 3. Devolver un objeto bien estructurado
  return {
    inspectionData,
    salasData: salasData || [],
    puntosMaestrosData: puntosMaestrosData || [],
    puntosInspeccionadosData: puntosInspeccionadosData || [],
    incidenciasData: incidenciasData || [],
  };
}