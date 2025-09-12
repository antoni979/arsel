// src/utils/pdf/index.js

import jsPDF from 'jspdf';
import { fetchReportData } from './pdf-data';
import { buildTextPages } from './pdf-module-text';
import { buildInitialPhotoAnnex, buildRemediationPhotoAnnex } from './pdf-module-photos';
import { buildChecklistAnnex } from './pdf-module-checklist';
import { buildSummaryAnnex } from './pdf-module-summary';

/**
 * Genera el informe en PDF con texto, fotos y checklists, pero SIN el plano visual.
 * @param {number} inspeccionId - El ID de la inspección.
 * @param {string} reportType - 'initial' o 'remediation'.
 */
export async function generateTextReport(inspeccionId, reportType = 'initial') {
  try {
    console.log("Iniciando generación de Informe de Texto...");
    const reportData = await fetchReportData(inspeccionId); // <-- Ahora contiene todo lo necesario
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
    const reportTypeName = reportType === 'initial' ? 'Informe' : 'Subsanacion';
    const fileName = `${reportTypeName}_${inspectionData.centros.nombre.replace(/ /g, '_')}_${inspectionData.fecha_inspeccion}.pdf`;
    
    console.log(`Guardando PDF como: ${fileName}`);
    pdf.save(fileName);

  } catch (err) {
    console.error("Error generando el Informe de Texto:", err);
    alert(`Hubo un error al generar el informe. Revisa la consola: ${err.message}`);
  }
}

/**
 * Genera un PDF que contiene ÚNICAMENTE el plano visual de incidencias.
 * @param {number} inspeccionId - El ID de la inspección.
 */
export async function generatePlanPdf(inspeccionId) {
  try {
    console.log("Iniciando generación de PDF del Plano...");
    const reportData = await fetchReportData(inspeccionId); // <-- Ahora contiene todo lo necesario, incluyendo planoBase64
    
    // --- INICIO DE CORRECCIÓN ---
    // Comprobamos si el plano se pudo cargar
    if (!reportData.planoBase64) {
        throw new Error("No se pudo cargar la imagen del plano para esta inspección.");
    }
    // --- FIN DE CORRECCIÓN ---

    const pdf = new jsPDF('l', 'mm', 'a4'); // Apaisado
    
    console.log("Construyendo anexo de resumen visual...");
    await buildSummaryAnnex(pdf, reportData); // Pasamos el objeto completo
    
    const { inspectionData } = reportData;
    const fileName = `Plano_Incidencias_${inspectionData.centros.nombre.replace(/ /g, '_')}_${inspectionData.fecha_inspeccion}.pdf`;
    
    console.log(`Guardando PDF como: ${fileName}`);
    pdf.save(fileName);

  } catch (err) {
    console.error("Error generando el PDF del Plano:", err);
    alert(`Hubo un error al generar el plano. Revisa la consola: ${err.message}`);
  }
}