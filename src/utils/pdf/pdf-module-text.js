// src/utils/pdf/pdf-module-text.js

import { drawHeader, loadImageAsBase64, ARSEL_LOGO_URL } from './pdf-helpers';
import { MARGIN, DOC_WIDTH, FONT_SIZES } from './pdf-helpers';

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

  const agruparPuntosConPlacaPorSala = () => {
      const puntosConPlaca = puntosInspeccionadosData.filter(pi => 
          pi.tiene_placa_caracteristicas === true &&
          pi.detalle_modificacion !== 'aumentado' &&
          pi.detalle_modificacion !== 'disminuido' &&
          pi.estado === 'existente'
      );
      const grupos = {};
      puntosConPlaca.forEach(pi => {
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
  const lineasAumentadas = agruparPuntosPorPropiedad('detalle_modificacion', 'aumentado');
  const lineasDisminuidas = agruparPuntosPorPropiedad('detalle_modificacion', 'disminuido');
  const lineasConPlaca = agruparPuntosConPlacaPorSala();
  
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
    const nombresDeSalasOrdenados = Object.keys(grupos).sort((a, b) => a.localeCompare(b));
    if (nombresDeSalasOrdenados.length === 1 && nombresDeSalasOrdenados[0].toLowerCase() === 'única') {
        const numerosSet = grupos[nombresDeSalasOrdenados[0]];
        return `Única: ${[...numerosSet].sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}`;
    }
    return nombresDeSalasOrdenados.map(nombreSala => {
      const numerosSet = grupos[nombreSala];
      const numerosOrdenados = [...numerosSet].sort((a, b) => parseInt(a) - parseInt(b)).join(', ');
      return `${nombreSala}: ${numerosOrdenados}`;
    }).join('\n');
  };

  const incidenciasVerdeAmbarReales = incidenciasData.filter(i => i.gravedad === 'verde' || i.gravedad === 'ambar');
  const puntosModificados = puntosInspeccionadosData.filter(pi => pi.estado === 'nuevo' || pi.estado === 'suprimido');
  const puntosYaIncluidosIds = new Set(incidenciasVerdeAmbarReales.map(i => i.punto_inspeccionado_id));
  const incidenciasSinteticas = puntosModificados
    .filter(pi => !puntosYaIncluidosIds.has(pi.id))
    .map(pi => ({ punto_inspeccionado_id: pi.id }));
  const incidenciasVerdeAmbarCombinadas = [...incidenciasVerdeAmbarReales, ...incidenciasSinteticas];
  const textoVerdeAmbar = agruparIncidenciasPorSala(incidenciasVerdeAmbarCombinadas);
  const incidenciasRojo = incidenciasData.filter(i => i.gravedad === 'rojo');
  const textoRojo = agruparIncidenciasPorSala(incidenciasRojo);

  // --- PÁGINA 1 ---
  await drawHeader(pdf, inspectionData);
  let currentY = 50;
  
  const titulo = `INFORME VISITA INSPECCIÓN DEL SISTEMA DE ALMACENAJE PARA CARGAS PALETIZADAS Y MANUALES DEL Hipermercado ${inspectionData.centros.nombre.toUpperCase()}`;
  pdf.setFontSize(FONT_SIZES.h2).setFont(undefined, 'bold');
  const tituloLines = pdf.splitTextToSize(titulo, DOC_WIDTH - (MARGIN * 2));
  pdf.text(tituloLines, DOC_WIDTH / 2, currentY, { align: 'center' });
  currentY += (tituloLines.length * 7) + 15;

  pdf.setFontSize(FONT_SIZES.h2).setFont(undefined, 'bold'); pdf.text('1. OBJETO', MARGIN, currentY); currentY += 8; pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'normal'); pdf.text(`Con motivo de la visita programada para la inspección del sistema de almacenaje para cargas paletizadas y manuales del ${inspectionData.centros.nombre}, se redacta el presente informe que recoge de forma somera el resultado de la visita.`, MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 }); currentY += 25;
  pdf.setFontSize(FONT_SIZES.h2).setFont(undefined, 'bold'); pdf.text('2. ANTECEDENTES', MARGIN, currentY); currentY += 8; pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'normal'); pdf.text('Para realizar la inspección del sistema de almacenaje de cargas paletizadas y manuales ubicadas en las reservas se toma como base la memoria técnica previa de evaluación de dichos sistemas facilitada al centro para la realización de las correcciones oportunas. Este documento establece los parámetros dimensionales y de carga, así como los elementos y medidas de seguridad que deben contemplar los sistemas de almacenaje para garantizar su estabilidad y uso seguro.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 }); currentY += 40; pdf.text('La inspección consiste en la revisión visual del sistema llevada a cabo por un técnico cualificado, con la comprobación de los puntos recogidos en el checklist previsto para tal fin en la memoria de evaluación previa, con el consiguiente registro escrito de los resultados obtenidos.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 }); currentY += 30;
  pdf.setFontSize(FONT_SIZES.h2).setFont(undefined, 'bold'); pdf.text('3. RESULTADO DE LA VISITA', MARGIN, currentY); currentY += 8; pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'normal'); pdf.text('En rasgos generales los sistemas de almacenaje cumplen los parámetros establecidos en la memoria técnica de evaluación.', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 }); currentY += 15; pdf.text('Se han detectado anomalías de riesgo verde y/o ámbar, tal y como se refleja en los listados de inspección elaborados durante la visita en:', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 });
  
  // --- PÁGINA 2 ---
  pdf.addPage();
  await drawHeader(pdf, inspectionData);
  currentY = 50;
  
  pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'bold');
  if (textoVerdeAmbar) { pdf.text(textoVerdeAmbar, MARGIN, currentY, { lineHeightFactor: 1.5 }); currentY += (textoVerdeAmbar.split('\n').length * 5) + 5; }
  pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'normal'); currentY = Math.max(currentY, 65); pdf.text('Estas anomalías, si bien no comprometen de forma inmediata la estabilidad ni seguridad del sistema, deben subsanarse lo antes posible para evitar que puedan derivar en un riesgo mayor. (Se adjuntan listados de chequeo y reportaje fotográfico de la visita).', MARGIN, currentY, { maxWidth: DOC_WIDTH - (MARGIN * 2), lineHeightFactor: 1.5 }); currentY += 30;
  pdf.text('Puntualmente, se han detectado anomalías de riesgo rojo en:', MARGIN, currentY); currentY += 8;
  pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'bold');
  if (textoRojo) { pdf.text(textoRojo, MARGIN, currentY, { lineHeightFactor: 1.5 }); currentY += (textoRojo.split('\n').length * 5) + 5; }
  pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'normal'); currentY = Math.max(currentY, 130); const textoRiesgoRojo = 'Estas anomalías deben subsanarse inmediatamente para evitar el colapso de las estanterías en el caso de una combinación de cargas desfavorables, procediendo a la descarga de la mercancía de los módulos afectados y señalizando la zona para que no se almacene producto en los mismos hasta que puedan ser sustituidos los elementos dañados. La sustitución se llevará a cabo con nuevo material que se tiene que solicitar si no cuenta con repuesto en el centro.'; const textLines = pdf.splitTextToSize(textoRiesgoRojo, DOC_WIDTH - (MARGIN * 2)); pdf.text(textLines, MARGIN, currentY, { lineHeightFactor: 1.5 }); currentY += textLines.length * 5 + 15;


  pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'normal');
  pdf.text('Alineaciones que disponen de sus fichas de características:', MARGIN, currentY);
  currentY += 8;
  pdf.setFont(undefined, 'bold');
  if (lineasConPlaca) {
    pdf.text(lineasConPlaca, MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += (lineasConPlaca.split('\n').length * 5) + 5;
  } else {
    pdf.text('Ninguna', MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += 10;
  }

  currentY += 8;
  pdf.setFont(undefined, 'bold');
  if (lineasAumentadas) {
    pdf.text(lineasAumentadas, MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += (lineasAumentadas.split('\n').length * 5) + 5;
  } else {
    pdf.text('Ninguna', MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += 10;
  }
  currentY += 5;

  pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'normal');

  currentY += 8;
  pdf.setFont(undefined, 'bold');
  if (lineasDisminuidas) {
    pdf.text(lineasDisminuidas, MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += (lineasDisminuidas.split('\n').length * 5) + 5;
  } else {
    pdf.text('Ninguna', MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += 10;
  }
  currentY += 5;

  pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'normal');
  pdf.text('Alineaciones desmontadas desde la inspección anterior:', MARGIN, currentY);
  currentY += 8;
  pdf.setFont(undefined, 'bold');
  if (lineasSuprimidas) {
    pdf.text(lineasSuprimidas, MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += (lineasSuprimidas.split('\n').length * 5) + 5;
  } else {
    pdf.text('Ninguna', MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
    currentY += 10;
  }
  currentY += 5;

  pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'normal');
  pdf.text('Alineaciones nuevas montadas desde la inspección anterior:', MARGIN, currentY);
  currentY += 8;
  pdf.setFont(undefined, 'bold');
  if (lineasNuevas) {
    pdf.text(lineasNuevas, MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
  } else {
    pdf.text('Ninguna', MARGIN + 5, currentY, { lineHeightFactor: 1.5 });
  }
  // --- FIN DE LA LÓGICA CORREGIDA ---

  // --- PÁGINA 3 ---
  pdf.addPage();
  await drawHeader(pdf, inspectionData);
  currentY = 50;
  pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'normal');

  const arselLogoBase64 = await loadImageAsBase64(ARSEL_LOGO_URL);
  if (arselLogoBase64) {
      pdf.addImage(arselLogoBase64, 'PNG', MARGIN, currentY, 35, 15, undefined, 'FAST');
      currentY += 18;
  }
  pdf.setFont(undefined, 'bold');
  pdf.text('ARSEL INGENIERIA', MARGIN, currentY);
  currentY += 5;
  pdf.setFont(undefined, 'normal');
  pdf.text(`Valencia, ${fecha}`, MARGIN, currentY);
}