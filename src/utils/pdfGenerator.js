// src/utils/pdfGenerator.js

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { supabase } from '../supabase';
import { checklistItems } from './checklist';

const PDF_OPTIONS = {
  image: { type: 'jpeg', quality: 0.85 },
  html2canvas: { scale: 2, useCORS: true, allowTaint: true },
};

const MARGIN = 15;
const DOC_WIDTH = 210;
const FONT_SIZES = { title: 16, h1: 14, h2: 12, body: 11, small: 8 };

function drawHeader(pdf, inspectionData) {
  pdf.setFontSize(FONT_SIZES.small);
  pdf.setFont(undefined, 'bold');
  pdf.text(`HIPERMERCADO ${inspectionData.centros.nombre.toUpperCase()}`, DOC_WIDTH / 2, MARGIN, { align: 'center' });
  pdf.setFontSize(FONT_SIZES.small - 1);
  pdf.setFont(undefined, 'normal');
  pdf.text('INFORME VISITA INSPECCIÓN DEL SISTEMA DE ALMACENAJE', DOC_WIDTH / 2, MARGIN + 4, { align: 'center' });
  pdf.rect(MARGIN, MARGIN - 8, DOC_WIDTH - (MARGIN * 2), 12);
}

export async function generateReport(inspeccionId) {
  try {
    const { data: inspectionData } = await supabase.from('inspecciones').select('*, centros(*)').eq('id', inspeccionId).single();
    const { data: puntosData } = await supabase.from('puntos_maestros').select('*').eq('centro_id', inspectionData.centros.id).order('nomenclatura');
    const { data: incidenciasData } = await supabase.from('incidencias').select('*').eq('inspeccion_id', inspeccionId);

    const pdf = new jsPDF('p', 'mm', 'a4');

    // --- PÁGINAS DE TEXTO (Ahora son 100% vectoriales y rápidas) ---
    addTextPages(pdf, inspectionData, incidenciasData, puntosData);

    // --- ANEXO 1: FOTOS (Usando html2canvas) ---
    const incidenciasConFoto = incidenciasData.filter(inc => inc.url_foto_antes);
    if (incidenciasConFoto.length > 0) {
      pdf.addPage();
      drawHeader(pdf, inspectionData);
      pdf.setFontSize(FONT_SIZES.title);
      pdf.text('ANEXO 01: REPORTAJE FOTOGRÁFICO', DOC_WIDTH / 2, 150, { align: 'center' });
      for (const incidencia of incidenciasConFoto) {
        const punto = puntosData.find(p => p.id === incidencia.punto_maestro_id);
        pdf.addPage();
        drawHeader(pdf, inspectionData);
        pdf.setFontSize(FONT_SIZES.h2);
        pdf.text(`Reserva: ÚNICA, Alineación: ${punto.nomenclatura.split('-')[1]}`, MARGIN, 40);
        
        const photoContainer = document.createElement('div');
        photoContainer.style.position = 'absolute';
        photoContainer.style.left = '-9999px';
        photoContainer.style.width = '180mm';
        photoContainer.style.height = '100mm';
        photoContainer.innerHTML = `<img src="${incidencia.url_foto_antes}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: contain;" />`;
        document.body.appendChild(photoContainer);
        
        const canvas = await html2canvas(photoContainer, { useCORS: true, allowTaint: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        pdf.addImage(imgData, 'JPEG', MARGIN, 50, 180, 100, undefined, 'FAST');
        document.body.removeChild(photoContainer);

        pdf.setFontSize(FONT_SIZES.body);
        pdf.text('Observaciones:', MARGIN, 165);
        pdf.text(incidencia.observaciones || '', MARGIN, 170, { maxWidth: DOC_WIDTH - (MARGIN * 2) });
      }
    }

    // --- ANEXO 2: CHECKLIST (Con autoTable) ---
    if (puntosData.length > 0) {
      pdf.addPage();
      drawHeader(pdf, inspectionData);
      pdf.setFontSize(FONT_SIZES.title);
      pdf.text('ANEXO 02: CHECKLIST', DOC_WIDTH / 2, 150, { align: 'center' });
      for (const punto of puntosData) {
        pdf.addPage();
        drawHeader(pdf, inspectionData);
        pdf.setFontSize(FONT_SIZES.body);
        pdf.text(`Reserva: ÚNICA`, MARGIN, 35);
        pdf.text(`Alineación: ${punto.nomenclatura.split('-')[1]}`, DOC_WIDTH - MARGIN, 35, { align: 'right' });

        const head = [
            [{ content: 'Parámetro de control', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
             { content: 'S', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
             { content: 'I', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
             { content: 'RIESGO', colSpan: 3, styles: { halign: 'center' } }],
            ['V', 'A', 'R']
        ];
        const body = checklistItems.map(item => {
          const incidencia = incidenciasData.find(inc => inc.punto_maestro_id === punto.id && inc.item_checklist === item.id);
          return [
            `${item.id}. ${item.text}`,
            incidencia ? '' : 'X',
            incidencia ? 'X' : '',
            incidencia?.gravedad === 'verde' ? 'X' : '',
            incidencia?.gravedad === 'ambar' ? 'X' : '',
            incidencia?.gravedad === 'rojo' ? 'X' : '',
          ];
        });
        autoTable(pdf, {
          head, body, startY: 40, margin: { left: MARGIN, right: MARGIN }, theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
          headStyles: { fillColor: [238, 238, 238], textColor: 0, fontStyle: 'bold', halign: 'center', fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 115 }, 1: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 10, halign: 'center' },
            3: { cellWidth: 10, halign: 'center' }, 4: { cellWidth: 10, halign: 'center' }, 5: { cellWidth: 10, halign: 'center' },
          },
        });
      }
    }

    pdf.save(`Informe_${inspectionData.centros.nombre.replace(/ /g, '_')}_${inspectionData.fecha_inspeccion}.pdf`);

  } catch (err) {
    console.error("Error generando el PDF:", err);
    alert("Hubo un error al generar el informe en PDF. Revisa la consola.");
  }
}

// --- NUEVA FUNCIÓN PARA DIBUJAR TODAS LAS PÁGINAS DE TEXTO ---
function addTextPages(pdf, inspectionData, incidenciasData, puntosData) {
  const getPuntoNomenclatura = (puntoId) => puntosData.find(p => p.id === puntoId)?.nomenclatura.split('-')[1] || '?';
  const incidenciasVerdeAmbar = incidenciasData.filter(i => i.gravedad === 'verde' || i.gravedad === 'ambar');
  const incidenciasRojo = incidenciasData.filter(i => i.gravedad === 'rojo');
  const puntosVerdeAmbarStr = incidenciasVerdeAmbar.map(i => getPuntoNomenclatura(i.punto_maestro_id)).join(', ');
  const puntosRojoStr = incidenciasRojo.map(i => getPuntoNomenclatura(i.punto_maestro_id)).join(', ');
  const fecha = new Date(inspectionData.fecha_inspeccion).toLocaleDateString('es-ES');

  // --- PÁGINA 1 ---
  drawHeader(pdf, inspectionData);
  let currentY = 40; // Posición vertical inicial
  
  pdf.setFontSize(FONT_SIZES.h2);
  pdf.setFont(undefined, 'bold');
  pdf.text('1. OBJETO', MARGIN, currentY);
  currentY += 8;
  
  pdf.setFontSize(FONT_SIZES.body);
  pdf.setFont(undefined, 'normal');
  pdf.text(`Con motivo de la visita programada para la inspección del sistema de almacenaje para cargas paletizadas y manuales del ${inspectionData.centros.nombre}, se redacta el presente informe que recoge de forma somera el resultado de la visita.`, MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 30;

  pdf.setFontSize(FONT_SIZES.h2);
  pdf.setFont(undefined, 'bold');
  pdf.text('2. ANTECEDENTES', MARGIN, currentY);
  currentY += 8;

  pdf.setFontSize(FONT_SIZES.body);
  pdf.setFont(undefined, 'normal');
  pdf.text('Para realizar la inspección del sistema de almacenaje de cargas paletizadas y manuales ubicadas en las reservas se toma como base la memoria técnica previa de evaluación de dichos sistemas facilitada al centro para la realización de las correcciones oportunas. Este documento establece los parámetros dimensionales y de carga, así como los elementos y medidas de seguridad que deben contemplar los sistemas de almacenaje para garantizar su estabilidad y uso seguro.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 45;
  pdf.text('La inspección consiste en la revisión visual del sistema llevada a cabo por un técnico cualificado, con la comprobación de los puntos recogidos en el checklist previsto para tal fin en la memoria de evaluación previa, con el consiguiente registro escrito de los resultados obtenidos.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 35;
  
  pdf.setFontSize(FONT_SIZES.h2);
  pdf.setFont(undefined, 'bold');
  pdf.text('3. RESULTADO DE LA VISITA', MARGIN, currentY);
  currentY += 8;
  
  pdf.setFontSize(FONT_SIZES.body);
  pdf.setFont(undefined, 'normal');
  pdf.text('En rasgos generales los sistemas de almacenaje cumplen los parámetros establecidos en la memoria técnica de evaluación.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 15;
  pdf.text('Se han detectado anomalías de riesgo verde y/o ámbar, tal y como se refleja en los listados de inspección elaborados durante la visita en:', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  
  // --- PÁGINA 2 ---
  pdf.addPage();
  drawHeader(pdf, inspectionData);
  currentY = 40;
  
  pdf.setFontSize(FONT_SIZES.body);
  pdf.setFont(undefined, 'bold');
  pdf.text(`ÚNICA: ${puntosVerdeAmbarStr}`, MARGIN, currentY);
  currentY += 8;

  pdf.setFontSize(FONT_SIZES.body);
  pdf.setFont(undefined, 'normal');
  pdf.text('Estas anomalías, si bien no comprometen de forma inmediata la estabilidad ni seguridad del sistema, deben subsanarse lo antes posible para evitar que puedan derivar en un riesgo mayor. (Se adjuntan listados de chequeo y reportaje fotográfico de la visita).', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 30;

  pdf.text('Puntualmente, se han detectado anomalías de riesgo rojo en:', MARGIN, currentY);
  currentY += 8;

  pdf.setFontSize(FONT_SIZES.body);
  pdf.setFont(undefined, 'bold');
  pdf.text(`ÚNICA: ${puntosRojoStr}`, MARGIN, currentY);
  currentY += 8;
  
  pdf.setFontSize(FONT_SIZES.body);
  pdf.setFont(undefined, 'normal');
  pdf.text('Estas anomalías deben subsanarse inmediatamente para evitar el colapso de las estanterías en el caso de una combinación de cargas desfavorables, procediendo a la descarga de la mercancía de los módulos afectados y señalizando la zona para que no se almacene producto en los mismos hasta que puedan ser sustituidos los elementos dañados. La sustitución se llevará a cabo con nuevo material que se tiene que solicitar si no cuenta con repuesto en el centro.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });

  // --- PÁGINA 3 ---
  pdf.addPage();
  drawHeader(pdf, inspectionData);
  currentY = 40;

  pdf.setFontSize(FONT_SIZES.body);
  pdf.setFont(undefined, 'normal');
  pdf.text('Para cerrar el proceso de inspección completo, el centro subsanará las deficiencias de menor grado detectadas en los próximos días, comunicando la resolución de las mismas mediante correo electrónico a ARSEL Ingeniería y al Técnico de Prevención Regional.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 40;
  
  pdf.text('Informe realizado por:', MARGIN, currentY);
  currentY += 15;

  pdf.setFont(undefined, 'bold');
  pdf.text('ARSEL INGENIERIA', MARGIN, currentY);
  currentY += 5;
  
  pdf.setFont(undefined, 'normal');
  pdf.text(`Valencia, ${fecha}`, MARGIN, currentY);
}