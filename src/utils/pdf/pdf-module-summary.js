// src/utils/pdf/pdf-module-summary.js

import { loadImageAsBase64, drawHeader, MARGIN, FONT_SIZES, DOC_WIDTH_LANDSCAPE } from './pdf-helpers';

// --- INICIO DE CAMBIOS: Últimas funciones de dibujado ---

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

// Dibuja ÚNICAMENTE el semáforo vertical.
function drawSemaphoreBadge(pdf, position, point) {
    const FONT_SIZE_SEMAPHORE = 6;
    const PADDING_V = 1.5;
    const BADGE_WIDTH = 12;
    const ITEM_HEIGHT = 4;
    const badgeHeight = (ITEM_HEIGHT * 3) + (PADDING_V * 2);

    const startX = position.x - (BADGE_WIDTH / 2);
    let currentY = position.y - (badgeHeight / 2);

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(startX, currentY, BADGE_WIDTH, badgeHeight, 2, 2, 'FD');

    currentY += PADDING_V;

    pdf.setFontSize(FONT_SIZE_SEMAPHORE).setFont(undefined, 'normal');
    const colorBoxSize = 3;
    const items = [
        { color: [34, 197, 94], count: point.counts.verde },
        { color: [245, 158, 11], count: point.counts.ambar },
        { color: [239, 68, 68], count: point.counts.rojo },
    ];

    items.forEach(item => {
        const itemCenterY = currentY + ITEM_HEIGHT / 2;
        pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
        pdf.rect(startX + 2, itemCenterY - colorBoxSize/2, colorBoxSize, colorBoxSize, 'F');
        pdf.setTextColor(80, 80, 80);
        pdf.text(String(item.count), startX + 2 + colorBoxSize + 2.5, itemCenterY + 2.1, { align: 'center' });
        currentY += ITEM_HEIGHT;
    });
    
    return { x: startX, y: position.y - (badgeHeight/2), width: BADGE_WIDTH, height: badgeHeight };
}

// Dibuja el texto de estado por separado.
function drawStateText(pdf, position, badgeRect, point) {
    let stateText = null;
    if (point.estado === 'nuevo') stateText = 'NUEVA';
    else if (point.estado === 'suprimido') stateText = 'SUPRIMIDA';
    else if (point.detalle_modificacion === 'aumentado') stateText = 'AUMENTADA';
    else if (point.detalle_modificacion === 'disminuido') stateText = 'DISMINUIDA';

    if (stateText) {
        pdf.setFontSize(5).setFont(undefined, 'bold');
        pdf.setTextColor(80, 80, 80);
        // Coloca el texto encima o debajo de la tarjeta del semáforo.
        const textY = position.y < point.absY ? badgeRect.y - 1.5 : badgeRect.y + badgeRect.height + 2.5;
        pdf.text(stateText, position.x, textY, { align: 'center', baseline: 'middle' });
    }
}


function drawLeaderLine(pdf, from, to) {
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.25);
    pdf.setLineDashPattern([1, 1], 0);
    pdf.line(from.x, from.y, to.x, to.y);
    pdf.setLineDashPattern([], 0);
}

// --- FIN DE CAMBIOS ---

export async function buildSummaryAnnex(pdf, reportData) {
    // Esta función ahora solo construye el contenido, no crea la página
    const { salasData, puntosInspeccionadosData, puntosMaestrosData, planoBase64, incidenceCounts } = reportData;

    const PAGE_WIDTH = pdf.internal.pageSize.getWidth();
    const PAGE_HEIGHT = pdf.internal.pageSize.getHeight();
    const HEADER_HEIGHT = 15;
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
        const margin = 3.5;
        return !(rect1.x > rect2.x + rect2.width + margin || rect1.x + rect1.width + margin < rect2.x ||
                 rect1.y > rect2.y + rect2.height + margin || rect1.y + rect1.height + margin < rect2.y);
    };

    // Ordenar los puntos desde el centro hacia afuera para una mejor distribución
    const mapCenterX = planoStartX + imgWidth / 2;
    const mapCenterY = planoStartY + imgHeight / 2;
    allPoints.sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.absX - mapCenterX, 2) + Math.pow(a.absY - mapCenterY, 2));
        const distB = Math.sqrt(Math.pow(b.absX - mapCenterX, 2) + Math.pow(b.absY - mapCenterY, 2));
        return distA - distB;
    });

    const labelsToDraw = [];

    for (const point of allPoints) {
        const needsBadge = point.estado !== 'existente' || point.detalle_modificacion !== null ||
            (point.counts.verde > 0 || point.counts.ambar > 0 || point.counts.rojo > 0);

        if (!needsBadge) continue;
        
        const candidateOffsets = [
            { x: 0, y: -15 }, { x: 0, y: 15 },      // Arriba, Abajo
            { x: 15, y: 0 }, { x: -15, y: 0 },      // Lados
            { x: 12, y: -12 }, { x: -12, y: -12 },  // Diagonales
            { x: 12, y: 12 }, { x: -12, y: 12 },
        ];
        
        let finalPosition = null;

        for (const offset of candidateOffsets) {
            const candidatePos = { x: point.absX + offset.x, y: point.absY + offset.y };
            
            const tempBadgeHeight = (4 * 3) + (1.5 * 2);
            const candidateRect = { x: candidatePos.x - 12 / 2, y: candidatePos.y - tempBadgeHeight/2, width: 12, height: tempBadgeHeight };
            
            // Comprobación de límites de la página
            if (candidateRect.x < MARGIN || candidateRect.x + candidateRect.width > PAGE_WIDTH - MARGIN ||
                candidateRect.y < HEADER_HEIGHT || candidateRect.y + candidateRect.height > PAGE_HEIGHT - MARGIN_V) {
                continue; // Esta posición está fuera de los límites, probar la siguiente
            }

            if (!obstacles.some(obs => isOverlapping(candidateRect, obs))) {
                finalPosition = candidatePos;
                obstacles.push(candidateRect);
                break;
            }
        }
        
        if (!finalPosition) finalPosition = { x: point.absX, y: point.absY - 20 };
        
        labelsToDraw.push({ point, position: finalPosition });
    }
    
    allPoints.forEach(point => drawPointNumberOnMap(pdf, point));
    
    labelsToDraw.forEach(({point, position}) => {
        const badgeRect = drawSemaphoreBadge(pdf, position, point);
        drawStateText(pdf, position, badgeRect, point);
        drawLeaderLine(pdf, {x: point.absX, y: point.absY}, position, badgeRect);
    });
}