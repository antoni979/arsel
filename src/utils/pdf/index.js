// src/utils/pdf/index.js

import jsPDF from 'jspdf';
import { fetchReportData } from './pdf-data';
import { buildTextPages } from './pdf-module-text';
import { buildInitialPhotoAnnex, buildRemediationPhotoAnnex } from './pdf-module-photos';
import { buildChecklistAnnex } from './pdf-module-checklist';
// === 1. IMPORTAMOS EL NUEVO MÓDULO ===
import { buildSummaryAnnex } from './pdf-module-summary';

export async function generatePdfReport(inspeccionId, reportType = 'initial') {
  try {
    console.log("Iniciando generación de PDF...");
    const reportData = await fetchReportData(inspeccionId);
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
    
    // === 2. AÑADIMOS LA LLAMADA AL NUEVO MÓDULO AL FINAL ===
    console.log("Construyendo anexo de resumen visual...");
    await buildSummaryAnnex(pdf, reportData);
    
    const { inspectionData } = reportData;
    const reportTypeName = reportType === 'initial' ? 'Informe' : 'Subsanacion';
    const fileName = `${reportTypeName}_${inspectionData.centros.nombre.replace(/ /g, '_')}_${inspectionData.fecha_inspeccion}.pdf`;
    
    console.log(`Guardando PDF como: ${fileName}`);
    pdf.save(fileName);

  } catch (err) {
    console.error("Error generando el PDF:", err);
    alert(`Hubo un error al generar el informe en PDF. Revisa la consola: ${err.message}`);
  }
}