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
    // Esta función no genera el plano, por lo que puede seguir en A4 si se desea.
    // La mantenemos en A4 ya que es un formato estándar para informes de texto.
  try {
    console.log(`Iniciando generación de Informe de Texto (output: ${outputType})...`);
    const reportData = await fetchReportData(inspeccionId, { optimizePlan: true }); 
    if (!reportData) throw new Error("No se pudieron cargar los datos para el informe.");
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    console.log("Construyendo páginas de texto...");
    await buildTextPages(pdf, reportData);
    
    if (reportType === 'initial') {
      console.log("Construyendo anexo de fotos inicial...");
      await buildInitialPhotoAnnex(pdf, reportData);
    } else if (reportType === 'remediation') {
      console.log("Construyendo anexo de fotos de subsanación...");
      await buildRemediationPhotoAnnex(pdf, reportData);
    }
    
    console.log("Construyendo anexo de checklist...");
    await buildChecklistAnnex(pdf, reportData);
    
    const { inspectionData } = reportData;
    const reportTypeName = reportType === 'initial' ? 'Informe_Inicial' : 'Informe_Cierre';
    
    const rawFileName = `${reportTypeName}_${inspectionData.centros.nombre}_${inspectionData.fecha_inspeccion}.pdf`;
    const fileName = sanitizeFileName(rawFileName);

    if (outputType === 'blob') {
      console.log('Devolviendo PDF como Blob.');
      return { blob: pdf.output('blob'), fileName: fileName };
    } else {
      console.log(`Guardando PDF como: ${fileName}`);
      pdf.save(fileName);
      return { blob: null, fileName: fileName };
    }

  } catch (err) {
    console.error("Error generando el Informe de Texto:", err);
    alert(`Hubo un error al generar el informe. Revisa la consola: ${err.message}`);
    return null;
  }
}


export async function generatePlanPdf(inspeccionId, finalLabels, previewDimensions) {
  try {
    console.log("Iniciando generación de PDF del Plano en formato A3...");
    const reportData = await fetchReportData(inspeccionId, { optimizePlan: false }); 
    
    if (!reportData.planoBase64) {
        throw new Error("No se pudo cargar la imagen del plano para esta inspección.");
    }

    // ===== INICIO DE LA CORRECCIÓN: Cambiamos 'a4' por 'a3' =====
    const pdf = new jsPDF('l', 'mm', 'a3');
    // ===== FIN DE LA CORRECCIÓN =====
    
    console.log("Construyendo anexo de resumen visual con posiciones ajustadas...");
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