// src/utils/excel/excel-module-gestion.js

import * as XLSX from 'xlsx-js-style';

const getEstadoInfo = (estado) => {
  switch (estado) {
    case 'en_progreso': return { text: 'En Progreso', style: { font: { color: { rgb: "2563EB" } } } }; // Blue
    case 'finalizada': return { text: 'Pend. Envío', style: { font: { color: { rgb: "D97706" } } } }; // Amber
    case 'pendiente_subsanacion': return { text: 'Pend. Cierre', style: { font: { color: { rgb: "F59E0B" } } } }; // Yellow
    case 'cerrada': return { text: 'Cerrada', style: { font: { color: { rgb: "10B981" } } } }; // Green
    default: return { text: 'Sin Inspección', style: { font: { color: { rgb: "6B7280" } } } }; // Gray
  }
};

export async function generateGestionExcel(resumenData) {
  try {
    // --- ESTILOS PROFESIONALES ---
    const headerStyle = { font: { sz: 12, bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" } }, alignment: { vertical: "center", horizontal: "center" } };
    const titleStyle = { font: { sz: 18, bold: true }, alignment: { horizontal: "center" } };
    const baseCellStyle = { font: { sz: 11, name: 'Calibri' }, alignment: { vertical: "center" } };
    const centerAlignStyle = { alignment: { horizontal: "center", vertical: "center" } };
    const bandedRowStyle = { fill: { fgColor: { rgb: "F3F4F6" } } };
    const redTextStyle = { font: { bold: true, color: { rgb: "EF4444" } } };

    // --- PREPARACIÓN DE DATOS ---
    const headers = ["Centro", "Región", "Última Inspección", "Grupo Visita", "Estado Informe", "Cambios Alineaciones", "Faltan Fichas", "Daños (Verdes)", "Daños (Ámbar)", "Daños (Rojos)"];
    
    const dataRows = resumenData.map(item => ([
      item.centro_nombre,
      item.region || '-',
      item.fecha_inspeccion ? new Date(item.fecha_inspeccion + 'T00:00:00') : '-',
      item.grupo_visita || '-',
      getEstadoInfo(item.estado_informe).text,
      item.cambios_en_alineaciones,
      item.faltan_fichas ? 'SI' : 'NO',
      item.danos_verdes,
      item.danos_ambares,
      item.danos_rojos
    ]));
    
    const finalData = [
      ['Informe de Gestión Anual'],
      [`Fecha de Generación: ${new Date().toLocaleDateString('es-ES')}`],
      [],
      headers,
      ...dataRows
    ];

    // --- CREACIÓN Y ESTILIZADO DE LA HOJA ---
    const worksheet = XLSX.utils.aoa_to_sheet(finalData);

    // Unir título
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    worksheet['A1'].s = titleStyle;

    // Aplicar estilos a la cabecera
    for (let C = 0; C < headers.length; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 3, c: C });
      worksheet[cellAddress].s = headerStyle;
    }

    // Aplicar estilos a las filas de datos
    for (let R = 4; R < finalData.length; R++) {
      const item = resumenData[R - 4]; // -4 to align with dataRows index
      const isBanded = (R - 4) % 2 === 1;

      for (let C = 0; C < headers.length; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cellAddress]) continue;

        let cellStyle = { ...baseCellStyle };
        if (isBanded) cellStyle.fill = bandedRowStyle.fill;
        
        // Estilos y formatos específicos
        switch(C) {
          case 2: // Última Inspección (Fecha)
            if (worksheet[cellAddress].v instanceof Date) {
              worksheet[cellAddress].t = 'd';
              worksheet[cellAddress].z = 'dd/mm/yyyy';
            }
            cellStyle.alignment = { ...cellStyle.alignment, ...centerAlignStyle };
            break;
          case 4: // Estado Informe
            cellStyle.font = { ...cellStyle.font, ...getEstadoInfo(item.estado_informe).style.font, bold: true };
            cellStyle.alignment = { ...cellStyle.alignment, ...centerAlignStyle };
            break;
          case 6: // Faltan Fichas
            if (worksheet[cellAddress].v === 'SI') cellStyle.font = { ...cellStyle.font, ...redTextStyle.font };
            cellStyle.alignment = { ...cellStyle.alignment, ...centerAlignStyle };
            break;
          case 7: // Daños Verdes
            if(worksheet[cellAddress].v > 0) cellStyle.fill = { fgColor: { rgb: "E0F2F1" } }; // Light green
            cellStyle.alignment = { ...cellStyle.alignment, ...centerAlignStyle };
            break;
          case 8: // Daños Ámbar
            if(worksheet[cellAddress].v > 0) cellStyle.fill = { fgColor: { rgb: "FFFBEB" } }; // Light amber
            cellStyle.alignment = { ...cellStyle.alignment, ...centerAlignStyle };
            break;
          case 9: // Daños Rojos
            if(worksheet[cellAddress].v > 0) cellStyle.fill = { fgColor: { rgb: "FEF2F2" } }; // Light red
            cellStyle.alignment = { ...cellStyle.alignment, ...centerAlignStyle };
            break;
          case 3: case 5: // Grupo Visita, Cambios Alineaciones
            cellStyle.alignment = { ...cellStyle.alignment, ...centerAlignStyle };
            break;
        }
        worksheet[cellAddress].s = cellStyle;
      }
    }
    
    // Ancho de columnas
    worksheet['!cols'] = [ { wch: 45 }, { wch: 25 }, { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 } ];
    // Auto-filtro
    worksheet['!autofilter'] = { ref: `A4:${XLSX.utils.encode_col(headers.length - 1)}4` };
    // Congelar panel
    worksheet['!view'] = { state: 'frozen', ySplit: 4 };

    // --- DESCARGA ---
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen de Gestión');
    const fileName = `Informe_Gestion_Anual_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);

  } catch (error) {
    console.error("Error generando el archivo XLSX de gestión:", error);
    alert("Hubo un error al generar el archivo Excel. Revisa la consola para más detalles.");
  }
}