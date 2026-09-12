/**
 * ============================================================
 *  SISTEMA DE INVENTARIO — LICEO INTEGRADO SIMÓN BOLÍVAR
 *  Google Apps Script — API Bridge para Google Sheets
 * ============================================================
 *
 *  INSTRUCCIONES DE INSTALACIÓN:
 *  1. Abre la planilla en Google Sheets
 *  2. Menú: Extensiones → Apps Script
 *  3. Borra el código existente y pega TODO este archivo
 *  4. Guarda (Ctrl+S)
 *  5. Clic en "Implementar" → "Nueva implementación"
 *  6. Tipo: Aplicación web
 *     - Ejecutar como: Yo (tu cuenta)
 *     - Quién tiene acceso: Cualquier persona
 *  7. Haz clic en "Implementar" y copia la URL que aparece
 *  8. Pega esa URL en el campo "URL del Script" dentro de
 *     la aplicación de inventario (ícono ☁️ en la barra).
 * ============================================================
 */

// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────
const SHEET_ENLACES = 'ENLACES';
const SHEET_LICEO   = 'LICEO';

const HEADERS_ENLACES = ['ID', 'Cód. Interno', 'Descripción', 'Ubicación', 'Estado', 'Observaciones', 'Actualizado'];
const HEADERS_LICEO   = ['ID', 'Cód. Interno', 'Artículo', 'Material', 'Estado', 'Cantidad', 'Ubicación', 'Observaciones', 'Actualizado'];

// ─────────────────────────────────────────────────────────────
//  CORS HELPER — permite llamadas desde cualquier origen
// ─────────────────────────────────────────────────────────────
function corsResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────────
//  GET — Leer datos
//  Parámetros URL: ?action=read&section=enlaces
//                 ?action=read&section=liceo
//                 ?action=ping  (test de conectividad)
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action  = e.parameter.action  || 'ping';
    const section = e.parameter.section || '';

    if (action === 'ping') {
      return corsResponse({ ok: true, message: 'API Inventario Liceo Simón Bolívar activa ✅' });
    }

    if (action === 'read') {
      const sheetName = section === 'enlaces' ? SHEET_ENLACES : SHEET_LICEO;
      const data = readSheet(sheetName);
      return corsResponse({ ok: true, section, count: data.length, data });
    }

    return corsResponse({ ok: false, error: 'Acción no reconocida' });

  } catch (err) {
    return corsResponse({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
//  POST — Escribir datos
//  Body JSON: { action: 'write', section: 'enlaces', data: [...] }
//             { action: 'write', section: 'liceo',   data: [...] }
// ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { action, section, data } = payload;

    if (action === 'write') {
      const sheetName = section === 'enlaces' ? SHEET_ENLACES : SHEET_LICEO;
      const headers   = section === 'enlaces' ? HEADERS_ENLACES : HEADERS_LICEO;
      writeSheet(sheetName, headers, data, section);
      return corsResponse({ ok: true, section, written: data.length });
    }

    return corsResponse({ ok: false, error: 'Acción no reconocida' });

  } catch (err) {
    return corsResponse({ ok: false, error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────
//  HELPERS DE LECTURA / ESCRITURA
// ─────────────────────────────────────────────────────────────

/**
 * Lee todos los datos de una hoja y los devuelve como array de objetos.
 */
function readSheet(sheetName) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(sheetName);
  
  // Si la hoja no existe, la creamos
  if (!sheet) {
    initSheet(sheetName);
    return [];
  }

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return []; // Solo headers o vacía

  const headers = rows[0].map(h => String(h).trim());
  const result  = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Ignorar filas completamente vacías
    if (row.every(cell => cell === '' || cell === null || cell === undefined)) continue;
    
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? String(row[idx]) : '';
    });
    result.push(normalizeRow(obj, sheetName));
  }
  return result;
}

/**
 * Escribe el array de datos en la hoja (reemplaza contenido, preserva headers).
 */
function writeSheet(sheetName, headers, data, section) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Limpiar contenido (no el formato)
  sheet.clearContents();

  // Escribir headers con formato
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1A4B8C');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontSize(10);

  if (data.length === 0) return;

  // Convertir objetos a filas alineadas con los headers
  const colMap = section === 'enlaces' ? {
    'ID':'id', 'Cód. Interno':'codigo_interno', 'Descripción':'dispositivo', 'Estado':'estado', 'Ubicación':'ubicacion', 'Observaciones':'observaciones', 'Actualizado':'updatedAt'
  } : {
    'ID':'id', 'Cód. Interno':'codigo_interno', 'Artículo':'articulo', 'Material':'material',
    'Estado':'estado', 'Cantidad':'cantidad', 'Ubicación':'ubicacion', 'Observaciones':'observaciones', 'Actualizado':'updatedAt'
  };

  const rows = data.map(item => {
    return headers.map(h => {
      const field = colMap[h];
      return field ? (item[field] || '') : '';
    });
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);

  // Formato de la tabla de datos
  const dataRange = sheet.getRange(2, 1, rows.length, headers.length);
  
  // Franjas alternadas
  for (let r = 0; r < rows.length; r++) {
    const rowRange = sheet.getRange(r + 2, 1, 1, headers.length);
    rowRange.setBackground(r % 2 === 0 ? '#FFFFFF' : '#EEF2F7');
  }

  // Colorear columna Estado
  const estadoColIdx = headers.indexOf('Estado') + 1;
  if (estadoColIdx > 0) {
    for (let r = 0; r < rows.length; r++) {
      const cell  = sheet.getRange(r + 2, estadoColIdx);
      const valor = rows[r][estadoColIdx - 1];
      if (valor === 'Operativo')    { cell.setBackground('#D1FAE5'); cell.setFontColor('#065F46'); }
      else if (valor === 'Dado de Baja')   { cell.setBackground('#FEE2E2'); cell.setFontColor('#991B1B'); }
    }
  }

  // Bordes y autofit
  sheet.getRange(1, 1, rows.length + 1, headers.length)
    .setBorder(true, true, true, true, true, true, '#D1DBE8', SpreadsheetApp.BorderStyle.SOLID);

  headers.forEach((_, i) => sheet.autoResizeColumn(i + 1));

  // Congelar fila de headers
  sheet.setFrozenRows(1);
}

/**
 * Normaliza los campos de una fila leída desde Sheets al formato interno de la app.
 */
function normalizeRow(obj, sheetName) {
  if (sheetName === SHEET_ENLACES) {
    return {
      id:          obj['ID']          || '',
      codigo_interno: obj['Cód. Interno'] || '',
      dispositivo: obj['Descripción'] || '',
      estado:      obj['Estado']      || 'Operativo',
      ubicacion:   obj['Ubicación']   || '',
      observaciones: obj['Observaciones'] || '',
      updatedAt:   obj['Actualizado'] || ''
    };
  } else {
    return {
      id:        obj['ID']         || '',
      codigo_interno: obj['Cód. Interno'] || '',
      articulo:  obj['Artículo']   || '',
      material:  obj['Material']   || '',
      estado:    obj['Estado']     || 'Operativo',
      cantidad:  obj['Cantidad']   || '',
      ubicacion: obj['Ubicación']  || '',
      observaciones: obj['Observaciones'] || '',
      updatedAt: obj['Actualizado']|| ''
    };
  }
}

/**
 * Inicializa una hoja con sus headers si no existe.
 */
function initSheet(sheetName) {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const sheet   = ss.insertSheet(sheetName);
  const headers = sheetName === SHEET_ENLACES ? HEADERS_ENLACES : HEADERS_LICEO;

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1A4B8C');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontSize(10);
  sheet.setFrozenRows(1);
}

/**
 * Función de inicialización manual: crea las hojas ENLACES y LICEO si no existen.
 * Ejecutar manualmente desde el editor de Apps Script.
 */
function inicializarPlanilla() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!ss.getSheetByName(SHEET_ENLACES)) initSheet(SHEET_ENLACES);
  if (!ss.getSheetByName(SHEET_LICEO))   initSheet(SHEET_LICEO);
  
  // Eliminar la hoja por defecto "Hoja 1" si está vacía
  const defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  
  Logger.log('✅ Planilla inicializada correctamente. Se crearon las hojas ENLACES y LICEO.');
}
