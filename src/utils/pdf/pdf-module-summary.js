// src/utils/pdf/pdf-module-summary.js

import { MARGIN } from './pdf-helpers';

function drawInfoBadge(pdf, position, pointData, badgeSizeMM) {
    const { width: BADGE_WIDTH_MM, height: BADGE_HEIGHT_MM } = badgeSizeMM;

    const FONT_SIZE_HEADER = BADGE_HEIGHT_MM * 0.70;
    const FONT_SIZE_STATE = BADGE_HEIGHT_MM * 0.38;
    const FONT_SIZE_SEMAPHORE = BADGE_HEIGHT_MM * 0.45;

    let stateText = null;
    if (pointData.estado === 'nuevo') stateText = 'NUEVA';
    else if (pointData.estado === 'suprimido') stateText = 'SUPRIMIDA';
    else if (pointData.detalle_modificacion === 'aumentado') stateText = 'AUMENTADA';
    else if (pointData.detalle_modificacion === 'disminuido') stateText = 'DISMINUIDA';

    const startX = position.x - BADGE_WIDTH_MM / 2;
    let currentY = position.y - BADGE_HEIGHT_MM / 2;

    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(startX, currentY, BADGE_WIDTH_MM, BADGE_HEIGHT_MM, 1, 1, 'F');

    pdf.setFontSize(FONT_SIZE_HEADER).setFont(undefined, 'bold');
    pdf.setTextColor(50, 50, 50);
    const headerText = `${pointData.nomenclatura.split('-').pop() || '?'}`;
    
    const headerY = stateText ? currentY + BADGE_HEIGHT_MM * 0.22 : currentY + BADGE_HEIGHT_MM * 0.35;
    pdf.text(headerText, position.x, headerY, { align: 'center' });

    if (stateText) {
        pdf.setFontSize(FONT_SIZE_STATE).setFont(undefined, 'bold');
        pdf.setTextColor(29, 78, 216);
        pdf.text(stateText, position.x, headerY + BADGE_HEIGHT_MM * 0.2, { align: 'center' });
    }
    
    currentY += BADGE_HEIGHT_MM * 0.5;
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

function drawLeaderLine(pdf, from, to) {
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.2);
    pdf.line(from.x, from.y, to.x, to.y);
}

export async function buildSummaryAnnex(pdf, reportData, finalLabels, originalDimensions) {
    const { planoBase64 } = reportData;

    const PAGE_WIDTH_MM = pdf.internal.pageSize.getWidth();
    const PAGE_HEIGHT_MM = pdf.internal.pageSize.getHeight();
    
    const pageBounds = { x: MARGIN, y: MARGIN, width: PAGE_WIDTH_MM - MARGIN * 2, height: PAGE_HEIGHT_MM - MARGIN * 2 };

    const pageAspectRatio = pageBounds.width / pageBounds.height;
    const imageAspectRatio = originalDimensions.width / originalDimensions.height;

    let imgWidthMM, imgHeightMM, planoStartX, planoStartY;
    if (imageAspectRatio > pageAspectRatio) {
        imgWidthMM = pageBounds.width;
        imgHeightMM = imgWidthMM / imageAspectRatio;
        planoStartX = pageBounds.x;
        planoStartY = pageBounds.y + (pageBounds.height - imgHeightMM) / 2;
    } else {
        imgHeightMM = pageBounds.height;
        imgWidthMM = imgHeightMM * imageAspectRatio;
        planoStartY = pageBounds.y;
        planoStartX = pageBounds.x + (pageBounds.width - imgWidthMM) / 2;
    }

    pdf.addImage(planoBase64, 'JPEG', planoStartX, planoStartY, imgWidthMM, imgHeightMM, undefined, 'FAST');
    
    const labelsInMM = finalLabels.map(label => {
        const pointPdfX = planoStartX + (label.pointData.relativeX * imgWidthMM);
        const pointPdfY = planoStartY + (label.pointData.relativeY * imgHeightMM);
        const labelPdfX = planoStartX + (label.position.x * imgWidthMM);
        const labelPdfY = planoStartY + (label.position.y * imgHeightMM);
        
        const badgeSizeMM = {
            width: label.size.width * imgWidthMM,
            height: label.size.height * imgHeightMM
        };

        return {
            pointData: label.pointData,
            pointPosition: { x: pointPdfX, y: pointPdfY },
            labelPosition: { x: labelPdfX, y: labelPdfY },
            badgeSizeMM: badgeSizeMM
        };
    });

    labelsInMM.forEach(label => {
        drawLeaderLine(pdf, label.pointPosition, label.labelPosition);
    });
    
    labelsInMM.forEach(label => {
        drawInfoBadge(pdf, label.labelPosition, label.pointData, label.badgeSizeMM);
    });
}