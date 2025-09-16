// src/utils/pdf/pdf-module-text.js

import { drawHeader, loadImageAsBase64, ARSEL_LOGO_URL, MARGIN, DOC_WIDTH, FONT_SIZES } from './pdf-helpers';

export async function buildTextPages(pdf, reportData) {
  const { inspectionData, incidenciasData, puntosMaestrosData, puntosInspeccionadosData, salasData } = reportData;

  const fecha = new Date(inspectionData.fecha_inspeccion).toLocaleDateString('es-ES');
  const puntoMaestroASalaMap = new Map();
  puntosMaestrosData.forEach(pm => {
    const sala = salasData.find(s => s.id === pm.sala_id);
    if (sala) puntoMaestroASalaMap.set(pm.id, sala);
  });
  const puntoInspeccionadoAMaestroMap = new Map(puntosInspeccionadosData.map(pi => [pi.id, pi.punto_maestro_id]));
  
  const agruparPuntosPorPropiedad = (propiedad, valor) => {
    const puntosFiltrados = puntosInspeccionadosData.filter(pi => pi[propiedad] === valor);
    if (puntosFiltrados.length === 0) return '';
    const grupos = {};
    puntosFiltrados.forEach(pi => {
      const sala = puntoMaestroASalaMap.get(pi.punto_maestro_id);
      if (sala) {
        if (!grupos[sala.nombre]) grupos[sala.nombre] = new Set();
        grupos[sala.nombre].add(pi.nomenclatura.split('-').pop());
      }
    });
    // --- INICIO DE LA CORRECCIÓN ---
    // Se corrige `grupos[sala.nombre]` por `grupos[nombreSala]`
    return Object.keys(grupos).sort().map(nombreSala =>
      `${nombreSala.toUpperCase()}: ${[...grupos[nombreSala]].sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}`
    ).join('\n');
    // --- FIN DE LA CORRECCIÓN ---
  };

  const agruparPuntosConPlacaInvalida = () => {
    const puntosConProblemaDePlaca = puntosInspeccionadosData.filter(pi => 
        pi.tiene_placa_caracteristicas === false || pi.detalle_modificacion === 'aumentado'
    );
      
    if (puntosConProblemaDePlaca.length === 0) return '';

    const grupos = {};
    puntosConProblemaDePlaca.forEach(pi => {
        const sala = puntoMaestroASalaMap.get(pi.punto_maestro_id);
        if(sala) {
            if(!grupos[sala.nombre]) grupos[sala.nombre] = new Set();
            grupos[sala.nombre].add(pi.nomenclatura.split('-').pop());
        }
    });
    // --- INICIO DE LA CORRECCIÓN ---
    // Se aplica la misma corrección aquí para consistencia
    return Object.keys(grupos).sort().map(nombreSala => 
      `${nombreSala.toUpperCase()}: ${[...grupos[nombreSala]].sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}`
    ).join('\n');
    // --- FIN DE LA CORRECCIÓN ---
  };

  const lineasSuprimidas = agruparPuntosPorPropiedad('estado', 'suprimido');
  const lineasNuevas = agruparPuntosPorPropiedad('estado', 'nuevo');
  const lineasDisminuidas = agruparPuntosPorPropiedad('detalle_modificacion', 'disminuido');
  const lineasConPlacaInvalida = agruparPuntosConPlacaInvalida();
  
  const getSalaYNumeroDeIncidencia = (incidencia) => {
    const puntoMaestroId = puntoInspeccionadoAMaestroMap.get(incidencia.punto_inspeccionado_id);
    if (!puntoMaestroId) return null;
    const sala = puntoMaestroASalaMap.get(puntoMaestroId);
    const puntoMaestro = puntosMaestrosData.find(pm => pm.id === puntoMaestroId);
    if (!sala || !puntoMaestro) return null;
    return { nombreSala: sala.nombre, numeroPunto: puntoMaestro.nomenclatura.split('-').pop() };
  };

  const agruparIncidenciasPorSala = (incidencias) => {
    if (incidencias.length === 0) return '';
    const grupos = {};
    incidencias.forEach(inc => {
      const info = getSalaYNumeroDeIncidencia(inc);
      if (info) {
        if (!grupos[info.nombreSala]) grupos[info.nombreSala] = new Set();
        grupos[info.nombreSala].add(info.numeroPunto);
      }
    });
    const nombresDeSalasOrdenados = Object.keys(grupos).sort((a, b) => a.localeCompare(b));
    return nombresDeSalasOrdenados.map(nombreSala => {
      const numerosOrdenados = [...grupos[nombreSala]].sort((a, b) => parseInt(a) - parseInt(b)).join(', ');
      return `${nombreSala.toUpperCase()}: ${numerosOrdenados}`;
    }).join('\n');
  };

  const incidenciasVerdeAmbar = incidenciasData.filter(i => i.gravedad === 'verde' || i.gravedad === 'ambar');
  const textoVerdeAmbar = agruparIncidenciasPorSala(incidenciasVerdeAmbar);
  const incidenciasRojo = incidenciasData.filter(i => i.gravedad === 'rojo');
  const textoRojo = agruparIncidenciasPorSala(incidenciasRojo);

  // --- PÁGINA 1 ---
  await drawHeader(pdf, inspectionData);
  let currentY = 50;
  
  pdf.setFont('helvetica', 'bold');
  const titulo = `INFORME VISITA INSPECCIÓN DEL SISTEMA DE ALMACENAJE PARA CARGAS PALETIZADAS Y MANUALES DEL Hipermercado ${inspectionData.centros.nombre.toUpperCase()}`;
  pdf.setFontSize(FONT_SIZES.h2);
  const tituloLines = pdf.splitTextToSize(titulo, DOC_WIDTH - (MARGIN * 2));
  pdf.text(tituloLines, DOC_WIDTH / 2, currentY, { align: 'center' });
  currentY += (tituloLines.length * 7) + 15;

  pdf.setFontSize(FONT_SIZES.h2).setFont('helvetica', 'bold'); pdf.text('1. OBJETO', MARGIN, currentY); currentY += 8; pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'normal'); pdf.text(`Con motivo de la visita programada para la inspección del sistema de almacenaje para cargas paletizadas y manuales del ${inspectionData.centros.nombre}, se redacta el presente informe que recoge de forma somera el resultado de la visita.`, MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 }); currentY += 25;
  pdf.setFontSize(FONT_SIZES.h2).setFont('helvetica', 'bold'); pdf.text('2. ANTECEDENTES', MARGIN, currentY); currentY += 8; pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'normal'); pdf.text('Para realizar la inspección del sistema de almacenaje de cargas paletizadas y manuales ubicadas en las reservas se toma como base la memoria técnica previa de evaluación de dichos sistemas facilitada al centro para la realización de las correcciones oportunas. Este documento establece los parámetros dimensionales y de carga, así como los elementos y medidas de seguridad que deben contemplar los sistemas de almacenaje para garantizar su estabilidad y uso seguro.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 }); currentY += 40; pdf.text('La inspección consiste en la revisión visual del sistema llevada a cabo por un técnico cualificado, con la comprobación de los puntos recogidos en el checklist previsto para tal fin en la memoria de evaluación previa, con el consiguiente registro escrito de los resultados obtenidos.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 }); currentY += 30;
  pdf.setFontSize(FONT_SIZES.h2).setFont('helvetica', 'bold'); pdf.text('3. RESULTADO DE LA VISITA', MARGIN, currentY); currentY += 8; pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'normal'); pdf.text('En rasgos generales los sistemas de almacenaje cumplen los parámetros establecidos en la memoria técnica de evaluación.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 }); currentY += 15; 
  
  if (textoVerdeAmbar) {
    pdf.text('Se han detectado anomalías de riesgo verde y/o ámbar, tal y como se refleja en los listados de inspección elaborados durante la visita en:', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  }

  // --- PÁGINA 2 Y SIGUIENTES ---
  pdf.addPage();
  await drawHeader(pdf, inspectionData);
  currentY = 50;
  
  const PAGE_HEIGHT = pdf.internal.pageSize.getHeight();
  const FOOTER_MARGIN = 30;

  const checkPageBreak = async (heightNeeded) => {
    if (currentY + heightNeeded > PAGE_HEIGHT - FOOTER_MARGIN) {
      pdf.addPage();
      await drawHeader(pdf, inspectionData);
      currentY = 50;
    }
  };

  const addSection = async (title, content) => {
    if (!content && !title.toLowerCase().includes('nuevas montadas')) return;
    content = content || 'Ninguna';
    
    const titleHeight = 8;
    const contentHeight = content.split('\n').length * 5 + 5;
    await checkPageBreak(titleHeight + contentHeight);
    
    pdf.setFont('helvetica', 'normal').setFontSize(FONT_SIZES.body).text(title, MARGIN, currentY);
    currentY += titleHeight;
    pdf.setFont('helvetica', 'bold').text(content, MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += contentHeight;
  };

  if (textoVerdeAmbar) {
    pdf.setFont('helvetica', 'bold').setFontSize(FONT_SIZES.body).text(textoVerdeAmbar, MARGIN, currentY, { lineHeightFactor: 1.5 });
    currentY += (textoVerdeAmbar.split('\n').length * 5) + 5;
  }
  
  pdf.setFont('helvetica', 'normal').setFontSize(FONT_SIZES.body);
  
  const textoPostVerdeAmbar = 'Estas anomalías, si bien no comprometen de forma inmediata la estabilidad ni seguridad del sistema, deben subsanarse lo antes posible para evitar que puedan derivar en un riesgo mayor. (Se adjuntan listados de chequeo y reportaje fotográfico de la visita).';
  const postVerdeAmbarLines = pdf.splitTextToSize(textoPostVerdeAmbar, DOC_WIDTH - MARGIN * 2);
  await checkPageBreak(postVerdeAmbarLines.length * 5 + 15);
  pdf.text(textoPostVerdeAmbar, MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  currentY += postVerdeAmbarLines.length * 5 + 15;

  if(textoRojo) {
    const textoPreRojo = 'Puntualmente, se han detectado anomalías de riesgo rojo en:';
    await checkPageBreak(8 + textoRojo.split('\n').length * 5 + 5);
    pdf.text(textoPreRojo, MARGIN, currentY); currentY += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.text(textoRojo, MARGIN, currentY, { lineHeightFactor: 1.5 });
    currentY += (textoRojo.split('\n').length * 5) + 5;
    
    pdf.setFont('helvetica', 'normal');
    const textoRiesgoRojo = 'Estas anomalías deben subsanarse inmediatamente para evitar el colapso de las estanterías en el caso de una combinación de cargas desfavorables, procediendo a la descarga de la mercancía de los módulos afectados y señalizando la zona para que no se almacene producto en los mismos hasta que puedan ser sustituidos los elementos dañados. La sustitución se llevará a cabo con nuevo material que se tiene que solicitar si no cuenta con repuesto en el centro.';
    const textLines = pdf.splitTextToSize(textoRiesgoRojo, DOC_WIDTH - (MARGIN * 2));
    await checkPageBreak(textLines.length * 5 + 15);
    pdf.text(textLines, MARGIN, currentY, { lineHeightFactor: 1.5 });
    currentY += textLines.length * 5 + 15;
  }

  await addSection('Alineaciones sin placa de características o con placa no válida (por aumento de módulos):', lineasConPlacaInvalida);
  await addSection('Alineaciones con módulos DISMINUIDOS desde la inspección anterior:', lineasDisminuidas);
  await addSection('Alineaciones desmontadas desde la inspección anterior:', lineasSuprimidas);
  await addSection('Alineaciones nuevas montadas desde la inspección anterior:', lineasNuevas);

  await checkPageBreak(80);
  pdf.setFont('helvetica', 'normal').setFontSize(FONT_SIZES.body);
  pdf.text('Para cerrar el proceso de inspección completo, el centro subsanará las deficiencias de menor grado detectadas en los próximos días, comunicando la resolución de las mismas mediante correo electrónico a ARSEL Ingeniería y al Técnico de Prevención Regional.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 }); currentY += 40;
  pdf.text('Informe realizado por:', MARGIN, currentY); currentY += 15;
  const arselLogoBase64 = await loadImageAsBase64(ARSEL_LOGO_URL);
  if (arselLogoBase64) {
      pdf.addImage(arselLogoBase64, 'PNG', MARGIN, currentY, 35, 15, undefined, 'MEDIUM');
      currentY += 18;
  }
  pdf.setFont('helvetica', 'bold').text('ARSEL INGENIERIA', MARGIN, currentY);
  currentY += 5;
  pdf.setFont('helvetica', 'normal').text(`Valencia, ${fecha}`, MARGIN, currentY);
}