<?php
/**
 * Buscador Automático de Informes SIMCE
 * Este script lee la carpeta de informes y los clasifica por nombre.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

$folder = 'informes html';
$reports = [];

if (is_dir($folder)) {
    // Escanear la carpeta
    $files = scandir($folder);
    
    foreach ($files as $file) {
        // Solo archivos HTML
        if (pathinfo($file, PATHINFO_EXTENSION) == 'html') {
            
            // Nueva lógica robusta: Buscamos las piezas sin importar el orden
            
            // 1. Extraer el número de ensayo (N1, N 1, N°1, etc.)
            $ensayo = "N/A";
            if (preg_match('/N\s*[°]?\s*(\d+)/iu', $file, $m)) {
                $ensayo = "N" . $m[1];
            }
            
            // 2. Extraer el curso (Número + BASICO/MEDIO + Letra opcional)
            $curso = "Desconocido";
            if (preg_match('/(\d+)[\s\x{00A0}]*(BÁSICO|BASICO|MEDIO)[\s\x{00A0}]*([A-Z])?/iu', $file, $m)) {
                $cursoNum = $m[1];
                $tipo = strtoupper($m[2]);
                $letra = isset($m[3]) ? " " . strtoupper($m[3]) : "";
                $curso = $cursoNum . (strpos($tipo, 'MEDIO') !== false ? "° Medio" : "° Básico") . $letra;
            }
            
            // 3. Extraer Asignatura (Limpieza para uso interno si fuera necesario)
            $cleanName = str_ireplace(['Reporte_ENSAYO', '.html', '_SIMCE'], '', $file);
            $cleanName = preg_replace('/N\s*[°]?\s*\d+/i', '', $cleanName);
            $cleanName = preg_replace('/\d+\s*(BÁSICO|BASICO|MEDIO)\s*[A-Z]?/i', '', $cleanName);
            $asignatura = trim(preg_replace('/\s+/', ' ', $cleanName));
            $asignatura = trim($asignatura, ' -_()');
            $asignatura = mb_convert_case($asignatura, MB_CASE_TITLE, "UTF-8");

            if ($curso !== "Desconocido") {
                $reports[] = [
                    'archivo' => str_replace(' ', '%20', $folder) . '/' . rawurlencode($file),
                    'ensayo' => $ensayo,
                    'asignatura' => $asignatura,
                    'curso' => $curso,
                    'nombre_completo' => str_replace('.html', '', $file) // Nombre sin extensión para mostrar
                ];
            }
        }
    }
}

// Devolver la lista como JSON para que el dashboard la procese
echo json_encode($reports, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>
