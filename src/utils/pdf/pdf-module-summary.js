// src/utils/pdf/pdf-module-summary.js

import { drawHeader, MARGIN } from './pdf-helpers';

// --- (No hay cambios en esta función de posicionamiento, sigue siendo la correcta) ---
function findNonOverlappingPosition(point, badgeSize, obstacles, pageBounds) {
    const isOverlapping = (rect1, rect2) => {
        const margin = 2; 
        return !(rect1.x > rect2.x + rect2.width + margin ||
                 rect1.x + rect1.width + margin < rect2.x ||
                 rect1.y > rect2.y + rect2.height + margin ||
                 rect1.y + rect1.height + margin < rect2.y);
    };

    const isWithinBounds = (rect) => {
        return rect.x >= pageBounds.x &&
               rect.y >= pageBounds.y &&
               rect.x + rect.width <= pageBounds.x + pageBounds.width &&
               rect.y + rect.height <= pageBounds.y + pageBounds.height;
    };

    const checkPosition = (pos) => {
        const candidateRect = {
            x: pos.x - badgeSize.width / 2,
            y: pos.y - badgeSize.height / 2,
            width: badgeSize.width,
            height: badgeSize.height
        };
        if (isWithinBounds(candidateRect) && !obstacles.some(obs => isOverlapping(candidateRect, obs))) {
            return pos;
        }
        return null;
    };

    const preferredOffsets = [
        { x: 0, y: -(badgeSize.height / 2 + 8) }, { x: 0, y: (badgeSize.height / 2 + 8) },
        { x: (badgeSize.width / 2 + 8), y: 0 },   { x: -(badgeSize.width / 2 + 8), y: 0 },
        { x: 15, y: -15 }, { x: -15, y: -15 }, { x: 15, y: 15 }, { x: -15, y: 15 }
    ];

    for (const offset of preferredOffsets) {
        const position = checkPosition({ x: point.absX + offset.x, y: point.absY + offset.y });
        if (position) return position;
    }

    let x = point.absX;
    let y = point.absY;
    let dx = 0;
    let dy = -1;
    let stepSize = 5; 
    let stepsInSegment = 1;
    let turnCounter = 0;

    for (let i = 0; i < 5000; i++) {
        for (let j = 0; j < Math.floor(stepsInSegment); j++) {
            x += dx * stepSize;
            y += dy * stepSize;
            const position = checkPosition({ x, y });
            if (position) return position;
        }
        [dx, dy] = [-dy, dx];
        turnCounter++;
        if (turnCounter % 2 === 0) {
            stepsInSegment += 1;
        }
    }

    console.warn("El algoritmo en espiral no encontró una posición. Colocando en la posición por defecto.");
    return { x: point.absX, y: point.absY - 25 };
}


function drawSalaPolygons(pdf, salas, planoX, planoY, planoW, planoH) {
    // (Esta función no necesita cambios)
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

// --- MEJORA 3: CÍRCULO DE ANCLAJE EN EL MAPA ---
function drawPointNumberOnMap(pdf, point) {
    const pointNumber = (point.nomenclatura && typeof point.nomenclatura === 'string')
        ? point.nomenclatura.split('-').pop() || '?'
        : '?';

    // Parsear el color de la sala para el borde
    const salaColorRGB = ((hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [128, 128, 128];
    })(point.salaColor);

    pdf.setFontSize(7).setFont(undefined, 'bold');
    pdf.setTextColor(salaColorRGB[0], salaColorRGB[1], salaColorRGB[2]);
    
    const textWidth = pdf.getStringUnitWidth(pointNumber) * 7 / pdf.internal.scaleFactor;
    const circleRadius = textWidth / 2 + 1.5; // Radio del círculo

    // Dibuja el círculo con borde y fondo blanco
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(salaColorRGB[0], salaColorRGB[1], salaColorRGB[2]);
    pdf.setLineWidth(0.4);
    pdf.circle(point.absX, point.absY, circleRadius, 'FD'); // FD = Fill and Draw (Stroke)
    
    // Dibuja el número en el centro
    pdf.text(pointNumber, point.absX, point.absY, { align: 'center', baseline: 'middle' });
}
// --- FIN DE MEJORA 3 ---


// --- MEJORA 1: NÚMERO DEL PUNTO EN LA TARJETA ---
function drawInfoBadge(pdf, position, point) {
    const FONT_SIZE_STATE = 5.5;
    const FONT_SIZE_SEMAPHORE = 6;
    const FONT_SIZE_PUNTO = 7;
    const PADDING_V = 1.2;
    const BADGE_WIDTH = 14; // Un poco más ancha para el número

    // Extraer el número del punto
    const pointNumber = point.nomenclatura.split('-').pop() || '?';

    let stateText = null;
    if (point.estado === 'nuevo') stateText = 'NUEVA';
    else if (point.estado === 'suprimido') stateText = 'SUPRIMIDA';
    else if (point.detalle_modificacion === 'aumentado') stateText = 'AUMENTADA';
    else if (point.detalle_modificacion === 'disminuido') stateText = 'DISMINUIDA';

    // Calcular altura dinámicamente
    const pointNumberHeight = FONT_SIZE_PUNTO + PADDING_V + 1; // +1 para la línea separadora
    const stateTextHeight = stateText ? FONT_SIZE_STATE + PADDING_V : 0;
    const semaphoreHeight = 3 * 4;
    const badgeHeight = pointNumberHeight + stateTextHeight + semaphoreHeight + (PADDING_V * 2);
    
    const startX = position.x - (BADGE_WIDTH / 2);
    let currentY = position.y - (badgeHeight / 2);

    // Dibuja el cuerpo del badge
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(150, 150, 150); // Borde un poco más oscuro
    pdf.setLineWidth(0.3);
    pdf.roundedRect(startX, currentY, BADGE_WIDTH, badgeHeight, 2, 2, 'FD');

    // Sección del Número del Punto
    currentY += PADDING_V + (FONT_SIZE_PUNTO / 2);
    pdf.setFontSize(FONT_SIZE_PUNTO).setFont(undefined, 'bold');
    pdf.setTextColor(50, 50, 50);
    pdf.text(`Punto ${pointNumber}`, position.x, currentY + 1, { align: 'center' });
    currentY += (FONT_SIZE_PUNTO / 2) + PADDING_V;
    pdf.setDrawColor(220, 220, 220);
    pdf.line(startX + 1, currentY, startX + BADGE_WIDTH - 1, currentY);
    currentY += 1;

    // Sección de Estado (si aplica)
    if (stateText) {
        currentY += PADDING_V;
        pdf.setFontSize(FONT_SIZE_STATE).setFont(undefined, 'bold');
        pdf.setTextColor(80, 80, 80);
        pdf.text(stateText, position.x, currentY + stateTextHeight / 2 - 0.2, { align: 'center', baseline: 'middle' });
        currentY += stateTextHeight;
    }

    // Sección del Semáforo
    const items = [
        { color: [34, 197, 94], count: point.counts.verde },
        { color: [245, 158, 11], count: point.counts.ambar },
        { color: [239, 68, 68], count: point.counts.rojo },
    ];

    items.forEach(item => {
        const itemCenterY = currentY + 4 / 2;
        pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
        pdf.circle(startX + 4, itemCenterY, 1.5, 'F'); // Círculos en lugar de cuadrados
        pdf.setTextColor(80, 80, 80);
        pdf.setFontSize(FONT_SIZE_SEMAPHORE).setFont(undefined, 'normal');
        pdf.text(String(item.count), startX + BADGE_WIDTH - 4, itemCenterY, { align: 'center', baseline: 'middle' });
        currentY += 4;
    });
    
    return { x: startX, y: position.y - (badgeHeight/2), width: BADGE_WIDTH, height: badgeHeight };
}
// --- FIN DE MEJORA 1 ---


// --- MEJORA 2: LÍNEAS GUÍA MÁS ELEGANTES ---
function drawLeaderLine(pdf, from, to, badgeRect) {
    // Usar línea sólida, fina y gris
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.2);
    // Quitar el patrón de guiones: pdf.setLineDashPattern([1, 1], 0);

    const badgeCenterX = badgeRect.x + badgeRect.width / 2;
    const badgeCenterY = badgeRect.y + badgeRect.height / 2;
    
    // Lógica para conectar al borde más cercano del badge
    const dx = from.x - badgeCenterX;
    const dy = from.y - badgeCenterY;
    const halfW = badgeRect.width / 2;
    const halfH = badgeRect.height / 2;
    
    let targetX, targetY;
    const slopeY = halfW * (dy / dx);
    const slopeX = halfH * (dx / dy);

    if (Math.abs(dy) <= halfH) { // Intersecta con lados verticales
      targetX = dx > 0 ? badgeRect.x + badgeRect.width : badgeRect.x;
      targetY = badgeCenterY + slopeY;
    } else { // Intersecta con lados horizontales
      targetY = dy > 0 ? badgeRect.y + badgeRect.height : badgeRect.y;
      targetX = badgeCenterX + slopeX;
    }

    pdf.line(from.x, from.y, targetX, targetY);
}
// --- FIN DE MEJORA 2 ---


export async function buildSummaryAnnex(pdf, reportData) {
    const { salasData, puntosInspeccionadosData, puntosMaestrosData, planoBase64, incidenceCounts } = reportData;

    const PAGE_WIDTH = pdf.internal.pageSize.getWidth();
    const PAGE_HEIGHT = pdf.internal.pageSize.getHeight();
    const HEADER_HEIGHT = 15;
    const MARGIN_V = 10;
    
    const pageBounds = {
        x: MARGIN,
        y: HEADER_HEIGHT,
        width: PAGE_WIDTH - MARGIN * 2,
        height: PAGE_HEIGHT - HEADER_HEIGHT - MARGIN_V
    };

    const imgProps = pdf.getImageProperties(planoBase64);
    const canvasAspectRatio = pageBounds.width / pageBounds.height;
    const imageAspectRatio = imgProps.width / imgProps.height;

    let imgWidth, imgHeight;
    if (imageAspectRatio > canvasAspectRatio) {
        imgWidth = pageBounds.width;
        imgHeight = imgWidth / imageAspectRatio;
    } else {
        imgHeight = pageBounds.height;
        imgWidth = imgHeight * imageAspectRatio;
    }

    const planoStartX = (PAGE_WIDTH - imgWidth) / 2;
    const planoStartY = HEADER_HEIGHT + (pageBounds.height - imgHeight) / 2;

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
    
    const placedObstacles = allPoints.map(p => ({ x: p.absX - 5, y: p.absY - 5, width: 10, height: 10 })); // Usar el círculo de anclaje como obstáculo
    const labelsToDraw = [];
    
    const mapCenterX = planoStartX + imgWidth / 2;
    const mapCenterY = planoStartY + imgHeight / 2;
    allPoints.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.absX - mapCenterX, 2) + Math.pow(a.absY - mapCenterY, 2));
        const distB = Math.sqrt(Math.pow(b.absX - mapCenterX, 2) + Math.pow(b.absY - mapCenterY, 2));
        return distA - distB;
    });

    for (const point of allPoints) {
        const needsBadge = point.estado !== 'existente' || point.detalle_modificacion !== null ||
            (point.counts.verde > 0 || point.counts.ambar > 0 || point.counts.rojo > 0);

        if (!needsBadge) continue;
        
        // --- (Código actualizado para calcular el tamaño del badge) ---
        let badgeHeight = (1.2 * 2) + (4 * 3) + (7 + 1.2 + 1);
        if (point.estado !== 'existente' || point.detalle_modificacion !== null) {
            badgeHeight += 5.5 + 1.2;
        }
        const badgeSize = { width: 14, height: badgeHeight };
        
        const finalPosition = findNonOverlappingPosition(point, badgeSize, placedObstacles, pageBounds);

        const badgeRect = {
            x: finalPosition.x - badgeSize.width / 2,
            y: finalPosition.y - badgeSize.height / 2,
            ...badgeSize
        };
        
        placedObstacles.push(badgeRect);
        labelsToDraw.push({ point, position: finalPosition, finalBadgeRect: badgeRect });
    }

    // Dibujar primero todos los números/anclajes de los puntos
    allPoints.forEach(point => drawPointNumberOnMap(pdf, point));
    
    // Luego, dibujar los badges y sus líneas guía
    labelsToDraw.forEach(({point, position, finalBadgeRect}) => {
        drawInfoBadge(pdf, position, point);
        drawLeaderLine(pdf, {x: point.absX, y: point.absY}, position, finalBadgeRect);
    });
}