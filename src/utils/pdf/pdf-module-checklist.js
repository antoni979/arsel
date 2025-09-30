// src/utils/pdf/pdf-module-checklist.js

import autoTable from 'jspdf-autotable';
import { checklistItems } from '../checklist';
import { FONT_SIZES, DOC_WIDTH, drawHeader } from './pdf-helpers'; // Importamos drawHeader
import { getArselLogoUrl } from './pdf-helpers';
import { supabase } from '../../supabase';

function getHighestSeverity(incidencias) {
    if (incidencias.some(inc => inc.gravedad === 'rojo')) return 'rojo';
    if (incidencias.some(inc => inc.gravedad === 'ambar')) return 'ambar';
    if (incidencias.some(inc => inc.gravedad === 'verde')) return 'verde';
    return null;
}

export async function buildChecklistAnnex(pdf, reportData) {
    const LOCAL_MARGIN = 15;
    const { inspectionData, salasData, puntosMaestrosData, puntosInspeccionadosData, incidenciasData } = reportData;

    if (!incidenciasData || incidenciasData.length === 0) {
        return;
    }

    const [customFieldsRes, arselLogoUrl] = await Promise.all([
        supabase.from('checklist_custom_fields').select('*'),
        getArselLogoUrl()
    ]);
    const customFieldsMap = new Map(customFieldsRes.data.map(f => [f.id, f]));
    const puntosInspeccionadosConIncidenciasIds = new Set(incidenciasData.map(inc => inc.punto_inspeccionado_id));
    const puntosMaestrosConIncidenciasIds = new Set(
        puntosInspeccionadosData
            .filter(pi => puntosInspeccionadosConIncidenciasIds.has(pi.id))
            .map(pi => pi.punto_maestro_id)
    );
    if (puntosMaestrosConIncidenciasIds.size === 0) {
        return;
    }

    pdf.addPage();
    autoTable(pdf, {
        body: [['ANEXO 02:\nCHECKLIST']],
        startY: 145,
        theme: 'plain',
        styles: { 
            fontSize: FONT_SIZES.annexTitle, 
            fontStyle: 'bold', 
            halign: 'center',
            font: 'helvetica',
            textColor: 0
        },
        margin: { left: LOCAL_MARGIN, right: LOCAL_MARGIN }
    });

    for (const sala of salasData) {
        const puntosDeLaSala = puntosMaestrosData
            .filter(pm => pm.sala_id === sala.id && puntosMaestrosConIncidenciasIds.has(pm.id))
            .sort((a,b) => a.nomenclatura.localeCompare(b.nomenclatura, undefined, {numeric: true}));
        
        if (puntosDeLaSala.length === 0) {
            continue;
        }

        for (const puntoMaestro of puntosDeLaSala) {
            pdf.addPage();

            const ANCHO_TOTAL = DOC_WIDTH - (LOCAL_MARGIN * 2);

            autoTable(pdf, {
                body: [['FORMATO DE INSPECCIÓN DEL SISTEMA DE ALMACENAJE']],
                startY: 25,
                theme: 'grid',
                styles: {
                    fontSize: 10,
                    fontStyle: 'bold',
                    halign: 'center',
                    fillColor: [255, 192, 0],
                    textColor: 0,
                    lineColor: 0,
                    lineWidth: 0.1,
                    minCellHeight: 8
                },
                margin: { left: LOCAL_MARGIN, right: LOCAL_MARGIN }
            });

            autoTable(pdf, {
                body: [[
                    `CENTRO: ${inspectionData.centros.nombre.toUpperCase()}`,
                    `Reserva: ${sala.nombre.toUpperCase()}`,
                    `Alineación: ${puntoMaestro.nomenclatura.split('-').pop()}`
                ]],
                startY: pdf.lastAutoTable.finalY,
                theme: 'grid',
                styles: {
                    fontStyle: 'bold',
                    fontSize: 9,
                    textColor: 0,
                    lineColor: 0,
                    lineWidth: 0.1,
                    valign: 'middle',
                    minCellHeight: 8
                },
                columnStyles: {
                    0: { cellWidth: 108, halign: 'left' },
                    1: { cellWidth: 42, halign: 'center' },
                    2: { cellWidth: 30, halign: 'center' }
                },
                margin: { left: LOCAL_MARGIN, right: LOCAL_MARGIN }
            });
            
            const puntoInspeccionado = puntosInspeccionadosData.find(pi => pi.punto_maestro_id === puntoMaestro.id);
            const puntoInspeccionadoId = puntoInspeccionado ? puntoInspeccionado.id : null;
            
            const head = [
                [
                    { content: 'Parámetro de control', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 9 } },
                    { content: 'S', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 8 } },
                    { content: 'I', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fontSize: 8 } },
                    { content: 'RIESGO', colSpan: 3, styles: { halign: 'center', fontSize: 8 } }
                ],
                [{ content: 'V', styles: { fontSize: 8 } }, { content: 'A', styles: { fontSize: 8 } }, { content: 'R', styles: { fontSize: 8 } }]
            ];
            
            const body = checklistItems.map(item => {
                const itemIncidencias = incidenciasData.filter(inc => inc.punto_inspeccionado_id === puntoInspeccionadoId && inc.item_checklist === item.id);
                const tieneIncidencias = itemIncidencias.length > 0;
                const maxSeverity = tieneIncidencias ? getHighestSeverity(itemIncidencias) : null;
                
                return [
                    `${item.id}. ${item.text}`,
                    !tieneIncidencias ? 'X' : '',
                    tieneIncidencias ? 'X' : '',
                    maxSeverity === 'verde' ? 'X' : '',
                    maxSeverity === 'ambar' ? 'X' : '',
                    maxSeverity === 'rojo' ? 'X' : '',
                ];
            });

            autoTable(pdf, {
                head, body, 
                startY: pdf.lastAutoTable.finalY,
                margin: { left: LOCAL_MARGIN, right: LOCAL_MARGIN }, 
                theme: 'grid',
                headStyles: { 
                    fillColor: [220, 220, 220], 
                    textColor: 0, 
                    fontStyle: 'bold', 
                    halign: 'center', 
                    lineColor: 0, 
                    lineWidth: 0.1, 
                    font: 'helvetica' 
                },
                styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak', lineColor: 0, lineWidth: 0.1, font: 'helvetica', textColor: 0 },
                columnStyles: {
                    0: { cellWidth: 136 },
                    1: { cellWidth: 7, halign: 'center' }, 
                    2: { cellWidth: 7, halign: 'center' }, 
                    3: { cellWidth: 10, halign: 'center' }, 
                    4: { cellWidth: 10, halign: 'center' }, 
                    5: { cellWidth: 10, halign: 'center' },
                },
            });

            let finalY = pdf.lastAutoTable.finalY;

            const OBSERVACIONES_THRESHOLD_COUNT = 12;

            const observacionesArray = incidenciasData
                .filter(inc => inc.punto_inspeccionado_id === puntoInspeccionadoId && (inc.observaciones || inc.custom_fields))
                .map((obs) => {
                    let parts = [];
                    if (obs.custom_fields) {
                        const customs = Object.entries(obs.custom_fields).map(([fieldId, value]) => {
                            const field = customFieldsMap.get(parseInt(fieldId));
                            return field && value ? `${field.field_name}: ${value}` : '';
                        }).filter(s => s);
                        parts.push(...customs);
                    }
                    if (obs.observaciones && obs.observaciones.trim()) {
                        parts.push(`Observaciones: ${obs.observaciones.trim()}`);
                    }
                    if (parts.length > 0) {
                        return { text: `Parámetro ${obs.item_checklist}: ${parts.join(' / ')}` };
                    }
                    return null;
                })
                .filter(obs => obs !== null);

            if (observacionesArray.length >= OBSERVACIONES_THRESHOLD_COUNT) {
                const placeholderText = '* Las observaciones detalladas para esta alineación se encuentran en la página siguiente.';
                autoTable(pdf, {
                    body: [[{ content: placeholderText, styles: { fontStyle: 'italic', valign: 'top' } }]],
                    startY: finalY,
                    theme: 'grid',
                    styles: { fontSize: FONT_SIZES.small, lineColor: 0, lineWidth: 0.1, minCellHeight: 20, font: 'helvetica', textColor: 0 },
                    margin: { left: LOCAL_MARGIN, right: LOCAL_MARGIN }
                });
                finalY = pdf.lastAutoTable.finalY;

                pdf.addPage();
                await drawHeader(pdf, inspectionData, arselLogoUrl);

                // ===== CAMBIO REALIZADO: Eliminamos el título y subimos la tabla =====
                autoTable(pdf, {
                    head: [[`Observaciones Detalladas de la Alineación: ${puntoMaestro.nomenclatura}`]],
                    body: observacionesArray.map(obs => [obs.text]),
                    startY: 40, // Subimos la tabla para que empiece justo después del header
                    theme: 'grid',
                    headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
                    styles: { fontSize: FONT_SIZES.small, font: 'helvetica', textColor: 0 },
                    margin: { left: LOCAL_MARGIN, right: LOCAL_MARGIN }
                });

            } else {
                const observacionesDelPunto = observacionesArray.map(obs => obs.text).join('\n');
                autoTable(pdf, {
                    body: [[{ content: `Observaciones:\n${observacionesDelPunto}`, styles: { fontStyle: 'bold', valign: 'top' } }]],
                    startY: finalY,
                    theme: 'grid',
                    styles: { fontSize: FONT_SIZES.small, lineColor: 0, lineWidth: 0.1, minCellHeight: 20, font: 'helvetica', textColor: 0 },
                    margin: { left: LOCAL_MARGIN, right: LOCAL_MARGIN }
                });
                finalY = pdf.lastAutoTable.finalY;
            }

            const fechaInspeccion = new Date(inspectionData.fecha_inspeccion).toLocaleDateString('es-ES');
            autoTable(pdf, {
                body: [[
                    `Fecha revisión: ${fechaInspeccion}\n\nFirma de Arsel Ingenieria S.L.:`,
                    `Firma del PRSES:`
                ]],
                startY: finalY,
                theme: 'grid',
                styles: { fontSize: FONT_SIZES.small, lineColor: 0, lineWidth: 0.1, minCellHeight: 15, valign: 'top', font: 'helvetica', textColor: 0 },
                columnStyles: { 1: { halign: 'left' } },
                margin: { left: LOCAL_MARGIN, right: LOCAL_MARGIN }
            });

            autoTable(pdf, {
                body: [['S: Satisfactorio, I: Insatisfactorio; V: Verde, A: Ámbar, R: Rojo']],
                startY: pdf.lastAutoTable.finalY,
                theme: 'plain',
                styles: { fontSize: 7, halign: 'left', font: 'helvetica', textColor: 0 },
                margin: { left: LOCAL_MARGIN, right: LOCAL_MARGIN }
            });
        }
    }
}