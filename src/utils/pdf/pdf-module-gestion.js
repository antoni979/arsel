// src/utils/pdf/pdf-module-gestion.js

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper para obtener el texto del estado
const getEstadoText = (estado) => {
  switch (estado) {
    case 'en_progreso': return 'En Progreso';
    case 'finalizada': return 'Pend. Envío';
    case 'pendiente_subsanacion': return 'Pend. Cierre';
    case 'cerrada': return 'Cerrada';
    default: return 'Sin Inspección';
  }
};

export async function generateGestionReport(resumenData) {
  // ===== PRUEBA IRREFUTABLE: Si ves este mensaje, estás ejecutando el código nuevo =====
  console.log('✅ ✅ ✅ Ejecutando generateGestionReport v2 (SIN LOGO) ✅ ✅ ✅');
  
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const PAGE_WIDTH = pdf.internal.pageSize.getWidth();
    const MARGIN = 15;

    // --- CABECERA DEL DOCUMENTO (SIN LOGO) ---
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('Informe Resumen Anual de Inspecciones', PAGE_WIDTH / 2, 17, { align: 'center' });
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Fecha de generación: ${new Date().toLocaleDateString('es-ES')}`, PAGE_WIDTH - MARGIN, 25, { align: 'right' });


    // --- TABLA DE DATOS ---
    const head = [
        [
            { content: 'Centro', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'Región', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'Última Inspección', rowSpan: 2, styles: { valign: 'middle' } },
            { content: 'Grupo Visita', rowSpan: 2, styles: { valign: 'middle' } },
            { content: 'Estado Informe', rowSpan: 2, styles: { valign: 'middle' } },
            { content: 'Cambios Alineaciones', rowSpan: 2, styles: { valign: 'middle' } },
            { content: 'Faltan Fichas', rowSpan: 2, styles: { valign: 'middle' } },
            { content: 'Daños', colSpan: 3, styles: { halign: 'center' } },
        ],
        [
            { content: 'V' },
            { content: 'A' },
            { content: 'R' }
        ]
    ];

    const body = resumenData.map(item => [
      item.centro_nombre,
      item.region || '-',
      item.fecha_inspeccion ? new Date(item.fecha_inspeccion + 'T00:00:00').toLocaleDateString('es-ES') : '-',
      item.grupo_visita || '-',
      getEstadoText(item.estado_informe),
      item.cambios_en_alineaciones,
      item.faltan_fichas ? 'SI' : 'NO',
      item.danos_verdes,
      item.danos_ambares,
      item.danos_rojos
    ]);

    autoTable(pdf, {
      head: head,
      body: body,
      startY: 35,
      theme: 'grid',
      margin: { left: MARGIN, right: MARGIN },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        valign: 'middle',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [75, 85, 99],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 8,
        cellWidth: 'wrap'
      },
      alternateRowStyles: {
        fillColor: [243, 244, 246]
      },
      columnStyles: {
        0: { cellWidth: 45, halign: 'left' },
        1: { cellWidth: 28, halign: 'left' },
        2: { cellWidth: 17, halign: 'center' },
        3: { cellWidth: 15, halign: 'center' },
        4: { cellWidth: 17, halign: 'center' },
        5: { cellWidth: 17, halign: 'center' },
        6: { cellWidth: 15, halign: 'center' },
        7: { cellWidth: 9, halign: 'center' },
        8: { cellWidth: 9, halign: 'center' },
        9: { cellWidth: 9, halign: 'center' },
      },
      didParseCell: function (data) {
        if (data.row.section === 'head' && data.row.index === 1) {
          if (data.column.index === 0) data.cell.styles.fillColor = [34, 197, 94];
          if (data.column.index === 1) data.cell.styles.fillColor = [245, 158, 11];
          if (data.column.index === 2) data.cell.styles.fillColor = [239, 68, 68];
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = 'bold';
        }

        if (data.row.section === 'body') {
          if (data.column.index === 6 && data.cell.raw === 'SI') {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 7 && data.cell.raw > 0) data.cell.styles.fillColor = '#e0f2e9';
          if (data.column.index === 8 && data.cell.raw > 0) data.cell.styles.fillColor = '#fff4e0';
          if (data.column.index === 9 && data.cell.raw > 0) data.cell.styles.fillColor = '#ffe0e0';
        }
      },
      didDrawPage: function (data) {
        const pageCount = pdf.internal.getNumberOfPages();
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          PAGE_WIDTH / 2,
          pdf.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
    });

    const fileName = `Informe_Gestion_Anual_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(fileName);

  } catch (error) {
    console.error("Error generando el PDF de gestión:", error);
    alert("Hubo un error al generar el PDF. Revisa la consola para más detalles.");
  }
}