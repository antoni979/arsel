// src/utils/pdfGenerator.js

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { supabase } from '../supabase';
import { checklistItems } from './checklist';

const MARGIN = 15;
const DOC_WIDTH = 210;
const FONT_SIZES = { title: 16, h1: 14, h2: 12, body: 11, small: 8 };

// ¡IMPORTANTE! PEGA AQUÍ LA URL PÚBLICA REAL DE TU LOGO DE ARSEL
const ARSEL_LOGO_URL = "https://bgltxcklvjumltuktdvv.supabase.co/storage/v1/object/public/logos-clientes/logo.PNG"; // <-- REEMPLAZA ESTO

async function loadImageAsBase64(url) {
  if (!url || !url.startsWith('http')) return null;
  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.startsWith("image/")) {
      console.warn(`La URL no devolvió una imagen: ${url}`);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error cargando imagen para PDF:", url, error);
    return null;
  }
}

async function drawHeader(pdf, inspectionData) {
  const [clientLogoBase64, arselLogoBase64] = await Promise.all([
    loadImageAsBase64(inspectionData.centros.url_logo_cliente),
    loadImageAsBase64(ARSEL_LOGO_URL)
  ]);

  const headerY = MARGIN - 8;
  const headerHeight = 20;
  const contentWidth = DOC_WIDTH - (MARGIN * 2);
  const cell1Width = 40;
  const cell3Width = 40;
  const cell2Width = contentWidth - cell1Width - cell3Width;

  pdf.rect(MARGIN, headerY, contentWidth, headerHeight);
  pdf.line(MARGIN, headerY + 8, DOC_WIDTH - MARGIN, headerY + 8);
  pdf.line(MARGIN + cell1Width, headerY + 8, MARGIN + cell1Width, headerY + headerHeight);
  pdf.line(MARGIN + cell1Width + cell2Width, headerY + 8, MARGIN + cell1Width + cell2Width, headerY + headerHeight);

  pdf.setFontSize(FONT_SIZES.h2);
  pdf.setFont(undefined, 'bold');
  pdf.text(`HIPERMERCADO ${inspectionData.centros.nombre.toUpperCase()}`, DOC_WIDTH / 2, headerY + 5.5, { align: 'center' });

  if (clientLogoBase64) {
    pdf.addImage(clientLogoBase64, 'PNG', MARGIN + 2, headerY + 9.5, cell1Width - 4, 9, undefined, 'FAST');
  }

  pdf.setFontSize(FONT_SIZES.small);
  pdf.setFont(undefined, 'normal');
  const titleText = 'INFORME VISITA INSPECCIÓN DEL SISTEMA DE ALMACENAJE PARA CARGAS PALETIZADAS Y MANUALES';
  pdf.text(titleText, MARGIN + cell1Width + (cell2Width / 2), headerY + 12.5, {
    maxWidth: cell2Width - 4,
    align: 'center',
    lineHeightFactor: 1.2
  });
  
  if (arselLogoBase64) {
    pdf.addImage(arselLogoBase64, 'PNG', MARGIN + cell1Width + cell2Width + 2, headerY + 9.5, cell3Width - 4, 9, undefined, 'FAST');
  }
}

export async function generateReport(inspeccionId) {
  try {
    const { data: inspectionData } = await supabase.from('inspecciones').select('*, centros(*)').eq('id', inspeccionId).single();
    const { data: salasData } = await supabase.from('salas').select('*').eq('centro_id', inspectionData.centros.id).order('nombre');
    const { data: puntosMaestrosData } = await supabase.from('puntos_maestros').select('*').eq('centro_id', inspectionData.centros.id);
    const { data: puntosInspeccionadosData } = await supabase.from('puntos_inspeccionados').select('*').eq('inspeccion_id', inspeccionId);
    const { data: incidenciasData } = await supabase.from('incidencias').select('*').eq('inspeccion_id', inspeccionId);

    const pdf = new jsPDF('p', 'mm', 'a4');
    
    await addTextPages(pdf, inspectionData, incidenciasData, puntosMaestrosData, puntosInspeccionadosData, salasData);

    const incidenciasConFoto = incidenciasData.filter(inc => inc.url_foto_antes);
    if (incidenciasConFoto.length > 0) {
      pdf.addPage();
      await drawHeader(pdf, inspectionData);
      pdf.setFontSize(FONT_SIZES.title);
      pdf.text('ANEXO 01: REPORTAJE FOTOGRÁFICO', DOC_WIDTH / 2, 150, { align: 'center' });
      for (const incidencia of incidenciasConFoto) {
        const puntoInspeccionado = puntosInspeccionadosData.find(pi => pi.id === incidencia.punto_inspeccionado_id);
        const puntoMaestro = puntoInspeccionado ? puntosMaestrosData.find(pm => pm.id === puntoInspeccionado.punto_maestro_id) : null;
        if (!puntoMaestro) continue;

        pdf.addPage();
        await drawHeader(pdf, inspectionData);
        pdf.setFontSize(FONT_SIZES.h2);
        pdf.text(`Alineación: ${puntoMaestro.nomenclatura}`, MARGIN, 45);
        
        const photoContainer = document.createElement('div');
        photoContainer.style.position = 'absolute'; photoContainer.style.left = '-9999px';
        photoContainer.style.width = '180mm'; photoContainer.style.height = '100mm';
        photoContainer.innerHTML = `<img src="${incidencia.url_foto_antes}" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: contain;" />`;
        document.body.appendChild(photoContainer);
        
        const canvas = await html2canvas(photoContainer, { useCORS: true, allowTaint: true });
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        pdf.addImage(imgData, 'JPEG', MARGIN, 55, 180, 100, undefined, 'FAST');
        document.body.removeChild(photoContainer);

        pdf.setFontSize(FONT_SIZES.body);
        pdf.text('Observaciones:', MARGIN, 170);
        pdf.text(incidencia.observaciones || '', MARGIN, 175, { maxWidth: DOC_WIDTH - (MARGIN * 2) });
      }
    }

    if (salasData.length > 0) {
      pdf.addPage();
      await drawHeader(pdf, inspectionData);
      pdf.setFontSize(FONT_SIZES.title);
      pdf.text('ANEXO 02: CHECKLIST', DOC_WIDTH / 2, 150, { align: 'center' });
      
      for (const sala of salasData) {
        const puntosDeLaSala = puntosMaestrosData.filter(pm => pm.sala_id === sala.id).sort((a,b) => a.nomenclatura.localeCompare(b.nomenclatura, undefined, {numeric: true}));
        if (puntosDeLaSala.length === 0) continue;

        for (const puntoMaestro of puntosDeLaSala) {
          pdf.addPage();
          await drawHeader(pdf, inspectionData);
          pdf.setFontSize(FONT_SIZES.body);
          pdf.text(`Sala: ${sala.nombre}`, MARGIN, 45);
          pdf.text(`Alineación: ${puntoMaestro.nomenclatura.split('-').pop()}`, DOC_WIDTH - MARGIN, 45, { align: 'right' });

          const puntoInspeccionado = puntosInspeccionadosData.find(pi => pi.punto_maestro_id === puntoMaestro.id);
          const puntoInspeccionadoId = puntoInspeccionado ? puntoInspeccionado.id : null;
          const head = [
              [{ content: 'Parámetro de control', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
               { content: 'S', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
               { content: 'I', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
               { content: 'RIESGO', colSpan: 3, styles: { halign: 'center' } }],
              ['V', 'A', 'R']
          ];
          const body = checklistItems.map(item => {
            const incidencia = incidenciasData.find(inc => inc.punto_inspeccionado_id === puntoInspeccionadoId && inc.item_checklist === item.id);
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
            head, body, startY: 50, margin: { left: MARGIN, right: MARGIN }, theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak' },
            headStyles: { fillColor: [238, 238, 238], textColor: 0, fontStyle: 'bold', halign: 'center', fontSize: 7 },
            columnStyles: {
              0: { cellWidth: 115 }, 1: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 10, halign: 'center' },
              3: { cellWidth: 10, halign: 'center' }, 4: { cellWidth: 10, halign: 'center' }, 5: { cellWidth: 10, halign: 'center' },
            },
          });
        }
      }
    }

    pdf.save(`Informe_${inspectionData.centros.nombre.replace(/ /g, '_')}_${inspectionData.fecha_inspeccion}.pdf`);

  } catch (err) {
    console.error("Error generando el PDF:", err);
    alert("Hubo un error al generar el informe en PDF. Revisa la consola.");
  }
}

async function addTextPages(pdf, inspectionData, incidenciasData, puntosMaestrosData, puntosInspeccionadosData, salasData) {
  const fecha = new Date(inspectionData.fecha_inspeccion).toLocaleDateString('es-ES');
  const puntoMaestroASalaMap = new Map();
  puntosMaestrosData.forEach(pm => {
    const sala = salasData.find(s => s.id === pm.sala_id);
    if (sala) puntoMaestroASalaMap.set(pm.id, sala);
  });
  const puntoInspeccionadoAMaestroMap = new Map(puntosInspeccionadosData.map(pi => [pi.id, pi.punto_maestro_id]));

  const agruparPuntosPorEstadoYSala = (estado) => {
    const puntosFiltrados = puntosInspeccionadosData.filter(pi => pi.estado === estado);
    const grupos = {};
    puntosFiltrados.forEach(pi => {
      const sala = puntoMaestroASalaMap.get(pi.punto_maestro_id);
      if (sala) {
        if (!grupos[sala.nombre]) grupos[sala.nombre] = new Set();
        grupos[sala.nombre].add(pi.nomenclatura.split('-').pop());
      }
    });
    return Object.entries(grupos).map(([nombreSala, numerosSet]) => 
      `${nombreSala.toUpperCase()}: ${[...numerosSet].sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}`
    );
  };

  const lineasSuprimidas = agruparPuntosPorEstadoYSala('suprimido');
  const lineasNuevas = agruparPuntosPorEstadoYSala('nuevo');
  
  const getSalaYNumeroDeIncidencia = (incidencia) => {
    const puntoMaestroId = puntoInspeccionadoAMaestroMap.get(incidencia.punto_inspeccionado_id);
    if (!puntoMaestroId) return null;
    const sala = puntoMaestroASalaMap.get(puntoMaestroId);
    const puntoMaestro = puntosMaestrosData.find(pm => pm.id === puntoMaestroId);
    if (!sala || !puntoMaestro) return null;
    return { nombreSala: sala.nombre, numeroPunto: puntoMaestro.nomenclatura.split('-').pop() };
  };

  const agruparIncidenciasPorSala = (incidencias) => {
    const grupos = {};
    incidencias.forEach(inc => {
      const info = getSalaYNumeroDeIncidencia(inc);
      if (info) {
        if (!grupos[info.nombreSala]) grupos[info.nombreSala] = new Set();
        grupos[info.nombreSala].add(info.numeroPunto);
      }
    });
    const nombresDeSalas = Object.keys(grupos);
    if (nombresDeSalas.length === 1 && nombresDeSalas[0].toLowerCase() === 'única') {
        const numerosSet = grupos[nombresDeSalas[0]];
        return `Única: ${[...numerosSet].sort((a, b) => a - b).join(', ')}`;
    }
    return Object.entries(grupos).map(([nombreSala, numerosSet]) => 
      `${nombreSala}: ${[...numerosSet].sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}`
    ).join('\n');
  };

  const incidenciasVerdeAmbar = incidenciasData.filter(i => i.gravedad === 'verde' || i.gravedad === 'ambar');
  const incidenciasRojo = incidenciasData.filter(i => i.gravedad === 'rojo');
  const textoVerdeAmbar = agruparIncidenciasPorSala(incidenciasVerdeAmbar);
  const textoRojo = agruparIncidenciasPorSala(incidenciasRojo);

  // --- PÁGINA 1 ---
  await drawHeader(pdf, inspectionData);
  let currentY = 50;
  
  pdf.setFontSize(FONT_SIZES.h2); pdf.setFont(undefined, 'bold');
  pdf.text('1. OBJETO', MARGIN, currentY);
  currentY += 8;
  pdf.setFontSize(FONT_SIZES.body); pdf.setFont(undefined, 'normal');
  pdf.text(`Con motivo de la visita programada para la inspección del sistema de almacenaje para cargas paletizadas y manuales del ${inspectionData.centros.nombre}, se redacta el presente informe que recoge de forma somera el resultado de la visita.`, MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 25;

  pdf.setFontSize(FONT_SIZES.h2); pdf.setFont(undefined, 'bold');
  pdf.text('2. ANTECEDENTES', MARGIN, currentY);
  currentY += 8;
  pdf.setFontSize(FONT_SIZES.body); pdf.setFont(undefined, 'normal');
  pdf.text('Para realizar la inspección del sistema de almacenaje de cargas paletizadas y manuales ubicadas en las reservas se toma como base la memoria técnica previa de evaluación de dichos sistemas facilitada al centro para la realización de las correcciones oportunas. Este documento establece los parámetros dimensionales y de carga, así como los elementos y medidas de seguridad que deben contemplar los sistemas de almacenaje para garantizar su estabilidad y uso seguro.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 40;
  pdf.text('La inspección consiste en la revisión visual del sistema llevada a cabo por un técnico cualificado, con la comprobación de los puntos recogidos en el checklist previsto para tal fin en la memoria de evaluación previa, con el consiguiente registro escrito de los resultados obtenidos.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 30;
  
  pdf.setFontSize(FONT_SIZES.h2); pdf.setFont(undefined, 'bold');
  pdf.text('3. RESULTADO DE LA VISITA', MARGIN, currentY);
  currentY += 8;
  pdf.setFontSize(FONT_SIZES.body); pdf.setFont(undefined, 'normal');
  pdf.text('En rasgos generales los sistemas de almacenaje cumplen los parámetros establecidos en la memoria técnica de evaluación.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 15;
  pdf.text('Se han detectado anomalías de riesgo verde y/o ámbar, tal y como se refleja en los listados de inspección elaborados durante la visita en:', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  
  // --- PÁGINA 2 ---
  pdf.addPage();
  await drawHeader(pdf, inspectionData);
  currentY = 50;
  
  pdf.setFontSize(FONT_SIZES.body); pdf.setFont(undefined, 'bold');
  if (textoVerdeAmbar) {
    pdf.text(textoVerdeAmbar, MARGIN, currentY, { lineHeightFactor: 1.5 });
    currentY += (textoVerdeAmbar.split('\n').length) * 8;
  }
  
  pdf.setFontSize(FONT_SIZES.body); pdf.setFont(undefined, 'normal');
  currentY = Math.max(currentY, 65);
  pdf.text('Estas anomalías, si bien no comprometen de forma inmediata la estabilidad ni seguridad del sistema, deben subsanarse lo antes posible para evitar que puedan derivar en un riesgo mayor. (Se adjuntan listados de chequeo y reportaje fotográfico de la visita).', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += 30;

  pdf.text('Puntualmente, se han detectado anomalías de riesgo rojo en:', MARGIN, currentY);
  currentY += 8;
  
  pdf.setFontSize(FONT_SIZES.body); pdf.setFont(undefined, 'bold');
  if (textoRojo) {
    pdf.text(textoRojo, MARGIN, currentY, { lineHeightFactor: 1.5 });
    currentY += (textoRojo.split('\n').length) * 8;
  }
  
  pdf.setFontSize(FONT_SIZES.body); pdf.setFont(undefined, 'normal');
  currentY = Math.max(currentY, 130);
  const textoRiesgoRojo = 'Estas anomalías deben subsanarse inmediatamente para evitar el colapso de las estanterías en el caso de una combinación de cargas desfavorables, procediendo a la descarga de la mercancía de los módulos afectados y señalizando la zona para que no se almacene producto en los mismos hasta que puedan ser sustituidos los elementos dañados. La sustitución se llevará a cabo con nuevo material que se tiene que solicitar si no cuenta con repuesto en el centro.';
  const textLines = pdf.splitTextToSize(textoRiesgoRojo, DOC_WIDTH - (MARGIN * 2));
  pdf.text(textLines, MARGIN, currentY, { lineHeightFactor: 1.5 });
  currentY += textLines.length * 5 + 5; // Avanzar Y según el tamaño del texto

  // === INICIO DEL CAMBIO: Secciones movidas aquí ===
  if (lineasSuprimidas.length > 0) {
    pdf.setFontSize(FONT_SIZES.body); pdf.setFont(undefined, 'bold');
    pdf.text('Alineaciones desmontadas desde la inspección anterior:', MARGIN, currentY);
    currentY += 7;
    pdf.setFont(undefined, 'normal');
    lineasSuprimidas.forEach(linea => {
      pdf.text(linea, MARGIN + 5, currentY);
      currentY += 6;
    });
    currentY += 5;
  }

  if (lineasNuevas.length > 0) {
    pdf.setFontSize(FONT_SIZES.body); pdf.setFont(undefined, 'bold');
    pdf.text('Alineaciones nuevas montadas desde la inspección anterior:', MARGIN, currentY);
    currentY += 7;
    pdf.setFont(undefined, 'normal');
    lineasNuevas.forEach(linea => {
      pdf.text(linea, MARGIN + 5, currentY);
      currentY += 6;
    });
    currentY += 10;
  }
  // === FIN DEL CAMBIO ===

  // --- PÁGINA 3 ---
  pdf.addPage();
  await drawHeader(pdf, inspectionData);
  currentY = 50;
  pdf.setFontSize(FONT_SIZES.body); pdf.setFont(undefined, 'normal');
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