// src/utils/pdf/pdf-data.js

import { supabase } from '../../supabase';
import { loadImageAsBase64 } from './pdf-helpers';

export async function fetchReportData(inspeccionId, options = {}) {
  const { optimizePlan = true } = options;
  console.log(`[fetchReportData] Iniciando búsqueda de datos para la inspección ID: ${inspeccionId}`);

  try {
    // ÚNICA LLAMADA A LA BASE DE DATOS
    const { data: reportJson, error } = await supabase.rpc('get_report_data', {
      inspeccion_id_param: inspeccionId
    });

    if (error) {
      console.error('[fetchReportData] ¡ERROR CRÍTICO al llamar a la función RPC!', error);
      throw new Error(`Error en la función de base de datos: ${error.message}`);
    }

    const reportData = reportJson; // El JSON ya viene con la estructura correcta

    const planoUrl = reportData.inspectionData.versiones_plano?.url_imagen_plano;
    const planoBase64 = planoUrl ? await loadImageAsBase64(planoUrl, { optimize: optimizePlan }) : null;

    // Calcular los contadores de incidencias (esto es rápido y se puede quedar en el cliente)
    const incidenceCounts = new Map();
    (reportData.puntosInspeccionadosData || []).forEach(pi => {
        incidenceCounts.set(pi.id, { verde: 0, ambar: 0, rojo: 0 });
    });
    (reportData.incidenciasData || []).forEach(inc => {
        const counts = incidenceCounts.get(inc.punto_inspeccionado_id);
        if (counts && counts[inc.gravedad] !== undefined) {
            counts[inc.gravedad]++;
        }
    });
    
    const result = {
      ...reportData,
      planoBase64,
      incidenceCounts,
    };
    
    console.log('[fetchReportData] Búsqueda de datos con RPC completada con éxito.');
    return result;

  } catch (error) {
    console.error('[fetchReportData] La función ha fallado con una excepción:', error);
    return null;
  }
}