// src/utils/pdf/pdf-module-photos.js

import { checklistItems } from '../checklist';
import { drawHeader, loadImageAsBase64, MARGIN, DOC_WIDTH, FONT_SIZES } from './pdf-helpers';
import { getArselLogoUrl } from './pdf-helpers';
import { supabase } from '../../supabase';

// --- ANEXO DE FOTOS INICIAL (OPTIMIZADO) ---
export async function buildInitialPhotoAnnex(pdf, reportData) {
  const { inspectionData, incidenciasData, puntosMaestrosData, puntosInspeccionadosData, salasData } = reportData;

  const incidenciasConFoto = incidenciasData.filter(inc =>
    inc.url_foto_antes && inc.item_checklist !== 2
  );
  if (incidenciasConFoto.length === 0) return;

  // Fetch custom fields and logo
  const [customFieldsRes, arselLogoUrl] = await Promise.all([
    supabase.from('checklist_custom_fields').select('*'),
    getArselLogoUrl()
  ]);
  const customFieldsMap = new Map(customFieldsRes.data.map(f => [f.id, f]));

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
  await drawHeader(pdf, inspectionData, arselLogoUrl);
  
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
    await drawHeader(pdf, inspectionData, arselLogoUrl);
    
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

    const photoWidth = DOC_WIDTH - (MARGIN * 2);
    const photoHeight = photoWidth * (100 / 180);

    const fotoAntesBase64 = await loadImageAsBase64(incidencia.url_foto_antes);
    if(fotoAntesBase64) {
      pdf.addImage(fotoAntesBase64, 'JPEG', MARGIN, currentY, photoWidth, photoHeight, undefined, 'MEDIUM');
    }

    let obsBlockY = currentY + photoHeight + 10;
    pdf.setFontSize(FONT_SIZES.body);
    let obsText = '';
    if (incidencia.custom_fields) {
      const customs = Object.entries(incidencia.custom_fields).map(([fieldId, value]) => {
        const field = customFieldsMap.get(parseInt(fieldId));
        return field ? `${field.field_name}: ${value}` : '';
      }).filter(s => s).join(' / ');
      if (customs) obsText = customs;
    }
    const obsNotes = incidencia.observaciones || '';
    if (obsNotes) obsText = obsText ? `${obsText} / ${obsNotes}` : obsNotes;
    
    // ===== CAMBIO 1: Ajustamos cómo se dibuja el bloque de observaciones =====
    const splitObs = pdf.splitTextToSize(obsText, DOC_WIDTH - (MARGIN * 2) - 4);
    const requiredTextHeight = splitObs.length * 5;
    const minBoxHeight = 20;
    const headerHeight = 8;
    const boxHeight = Math.max(minBoxHeight, requiredTextHeight + headerHeight + 2); // +2 for padding

    pdf.setDrawColor(0);
    pdf.rect(MARGIN, obsBlockY, DOC_WIDTH - (MARGIN * 2), boxHeight);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Observaciones:', MARGIN + 2, obsBlockY + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(splitObs, MARGIN + 2, obsBlockY + 12); // Aumentamos el espacio vertical
  }
}


// --- ANEXO DE FOTOS DE SUBSANACIÓN (OPTIMIZADO) ---
export async function buildRemediationPhotoAnnex(pdf, reportData) {
  const { inspectionData, incidenciasData, puntosMaestrosData, puntosInspeccionadosData, salasData } = reportData;

  const incidenciasCorregidas = incidenciasData.filter(inc => inc.url_foto_antes && inc.url_foto_despues);
  if (incidenciasCorregidas.length === 0) return;

  // Fetch custom fields and logo
  const [customFieldsRes, arselLogoUrl] = await Promise.all([
    supabase.from('checklist_custom_fields').select('*'),
    getArselLogoUrl()
  ]);
  const customFieldsMap = new Map(customFieldsRes.data.map(f => [f.id, f]));

  pdf.addPage();
  await drawHeader(pdf, inspectionData, arselLogoUrl);

  pdf.setFontSize(FONT_SIZES.annexTitle);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ANEXO 01:', DOC_WIDTH / 2, 145, { align: 'center' });
  const remediationTitleLines = pdf.splitTextToSize('INFORME FOTOGRÁFICO DE CIERRE', 180);
  pdf.text(remediationTitleLines, DOC_WIDTH / 2, 155, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  
  for (const incidencia of incidenciasCorregidas) {
    const puntoInspeccionado = puntosInspeccionadosData.find(pi => pi.id === incidencia.punto_inspeccionado_id);
    const puntoMaestro = puntoInspeccionado ? puntosMaestrosData.find(pm => pm.id === puntoInspeccionado.punto_maestro_id) : null;
    if (!puntoMaestro) continue;

    // Obtener sala y checklist item
    const sala = salasData.find(s => s.id === puntoMaestro.sala_id);
    const checklistItem = checklistItems.find(item => item.id === incidencia.item_checklist);

    pdf.addPage();
    await drawHeader(pdf, inspectionData, arselLogoUrl);

    // Título: Nombre de la sala en negrita y grande
    let currentY = 45;
    pdf.setFontSize(FONT_SIZES.h2).setFont('helvetica', 'bold');
    pdf.text(sala ? sala.nombre.toUpperCase() : 'SALA DESCONOCIDA', MARGIN, currentY);
    currentY += 7;

    // Nomenclatura del punto
    pdf.setFontSize(FONT_SIZES.body).setFont('helvetica', 'normal');
    pdf.text(`Punto: ${puntoMaestro.nomenclatura}`, MARGIN, currentY);
    currentY += 6;

    // Item del checklist subsanado (subtítulo)
    if (checklistItem) {
      pdf.setFontSize(FONT_SIZES.body - 1).setFont('helvetica', 'italic');
      const checklistText = `Item ${checklistItem.id}: ${checklistItem.text}`;
      const checklistLines = pdf.splitTextToSize(checklistText, DOC_WIDTH - (MARGIN * 2));
      pdf.text(checklistLines, MARGIN, currentY);
    }

    const [fotoAntesBase64, fotoDespuesBase64] = await Promise.all([
      loadImageAsBase64(incidencia.url_foto_antes, { maxWidth: 600, maxHeight: 600 }),
      loadImageAsBase64(incidencia.url_foto_despues, { maxWidth: 600, maxHeight: 600 })
    ]);

    // Ajustar posición de fotos después del título
    currentY += 10; // Espacio después del checklist item
    const photoBoxSize = (DOC_WIDTH - (MARGIN * 2) - 10) / 2;
    const photoPadding = 2;

    pdf.setFont('helvetica', 'bold').setFontSize(FONT_SIZES.body);
    pdf.text('ANTES', MARGIN + (photoBoxSize / 2), currentY, { align: 'center' });

    currentY += 5; // Espacio entre etiqueta y foto
    const photoBoxY = currentY;

    pdf.rect(MARGIN, photoBoxY, photoBoxSize, photoBoxSize);
    if (fotoAntesBase64) {
      pdf.addImage(fotoAntesBase64, 'JPEG', MARGIN + photoPadding, photoBoxY + photoPadding, photoBoxSize - (photoPadding * 2), photoBoxSize - (photoPadding * 2), undefined, 'MEDIUM');
    }

    const secondPhotoX = MARGIN + photoBoxSize + 10;
    pdf.text('DESPUÉS', secondPhotoX + (photoBoxSize / 2), photoBoxY - 5, { align: 'center' });
    pdf.rect(secondPhotoX, photoBoxY, photoBoxSize, photoBoxSize);
    if (fotoDespuesBase64) {
      pdf.addImage(fotoDespuesBase64, 'JPEG', secondPhotoX + photoPadding, photoBoxY + photoPadding, photoBoxSize - (photoPadding * 2), photoBoxSize - (photoPadding * 2), undefined, 'MEDIUM');
    }

    let obsBlockY = photoBoxY + photoBoxSize + 5; // Dinámicamente después de las fotos
    pdf.setFontSize(FONT_SIZES.body);
    let obsText = '';
    if (incidencia.custom_fields) {
      const customs = Object.entries(incidencia.custom_fields).map(([fieldId, value]) => {
        const field = customFieldsMap.get(parseInt(fieldId));
        return field ? `${field.field_name}: ${value}` : '';
      }).filter(s => s).join(' / ');
      if (customs) obsText = customs;
    }
    const obsNotes = incidencia.observaciones || '';
    if (obsNotes) obsText = obsText ? `${obsText} / ${obsNotes}` : obsNotes;

    // ===== CAMBIO 1: Ajustamos cómo se dibuja el bloque de observaciones =====
    const splitObs = pdf.splitTextToSize(obsText, DOC_WIDTH - (MARGIN * 2) - 4);
    const requiredTextHeight = splitObs.length * 5;
    const minBoxHeight = 20;
    const headerHeight = 8;
    const boxHeight = Math.max(minBoxHeight, requiredTextHeight + headerHeight + 2); // +2 for padding

    pdf.setDrawColor(0);
    pdf.rect(MARGIN, obsBlockY, DOC_WIDTH - (MARGIN * 2), boxHeight);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Observaciones:', MARGIN + 2, obsBlockY + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(splitObs, MARGIN + 2, obsBlockY + 12); // Aumentamos el espacio vertical
  }
}