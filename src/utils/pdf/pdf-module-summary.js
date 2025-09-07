// src/utils/pdf/pdf-module-summary.js

import { loadImageAsBase64, drawHeader, MARGIN, FONT_SIZES, DOC_WIDTH_LANDSCAPE } from './pdf-helpers';
import autoTable from 'jspdf-autotable';

function drawSalaAreas(pdf, salas, planoX, planoY, planoW, planoH) {
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
    };

    for (const sala of salas) {
        if (sala.area_x1 && sala.area_y1 && sala.area_x2 && sala.area_y2) {
            const rgb = hexToRgb(sala.color);
            if (rgb) {
                const x = planoX + (Math.min(sala.area_x1, sala.area_x2) * planoW);
                const y = planoY + (Math.min(sala.area_y1, sala.area_y2) * planoH);
                const w = Math.abs(sala.area_x2 - sala.area_x1) * planoW;
                const h = Math.abs(sala.area_y2 - sala.area_y1) * planoH;

                pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
                pdf.setLineWidth(0.8);
                pdf.rect(x, y, w, h, 'S');
            }
        }
    }
}

function drawPointMarker(pdf, x, y, point, counts, planoW, salaColor) {
    const pointNumber = point.nomenclatura.split('-').pop() || '?';
    
    const circleRadius = 4;
    pdf.setFillColor(salaColor);
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.5);
    pdf.circle(x, y, circleRadius, 'DF');
    
    pdf.setFontSize(8).setFont(undefined, 'bold');
    pdf.setTextColor(255, 255, 255);
    pdf.text(pointNumber, x, y, { align: 'center', baseline: 'middle' });
    
    const badgeWidth = 24;
    const badgeHeight = 8;
    const isNearRightEdge = point.coordenada_x * planoW > planoW - 40;
    const badgeOffsetX = isNearRightEdge ? -(badgeWidth + circleRadius + 2) : (circleRadius + 2);
    
    const startX = x + badgeOffsetX;
    const startY = y - (badgeHeight / 2);
    
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(startX, startY, badgeWidth, badgeHeight, 2, 2, 'FD');
    
    const semaphoreY = startY + (badgeHeight / 2);
    const colorBoxSize = 3;
    let currentX = startX + 3;
    const gap = 6;

    pdf.setFontSize(6).setFont(undefined, 'normal');

    pdf.setFillColor(34, 197, 94);
    pdf.rect(currentX, semaphoreY - (colorBoxSize/2), colorBoxSize, colorBoxSize, 'F');
    pdf.setTextColor(80, 80, 80);
    pdf.text(String(counts.verde), currentX + colorBoxSize + 1, semaphoreY + 2.1);
    currentX += gap;

    pdf.setFillColor(245, 158, 11);
    pdf.rect(currentX, semaphoreY - (colorBoxSize/2), colorBoxSize, colorBoxSize, 'F');
    pdf.text(String(counts.ambar), currentX + colorBoxSize + 1, semaphoreY + 2.1);
    currentX += gap;

    pdf.setFillColor(239, 68, 68);
    pdf.rect(currentX, semaphoreY - (colorBoxSize/2), colorBoxSize, colorBoxSize, 'F');
    pdf.text(String(counts.rojo), currentX + colorBoxSize + 1, semaphoreY + 2.1);

    pdf.setTextColor(0);
}


export async function buildSummaryAnnex(pdf, reportData) {
    const { inspectionData, salasData, puntosInspeccionadosData, incidenciasData, puntosMaestrosData } = reportData;
    const version = inspectionData.versiones_plano;

    if (!version || !version.url_imagen_plano) return;

    const incidenceCounts = new Map();
    puntosInspeccionadosData.forEach(pi => {
        incidenceCounts.set(pi.id, { verde: 0, ambar: 0, rojo: 0 });
    });
    incidenciasData.forEach(inc => {
        const counts = incidenceCounts.get(inc.punto_inspeccionado_id);
        if (counts && counts[inc.gravedad] !== undefined) {
            counts[inc.gravedad]++;
        }
    });

    const planoBase64 = await loadImageAsBase64(version.url_imagen_plano);
    if (!planoBase64) return;

    pdf.addPage(null, 'l');
    await drawHeader(pdf, inspectionData);

    autoTable(pdf, {
        body: [['ANEXO 03: RESUMEN VISUAL DE INCIDENCIAS']],
        startY: 40,
        theme: 'plain',
        styles: { fontSize: FONT_SIZES.title, fontStyle: 'bold', halign: 'center' },
    });

    const imgProps = pdf.getImageProperties(planoBase64);
    const imgAspectRatio = imgProps.width / imgProps.height;

    const availableWidth = DOC_WIDTH_LANDSCAPE - MARGIN * 2;
    const availableHeight = 150;
    let imgWidth = availableWidth;
    let imgHeight = imgWidth / imgAspectRatio;
    if (imgHeight > availableHeight) {
        imgHeight = availableHeight;
        imgWidth = imgHeight * imgAspectRatio;
    }
    const planoStartX = MARGIN + (availableWidth - imgWidth) / 2;
    const planoStartY = pdf.lastAutoTable.finalY + 5;

    // === INICIO DEL CAMBIO: Invertimos el orden de dibujado ===
    // 1. Primero dibujamos la imagen del plano.
    pdf.addImage(planoBase64, 'JPEG', planoStartX, planoStartY, imgWidth, imgHeight);

    // 2. Después, dibujamos los recuadros de las salas ENCIMA de la imagen.
    drawSalaAreas(pdf, salasData, planoStartX, planoStartY, imgWidth, imgHeight);
    // === FIN DEL CAMBIO ===


    const puntoMaestroMap = new Map(puntosMaestrosData.map(pm => [pm.id, pm]));
    const salaMap = new Map(salasData.map(s => [s.id, s]));

    puntosInspeccionadosData.forEach(punto => {
        const puntoMaestro = puntoMaestroMap.get(punto.punto_maestro_id);
        if (!puntoMaestro) return;
        const sala = salaMap.get(puntoMaestro.sala_id);
        const salaColor = sala ? sala.color : '#808080';

        const absX = planoStartX + (punto.coordenada_x * imgWidth);
        const absY = planoStartY + (punto.coordenada_y * imgHeight);
        const counts = incidenceCounts.get(punto.id) || { verde: 0, ambar: 0, rojo: 0 };
        drawPointMarker(pdf, absX, absY, punto, counts, imgWidth, salaColor);
    });
}