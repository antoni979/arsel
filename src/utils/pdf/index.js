// src/utils/pdf/index.js

import jsPDF from 'jspdf';
import { fetchReportData } from './pdf-data';
import { buildTextPages } from './pdf-module-text';
import { buildInitialPhotoAnnex, buildRemediationPhotoAnnex } from './pdf-module-photos';
import { buildChecklistAnnex } from './pdf-module-checklist';
import { buildSummaryAnnex } from './pdf-module-summary';

function sanitizeFileName(name) {
  let sanitized = name.replace(/\s+/g, '_');
  sanitized = sanitized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  sanitized = sanitized.replace(/[^a-zA-Z0-9_.-]/g, '');
  return sanitized;
}

export async function generateTextReport(inspeccionId, reportType = 'initial', outputType = 'download') {
    // ... (sin cambios en esta función)
}

// ===== INICIO DE LA CORRECCIÓN =====
export async function generatePlanPdf(inspeccionId, finalLabels, previewDimensions) {
  try {
    console.log("Iniciando generación de PDF del Plano...");
    // Pedimos la imagen SIN optimizar para máxima calidad
    const reportData = await fetchReportData(inspeccionId, { optimizePlan: false }); 
    
    if (!reportData.planoBase64) {
        throw new Error("No se pudo cargar la imagen del plano para esta inspección.");
    }

    const pdf = new jsPDF('l', 'mm', 'a4');
    
    console.log("Construyendo anexo de resumen visual con posiciones ajustadas...");
    // Pasamos los datos extra a la función de dibujado
    await buildSummaryAnnex(pdf, reportData, finalLabels, previewDimensions);
    
    const { inspectionData } = reportData;
    
    const rawFileName = `Plano_Incidencias_${inspectionData.centros.nombre}_${inspectionData.fecha_inspeccion}.pdf`;
    const fileName = sanitizeFileName(rawFileName);

    console.log(`Guardando PDF como: ${fileName}`);
    pdf.save(fileName);

  } catch (err) {
    console.error("Error generando el PDF del Plano:", err);
    alert(`Hubo un error al generar el plano. Revisa la consola: ${err.message}`);
  }
}
// ===== FIN DE LA CORRECCIÓN =====