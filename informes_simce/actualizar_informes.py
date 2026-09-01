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
    Ejemplo esperado: Reporte_ENSAYO SIMCE N1 MATEMATICAS 6 BASICO A.html
    """
    # Patrón: Reporte_ENSAYO SIMCE (N1) (ASIGNATURA) (CURSO) (LETRA Opcional)
    pattern = r"Reporte_ENSAYO SIMCE (N\d+)\s+(.*?)\s+(\d+\sB[AÁ]SICO|\d+\sMEDIO)(?:[\s\xa0]*([A-Z]))?"
    match = re.search(pattern, filename, re.IGNORECASE)
    
    if match:
        ensayo_id = match.group(1) # Ej: N1
        asignatura = match.group(2).strip() # Ej: MATEMATICAS
        curso_raw = match.group(3).strip().upper() # Ej: 6 BASICO o 6 BÁSICO
        letra_curso = match.group(4) # Ej: A
        
        # Normalizar tildes para uniformidad
        curso_raw = curso_raw.replace("BÁSICO", "BASICO")
        
        if letra_curso:
            curso_raw = f"{curso_raw} {letra_curso.strip()}"
        
        # Formatear el curso para que se vea bien en la web
        curso_pretty = curso_raw
        if "BASICO" in curso_pretty:
            curso_pretty = curso_pretty.replace("BASICO", "° Básico")
        elif "MEDIO" in curso_pretty:
            curso_pretty = curso_pretty.replace("MEDIO", "° Medio")
            
        # Limpiar asignatura (Capitalizar primera letra)
        asignatura_pretty = asignatura.capitalize()

        # Codificar URL para que funcione en el navegador (espacios -> %20, etc)
        encoded_folder = urllib.parse.quote(FOLDER_PATH)
        encoded_filename = urllib.parse.quote(filename)

        return {
            "archivo": f"{encoded_folder}/{encoded_filename}",
            "ensayo": ensayo_id,
            "asignatura": asignatura_pretty,
            "curso": curso_pretty,
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
