// --- Configuración de la Plataforma ---

const CONFIG = {
    // 1. Configuración de Marca
    SCHOOL_NAME: 'Liceo Libertador Simón Bolívar',
    LOGO_URL: 'insignia/insignia.jpg',
    BOT_NAME: 'Simona',
    BOT_AVATAR: 'simona_final.png',

    // 2. Base de Conocimientos de Simona (Preguntas Frecuentes)
    // Puedes agregar palabras clave y la respuesta que Simona debe dar.
    FAQ: [

        {
            keywords: ['hola', 'quien eres'],
            response: '¡Hola! Soy Simona, tu asistente felina. 🐾 ¿En qué puedo ayudarte hoy?'
        },
        {
            keywords: ['horario', 'atención'],
            response: 'El horario de atención es de 08:00 a 17:00 hrs de lunes a jueves y viernes de 8:00 a 13:00 hrs. 🕒'
        },
        {
            keywords: ['contacto', 'teléfono', 'mail', 'correo', 'llamar'],
            response: 'Puedes escribirnos a simon.bolivar@cormun.cl o llamarnos al teléfono 72 222 3067.'
        },
        {
            keywords: ['ubicación', 'llegar', 'dirección'],
            response: 'Nos encontramos en el corazón de Rancagua, específicamente en Avenida Baquedano Nº 390.'
        },
        {
            keywords: ['uniforme', 'delantal', 'ropa'],
            response: 'El uso del uniforme es obligatorio. Para educación física se debe usar el buzo del liceo. 👕'
        }
    ],

    // 3. Configuración para cargar FAQ desde Google Sheets (Opcional)
    // Para usar: Crea una planilla con dos columnas (Palabras Clave | Respuesta)
    // Publica como CSV y pega el link abajo.
    SHEET_FAQ_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSlbGpy8vx353WOj98VkH90BjtqU3F-cI1pTpo6g_98AbGrIpMhUj5uqiNFfWjt2ID3CEbtDIS-USBF/pub?output=csv',
    USE_SHEET_FAQ: true,

    // 4. Link de la Hoja de Cálculo de Google (Publicada como CSV)
    // Para obtener este link: Archivo -> Compartir -> Publicar en la web -> Valores separados por comas (.csv)
    SHEET_URL: 'https://www.liceo-simonbolivar.cl/intranet/informaciones/PDF/lista_automatica.php',

    // 5. Carpeta base para documentos PDF
    // Si tus PDFs están en una carpeta específica, agrégala aquí para no tener que escribir todo el link en la planilla.
    BASE_PDF_URL: 'https://www.liceo-simonbolivar.cl/intranet/informaciones/PDF/',

    // 6. Usar Google Sheets (true) o usar datos locales (false)
    USE_SHEET: true, // ¡Activado! Ahora lee los datos desde el link de arriba.

    // 7. Configuración de Admisión (SAE, Ubicación y Redes)
    SAE_PORTAL_URL: 'https://www.sistemadeadmisionescolar.cl',
    ANOTATE_URL: 'https://registropublicodigital.mineduc.gob.cl/rpd-app-registro-apoderado/login',
    MAPS_URL: 'https://www.google.com/maps/place/liceo+Libertador+Simon+Bol%C3%ADvar/@-34.16759,-70.75909,441m/data=!3m1!1e3!4m6!3m5!1s0x9663431ea84f9973:0x854deb0a84f406b8!8m2!3d-34.16759!4d-70.7590901!16s%2Fg%2F1hjh2s456?hl=es-419&entry=ttu',
    WAZE_URL: 'https://waze.com/ul?ll=-34.16759,-70.7590901&navigate=yes',
    FACEBOOK_URL: 'https://www.facebook.com/share/15RiRDhFXK/?mibextid=wwXIfr',
    INSTAGRAM_URL: 'https://www.instagram.com/liceosimonbolivar_oficial',
    SAE_TIMELINE: [
        { month: 8, label: 'Postulaciones', icon: 'fa-edit', desc: 'Agosto' },
        { month: 10, label: 'Resultados', icon: 'fa-search', desc: 'Octubre' },
        { month: 12, label: 'Matrículas', icon: 'fa-check-circle', desc: 'Diciembre' }
    ]
};
