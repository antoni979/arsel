// src/utils/pdf/pdf-module-summary.js

import { loadImageAsBase64, drawHeader, MARGIN, FONT_SIZES, DOC_WIDTH_LANDSCAPE } from './pdf-helpers';

function drawSalaPolygons(pdf, salas, planoX, planoY, planoW, planoH) {
    for (const sala of salas) {
        if (sala.area_puntos && sala.area_puntos.length > 2) {
            const rgb = ((hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : null;
            })(sala.color);
            if (rgb) {
                pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
                pdf.setLineWidth(0.8);
                const absolutePoints = sala.area_puntos.map(p => ({ x: planoX + (p.x * planoW), y: planoY + (p.y * planoH) }));
                for (let i = 0; i < absolutePoints.length; i++) {
                    const p1 = absolutePoints[i];
                    const p2 = absolutePoints[(i + 1) % absolutePoints.length];
                    pdf.line(p1.x, p1.y, p2.x, p2.y);
                }
            }
        }
    }
}

function drawPointNumberOnMap(pdf, point) {
    const pointNumber = (point.nomenclatura && typeof point.nomenclatura === 'string')
        ? point.nomenclatura.split('-').pop() || '?'
        : '?';
    pdf.setFontSize(8).setFont(undefined, 'bold');
    pdf.setTextColor(point.salaColor);
    
    const textWidth = pdf.getStringUnitWidth(pointNumber) * 8 / pdf.internal.scaleFactor;
    const rectWidth = textWidth + 1.5;
    const rectHeight = 4;
    
    pdf.setFillColor(255, 255, 255);
    pdf.rect(point.absX - rectWidth/2, point.absY - rectHeight/2, rectWidth, rectHeight, 'F');
    pdf.text(pointNumber, point.absX, point.absY, { align: 'center', baseline: 'middle' });
}

function drawInfoBadge(pdf, position, point) {
    const FONT_SIZE_STATE = 5.5;
    const FONT_SIZE_SEMAPHORE = 6;
    const PADDING_V = 1.2;
    const PADDING_H = 2.5;
    const SEMAPHORE_HEIGHT = 5;
    const BADGE_WIDTH = 23;

    let stateText = null;
    if (point.estado === 'nuevo') stateText = 'NUEVA';
    else if (point.estado === 'suprimido') stateText = 'SUPRIMIDA';
    else if (point.detalle_modificacion === 'aumentado') stateText = 'AUMENTADA';
    else if (point.detalle_modificacion === 'disminuido') stateText = 'DISMINUIDA';

    const stateTextHeight = stateText ? FONT_SIZE_STATE + PADDING_V : 0;
    const badgeHeight = SEMAPHORE_HEIGHT + stateTextHeight + (PADDING_V * 2);
    
    const startX = position.x - (BADGE_WIDTH / 2);
    let currentY = position.y - (badgeHeight / 2);

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(startX, currentY, BADGE_WIDTH, badgeHeight, 2, 2, 'FD');

    currentY += PADDING_V;

    if (stateText) {
        pdf.setFontSize(FONT_SIZE_STATE).setFont(undefined, 'bold');
        pdf.setTextColor(80, 80, 80);
        pdf.text(stateText, position.x, currentY + stateTextHeight / 2 - 0.2, { align: 'center', baseline: 'middle' });
        currentY += stateTextHeight;
    }

    const semaphoreY = currentY + SEMAPHORE_HEIGHT / 2;
    const colorBoxSize = 3;
    let currentX = startX + PADDING_H;
    const gap = 5.5;
    
    pdf.setFontSize(FONT_SIZE_SEMAPHORE).setFont(undefined, 'normal');
    pdf.setFillColor(34, 197, 94);
    pdf.rect(currentX, semaphoreY - (colorBoxSize/2), colorBoxSize, colorBoxSize, 'F');
    pdf.setTextColor(80, 80, 80);
    pdf.text(String(point.counts.verde), currentX + colorBoxSize + 0.8, semaphoreY + 2.1, {align: 'center'});
    currentX += gap;
    pdf.setFillColor(245, 158, 11);
    pdf.rect(currentX, semaphoreY - (colorBoxSize/2), colorBoxSize, colorBoxSize, 'F');
    pdf.text(String(point.counts.ambar), currentX + colorBoxSize + 0.8, semaphoreY + 2.1, {align: 'center'});
    currentX += gap;
    pdf.setFillColor(239, 68, 68);
    pdf.rect(currentX, semaphoreY - (colorBoxSize/2), colorBoxSize, colorBoxSize, 'F');
    pdf.text(String(point.counts.rojo), currentX + colorBoxSize + 0.8, semaphoreY + 2.1, {align: 'center'});
    
    return { x: startX, y: position.y - (badgeHeight/2), width: BADGE_WIDTH, height: badgeHeight };
}

function drawLeaderLine(pdf, from, to, badgeRect) {
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.25);
    pdf.setLineDashPattern([1, 1], 0);

    const targetX = Math.max(badgeRect.x, Math.min(from.x, badgeRect.x + badgeRect.width));
    const targetY = Math.max(badgeRect.y, Math.min(from.y, badgeRect.y + badgeRect.height));

    pdf.line(from.x, from.y, targetX, targetY);
    pdf.setLineDashPattern([], 0);
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
        if (counts && counts[inc.gravedad] !== undefined) counts[inc.gravedad]++;
    });

    const planoBase64 = await loadImageAsBase64(version.url_imagen_plano);
    if (!planoBase64) return;

    pdf.addPage(null, 'l');

    const PAGE_WIDTH = pdf.internal.pageSize.getWidth();
    const PAGE_HEIGHT = pdf.internal.pageSize.getHeight();
    const HEADER_HEIGHT = 20;
    const MARGIN_V = 10;

    const imgProps = pdf.getImageProperties(planoBase64);
    const canvasAspectRatio = (PAGE_WIDTH - MARGIN * 2) / (PAGE_HEIGHT - HEADER_HEIGHT - MARGIN_V);
    const imageAspectRatio = imgProps.width / imgProps.height;

    let imgWidth, imgHeight;
    if (imageAspectRatio > canvasAspectRatio) {
        imgWidth = PAGE_WIDTH - MARGIN * 2;
        imgHeight = imgWidth / imageAspectRatio;
    } else {
        imgHeight = PAGE_HEIGHT - HEADER_HEIGHT - MARGIN_V;
        imgWidth = imgHeight * imageAspectRatio;
    }

    const planoStartX = (PAGE_WIDTH - imgWidth) / 2;
    const planoStartY = HEADER_HEIGHT;

    pdf.addImage(planoBase64, 'JPEG', planoStartX, planoStartY, imgWidth, imgHeight);
    drawSalaPolygons(pdf, salasData, planoStartX, planoStartY, imgWidth, imgHeight);

    const puntoMaestroMap = new Map(puntosMaestrosData.map(pm => [pm.id, pm]));
    const salaMap = new Map(salasData.map(s => [s.id, s]));

    const allPoints = puntosInspeccionadosData.map(punto => {
        const puntoMaestro = puntoMaestroMap.get(punto.punto_maestro_id);
        if (!puntoMaestro) return null;
        const sala = salaMap.get(puntoMaestro.sala_id);
        const salaColor = sala ? sala.color : '#808080';
        const absX = planoStartX + (punto.coordenada_x * imgWidth);
        const absY = planoStartY + (punto.coordenada_y * imgHeight);
        const counts = incidenceCounts.get(punto.id) || { verde: 0, ambar: 0, rojo: 0 };
        return { ...punto, nomenclatura: puntoMaestro.nomenclatura, sala, salaColor, absX, absY, counts };
    }).filter(Boolean);
    
    const obstacles = allPoints.map(p => ({ x: p.absX - 4, y: p.absY - 4, width: 8, height: 8 }));
    const isOverlapping = (rect1, rect2) => {
        const margin = 2;
        return !(rect1.x > rect2.x + rect2.width + margin || rect1.x + rect1.width + margin < rect2.x ||
                 rect1.y > rect2.y + rect2.height + margin || rect1.y + rect1.height + margin < rect2.y);
    };

    allPoints.sort((a, b) => a.absY - b.absY);

    // --- INICIO DE CAMBIOS: Reordenación del proceso de dibujado ---
    const badgesToDraw = []; // Almacenará la información de las tarjetas para dibujarlas al final

    // Fase 1: Dibujar números, calcular posiciones y guardar info de tarjetas
    for (const point of allPoints) {
        drawPointNumberOnMap(pdf, point);

        const needsBadge = point.estado !== 'existente' || point.detalle_modificacion !== null ||
            (point.counts.verde > 0 || point.counts.ambar > 0 || point.counts.rojo > 0);

        if (!needsBadge) continue;
        
        const candidateOffsets = [
            { x: 15, y: 15 }, { x: -15, y: 15 }, { x: 15, y: -15 }, { x: -15, y: -15 },
            { x: 20, y: 0 }, { x: -20, y: 0 }, { x: 0, y: 20 }, { x: 0, y: -20 },
        ];
        
        let finalPosition = null;

        for (const offset of candidateOffsets) {
            const candidatePos = { x: point.absX + offset.x, y: point.absY + offset.y };
            
            let tempBadgeHeight = 5 + 1.2 * 2;
            if (point.estado !== 'existente' || point.detalle_modificacion !== null) tempBadgeHeight += 5.5 + 1.2;
            const candidateRect = { x: candidatePos.x - 23 / 2, y: candidatePos.y - tempBadgeHeight/2, width: 23, height: tempBadgeHeight };

            const hasCollision = obstacles.some(obs => isOverlapping(candidateRect, obs));

            if (!hasCollision) {
                finalPosition = candidatePos;
                break;
            }
        }
        
        if (!finalPosition) finalPosition = { x: point.absX + 20, y: point.absY }; // Posición de emergencia
        
        // En lugar de dibujar la tarjeta, guardamos su información
        const badgeRect = { 
            x: finalPosition.x - 23 / 2, y: finalPosition.y - (5 + 1.2 * 2)/2, 
            width: 23, height: (5 + 1.2 * 2) // Altura base
        };
        obstacles.push(badgeRect);
        badgesToDraw.push({ point: point, position: finalPosition, rect: badgeRect });
    }

    // Fase 2: Dibujar todas las líneas guía PRIMERO
    for (const badgeInfo of badgesToDraw) {
        drawLeaderLine(pdf, { x: badgeInfo.point.absX, y: badgeInfo.point.absY }, badgeInfo.position, badgeInfo.rect);
    }
    
    // Fase 3: Dibujar todas las tarjetas de información ENCIMA de las líneas
    for (const badgeInfo of badgesToDraw) {
        drawInfoBadge(pdf, badgeInfo.position, badgeInfo.point);
    }
    // --- FIN DE CAMBIOS ---
}