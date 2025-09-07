// src/utils/pdf/pdf-module-checklist.js

import autoTable from 'jspdf-autotable';
import { checklistItems } from '../checklist';
import { MARGIN, DOC_WIDTH, FONT_SIZES } from './pdf-helpers';

export async function buildChecklistAnnex(pdf, reportData) {
    const { inspectionData, salasData, puntosMaestrosData, puntosInspeccionadosData, incidenciasData } = reportData;
    if (salasData.length === 0) return;

    pdf.addPage();
    // === CAMBIO: ESTILO DE LA PORTADA DEL ANEXO CHECKLIST ===
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
    // === FIN DEL CAMBIO ===

    for (const sala of salasData) {
        const puntosDeLaSala = puntosMaestrosData
            .filter(pm => pm.sala_id === sala.id)
            .sort((a,b) => a.nomenclatura.localeCompare(b.nomenclatura, undefined, {numeric: true}));
        if (puntosDeLaSala.length === 0) continue;

        for (const puntoMaestro of puntosDeLaSala) {
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
                const incidencia = incidenciasData.find(inc => inc.punto_inspeccionado_id === puntoInspeccionadoId && inc.item_checklist === item.id);
                return [
                    `${item.id}. ${item.text}`,
                    !incidencia ? 'X' : '',
                    incidencia ? 'X' : '',
                    '', // N/A
                    incidencia?.gravedad === 'verde' ? 'X' : '',
                    incidencia?.gravedad === 'ambar' ? 'X' : '',
                    incidencia?.gravedad === 'rojo' ? 'X' : '',
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
                .map(obs => `Parámetro de control ${obs.item_checklist}: / ${obs.observaciones}`)
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