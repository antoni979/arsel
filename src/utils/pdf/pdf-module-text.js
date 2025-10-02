// src/utils/pdf/pdf-module-text.js

import { drawHeader, loadImageAsBase64, getArselLogoUrl, MARGIN, DOC_WIDTH, FONT_SIZES } from './pdf-helpers';

export async function buildTextPages(pdf, reportData) {
  const { inspectionData, incidenciasData, puntosMaestrosData, puntosInspeccionadosData, salasData } = reportData;

  // Fetch logo URL
  const arselLogoUrl = await getArselLogoUrl();

  const CONTENT_WIDTH = DOC_WIDTH - (MARGIN * 2);

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
    return Object.keys(grupos).sort().map(nombreSala =>
      `${nombreSala.toUpperCase()}: ${[...grupos[nombreSala]].sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}`
    ).join('\n');
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
    return Object.keys(grupos).sort().map(nombreSala => 
      `${nombreSala.toUpperCase()}: ${[...grupos[nombreSala]].sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}`
    ).join('\n');
  };

  const lineasSuprimidas = agruparPuntosPorPropiedad('estado', 'suprimido');
  const lineasNuevas = agruparPuntosPorPropiedad('estado', 'nuevo');
  const lineasDisminuidas = agruparPuntosPorPropiedad('detalle_modificacion', 'disminuido');
  const lineasAumentadas = agruparPuntosPorPropiedad('detalle_modificacion', 'aumentado');
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
  
  const TOP_MARGIN = 50;

  // --- PÁGINA 1 ---
  await drawHeader(pdf, inspectionData, arselLogoUrl);
  let currentY = TOP_MARGIN;
  
  pdf.setFont('helvetica', 'bold');
  const titulo = `INFORME VISITA INSPECCIÓN DEL SISTEMA DE ALMACENAJE PARA CARGAS PALETIZADAS Y MANUALES DEL CENTRO ${inspectionData.centros.nombre.toUpperCase()}`;
  pdf.setFontSize(FONT_SIZES.title);
  const tituloLines = pdf.splitTextToSize(titulo, CONTENT_WIDTH);
  pdf.text(tituloLines, DOC_WIDTH / 2, currentY, { align: 'center' });
  currentY += (tituloLines.length * 9) + 15;

  pdf.setFontSize(FONT_SIZES.h1).setFont('helvetica', 'bold'); 
  pdf.text('1. OBJETO', MARGIN, currentY); 
  currentY += 8; 
  pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'normal'); 
  pdf.text(`Con motivo de la visita programada para la inspección del sistema de almacenaje para cargas paletizadas y manuales del ${inspectionData.centros.nombre}, se redacta el presente informe que recoge de forma somera el resultado de la visita.`, MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 }); 
  currentY += 40;

  pdf.setFontSize(FONT_SIZES.h1).setFont('helvetica', 'bold'); 
  pdf.text('2. ANTECEDENTES', MARGIN, currentY); 
  currentY += 8; 
  pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'normal'); 
  pdf.text('Para realizar la inspección del sistema de almacenaje de cargas paletizadas y manuales ubicadas en las reservas se toma como base la memoria técnica previa de evaluación de dichos sistemas facilitada al centro para la realización de las correcciones oportunas. Este documento establece los parámetros dimensionales y de carga, así como los elementos y medidas de seguridad que deben contemplar los sistemas de almacenaje para garantizar su estabilidad y uso seguro.', MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 }); 
  currentY += 40; 
  pdf.text('La inspección consiste en la revisión visual del sistema llevada a cabo por un técnico cualificado, con la comprobación de los puntos recogidos en el checklist previsto para tal fin en la memoria de evaluación previa, con el consiguiente registro escrito de los resultados obtenidos.', MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 }); 
  
  pdf.addPage();
  await drawHeader(pdf, inspectionData, arselLogoUrl);
  currentY = TOP_MARGIN;

  // --- PÁGINA 2 Y SIGUIENTES ---
  const PAGE_HEIGHT = pdf.internal.pageSize.getHeight();
  const FOOTER_MARGIN = 30;

  const checkPageBreak = async (heightNeeded) => {
    if (currentY + heightNeeded > PAGE_HEIGHT - FOOTER_MARGIN) {
      pdf.addPage();
      await drawHeader(pdf, inspectionData, arselLogoUrl);
      currentY = TOP_MARGIN;
    }
  };

  const addSection = async (title, content) => {
    content = content || 'Ninguna';

    const titleHeight = 8;
    const contentHeight = content.split('\n').length * 5 + 5;
    await checkPageBreak(titleHeight + contentHeight);

    pdf.setFont('helvetica', 'normal').setFontSize(FONT_SIZES.body).text(title, MARGIN, currentY);
    currentY += titleHeight;
    pdf.setFont('helvetica', 'bold').text(content, MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += contentHeight;
  };

  pdf.setFontSize(FONT_SIZES.h1).setFont('helvetica', 'bold'); 
  pdf.text('3. RESULTADO DE LA VISITA', MARGIN, currentY); 
  currentY += 8; 
  pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'normal'); 
  pdf.text('En rasgos generales los sistemas de almacenaje cumplen los parámetros establecidos en la memoria técnica de evaluación.', MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 }); 
  currentY += 15; 
  
  if (textoVerdeAmbar) {
    const introText = 'Se han detectado anomalías de riesgo verde y/o ámbar, tal y como se refleja en los listados de inspección elaborados durante la visita en:';
    pdf.text(introText, MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 });
    const introTextHeight = pdf.splitTextToSize(introText, CONTENT_WIDTH).length * 5 * 1.5;
    currentY += introTextHeight;
  }

  if (textoVerdeAmbar) {
    pdf.setFont('helvetica', 'bold').setFontSize(FONT_SIZES.body);
    pdf.text(textoVerdeAmbar, MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += (textoVerdeAmbar.split('\n').length * 5) + 5;
  }
  
  pdf.setFont('helvetica', 'normal').setFontSize(FONT_SIZES.body);
  
  const textoPostVerdeAmbar = 'Estas anomalías, si bien no comprometen de forma inmediata la estabilidad ni seguridad del sistema, deben subsanarse lo antes posible para evitar que puedan derivar en un riesgo mayor. (Se adjuntan listados de chequeo y reportaje fotográfico de la visita).';
  const newMargin = MARGIN + 5;
  const newContentWidth = DOC_WIDTH - (newMargin * 2);
  await checkPageBreak((pdf.splitTextToSize(textoPostVerdeAmbar, newContentWidth).length * 5 * 1.5) + 5);
  pdf.text(textoPostVerdeAmbar, newMargin, currentY, { maxWidth: newContentWidth, align: 'justify', lineHeightFactor: 1.5 });
  currentY += (pdf.splitTextToSize(textoPostVerdeAmbar, newContentWidth).length * 5 * 1.5) + 15;

  if(textoRojo) {
    currentY += 5;
    const textoPreRojo = 'Puntualmente, se han detectado anomalías de riesgo rojo en:';
    await checkPageBreak(8 + textoRojo.split('\n').length * 5 + 5);
    pdf.text(textoPreRojo, MARGIN, currentY, { align: 'justify' }); 
    currentY += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.text(textoRojo, MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += (textoRojo.split('\n').length * 5) + 5;
    
    pdf.setFont('helvetica', 'normal');
    const textoRiesgoRojo = 'Estas anomalías deben subsanarse inmediatamente para evitar el colapso de las estanterías en el caso de una combinación de cargas desfavorables, procediendo a la descarga de la mercancía de los módulos afectados y señalizando la zona para que no se almacene producto en los mismos hasta que puedan ser sustituidos los elementos dañados. La sustitución se llevará a cabo con nuevo material que se tiene que solicitar si no cuenta con repuesto en el centro.';
    await checkPageBreak((pdf.splitTextToSize(textoRiesgoRojo, CONTENT_WIDTH).length * 5 * 1.5) + 15);
    pdf.text(textoRiesgoRojo, MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 });
    currentY += (pdf.splitTextToSize(textoRiesgoRojo, CONTENT_WIDTH).length * 5 * 1.5) + 15;
  }

  await addSection('Alineaciones sin ficha de características o con ficha no válida:', lineasConPlacaInvalida);
  await addSection('Alineaciones con módulos DISMINUIDOS desde la inspección anterior:', lineasDisminuidas);
  await addSection('Alineaciones con módulos AUMENTADOS desde la inspección anterior:', lineasAumentadas);
  await addSection('Alineaciones desmontadas desde la inspección anterior:', lineasSuprimidas);
  await addSection('Alineaciones nuevas montadas desde la inspección anterior:', lineasNuevas);

  await checkPageBreak(80);
  pdf.setFont('helvetica', 'normal').setFontSize(FONT_SIZES.body);
  pdf.text('Para cerrar el proceso de inspección completo, el centro subsanará las deficiencias de menor grado detectadas en los próximos días, comunicando la resolución de las mismas mediante correo electrónico a ARSEL Ingeniería y al Técnico de Prevención Regional.', MARGIN, currentY, { maxWidth: CONTENT_WIDTH, align: 'justify', lineHeightFactor: 1.5 }); 
  currentY += 40;
  pdf.text('Informe realizado por:', MARGIN, currentY);
  
  // --- INICIO DE LA CORRECCIÓN ---
  currentY += 4; // 1. Reducir el espacio vertical
  const signatureLogoUrl = await getArselLogoUrl('signature_logo');
  const finalLogoUrl = signatureLogoUrl || arselLogoUrl;
  const arselLogoBase64 = await loadImageAsBase64(finalLogoUrl);
  if (arselLogoBase64) {
      pdf.addImage(arselLogoBase64, 'PNG', MARGIN, currentY, 55, 25, undefined, 'MEDIUM'); // 2. Aumentar el tamaño de la imagen
      currentY += 28; // Ajustar el incremento de Y para que coincida con el nuevo tamaño
  }
  // --- FIN DE LA CORRECCIÓN ---

  pdf.setFont('helvetica', 'bold').text('ARSEL INGENIERIA', MARGIN, currentY);
  currentY += 5;
  pdf.setFont('helvetica', 'normal').text(`Valencia, ${fecha}`, MARGIN, currentY);
}