// src/utils/pdf/pdf-module-checklist.js

import autoTable from 'jspdf-autotable';
import { checklistItems } from '../checklist';
import { FONT_SIZES, DOC_WIDTH, drawHeader, loadImageAsBase64 } from './pdf-helpers'; // Importamos loadImageAsBase64
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

            const [clientLogoBase64, arselLogoBase64] = await Promise.all([
                loadImageAsBase64(inspectionData.centros.url_logo_cliente, { optimize: false }),
                loadImageAsBase64(arselLogoUrl, { optimize: false })
            ]);

            const logoHeight = 10;
            const headerY = 12;
            const arselLogoWidth = 30;

            if (clientLogoBase64) {
                pdf.addImage(clientLogoBase64, 'JPEG', LOCAL_MARGIN, headerY, 0, logoHeight);
            }
            if (arselLogoBase64) {
                pdf.addImage(arselLogoBase64, 'JPEG', DOC_WIDTH - LOCAL_MARGIN - arselLogoWidth, headerY, arselLogoWidth, logoHeight);
            }
            
            const firstTableStartY = headerY + logoHeight + 3;

            autoTable(pdf, {
                body: [['FORMATO DE INSPECCIÓN DEL SISTEMA DE ALMACENAJE']],
                startY: firstTableStartY,
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
                // --- INICIO DE LA CORRECCIÓN 2: Reducir el espaciado de las celdas ---
                styles: { fontSize: 8, cellPadding: 1.0, overflow: 'linebreak', lineColor: 0, lineWidth: 0.1, font: 'helvetica', textColor: 0 }, // cellPadding reducido de 1.5 a 1.0
                // --- FIN DE LA CORRECCIÓN 2 ---
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

            // --- INICIO DE LA CORRECCIÓN 1: Bajar el límite de observaciones ---
            const OBSERVACIONES_THRESHOLD_COUNT = 10; // Reducido de 12 a 10
            // --- FIN DE LA CORRECCIÓN 1 ---

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

                autoTable(pdf, {
                    head: [[`Observaciones Detalladas de la Alineación: ${puntoMaestro.nomenclatura}`]],
                    body: observacionesArray.map(obs => [obs.text]),
                    startY: 40,
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