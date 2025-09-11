// src/utils/pdf/pdf-module-checklist.js

import autoTable from 'jspdf-autotable';
import { checklistItems } from '../checklist';
import { MARGIN, DOC_WIDTH, FONT_SIZES } from './pdf-helpers';

// Helper para determinar la gravedad máxima de un grupo de incidencias
function getHighestSeverity(incidencias) {
    if (incidencias.some(inc => inc.gravedad === 'rojo')) return 'rojo';
    if (incidencias.some(inc => inc.gravedad === 'ambar')) return 'ambar';
    if (incidencias.some(inc => inc.gravedad === 'verde')) return 'verde';
    return null;
}

export async function buildChecklistAnnex(pdf, reportData) {
    const { inspectionData, salasData, puntosMaestrosData, puntosInspeccionadosData, incidenciasData } = reportData;

    // --- INICIO DEL CAMBIO: Lógica de filtrado principal ---
    // 1. Si no hay ninguna incidencia en todo el informe, no generamos este anexo en absoluto.
    if (!incidenciasData || incidenciasData.length === 0) {
        return;
    }

    // 2. Creamos un conjunto (Set) para buscar eficientemente los IDs de los puntos maestros que SÍ tienen incidencias.
    const puntosInspeccionadosConIncidenciasIds = new Set(incidenciasData.map(inc => inc.punto_inspeccionado_id));
    const puntosMaestrosConIncidenciasIds = new Set(
        puntosInspeccionadosData
            .filter(pi => puntosInspeccionadosConIncidenciasIds.has(pi.id))
            .map(pi => pi.punto_maestro_id)
    );

    // 3. Si, por alguna razón, no encontramos puntos maestros correspondientes, salimos.
    if (puntosMaestrosConIncidenciasIds.size === 0) {
        return;
    }
    // --- FIN DEL CAMBIO ---

    // Solo si hemos pasado los filtros, creamos la página de portada del anexo.
    pdf.addPage();
    autoTable(pdf, {
        body: [['ANEXO 02:\nCHECKLIST']],
        startY: 145,
        theme: 'plain',
        styles: { 
            fontSize: FONT_SIZES.annexTitle, 
            fontStyle: 'bold', 
            halign: 'center' 
        },
        margin: { left: MARGIN, right: MARGIN }
    });

    for (const sala of salasData) {
        // --- INICIO DEL CAMBIO: Filtramos los puntos de la sala para incluir solo los que tienen incidencias ---
        const puntosDeLaSala = puntosMaestrosData
            .filter(pm => pm.sala_id === sala.id && puntosMaestrosConIncidenciasIds.has(pm.id))
            .sort((a,b) => a.nomenclatura.localeCompare(b.nomenclatura, undefined, {numeric: true}));
        
        // Si en esta sala no hay ningún punto con incidencias, la saltamos por completo.
        if (puntosDeLaSala.length === 0) {
            continue;
        }
        // --- FIN DEL CAMBIO ---

        for (const puntoMaestro of puntosDeLaSala) {
            // Ya no necesitamos comprobar si hay incidencias aquí, porque el bucle solo itera sobre puntos que SÍ las tienen.
            pdf.addPage();

            autoTable(pdf, {
                body: [['FORMATO DE INSPECCIÓN DEL SISTEMA DE ALMACENAJE']],
                startY: 25,
                theme: 'plain',
                styles: { fontSize: FONT_SIZES.h2, fontStyle: 'bold', halign: 'center' },
                margin: { left: MARGIN, right: MARGIN }
            });

            autoTable(pdf, {
                body: [[
                    `HIPERMERCADO: ${inspectionData.centros.nombre.toUpperCase()}`,
                    `Reserva: ${sala.nombre.toUpperCase()}`,
                    `Alineación: ${puntoMaestro.nomenclatura.split('-').pop()}`
                ]],
                startY: pdf.lastAutoTable.finalY + 1,
                theme: 'grid',
                styles: { fontSize: FONT_SIZES.body, fontStyle: 'normal', lineColor: 0, lineWidth: 0.1 },
                headStyles: { fillColor: [255, 192, 0] },
                columnStyles: {
                    0: { cellWidth: 100 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 40, halign: 'left' }
                },
                margin: { left: MARGIN, right: MARGIN }
            });

            const puntoInspeccionado = puntosInspeccionadosData.find(pi => pi.punto_maestro_id === puntoMaestro.id);
            const puntoInspeccionadoId = puntoInspeccionado ? puntoInspeccionado.id : null;
            const head = [
                [{ content: 'Parámetro de control', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'S', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'I', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, 
                { content: 'N', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'RIESGO', colSpan: 3, styles: { halign: 'center' } }],
                ['V', 'A', 'R']
            ];
            
            const body = checklistItems.map(item => {
                const itemIncidencias = incidenciasData.filter(inc => inc.punto_inspeccionado_id === puntoInspeccionadoId && inc.item_checklist === item.id);
                const tieneIncidencias = itemIncidencias.length > 0;
                const maxSeverity = tieneIncidencias ? getHighestSeverity(itemIncidencias) : null;
                
                return [
                    `${item.id}. ${item.text}`,
                    !tieneIncidencias ? 'X' : '',
                    tieneIncidencias ? 'X' : '',
                    '', // N/A
                    maxSeverity === 'verde' ? 'X' : '',
                    maxSeverity === 'ambar' ? 'X' : '',
                    maxSeverity === 'rojo' ? 'X' : '',
                ];
            });

            autoTable(pdf, {
                head, body, 
                startY: pdf.lastAutoTable.finalY, 
                margin: { left: MARGIN, right: MARGIN }, 
                theme: 'grid',
                headStyles: { fillColor: [255, 192, 0], textColor: 0, fontStyle: 'bold', halign: 'center', fontSize: 7, lineColor: 0, lineWidth: 0.1 },
                styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', lineColor: 0, lineWidth: 0.1 },
                columnStyles: {
                    0: { cellWidth: 129 }, 1: { cellWidth: 7, halign: 'center' }, 2: { cellWidth: 7, halign: 'center' }, 3: { cellWidth: 7, halign: 'center' },
                    4: { cellWidth: 10, halign: 'center' }, 5: { cellWidth: 10, halign: 'center' }, 6: { cellWidth: 10, halign: 'center' },
                },
            });

            let finalY = pdf.lastAutoTable.finalY;

            const observacionesDelPunto = incidenciasData
                .filter(inc => inc.punto_inspeccionado_id === puntoInspeccionadoId && inc.observaciones && inc.observaciones.trim() !== '')
                .map((obs) => {
                    const itemIncidencias = incidenciasData.filter(i => i.punto_inspeccionado_id === puntoInspeccionadoId && i.item_checklist === obs.item_checklist);
                    const obsIndex = itemIncidencias.findIndex(i => i.id === obs.id);
                    const numTotal = itemIncidencias.length;
                    const countStr = numTotal > 1 ? ` (${obsIndex + 1}/${numTotal})` : '';

                    return `Parámetro ${obs.item_checklist}${countStr}: ${obs.observaciones}`;
                })
                .join('\n');
            
            autoTable(pdf, {
                body: [[{ content: `Observaciones:\n${observacionesDelPunto}`, styles: { fontStyle: 'bold', valign: 'top' } }]],
                startY: finalY,
                theme: 'grid',
                styles: { fontSize: FONT_SIZES.small, lineColor: 0, lineWidth: 0.1, minCellHeight: 20 },
                margin: { left: MARGIN, right: MARGIN }
            });

            const fechaInspeccion = new Date(inspectionData.fecha_inspeccion).toLocaleDateString('es-ES');
            autoTable(pdf, {
                body: [[
                    `Fecha revisión: ${fechaInspeccion}\n\nFirma de Arsel Ingenieria S.L.:`,
                    `Firma del PRSES:`
                ]],
                startY: pdf.lastAutoTable.finalY,
                theme: 'grid',
                styles: { fontSize: FONT_SIZES.small, lineColor: 0, lineWidth: 0.1, minCellHeight: 15, valign: 'top' },
                columnStyles: { 1: { halign: 'left' } },
                margin: { left: MARGIN, right: MARGIN }
            });

            autoTable(pdf, {
                body: [['S: Satisfactorio, I: Insatisfactorio, N: No aplica; V: Verde, A: Ámbar, R: Rojo']],
                startY: pdf.lastAutoTable.finalY,
                theme: 'plain',
                styles: { fontSize: 7, halign: 'left' },
                margin: { left: MARGIN, right: MARGIN }
            });
        }
    }
}