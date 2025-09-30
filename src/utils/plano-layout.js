// src/utils/plano-layout.js

export function calculatePlanoLayout(allPointsData, mapDimensions, badgeWidthRatio) {
    const BADGE_ASPECT_RATIO = 45 / 55;
    const badgeSize = {
        width: mapDimensions.width * badgeWidthRatio,
        height: mapDimensions.width * badgeWidthRatio * BADGE_ASPECT_RATIO
    };

    const placedObstacles = allPointsData.map(p => ({
        x: p.relativeX * mapDimensions.width, 
        y: p.relativeY * mapDimensions.height,
        width: 1, height: 1 // Los puntos son obstáculos pequeños
    }));

    const labelsToDraw = [];
    const mapCenterX = mapDimensions.width / 2;
    const mapCenterY = mapDimensions.height / 2;
    
    const sortedPoints = [...allPointsData].sort((a, b) => {
        const distA = Math.sqrt(Math.pow((a.relativeX * mapDimensions.width) - mapCenterX, 2) + Math.pow((a.relativeY * mapDimensions.height) - mapCenterY, 2));
        const distB = Math.sqrt(Math.pow((b.relativeX * mapDimensions.width) - mapCenterX, 2) + Math.pow((b.relativeY * mapDimensions.height) - mapCenterY, 2));
        return distA - distB;
    });

    for (const point of sortedPoints) {
        const needsBadge = point.estado !== 'existente' || point.detalle_modificacion !== null ||
            (point.counts.verde > 0 || point.counts.ambar > 0 || point.counts.rojo > 0);
        if (!needsBadge) continue;

        const pointAbs = {
            x: point.relativeX * mapDimensions.width,
            y: point.relativeY * mapDimensions.height
        };
        
        const finalPositionAbs = findNonOverlappingPosition(pointAbs, badgeSize, placedObstacles, mapDimensions);
        
        const badgeRect = { 
            x: finalPositionAbs.x - badgeSize.width / 2, 
            y: finalPositionAbs.y - badgeSize.height / 2, 
            ...badgeSize 
        };
        placedObstacles.push(badgeRect);
        
        labelsToDraw.push({
            pointData: point,
            position: { // Posición RELATIVA (0-1)
                x: finalPositionAbs.x / mapDimensions.width,
                y: finalPositionAbs.y / mapDimensions.height
            },
            size: { // Tamaño RELATIVO (0-1)
                width: badgeSize.width / mapDimensions.width,
                height: badgeSize.height / mapDimensions.height
            }
        });
    }
    return labelsToDraw;
}

function findNonOverlappingPosition(pointAbs, badgeSize, obstacles, pageBounds) {
    const isOverlapping = (rect1, rect2) => {
        const margin = 5; 
        return !(rect1.x > rect2.x + rect2.width + margin ||
            rect1.x + rect1.width + margin < rect2.x ||
            rect1.y > rect2.y + rect2.height + margin ||
            rect1.y + rect1.height + margin < rect2.y);
    };
    const isWithinBounds = (rect) => (
        rect.x >= 0 &&
        rect.y >= 0 &&
        rect.x + rect.width <= pageBounds.width &&
        rect.y + rect.height <= pageBounds.height
    );
    const checkPosition = (pos) => {
        const candidateRect = {
            x: pos.x - badgeSize.width / 2,
            y: pos.y - badgeSize.height / 2,
            ...badgeSize
        };
        if (isWithinBounds(candidateRect) && !obstacles.some(obs => isOverlapping(candidateRect, obs))) {
            return pos;
        }
        return null;
    };
    const preferredOffsets = [
        { x: 0, y: -(badgeSize.height / 2 + 10) }, { x: 0, y: (badgeSize.height / 2 + 10) },
        { x: (badgeSize.width / 2 + 10), y: 0 },   { x: -(badgeSize.width / 2 + 10), y: 0 }
    ];
    for (const offset of preferredOffsets) {
        const position = checkPosition({ x: pointAbs.x + offset.x, y: pointAbs.y + offset.y });
        if (position) return position;
    }

    let x = pointAbs.x, y = pointAbs.y, dx = 0, dy = -1, stepSize = 10, stepsInSegment = 1, turnCounter = 0;
    for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < Math.floor(stepsInSegment); j++) {
            x += dx * stepSize;
            y += dy * stepSize;
            const position = checkPosition({ x, y });
            if (position) return position;
        }
        [dx, dy] = [-dy, dx];
        turnCounter++;
        if (turnCounter % 2 === 0) stepsInSegment += 0.5;
    }
    return { x: pointAbs.x, y: pointAbs.y - (badgeSize.height / 2 + 10) };
}