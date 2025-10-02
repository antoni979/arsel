import jsPDF from 'jspdf';
import { fetchReportData } from './pdf-data';
import { buildTextPages } from './pdf-module-text';
import { buildInitialPhotoAnnex, buildRemediationPhotoAnnex } from './pdf-module-photos';
import { buildChecklistAnnex } from './pdf-module-checklist';
import { buildSummaryAnnex } from './pdf-module-summary';
// --- INICIO DE LA CORRECCIÓN: Importamos getArselLogoUrl ---
import { drawHeader, FONT_SIZES, DOC_WIDTH, getArselLogoUrl } from './pdf-helpers';

function sanitizeFileName(name) {
  let sanitized = name.replace(/\s+/g, '_');
  sanitized = sanitized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  sanitized = sanitized.replace(/[^a-zA-Z0-9_.-]/g, '');
  return sanitized;
}

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

    // --- INICIO DE LA CORRECCIÓN: Obtenemos y pasamos el logo de Arsel a la cabecera ---
    console.log("Añadiendo página de Anexo de Planos...");
    const arselLogoUrl = await getArselLogoUrl(); // Obtenemos la URL del logo
    pdf.addPage();
    await drawHeader(pdf, reportData.inspectionData, arselLogoUrl); // Pasamos la URL a la función
    pdf.setFontSize(FONT_SIZES.annexTitle);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ANEXO 03:', DOC_WIDTH / 2, 145, { align: 'center' });
    pdf.text('PLANOS', DOC_WIDTH / 2, 155, { align: 'center' });
    // --- FIN DE LA CORRECCIÓN ---
    
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


export async function generatePlanPdf(inspeccionId, finalLabels, originalDimensions) {
  try {
    console.log("Iniciando generación de PDF del Plano en formato A3...");
    const reportData = await fetchReportData(inspeccionId, { optimizePlan: false }); 
    
    if (!reportData.planoBase64) {
        throw new Error("No se pudo cargar la imagen del plano para esta inspección.");
    }

    const pdf = new jsPDF('l', 'mm', 'a3');
    
    console.log("Construyendo anexo de resumen visual con posiciones ajustadas...");
    await buildSummaryAnnex(pdf, reportData, finalLabels, originalDimensions);
    
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