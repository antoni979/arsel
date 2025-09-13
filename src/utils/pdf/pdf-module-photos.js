// src/utils/pdf/pdf-module-photos.js

import { checklistItems } from '../checklist';
import { drawHeader, loadImageAsBase64, MARGIN, DOC_WIDTH, FONT_SIZES } from './pdf-helpers';

// --- ANEXO DE FOTOS INICIAL (OPTIMIZADO) ---
export async function buildInitialPhotoAnnex(pdf, reportData) {
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
  pdf.setFont('helvetica', 'bold');
  pdf.text('ANEXO 01:', DOC_WIDTH / 2, 145, { align: 'center' });
  pdf.text('REPORTAJE FOTOGRÁFICO', DOC_WIDTH / 2, 155, { align: 'center' });
  pdf.setFont('helvetica', 'normal');

  for (const incidencia of incidenciasConFoto) {
    const puntoInspeccionado = puntosInspeccionadosData.find(pi => pi.id === incidencia.punto_inspeccionado_id);
    const puntoMaestro = puntoInspeccionado ? puntosMaestrosData.find(pm => pm.id === puntoInspeccionado.punto_maestro_id) : null;
    if (!puntoMaestro) continue;

    pdf.addPage();
    await drawHeader(pdf, inspectionData);
    
    let currentY = 45;
    pdf.setFontSize(FONT_SIZES.h2).setFont('helvetica', 'normal');
    pdf.text(`Alineación: ${puntoMaestro.nomenclatura}`, MARGIN, currentY);
    currentY += 8;

    const checklistItem = checklistItems.find(item => item.id === incidencia.item_checklist);
    if (checklistItem) {
      pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'italic');
      pdf.setTextColor(100);
      const itemText = `Incidencia: ${checklistItem.id}. ${checklistItem.text}`;
      const splitText = pdf.splitTextToSize(itemText, DOC_WIDTH - (MARGIN * 2));
      pdf.text(splitText, MARGIN, currentY);
      currentY += (splitText.length * 5) + 5;
      pdf.setTextColor(0);
      pdf.setFont('helvetica', 'normal');
    }

    // --- CORRECCIÓN DE OPTIMIZACIÓN: Usa el default optimizado (1024px) ---
    const fotoAntesBase64 = await loadImageAsBase64(incidencia.url_foto_antes);
    if(fotoAntesBase64) {
      pdf.addImage(fotoAntesBase64, 'JPEG', MARGIN, currentY, 180, 100, undefined, 'MEDIUM');
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
    pdf.setFont('helvetica', 'bold');
    pdf.text('Observaciones:', MARGIN + 2, obsBlockY + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(splitObs, MARGIN + 2, obsBlockY + 10);
  }
}


// --- ANEXO DE FOTOS DE SUBSANACIÓN (OPTIMIZADO) ---
export async function buildRemediationPhotoAnnex(pdf, reportData) {
  const { inspectionData, incidenciasData, puntosMaestrosData, puntosInspeccionadosData } = reportData;
  
  const incidenciasSubsanadas = incidenciasData.filter(inc => inc.url_foto_antes && inc.url_foto_despues);
  if (incidenciasSubsanadas.length === 0) return;

  pdf.addPage();
  await drawHeader(pdf, inspectionData);

  pdf.setFontSize(FONT_SIZES.annexTitle);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ANEXO 01:', DOC_WIDTH / 2, 145, { align: 'center' });
  const remediationTitleLines = pdf.splitTextToSize('REPORTAJE FOTOGRÁFICO DE SUBSANACIÓN', 180);
  pdf.text(remediationTitleLines, DOC_WIDTH / 2, 155, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  
  for (const incidencia of incidenciasSubsanadas) {
    const puntoInspeccionado = puntosInspeccionadosData.find(pi => pi.id === incidencia.punto_inspeccionado_id);
    const puntoMaestro = puntoInspeccionado ? puntosMaestrosData.find(pm => pm.id === puntoInspeccionado.punto_maestro_id) : null;
    if (!puntoMaestro) continue;
    
    pdf.addPage();
    await drawHeader(pdf, inspectionData);
    pdf.setFontSize(FONT_SIZES.h2).setFont('helvetica', 'normal').text(`Subsanación de Incidencia: ${puntoMaestro.nomenclatura}`, MARGIN, 45);

    // --- CORRECCIÓN DE OPTIMIZACIÓN: Redimensiona a un tamaño más pequeño (600px) ---
    const [fotoAntesBase64, fotoDespuesBase64] = await Promise.all([
      loadImageAsBase64(incidencia.url_foto_antes, 600, 600),
      loadImageAsBase64(incidencia.url_foto_despues, 600, 600)
    ]);
    
    const photoBoxY = 65;
    const photoBoxSize = 85;
    const photoPadding = 2;

    pdf.text('ANTES', MARGIN + (photoBoxSize / 2), 60, { align: 'center' });
    pdf.rect(MARGIN, photoBoxY, photoBoxSize, photoBoxSize);
    if (fotoAntesBase64) {
      pdf.addImage(fotoAntesBase64, 'JPEG', MARGIN + photoPadding, photoBoxY + photoPadding, photoBoxSize - (photoPadding * 2), photoBoxSize - (photoPadding * 2), undefined, 'MEDIUM');
    }
    
    pdf.text('DESPUÉS', DOC_WIDTH - MARGIN - (photoBoxSize / 2), 60, { align: 'center' });
    pdf.rect(DOC_WIDTH / 2 + 5, photoBoxY, photoBoxSize, photoBoxSize);
    if (fotoDespuesBase64) {
      pdf.addImage(fotoDespuesBase64, 'JPEG', (DOC_WIDTH / 2 + 5) + photoPadding, photoBoxY + photoPadding, photoBoxSize - (photoPadding * 2), photoBoxSize - (photoPadding * 2), undefined, 'MEDIUM');
    }
    
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
    pdf.setFont('helvetica', 'bold');
    pdf.text('Observaciones:', MARGIN + 2, obsBlockY + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(splitObs, MARGIN + 2, obsBlockY + 10);
  }
}