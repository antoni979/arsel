// src/utils/pdf/pdf-data.js

import { supabase } from '../../supabase';
import { loadImageAsBase64 } from './pdf-helpers';

export async function fetchReportData(inspeccionId) {
  // --- LOG DE DEBUG ---
  console.log(`[fetchReportData] Iniciando búsqueda de datos para la inspección ID: ${inspeccionId}`);
  
  try {
    const { data: inspectionData, error: inspectionError } = await supabase
      .from('inspecciones')
      .select('*, centros(*), versiones_plano(*)')
      .eq('id', inspeccionId)
      .single();
    
    // --- LOG DE DEBUG ---
    if (inspectionError) {
      console.error('[fetchReportData] ¡ERROR CRÍTICO al obtener la inspección!', inspectionError);
      throw new Error(`Error al obtener la inspección: ${inspectionError.message}`);
    }
    console.log('[fetchReportData] Datos de la inspección principal obtenidos:', inspectionData);
    
    if (!inspectionData.centros) {
      console.error('[fetchReportData] ¡ERROR! La inspección no tiene un centro asociado.');
      throw new Error('Datos del centro no encontrados para esta inspección.');
    }

    const versionId = inspectionData.versiones_plano?.id;
    // --- LOG DE DEBUG ---
    console.log(`[fetchReportData] Usando la versión de plano ID: ${versionId}`);

    const planoUrl = inspectionData.versiones_plano?.url_imagen_plano;
    const planoBase64 = planoUrl ? await loadImageAsBase64(planoUrl) : null;
    // --- LOG DE DEBUG ---
    console.log(`[fetchReportData] ¿Se cargó la imagen del plano? -> ${planoBase64 ? 'Sí' : 'No'}`);

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
      console.error('[fetchReportData] ¡ERROR en una de las consultas en paralelo!', { salasError, puntosMaestrosError, puntosInspeccionadosError, incidenciasError });
      throw new Error('Error al obtener datos relacionados con la inspección.');
    }
    // --- LOG DE DEBUG ---
    console.log('[fetchReportData] Datos relacionados obtenidos:', {
        salas: salasData?.length,
        puntosMaestros: puntosMaestrosData?.length,
        puntosInspeccionados: puntosInspeccionadosData?.length,
        incidencias: incidenciasData?.length
    });
    
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

    const result = {
      inspectionData,
      salasData: salasData || [],
      puntosMaestrosData: puntosMaestrosData || [],
      puntosInspeccionadosData: puntosInspeccionadosData || [],
      incidenciasData: incidenciasData || [],
      planoBase64,
      incidenceCounts,
    };
    
    // --- LOG DE DEBUG ---
    console.log('[fetchReportData] Búsqueda de datos completada con éxito.');
    return result;

  } catch (error) {
    console.error('[fetchReportData] La función ha fallado con una excepción:', error);
    // Devolvemos null para que el componente que llama sepa que algo fue mal
    return null;
  }
}