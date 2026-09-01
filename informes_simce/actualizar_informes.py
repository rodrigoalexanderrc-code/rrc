import os
import json
import re
import urllib.parse

# Configuración
# Ruta relativa a la carpeta donde están los informes
FOLDER_PATH = "informes html"
OUTPUT_FILE = "datos_informes.js"

def parse_filename(filename):
    """
    Extrae Curso, Asignatura y N° de Ensayo del nombre del archivo.
    Usa una lógica robusta similar a la de obtener_informes.php
    """
    # 1. Extraer el número de ensayo (N1, N 1, N°1, etc.)
    ensayo = "N/A"
    m_ensayo = re.search(r'N\s*[°]?\s*(\d+)', filename, re.IGNORECASE)
    if m_ensayo:
        ensayo = f"N{m_ensayo.group(1)}"
        
    # 2. Extraer el curso
    curso = "Desconocido"
    # \xa0 es el non-breaking space
    m_curso = re.search(r'(\d+)[\s\xa0]*(B[AÁ]SICO|MEDIO)[\s\xa0]*([A-Z])?', filename, re.IGNORECASE)
    if m_curso:
        curso_num = m_curso.group(1)
        tipo = m_curso.group(2).upper().replace("BÁSICO", "BASICO")
        letra = f" {m_curso.group(3).upper()}" if m_curso.group(3) else ""
        
        tipo_str = "° Medio" if "MEDIO" in tipo else "° Básico"
        curso = f"{curso_num} {tipo_str}{letra}"
        
    # 3. Extraer Asignatura limpiando el resto del nombre
    clean_name = re.sub(r'(?i)Reporte_ENSAYO|\.html|_SIMCE', '', filename)
    clean_name = re.sub(r'(?i)Informe_', '', clean_name) # Dejar IDPS
    clean_name = re.sub(r'(?i)N\s*[°]?\s*\d+', '', clean_name)
    clean_name = re.sub(r'(?i)\d+[\s\xa0]*(B[AÁ]SICO|MEDIO)[\s\xa0]*[A-Z]?', '', clean_name)
    clean_name = re.sub(r'\s+', ' ', clean_name).strip(' -_()')
    
    # Capitalizar como título (Title Case)
    asignatura = clean_name.title() if clean_name else "General"

    if curso != "Desconocido":
        encoded_folder = urllib.parse.quote(FOLDER_PATH)
        encoded_filename = urllib.parse.quote(filename)
        return {
            "archivo": f"{encoded_folder}/{encoded_filename}",
            "ensayo": ensayo,
            "asignatura": asignatura,
            "curso": curso,
            "nombre_completo": filename.replace(".html", "")
        }
    return None

def main():
    print("--- Iniciando Indexación de Informes ---")
    reports = []
    
    if not os.path.exists(FOLDER_PATH):
        print(f"Error: No se encuentra la carpeta '{FOLDER_PATH}'")
        return

    archivos = [f for f in os.listdir(FOLDER_PATH) if f.endswith(".html")]
    print(f"Buscando en: {os.path.abspath(FOLDER_PATH)}")
    print(f"Archivos encontrados: {len(archivos)}")

    for filename in archivos:
        data = parse_filename(filename)
        if data:
            reports.append(data)
            print(f"[OK] Clasificado: {data['curso']} - {data['asignatura']}")
        else:
            print(f"[!] No se pudo clasificar: {filename}")

    # Generar el archivo JavaScript
    # Usamos una variable global para que el dashboard pueda leerla fácilmente
    js_content = f"// Archivo generado automáticamente - No editar manualmente\n"
    js_content += f"const REPORTS_DATA = {json.dumps(reports, indent=4, ensure_ascii=False)};"
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    print("-" * 40)
    print(f"Éxito: Se generó '{OUTPUT_FILE}' con {len(reports)} informes.")
    print("--- Proceso Finalizado ---")

if __name__ == "__main__":
    main()
