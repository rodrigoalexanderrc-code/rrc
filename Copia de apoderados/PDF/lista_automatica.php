<?php
// Script para listar PDFs con detección automática de mes y título limpio
header('Content-Type: text/plain');
header('Access-Control-Allow-Origin: *');

$files = glob("./*.{pdf,jpg,jpeg,png,gif,webp}", GLOB_BRACE);
$meses_validos = ['marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'admision'];
$months_map = [
    'marzo' => 3, 'abril' => 4, 'mayo' => 5, 'junio' => 6, 
    'julio' => 7, 'agosto' => 8, 'septiembre' => 9, 
    'octubre' => 10, 'noviembre' => 11, 'diciembre' => 12
];

echo "mes,titulo,fecha,link,timestamp\n";

// 1. Procesar PDFs
foreach($files as $file) {
    $name = basename($file);
    $name_lower = strtolower($name);
    $mes_detectado = 'marzo'; // Mes por defecto

    // Detectar el mes buscando en el nombre del archivo
    foreach($meses_validos as $mes) {
        if (strpos($name_lower, $mes) !== false) {
            $mes_detectado = $mes;
            break;
        }
    }

    // Crear un título limpio (quitando el nombre del mes del título)
    // Crear un título limpio (quitando la extensión)
    $ext_pos = strrpos($name, '.');
    $clean_title = $ext_pos !== false ? substr($name, 0, $ext_pos) : $name;
    $clean_title = str_replace(['_', '-'], ' ', $clean_title); // Quito rayas

    // Quitamos la palabra del mes del título para que no se repita
    $clean_title = str_ireplace($mes_detectado, '', $clean_title);
    $clean_title = trim(ucwords($clean_title));

    // Si el título quedó vacío (porque el archivo se llamaba solo "Abril.pdf")
    if (empty($clean_title)) {
        $clean_title = "Documento " . ucfirst($mes_detectado);
    }

    $mtime = filemtime($file);
    $date = date("d/m/Y", $mtime);

    echo "$mes_detectado,$clean_title,$date,$name,$mtime\n";
}

// 2. Leer videos manuales desde videos.txt si existe
$videos_file = "./videos.txt";
if (file_exists($videos_file)) {
    $videos_lines = file($videos_file);
    foreach($videos_lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) continue;
        
        $cols = explode(',', $line);
        if (count($cols) >= 4) {
            $mes = trim($cols[0]);
            $titulo = trim($cols[1]);
            $date_str = trim($cols[2]);
            $link = trim($cols[3]);
            
            $timestamp = 0;
            if (!empty($date_str)) {
                $timestamp = strtotime(str_replace('/', '-', $date_str));
            }
            if (!$timestamp) {
                $timestamp = filemtime($videos_file);
            }
            
            echo "$mes,$titulo,$date_str,$link,$timestamp\n";
        }
    }
}

// 3. Leer reuniones desde reuniones.txt si existe
$reuniones_file = "./reuniones.txt";
if (file_exists($reuniones_file)) {
    $reuniones_lines = file($reuniones_file);
    foreach($reuniones_lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) continue;
        
        $cols = explode(',', $line);
        if (count($cols) >= 6) {
            $mes = trim($cols[0]);
            $curso = trim($cols[1]);
            $dia_num = trim($cols[2]);
            $dia_nombre = trim($cols[3]);
            $hora = trim($cols[4]);
            $lugar = trim($cols[5]);
            
            $month_num = isset($months_map[$mes]) ? $months_map[$mes] : 3;
            $timestamp = strtotime("2026-$month_num-$dia_num");
            if (!$timestamp) {
                $timestamp = filemtime($reuniones_file);
            }
            
            // Enviamos el formato: mes, título (curso), fecha (día num), link (datos embebidos), timestamp
            echo "$mes,$curso,$dia_num,MEETING|$dia_nombre|$hora|$lugar,$timestamp\n";
        }
    }
}

// 4. Leer talleres desde talleres.txt si existe
$talleres_file = "./talleres.txt";
if (file_exists($talleres_file)) {
    $talleres_lines = file($talleres_file);
    foreach($talleres_lines as $line) {
        $line = trim($line);
        if (empty($line) || strpos($line, '#') === 0) continue;
        
        $cols = explode(',', $line);
        if (count($cols) >= 5) {
            $mes = trim($cols[0]);
            $taller = trim($cols[1]);
            $profesor = trim($cols[2]);
            $horario = trim($cols[3]);
            $lugar = trim($cols[4]);
            
            $month_num = isset($months_map[$mes]) ? $months_map[$mes] : 3;
            $timestamp = strtotime("2026-$month_num-01");
            if (!$timestamp) {
                $timestamp = filemtime($talleres_file);
            }
            
            // Enviamos el formato: mes, título (taller), fecha (profesor), link (datos embebidos ACLE), timestamp
            echo "$mes,$taller,$profesor,ACLE|$horario|$lugar,$timestamp\n";
        }
    }
}
?>
