// src/utils/plano-layout.js

export function calculatePlanoLayout(allPointsData, mapDimensions, badgeWidth) {
    const placedObstacles = allPointsData.map(p => ({
        x: p.absX - 5, y: p.absY - 5,
        width: 10, height: 10
    }));

    const labelsToDraw = [];
    const mapCenterX = mapDimensions.x + mapDimensions.width / 2;
    const mapCenterY = mapDimensions.y + mapDimensions.height / 2;
    
    const sortedPoints = [...allPointsData].sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.absX - mapCenterX, 2) + Math.pow(a.absY - mapCenterY, 2));
        const distB = Math.sqrt(Math.pow(b.absX - mapCenterX, 2) + Math.pow(b.absY - mapCenterY, 2));
        return distA - distB;
    });

    for (const point of sortedPoints) {
        const needsBadge = point.estado !== 'existente' || point.detalle_modificacion !== null ||
            (point.counts.verde > 0 || point.counts.ambar > 0 || point.counts.rojo > 0);
        if (!needsBadge) continue;

        // ===== INICIO DE LA CORRECCIÓN: Ajustamos la altura para el nuevo diseño compacto =====
        let badgeHeight = 30; // Altura base más pequeña
        if (point.estado !== 'existente' || point.detalle_modificacion !== null) {
            badgeHeight += 10; // Espacio extra para el texto de estado
        }
        const badgeSize = { width: badgeWidth, height: badgeHeight };
        // ===== FIN DE LA CORRECCIÓN =====
        
        const finalPosition = findNonOverlappingPosition(point, badgeSize, placedObstacles, mapDimensions);
        const badgeRect = { x: finalPosition.x - badgeSize.width / 2, y: finalPosition.y - badgeSize.height / 2, ...badgeSize };

        placedObstacles.push(badgeRect);
        
        labelsToDraw.push({
            pointData: point,
            position: { x: finalPosition.x, y: finalPosition.y },
            size: badgeSize
        });
    }
    return labelsToDraw;
}

function findNonOverlappingPosition(point, badgeSize, obstacles, pageBounds) {
    const isOverlapping = (rect1, rect2) => {
        const margin = 5; // Más margen para que no se peguen
        return !(rect1.x > rect2.x + rect2.width + margin ||
            rect1.x + rect1.width + margin < rect2.x ||
            rect1.y > rect2.y + rect2.height + margin ||
            rect1.y + rect1.height + margin < rect2.y);
    };
    const isWithinBounds = (rect) => (
        rect.x >= pageBounds.x &&
        rect.y >= pageBounds.y &&
        rect.x + rect.width <= pageBounds.x + pageBounds.width &&
        rect.y + rect.height <= pageBounds.y + pageBounds.height
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
        const position = checkPosition({ x: point.absX + offset.x, y: point.absY + offset.y });
        if (position) return position;
    }

    let x = point.absX, y = point.absY, dx = 0, dy = -1, stepSize = 10, stepsInSegment = 1, turnCounter = 0;
    for (let i = 0; i < 1000; i++) {
        for (let j = 0; j < Math.floor(stepsInSegment); j++) {
            x += dx * stepSize;
            y += dy * stepSize;
            const position = checkPosition({ x, y });
            if (position) return position;
        }
        [dx, dy] = [-dy, dx];
        turnCounter++;
        if (turnCounter % 2 === 0) stepsInSegment += 0.5; // Espiral más densa
    }
    return { x: point.absX, y: point.absY - (badgeSize.height / 2 + 10) };
}