// src/utils/pdf/pdf-module-photos.js

import html2canvas from 'html2canvas'; // Asegúrate de tener html2canvas si no se usa
import { checklistItems } from '../checklist';
import { drawHeader, loadImageAsBase64, MARGIN, DOC_WIDTH, FONT_SIZES } from './pdf-helpers';

// --- ANEXO DE FOTOS INICIAL (Sin cambios, lo dejamos como está) ---
export async function buildInitialPhotoAnnex(pdf, reportData) {
  // ... (Esta función se mantiene igual, no es necesario copiarla de nuevo si no ha cambiado)
  const { inspectionData, incidenciasData, puntosMaestrosData, puntosInspeccionadosData, salasData } = reportData;
  
  const incidenciasConFoto = incidenciasData.filter(inc => 
    inc.url_foto_antes && inc.item_checklist !== 2
  );
  if (incidenciasConFoto.length === 0) return;

  const puntoMaestroASalaMap = new Map(puntosMaestrosData.map(pm => [pm.id, salasData.find(s => s.id === pm.sala_id)]));
  const puntoInspeccionadoAMaestroMap = new Map(puntosInspeccionadosData.map(pi => [pi.id, pi.punto_maestro_id]));
  
  const getSortInfoForIncidencia = (inc) => {
    const puntoMaestroId = puntoInspeccionadoAMaestroMap.get(inc.punto_inspeccionado_id);
    const puntoMaestro = puntosMaestrosData.find(pm => pm.id === puntoMaestroId);
    const sala = puntoMaestroASalaMap.get(puntoMaestroId);
    return {
      salaNombre: sala ? sala.nombre : 'ZZZ',
      puntoNumero: puntoMaestro ? parseInt(puntoMaestro.nomenclatura.split('-').pop() || 0) : 9999
    };
  };

  incidenciasConFoto.sort((a, b) => {
    const infoA = getSortInfoForIncidencia(a);
    const infoB = getSortInfoForIncidencia(b);
    const comparacionSala = infoA.salaNombre.localeCompare(infoB.salaNombre);
    if (comparacionSala !== 0) return comparacionSala;
    return infoA.puntoNumero - infoB.puntoNumero;
  });

  pdf.addPage();
  await drawHeader(pdf, inspectionData);
  
  pdf.setFontSize(FONT_SIZES.annexTitle);
  pdf.setFont(undefined, 'bold');
  pdf.text('ANEXO 01:', DOC_WIDTH / 2, 145, { align: 'center' });
  pdf.text('REPORTAJE FOTOGRÁFICO', DOC_WIDTH / 2, 155, { align: 'center' });
  pdf.setFont(undefined, 'normal');

  for (const incidencia of incidenciasConFoto) {
    const puntoInspeccionado = puntosInspeccionadosData.find(pi => pi.id === incidencia.punto_inspeccionado_id);
    const puntoMaestro = puntoInspeccionado ? puntosMaestrosData.find(pm => pm.id === puntoInspeccionado.punto_maestro_id) : null;
    if (!puntoMaestro) continue;

    pdf.addPage();
    await drawHeader(pdf, inspectionData);
    
    let currentY = 45;
    pdf.setFontSize(FONT_SIZES.h2);
    pdf.text(`Alineación: ${puntoMaestro.nomenclatura}`, MARGIN, currentY);
    currentY += 8;

    const checklistItem = checklistItems.find(item => item.id === incidencia.item_checklist);
    if (checklistItem) {
      pdf.setFontSize(FONT_SIZES.body).setFont(undefined, 'italic');
      pdf.setTextColor(100);
      const itemText = `Incidencia: ${checklistItem.id}. ${checklistItem.text}`;
      const splitText = pdf.splitTextToSize(itemText, DOC_WIDTH - (MARGIN * 2));
      pdf.text(splitText, MARGIN, currentY);
      currentY += (splitText.length * 5) + 5;
      pdf.setTextColor(0);
      pdf.setFont(undefined, 'normal');
    }

    const fotoAntesBase64 = await loadImageAsBase64(incidencia.url_foto_antes);
    if(fotoAntesBase64) {
      pdf.addImage(fotoAntesBase64, 'JPEG', MARGIN, currentY, 180, 100, undefined, 'FAST');
    }

    let obsBlockY = currentY + 100 + 10;
    pdf.setFontSize(FONT_SIZES.body);
    const obsText = incidencia.observaciones || '';
    const splitObs = pdf.splitTextToSize(obsText, DOC_WIDTH - (MARGIN * 2) - 4);
    const requiredTextHeight = splitObs.length * 5;
    const minBoxHeight = 20;
    const headerHeight = 8;
    const boxHeight = Math.max(minBoxHeight, requiredTextHeight + headerHeight);

    pdf.setDrawColor(0);
    pdf.rect(MARGIN, obsBlockY, DOC_WIDTH - (MARGIN * 2), boxHeight);
    pdf.setFont(undefined, 'bold');
    pdf.text('Observaciones:', MARGIN + 2, obsBlockY + 5);
    pdf.setFont(undefined, 'normal');
    pdf.text(splitObs, MARGIN + 2, obsBlockY + 10);
  }
}


// --- ANEXO DE FOTOS DE SUBSANACIÓN (MODIFICADO Y CORREGIDO) ---
export async function buildRemediationPhotoAnnex(pdf, reportData) {
  const { inspectionData, incidenciasData, puntosMaestrosData, puntosInspeccionadosData } = reportData;
  
  // Filtramos solo las incidencias que tienen foto de ANTES y DESPUÉS
  const incidenciasSubsanadas = incidenciasData.filter(inc => inc.url_foto_antes && inc.url_foto_despues);
  if (incidenciasSubsanadas.length === 0) return;

  pdf.addPage();
  await drawHeader(pdf, inspectionData);

  pdf.setFontSize(FONT_SIZES.annexTitle);
  pdf.setFont(undefined, 'bold');
  pdf.text('ANEXO 01:', DOC_WIDTH / 2, 145, { align: 'center' });
  const remediationTitleLines = pdf.splitTextToSize('REPORTAJE FOTOGRÁFICO DE SUBSANACIÓN', 180);
  pdf.text(remediationTitleLines, DOC_WIDTH / 2, 155, { align: 'center' });
  pdf.setFont(undefined, 'normal');
  
  for (const incidencia of incidenciasSubsanadas) {
    const puntoInspeccionado = puntosInspeccionadosData.find(pi => pi.id === incidencia.punto_inspeccionado_id);
    const puntoMaestro = puntoInspeccionado ? puntosMaestrosData.find(pm => pm.id === puntoInspeccionado.punto_maestro_id) : null;
    if (!puntoMaestro) continue;
    
    pdf.addPage();
    await drawHeader(pdf, inspectionData);
    pdf.setFontSize(FONT_SIZES.h2).text(`Subsanación de Incidencia: ${puntoMaestro.nomenclatura}`, MARGIN, 45);

    // === INICIO DE LA CORRECCIÓN: Carga y dibuja las imágenes ===
    
    // 1. Cargar ambas imágenes en paralelo
    const [fotoAntesBase64, fotoDespuesBase64] = await Promise.all([
      loadImageAsBase64(incidencia.url_foto_antes),
      loadImageAsBase64(incidencia.url_foto_despues)
    ]);
    
    // Dimensiones y posiciones de los recuadros
    const photoBoxY = 65;
    const photoBoxSize = 85;
    const photoPadding = 2; // Pequeño margen interno

    // Dibuja el recuadro y la foto de "ANTES"
    pdf.text('ANTES', MARGIN + (photoBoxSize / 2), 60, { align: 'center' });
    pdf.rect(MARGIN, photoBoxY, photoBoxSize, photoBoxSize);
    if (fotoAntesBase64) {
      pdf.addImage(fotoAntesBase64, 'JPEG', MARGIN + photoPadding, photoBoxY + photoPadding, photoBoxSize - (photoPadding * 2), photoBoxSize - (photoPadding * 2), undefined, 'FAST');
    }
    
    // Dibuja el recuadro y la foto de "DESPUÉS"
    pdf.text('DESPUÉS', DOC_WIDTH - MARGIN - (photoBoxSize / 2), 60, { align: 'center' });
    pdf.rect(DOC_WIDTH / 2 + 5, photoBoxY, photoBoxSize, photoBoxSize);
    if (fotoDespuesBase64) {
      pdf.addImage(fotoDespuesBase64, 'JPEG', (DOC_WIDTH / 2 + 5) + photoPadding, photoBoxY + photoPadding, photoBoxSize - (photoPadding * 2), photoBoxSize - (photoPadding * 2), undefined, 'FAST');
    }
    
    // === FIN DE LA CORRECCIÓN ===
    
    let obsBlockY = 160;
    pdf.setFontSize(FONT_SIZES.body);
    const obsText = incidencia.observaciones || '';
    const splitObs = pdf.splitTextToSize(obsText, DOC_WIDTH - (MARGIN * 2) - 4);
    const requiredTextHeight = splitObs.length * 5;
    const minBoxHeight = 20;
    const headerHeight = 8;
    const boxHeight = Math.max(minBoxHeight, requiredTextHeight + headerHeight);

    pdf.setDrawColor(0);
    pdf.rect(MARGIN, obsBlockY, DOC_WIDTH - (MARGIN * 2), boxHeight);
    pdf.setFont(undefined, 'bold');
    pdf.text('Observaciones:', MARGIN + 2, obsBlockY + 5);
    pdf.setFont(undefined, 'normal');
    pdf.text(splitObs, MARGIN + 2, obsBlockY + 10);
  }
}