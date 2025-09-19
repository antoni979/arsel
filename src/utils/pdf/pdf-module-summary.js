// src/utils/pdf/pdf-module-summary.js

import { MARGIN } from './pdf-helpers';

// ===== INICIO DE LA CORRECCIÓN: La función ahora recibe el tamaño en mm =====
function drawInfoBadge(pdf, position, pointData, badgeSizeMM) {
    const { width: BADGE_WIDTH_MM, height: BADGE_HEIGHT_MM } = badgeSizeMM;

    // Los tamaños de fuente se ajustan proporcionalmente al tamaño de la tarjeta
    const FONT_SIZE_HEADER = BADGE_HEIGHT_MM * 0.45;
    const FONT_SIZE_STATE = BADGE_HEIGHT_MM * 0.35;
    const FONT_SIZE_SEMAPHORE = BADGE_HEIGHT_MM * 0.45;

    let stateText = null;
    if (pointData.estado === 'nuevo') stateText = 'NUEVA';
    else if (pointData.estado === 'suprimido') stateText = 'SUPRIMIDA';
    else if (pointData.detalle_modificacion === 'aumentado') stateText = 'AUMENTADA';
    else if (pointData.detalle_modificacion === 'disminuido') stateText = 'DISMINUIDA';

    const startX = position.x - BADGE_WIDTH_MM / 2;
    let currentY = position.y - BADGE_HEIGHT_MM / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(startX, currentY, BADGE_WIDTH_MM, BADGE_HEIGHT_MM, 1, 1, 'FD');
    
    pdf.setFontSize(FONT_SIZE_HEADER).setFont(undefined, 'bold');
    pdf.setTextColor(50, 50, 50);
    const headerText = `Punto ${pointData.nomenclatura.split('-').pop() || '?'}`;
    
    const headerY = stateText ? currentY + BADGE_HEIGHT_MM * 0.22 : currentY + BADGE_HEIGHT_MM * 0.35;
    pdf.text(headerText, position.x, headerY, { align: 'center' });

    if (stateText) {
        pdf.setFontSize(FONT_SIZE_STATE).setFont(undefined, 'bold');
        pdf.setTextColor(29, 78, 216);
        pdf.text(stateText, position.x, headerY + BADGE_HEIGHT_MM * 0.2, { align: 'center' });
    }
    
    currentY += BADGE_HEIGHT_MM * 0.5; // Línea a la mitad de la altura
    pdf.setDrawColor(220, 220, 220);
    pdf.line(startX + 1, currentY, startX + BADGE_WIDTH_MM - 1, currentY);
    currentY += 0.5;

    const items = [
      { color: [34, 197, 94], count: pointData.counts.verde },
      { color: [245, 158, 11], count: pointData.counts.ambar },
      { color: [239, 68, 68], count: pointData.counts.rojo },
    ];
    const circleRadius = BADGE_HEIGHT_MM * 0.15;
    const semaphoreStartX = position.x - (items.length - 1) * (circleRadius * 2 + 0.8) / 2;
    
    pdf.setFontSize(FONT_SIZE_SEMAPHORE).setFont(undefined, 'bold');
    
    items.forEach((item, index) => {
        const circleX = semaphoreStartX + index * (circleRadius * 2 + 0.8);
        const circleY = currentY + BADGE_HEIGHT_MM * 0.2;
        pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
        pdf.circle(circleX, circleY, circleRadius, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.text(String(item.count), circleX, circleY, { align: 'center', baseline: 'middle' });
    });
}
// ===== FIN DE LA CORRECCIÓN =====

function drawLeaderLine(pdf, from, to) {
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.2);
    pdf.line(from.x, from.y, to.x, to.y);
}

export async function buildSummaryAnnex(pdf, reportData, finalLabels, previewDimensions) {
    const { planoBase64 } = reportData;

    const PAGE_WIDTH_MM = pdf.internal.pageSize.getWidth();
    const PAGE_HEIGHT_MM = pdf.internal.pageSize.getHeight();
    
    const pageBounds = { x: MARGIN, y: MARGIN, width: PAGE_WIDTH_MM - MARGIN * 2, height: PAGE_HEIGHT_MM - MARGIN * 2 };

    const imgProps = pdf.getImageProperties(planoBase64);
    const pageAspectRatio = pageBounds.width / pageBounds.height;
    const imageAspectRatio = imgProps.width / imgProps.height;

    let imgWidth, imgHeight, planoStartX, planoStartY;
    if (imageAspectRatio > pageAspectRatio) {
        imgWidth = pageBounds.width;
        imgHeight = imgWidth / imageAspectRatio;
        planoStartX = pageBounds.x;
        planoStartY = pageBounds.y + (pageBounds.height - imgHeight) / 2;
    } else {
        imgHeight = pageBounds.height;
        imgWidth = imgHeight * imageAspectRatio;
        planoStartY = pageBounds.y;
        planoStartX = pageBounds.x + (pageBounds.width - imgWidth) / 2;
    }

    pdf.addImage(planoBase64, 'JPEG', planoStartX, planoStartY, imgWidth, imgHeight, undefined, 'FAST');
    
    // ===== INICIO DE LA CORRECCIÓN: Usamos un único factor de escala =====
    // Usamos el del ancho para mantener la proporción de los elementos cuadrados/circulares
    const scale = imgWidth / previewDimensions.width;

    const labelsInMM = finalLabels.map(label => {
        const pointPdfX = planoStartX + (label.pointData.absX * scale);
        const pointPdfY = planoStartY + (label.pointData.absY * scale);
        const labelPdfX = planoStartX + (label.position.x * scale);
        const labelPdfY = planoStartY + (label.position.y * scale);
        
        // Convertimos el tamaño de la tarjeta de píxeles a milímetros
        const badgeSizeMM = {
            width: label.size.width * scale,
            height: label.size.height * scale
        };

        return {
            pointData: label.pointData,
            pointPosition: { x: pointPdfX, y: pointPdfY },
            labelPosition: { x: labelPdfX, y: labelPdfY },
            badgeSizeMM: badgeSizeMM
        };
    });
    // ===== FIN DE LA CORRECCIÓN =====

    labelsInMM.forEach(label => {
        drawLeaderLine(pdf, label.pointPosition, label.labelPosition);
    });
    
    labelsInMM.forEach(label => {
        drawInfoBadge(pdf, label.labelPosition, label.pointData, label.badgeSizeMM);
    });
}