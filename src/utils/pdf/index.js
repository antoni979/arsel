// src/utils/pdf/index.js

import jsPDF from 'jspdf';
import { fetchReportData } from './pdf-data';
import { buildTextPages } from './pdf-module-text';
import { buildInitialPhotoAnnex, buildRemediationPhotoAnnex } from './pdf-module-photos';
import { buildChecklistAnnex } from './pdf-module-checklist';
import { buildSummaryAnnex } from './pdf-module-summary';

// --- NUEVA FUNCIÓN HELPER PARA LIMPIAR NOMBRES DE ARCHIVO ---
function sanitizeFileName(name) {
  // 1. Reemplaza espacios con guiones bajos
  let sanitized = name.replace(/\s+/g, '_');
  // 2. Normaliza para separar tildes de las letras (ej. á -> a + ´)
  sanitized = sanitized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // 3. Elimina cualquier caracter que no sea letra, número, guión bajo, punto o guión
  sanitized = sanitized.replace(/[^a-zA-Z0-9_.-]/g, '');
  return sanitized;
}

/**
 * Genera el informe en PDF. Puede descargarlo o devolverlo como Blob.
 * @param {number} inspeccionId - El ID de la inspección.
 * @param {string} reportType - 'initial' o 'remediation'.
 * @param {string} outputType - 'download' o 'blob'.
 */
export async function generateTextReport(inspeccionId, reportType = 'initial', outputType = 'download') {
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
    const reportTypeName = reportType === 'initial' ? 'Informe' : 'Subsanacion';
    
    // --- INICIO DE LA CORRECCIÓN: Sanitizamos el nombre del archivo ---
    const rawFileName = `${reportTypeName}_${inspectionData.centros.nombre}_${inspectionData.fecha_inspeccion}.pdf`;
    const fileName = sanitizeFileName(rawFileName);
    // --- FIN DE LA CORRECCIÓN ---

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

/**
 * Genera un PDF que contiene ÚNICAMENTE el plano visual de incidencias.
 * @param {number} inspeccionId - El ID de la inspección.
 */
export async function generatePlanPdf(inspeccionId) {
  try {
    console.log("Iniciando generación de PDF del Plano...");
    const reportData = await fetchReportData(inspeccionId, { optimizePlan: true }); 
    
    if (!reportData.planoBase64) {
        throw new Error("No se pudo cargar la imagen del plano para esta inspección.");
    }

    const pdf = new jsPDF('l', 'mm', 'a4');
    
    console.log("Construyendo anexo de resumen visual...");
    await buildSummaryAnnex(pdf, reportData);
    
    const { inspectionData } = reportData;
    
    // --- INICIO DE LA CORRECCIÓN: Sanitizamos también aquí ---
    const rawFileName = `Plano_Incidencias_${inspectionData.centros.nombre}_${inspectionData.fecha_inspeccion}.pdf`;
    const fileName = sanitizeFileName(rawFileName);
    // --- FIN DE LA CORRECCIÓN ---

    console.log(`Guardando PDF como: ${fileName}`);
    pdf.save(fileName);

  } catch (err) {
    console.error("Error generando el PDF del Plano:", err);
    alert(`Hubo un error al generar el plano. Revisa la consola: ${err.message}`);
  }
}