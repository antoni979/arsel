// src/utils/pdf/pdf-helpers.js

// --- CONSTANTES ---
export const MARGIN = 25;
export const DOC_WIDTH = 210;
export const DOC_WIDTH_LANDSCAPE = 297;
export const FONT_SIZES = { annexTitle: 22, title: 16, h1: 14, h2: 12, body: 11, small: 8 };
// ===== CAMBIO REALIZADO: Eliminamos la URL de fallback por completo =====
// const FALLBACK_LOGO_URL = "https://ryyqgdodwrjxgnojgrkb.supabase.co/storage/v1/object/public/logos/logo.PNG";

// --- FUNCIÓN PARA OBTENER LOGO DINÁMICO ---
export async function getArselLogoUrl(assetType = 'header_logo') {
  try {
    const { supabase } = await import('../../supabase');
    const { data: assets } = await supabase.from('company_assets').select('*');
    const assetsMap = new Map((assets || []).map(a => [a.asset_type, a.url]));
    // ===== CAMBIO REALIZADO: Si no encuentra el asset, devuelve null =====
    return assetsMap.get(assetType) || null;
  } catch (error) {
    console.error('Error fetching ARSEL logo:', error);
    // ===== CAMBIO REALIZADO: Devuelve null en caso de error =====
    return null;
  }
}

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
      if (!optimize) {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
        return;
      }

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
export async function drawHeader(pdf, inspectionData, arselLogoUrl = null) {
  // ===== CAMBIO REALIZADO: Si arselLogoUrl es null, no se intenta cargar nada =====
  const [clientLogoBase64, arselLogoBase64] = await Promise.all([
    loadImageAsBase64(inspectionData.centros.url_logo_cliente, { optimize: false }),
    arselLogoUrl ? loadImageAsBase64(arselLogoUrl, { optimize: false }) : Promise.resolve(null)
  ]);

  const pageSize = pdf.internal.pageSize;
  const pageWidth = pageSize.getWidth();
  
  const HEADER_MARGIN = 15;
  const headerY = 10;
  const headerHeight = 22;
  const contentWidth = pageWidth - (HEADER_MARGIN * 2); 
  
  const cell1Width = 38;
  const cell3Width = 32;
  const cell2Width = contentWidth - cell1Width - cell3Width;
  const textCenter = HEADER_MARGIN + cell1Width + (cell2Width / 2);

  // Dibujar el contorno y las líneas
  pdf.rect(HEADER_MARGIN, headerY, contentWidth, headerHeight);
  pdf.line(HEADER_MARGIN, headerY + 8, pageWidth - HEADER_MARGIN, headerY + 8);
  pdf.line(HEADER_MARGIN + cell1Width, headerY + 8, HEADER_MARGIN + cell1Width, headerY + headerHeight);
  pdf.line(HEADER_MARGIN + cell1Width + cell2Width, headerY + 8, HEADER_MARGIN + cell1Width + cell2Width, headerY + headerHeight);

  // Título del Centro
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(FONT_SIZES.h2);
  pdf.text(`${inspectionData.centros.nombre.toUpperCase()}`, pageWidth / 2, headerY + 5.5, { align: 'center' });

  const logoY = headerY + 8 + ((headerHeight - 8) - 9) / 2;
  
  // Logo Cliente (Celda 1)
  if (clientLogoBase64) {
    pdf.addImage(clientLogoBase64, 'JPEG', HEADER_MARGIN + 2, logoY, cell1Width - 4, 9, undefined, 'MEDIUM');
  }

  // Subtítulo del Informe (Celda 2)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10); 

  const titleLines = [
    "INFORME VISITA INSPECCIÓN DEL SISTEMA DE",
    "ALMACENAJE PARA CARGAS PALETIZADAS Y MANUALES"
  ];
  
  const cellBottomY = headerY + headerHeight;
  const cellTopY = headerY + 8;
  const cellMiddleY = cellTopY + (cellBottomY - cellTopY) / 2;
  
  const lineSpacing = 4.5; 
  
  const startY = cellMiddleY - (lineSpacing / 2);

  pdf.text(titleLines[0], textCenter, startY, { align: 'center', baseline: 'middle' });
  pdf.text(titleLines[1], textCenter, startY + lineSpacing, { align: 'center', baseline: 'middle' });
  
  // Logo Arsel (Celda 3)
  if (arselLogoBase64) {
    pdf.addImage(arselLogoBase64, 'JPEG', HEADER_MARGIN + cell1Width + cell2Width + 2, logoY, cell3Width - 4, 9, undefined, 'MEDIUM');
  }
}