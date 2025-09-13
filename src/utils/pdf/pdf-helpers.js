// src/utils/pdf/pdf-helpers.js

// --- CONSTANTES ---
export const MARGIN = 15;
export const DOC_WIDTH = 210;
export const DOC_WIDTH_LANDSCAPE = 297;
export const FONT_SIZES = { annexTitle: 22, title: 16, h1: 14, h2: 12, body: 11, small: 8 };
export const ARSEL_LOGO_URL = "https://bgltxcklvjumltuktdvv.supabase.co/storage/v1/object/public/logos-clientes/logo.PNG";

// --- FUNCIÓN DE AYUDA PARA CARGAR IMÁGENES (CON CONTROL DE OPTIMIZACIÓN) ---
export async function loadImageAsBase64(url, options = {}) {
  // Opciones por defecto: optimizar siempre con un máximo de 1024px
  const { optimize = true, maxWidth = 1024, maxHeight = 1024 } = options;

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
      // --- INICIO DEL CAMBIO: Si no se debe optimizar, devolvemos el original ---
      if (!optimize) {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
        return;
      }
      // --- FIN DEL CAMBIO ---

      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
      
      img.onload = () => {
        let { width, height } = img;
        
        if (width <= maxWidth && height <= maxHeight) {
            const reader = new FileReader();
            reader.onloadend = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(reader.result);
            };
            reader.onerror = (err) => {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            };
            reader.readAsDataURL(blob);
            return;
        }

        const ratio = Math.min(maxWidth / width, maxHeight / height);
        const newWidth = Math.floor(width * ratio);
        const newHeight = Math.floor(height * ratio);
        
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.80);
        
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
    });

  } catch (error) {
    console.error("Error cargando y optimizando imagen para PDF:", url, error);
    return null;
  }
}

// --- CABECERA PRINCIPAL (REUTILIZABLE EN TODO EL PDF) ---
export async function drawHeader(pdf, inspectionData) {
  const [clientLogoBase64, arselLogoBase64] = await Promise.all([
    // Los logos siempre los optimizamos a un tamaño pequeño
    loadImageAsBase64(inspectionData.centros.url_logo_cliente, { maxWidth: 300, maxHeight: 300 }),
    loadImageAsBase64(ARSEL_LOGO_URL, { maxWidth: 300, maxHeight: 300 })
  ]);

  // (El resto de la función drawHeader no cambia)
  const pageSize = pdf.internal.pageSize;
  const pageWidth = pageSize.getWidth();

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

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(FONT_SIZES.h2);
  pdf.text(`HIPERMERCADO ${inspectionData.centros.nombre.toUpperCase()}`, pageWidth / 2, headerY + 5.5, { align: 'center' });

  if (clientLogoBase64) {
    pdf.addImage(clientLogoBase64, 'JPEG', MARGIN + 2, headerY + 9.5, cell1Width - 4, 9, undefined, 'MEDIUM');
  }

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(FONT_SIZES.small);
  const titleText = 'INFORME VISITA INSPECCIÓN DEL SISTEMA DE ALMACENAJE PARA CARGAS PALETIZADAS Y MANUALES';
  pdf.text(titleText, MARGIN + cell1Width + (cell2Width / 2), headerY + 12.5, {
    maxWidth: cell2Width - 4,
    align: 'center',
    lineHeightFactor: 1.2
  });
  
  if (arselLogoBase64) {
    pdf.addImage(arselLogoBase64, 'JPEG', MARGIN + cell1Width + cell2Width + 2, headerY + 9.5, cell3Width - 4, 9, undefined, 'MEDIUM');
  }
}