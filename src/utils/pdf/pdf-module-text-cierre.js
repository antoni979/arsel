// src/utils/pdf/pdf-module-text-cierre.js
// Módulo específico para las páginas de texto del INFORME DE CIERRE

import { drawHeader, loadImageAsBase64, getArselLogoUrl, MARGIN, DOC_WIDTH, FONT_SIZES } from './pdf-helpers';

export async function buildTextPagesCierre(pdf, reportData) {
  const { inspectionData, incidenciasData, puntosMaestrosData, puntosInspeccionadosData, salasData } = reportData;

  // Fetch logo URL
  const arselLogoUrl = await getArselLogoUrl();

  const CONTENT_WIDTH = DOC_WIDTH - (MARGIN * 2);

  const fecha = new Date(inspectionData.fecha_inspeccion).toLocaleDateString('es-ES');

  // Crear mapeos necesarios
  const puntoMaestroASalaMap = new Map();
  puntosMaestrosData.forEach(pm => {
    const sala = salasData.find(s => s.id === pm.sala_id);
    if (sala) puntoMaestroASalaMap.set(pm.id, sala);
  });
  const puntoInspeccionadoAMaestroMap = new Map(puntosInspeccionadosData.map(pi => [pi.id, pi.punto_maestro_id]));

  // Función para agrupar puntos subsanados por sala
  // Solo incluye los puntos que tienen foto DESPUÉS (es decir, fueron subsanados)
  const agruparPuntosSubsanadosPorSala = () => {
    // Filtrar incidencias que tienen foto_despues (subsanadas)
    const incidenciasSubsanadas = incidenciasData.filter(inc => inc.url_foto_despues);

    if (incidenciasSubsanadas.length === 0) return '';

    const grupos = {};

    incidenciasSubsanadas.forEach(inc => {
      const puntoMaestroId = puntoInspeccionadoAMaestroMap.get(inc.punto_inspeccionado_id);
      if (!puntoMaestroId) return;

      const sala = puntoMaestroASalaMap.get(puntoMaestroId);
      const puntoMaestro = puntosMaestrosData.find(pm => pm.id === puntoMaestroId);

      if (sala && puntoMaestro) {
        if (!grupos[sala.nombre]) grupos[sala.nombre] = new Set();
        // Extraer solo el número del punto (última parte de la nomenclatura)
        grupos[sala.nombre].add(puntoMaestro.nomenclatura.split('-').pop());
      }
    });

    // Ordenar por nombre de sala y formatear
    const nombresDeSalasOrdenados = Object.keys(grupos).sort((a, b) => a.localeCompare(b));
    return nombresDeSalasOrdenados.map(nombreSala => {
      const numerosOrdenados = [...grupos[nombreSala]].sort((a, b) => parseInt(a) - parseInt(b)).join(',');
      return `${nombreSala.toUpperCase()}: ${numerosOrdenados}`;
    }).join('\n');
  };

  const puntosSubsanados = agruparPuntosSubsanadosPorSala();

  const TOP_MARGIN = 50;

  // --- PÁGINA 1 ---
  await drawHeader(pdf, inspectionData, arselLogoUrl);
  let currentY = TOP_MARGIN;

  // TÍTULO PRINCIPAL
  pdf.setFont('helvetica', 'bold');
  const titulo = `INFORME VISITA INSPECCIÓN DEL SISTEMA DE ALMACENAJE PARA CARGAS PALETIZADAS Y MANUALES DEL ${inspectionData.centros.nombre.toUpperCase()}`;
  pdf.setFontSize(FONT_SIZES.title);
  const tituloLines = pdf.splitTextToSize(titulo, CONTENT_WIDTH);
  pdf.text(tituloLines, DOC_WIDTH / 2, currentY, { align: 'center' });
  currentY += (tituloLines.length * 9) + 5; // Reducir espacio antes del subtítulo

  // SUBTÍTULO (SUBSANACIÓN DE ANOMALÍAS Y CIERRE DE INSPECCIÓN)
  pdf.setFontSize(FONT_SIZES.body);
  pdf.setFont('helvetica', 'bold');
  const subtitulo = '(SUBSANACIÓN DE ANOMALÍAS Y CIERRE DE INSPECCIÓN)';
  pdf.text(subtitulo, DOC_WIDTH / 2, currentY, { align: 'center' });
  currentY += 15;

  // 1. OBJETO (texto de cierre con fecha de inspección inicial)
  pdf.setFontSize(FONT_SIZES.h1).setFont('helvetica', 'bold');
  pdf.text('1. OBJETO', MARGIN, currentY);
  currentY += 8;
  pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'normal');
  const textoObjeto = `Con motivo de la visita programada para la validación del sistema de almacenaje para cargas paletizadas y manuales del ${inspectionData.centros.nombre}, se redacta el presente informe para constatar la subsanación de las anomalías detectadas en la visita de validación realizada el ${fecha} y que se reflejaban en las fichas checklist de revisión correspondientes.`;
  pdf.text(textoObjeto, MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 });
  currentY += 40;

  // 2. ANTECEDENTES (texto con "validación" en lugar de "inspección")
  pdf.setFontSize(FONT_SIZES.h1).setFont('helvetica', 'bold');
  pdf.text('2. ANTECEDENTES', MARGIN, currentY);
  currentY += 8;
  pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'normal');
  pdf.text('Para realizar la validación del sistema de almacenaje de cargas paletizadas y manuales ubicadas en las reservas se toma como base la memoria técnica previa de evaluación de dichos sistemas facilitada al centro para la realización de las correcciones oportunas. Este documento establece los parámetros dimensionales y de carga, así como los elementos y medidas de seguridad que deben contemplar los sistemas de almacenaje para garantizar su estabilidad y uso seguro.', MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 });
  currentY += 40;
  pdf.text('La validación consiste en la inspección visual del sistema llevada a cabo por un técnico cualificado, con la comprobación de los puntos de inspección recogidos en el checklist previsto para tal fin en la memoria de evaluación previa, con el consiguiente registro escrito de los resultados obtenidos.', MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 });

  pdf.addPage();
  await drawHeader(pdf, inspectionData, arselLogoUrl);
  currentY = TOP_MARGIN;

  // --- PÁGINA 2 ---
  const PAGE_HEIGHT = pdf.internal.pageSize.getHeight();
  const FOOTER_MARGIN = 30;

  const checkPageBreak = async (heightNeeded) => {
    if (currentY + heightNeeded > PAGE_HEIGHT - FOOTER_MARGIN) {
      pdf.addPage();
      await drawHeader(pdf, inspectionData, arselLogoUrl);
      currentY = TOP_MARGIN;
    }
  };

  // 3. RESULTADO DE LA VISITA (texto de cierre)
  pdf.setFontSize(FONT_SIZES.h1).setFont('helvetica', 'bold');
  pdf.text('3. RESULTADO DE LA VISITA', MARGIN, currentY);
  currentY += 8;
  pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'normal');

  // Texto introductorio
  const textoResultado = 'Se constata la subsanación de las anomalías detectadas en:';
  pdf.text(textoResultado, MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 });
  currentY += 10;

  // Listado de puntos subsanados por sala
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(FONT_SIZES.body);
  if (puntosSubsanados) {
    pdf.text(puntosSubsanados, MARGIN + 10, currentY, { lineHeightFactor: 1.5 });
    currentY += (puntosSubsanados.split('\n').length * 6) + 15;
  } else {
    pdf.setFont('helvetica', 'normal');
    pdf.text('No se encontraron puntos subsanados.', MARGIN + 10, currentY);
    currentY += 15;
  }

  // Texto de cierre
  pdf.setFont('helvetica', 'normal');
  const textoCierre = 'Dando por cerrado el proceso de validación correspondiente.';
  pdf.text(textoCierre, MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 });
  currentY += 30;

  // FIRMA
  await checkPageBreak(80);
  pdf.text('Informe realizado por:', MARGIN, currentY);

  currentY += 4;
  const signatureLogoUrl = await getArselLogoUrl('signature_logo');
  const finalLogoUrl = signatureLogoUrl || arselLogoUrl;
  const arselLogoBase64 = await loadImageAsBase64(finalLogoUrl);
  if (arselLogoBase64) {
      pdf.addImage(arselLogoBase64, 'PNG', MARGIN, currentY, 55, 25, undefined, 'MEDIUM');
      currentY += 28;
  }

  pdf.setFont('helvetica', 'bold').text('ARSEL INGENIERIA', MARGIN, currentY);
  currentY += 5;

  // La fecha que aparece aquí es la fecha de HOY (cuando se genera el informe de cierre)
  // No la fecha de la inspección inicial
  const fechaHoy = new Date().toLocaleDateString('es-ES');
  pdf.setFont('helvetica', 'normal').text(`Valencia, ${fechaHoy}`, MARGIN, currentY);
}
