// src/utils/pdf/pdf-helpers.js

// --- CONSTANTES ---
export const MARGIN = 15;
export const DOC_WIDTH = 210;
export const DOC_WIDTH_LANDSCAPE = 297;
export const FONT_SIZES = { annexTitle: 22, title: 16, h1: 14, h2: 12, body: 11, small: 8 };
export const ARSEL_LOGO_URL = "https://bgltxcklvjumltuktdvv.supabase.co/storage/v1/object/public/logos-clientes/logo.PNG";

// --- FUNCIÓN DE AYUDA PARA CARGAR IMÁGENES ---
export async function loadImageAsBase64(url) {
  if (!url || !url.startsWith('http')) return null;
  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.startsWith("image/")) {
      console.warn(`La URL no devolvió una imagen: ${url}`);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error cargando imagen para PDF:", url, error);
    return null;
  }
}

// --- CABECERA PRINCIPAL (REUTILIZABLE EN TODO EL PDF) ---
export async function drawHeader(pdf, inspectionData) {
  const [clientLogoBase64, arselLogoBase64] = await Promise.all([
    loadImageAsBase64(inspectionData.centros.url_logo_cliente),
    loadImageAsBase64(ARSEL_LOGO_URL)
  ]);

  // === INICIO DE LA CORRECCIÓN: Usamos el método oficial de jsPDF ===
  const pageSize = pdf.internal.pageSize;
  const pageWidth = pageSize.getWidth();
  // === FIN DE LA CORRECCIÓN ===

  const headerY = MARGIN - 8;
  const headerHeight = 20;
  const contentWidth = pageWidth - (MARGIN * 2); 
  const cell1Width = 40;
  const cell3Width = 40;
  const cell2Width = contentWidth - cell1Width - cell3Width;

  pdf.rect(MARGIN, headerY, contentWidth, headerHeight);
  pdf.line(MARGIN, headerY + 8, pageWidth - MARGIN, headerY + 8);
  pdf.line(MARGIN + cell1Width, headerY + 8, MARGIN + cell1Width, headerY + headerHeight);
  pdf.line(MARGIN + cell1Width + cell2Width, headerY + 8, MARGIN + cell1Width + cell2Width, headerY + headerHeight);

  pdf.setFontSize(FONT_SIZES.h2).setFont(undefined, 'bold');
  pdf.text(`HIPERMERCADO ${inspectionData.centros.nombre.toUpperCase()}`, pageWidth / 2, headerY + 5.5, { align: 'center' });

  if (clientLogoBase64) {
    pdf.addImage(clientLogoBase64, 'PNG', MARGIN + 2, headerY + 9.5, cell1Width - 4, 9, undefined, 'FAST');
  }

  pdf.setFontSize(FONT_SIZES.small).setFont(undefined, 'normal');
  const titleText = 'INFORME VISITA INSPECCIÓN DEL SISTEMA DE ALMACENAJE PARA CARGAS PALETIZADAS Y MANUALES';
  pdf.text(titleText, MARGIN + cell1Width + (cell2Width / 2), headerY + 12.5, {
    maxWidth: cell2Width - 4,
    align: 'center',
    lineHeightFactor: 1.2
  });
  
  if (arselLogoBase64) {
    pdf.addImage(arselLogoBase64, 'PNG', MARGIN + cell1Width + cell2Width + 2, headerY + 9.5, cell3Width - 4, 9, undefined, 'FAST');
  }
} 