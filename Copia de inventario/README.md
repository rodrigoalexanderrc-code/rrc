# 📦 Sistema de Gestión de Inventario
## Liceo Integrado Simón Bolívar

---

## 🚀 Cómo usar

1. **Abrir la aplicación**: Haz doble clic en `index.html` o arrástralo a cualquier navegador moderno (Chrome, Edge, Firefox).
2. **Iniciar sesión** con las credenciales por defecto:
   - **Usuario:** `admin`
   - **Contraseña:** `simbol2025`
3. Cambia la contraseña desde el ícono 🔑 en la barra superior.

> ⚠️ La sesión se cierra automáticamente al cerrar el navegador (usa sessionStorage).  
> Los datos del inventario se guardan en `localStorage` y persisten entre sesiones en el mismo navegador/PC.

---

## 📋 Secciones del sistema

| Sección | Descripción |
|---|---|
| **ENLACES** | Equipamiento informático: PCs, Monitores, Routers, Impresoras, etc. |
| **LICEO** | Mobiliario general: Sillas, Mesas, Estantes, etc. |

---

## 📥 Importación de Excel

El sistema acepta archivos `.xlsx`, `.xls` o `.csv`.

### Formato de las pestañas:

**Pestaña `ENLACES`** — columnas obligatorias:

| ID | Dispositivo | Marca | Modelo | Serie | Estado | Ubicación | IP/MAC |
|---|---|---|---|---|---|---|---|
| PC-001 | PC | HP | ProDesk 400 | SN123 | Operativo | Sala de Computación | 192.168.1.10 |

**Pestaña `LICEO`** — columnas obligatorias:

| ID | Artículo | Material | Estado | Cantidad | Ubicación |
|---|---|---|---|---|---|
| S-001 | Silla | Madera | Operativo | 30 | Aula 1 |

### Valores válidos para Estado:
- `Operativo`
- `En Reparación`
- `Baja`

> 💡 El sistema detecta automáticamente si hay pestañas `ENLACES` y/o `LICEO` en el archivo. Si el archivo tiene solo una hoja, intentará detectar el tipo por las columnas presentes.

---

## 📤 Exportación

- Haz clic en **"Exportar"** para descargar a Excel los datos **filtrados actualmente**.
- El archivo se descarga con el nombre `Inventario_SECCIÓN_FECHA.xlsx`.

---

## 🔐 Seguridad

- Las contraseñas se almacenan como hash **SHA-256** en `localStorage`.
- Las sesiones usan `sessionStorage` (se cierran al cerrar el navegador).
- No hay transmisión de datos a ningún servidor externo.

---

## 💻 Requisitos técnicos

- Navegador moderno con soporte para ES2020+ (Chrome 80+, Edge 80+, Firefox 75+)
- No requiere instalación ni conexión a internet (carga SheetJS desde CDN; si no hay internet, descargar la librería localmente)
- Compatible con Windows, macOS y Linux

---

## 📁 Estructura del proyecto

```
inventario-liceo/
├── index.html    ← Aplicación principal (todo en un archivo)
└── README.md     ← Este archivo
```

---

## 🛠️ Personalización

Para agregar más ubicaciones o tipos de dispositivo, edita las constantes al inicio del `<script>` en `index.html`:
- `DISPOSITIVOS` — tipos de equipos ENLACES
- `MATERIALES` — materiales para LICEO
- `UBICACIONES_ENLACES` — salas para equipos
- `UBICACIONES_LICEO` — salas para mobiliario

---

*Desarrollado para el Liceo Integrado Simón Bolívar — Sistema autocontenido, sin dependencias de servidor.*
