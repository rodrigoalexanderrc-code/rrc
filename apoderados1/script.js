// --- Notificación tipo toast ---
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast-notification toast-' + type;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i> ${message}`;
    document.body.appendChild(toast);
    
    // Mostrar con animación
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// --- Función global para forzar descarga en móviles ---
function forceDownload(url, title) {
    const filename = url.split('/').pop() || (title + '.pdf');
    
    fetch(url)
        .then(response => response.blob())
        .then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
            showToast('✅ Archivo descargado correctamente', 'success');
        })
        .catch(() => {
            window.open(url, '_blank');
            showToast('El archivo se abrió en una nueva pestaña', 'info');
        });
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- State ---
    let documents = [];
    let remoteFAQ = [];
    let lastDocError = null;
    let lastFAQError = null;
    let currentMonth = null;
    let chatContext = { lastMonth: null, lastTopic: null };
    let conversationHistory = []; // Historial de temas consultados
    
    const SYNONYMS = {
        'uniforme': ['vestimenta', 'ropa', 'buzo', 'delantal', 'chaleco', 'pantalones'],
        'horarios': ['atencion', 'hora', 'abierto', 'cerrado', 'cuando'],
        'contacto': ['telefono', 'mail', 'correo', 'llamar', 'comunicarse'],
        'ubicacion': ['donde', 'llegar', 'direccion', 'mapa', 'calle'],
        'documentos': ['circular', 'comunicado', 'archivo', 'pdf', 'papel']
    };

    const EMERGENCY_WORDS = ['emergencia', 'urgente', 'urgencia', 'accidente', 'reclamo', 'denuncia', 'grave', 'peligro', 'ayuda urgente'];

    // Diccionario de conceptos conocidos para fuzzy search
    const KNOWN_CONCEPTS = ['horario', 'uniforme', 'contacto', 'ubicacion', 'direccion', 'telefono', 'correo', 'documentos', 'circular', 'comunicado', 'reglamento', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    // Función de distancia de Levenshtein para fuzzy search
    function levenshtein(a, b) {
        const m = a.length, n = b.length;
        const dp = Array.from({length: m + 1}, () => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                dp[i][j] = Math.min(
                    dp[i-1][j] + 1,
                    dp[i][j-1] + 1,
                    dp[i-1][j-1] + (a[i-1] !== b[j-1] ? 1 : 0)
                );
            }
        }
        return dp[m][n];
    }

    function findFuzzyMatches(word) {
        const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cleanWord = removeAccents(word.toLowerCase());
        if (cleanWord.length < 4) return [];
        return KNOWN_CONCEPTS.filter(concept => {
            const distance = levenshtein(cleanWord, concept);
            return distance > 0 && distance <= 2 && distance < concept.length * 0.4;
        });
    }

    // --- DOM Elements ---
    const navItems = document.querySelectorAll('.nav-item');
    const documentGrid = document.getElementById('document-grid');
    const monthTitle = document.getElementById('month-title');
    const sectionTitle = document.getElementById('section-title');
    const sectionDescription = document.getElementById('section-description');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    const monthsMap = {
        'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7, 
        'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };

    function getDocSortValue(doc) {
        if (!doc || !doc.date) return 0;
        const dateStr = doc.date;
        const year = 2026; // Año escolar por defecto

        // 1. Detectar DD/MM/AAAA
        const dmy = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dmy) return new Date(dmy[3], dmy[2] - 1, dmy[1]).getTime();

        // 2. Detectar DD/MM
        const dm = dateStr.match(/(\d{1,2})\/(\d{1,2})/);
        if (dm) return new Date(year, dm[2] - 1, dm[1]).getTime();

        // 3. Detectar número solo (como "10" o "Lunes 15")
        const dayMatch = dateStr.match(/(\d{1,2})/);
        if (dayMatch) {
            const dayNum = parseInt(dayMatch[1]);
            const monthIdx = monthsMap[doc.month] || 0;
            return new Date(year, monthIdx, dayNum).getTime();
        }

        return 0; // Fallback
    }

    function compareDocs(a, b) {
        // 1. Prioridad principal: Mes del documento (descendente, ej: Diciembre antes que Noviembre)
        const monthA = monthsMap[a.month] || 0;
        const monthB = monthsMap[b.month] || 0;
        if (monthA !== monthB) {
            return monthB - monthA;
        }

        // 2. Prioridad secundaria (dentro del mismo mes): Fecha real de subida al servidor (timestamp)
        if (a.timestamp && b.timestamp && a.timestamp !== b.timestamp) {
            return b.timestamp - a.timestamp; // El archivo más recientemente subido va primero
        }

        // 3. Prioridad terciaria: Fecha visible del documento (por si empatan en timestamp o no lo tienen)
        const valA = getDocSortValue(a);
        const valB = getDocSortValue(b);
        if (valA !== valB) {
            return valB - valA; 
        }
        
        // 4. Desempate final: Orden en que se leyeron del CSV
        return b.originalIndex - a.originalIndex;
    }

    // --- initialization ---
    function initBrand() {
        document.querySelectorAll('.js-school-logo').forEach(img => img.src = CONFIG.LOGO_URL);
        document.querySelectorAll('.js-school-name').forEach(el => el.textContent = CONFIG.SCHOOL_NAME);
        document.querySelectorAll('.js-bot-name').forEach(el => el.textContent = CONFIG.BOT_NAME);
        document.querySelectorAll('.js-bot-avatar').forEach(img => img.src = CONFIG.BOT_AVATAR);
        
        if (CONFIG.SCHOOL_NAME) {
            document.title = `Información para Apoderados - ${CONFIG.SCHOOL_NAME}`;
        }

        // --- Navegación al tocar el escudo/logo ---
        document.querySelectorAll('.js-school-logo').forEach(logo => {
            logo.addEventListener('click', (e) => {
                e.preventDefault();
                // Resetear estado de navegación
                navItems.forEach(i => i.classList.remove('active'));
                
                // Cerrar acordeones abiertos
                document.querySelectorAll('.nav-accordion-trigger').forEach(t => t.classList.remove('open'));
                document.querySelectorAll('.nav-group-content').forEach(c => c.classList.remove('open'));
                
                // Volver a inicio
                showWelcome();
                
                // Cerrar sidebar en móviles
                if (window.innerWidth <= 1024) {
                    sidebar.classList.remove('open');
                }
                
                // Scrollear al top suavemente
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        updateGreeting();
    }
    initBrand();

    // --- KPI Cards click handler (Quick navigation to categories) ---
    function initKpiCards() {
        const kpiCards = document.querySelectorAll('.kpi-card');
        kpiCards.forEach(card => {
            card.addEventListener('click', () => {
                const type = card.getAttribute('data-type');
                let triggerId = '';
                if (type === 'pdf') triggerId = 'accordion-trigger';
                else if (type === 'video') triggerId = 'video-accordion-trigger';
                else if (type === 'meeting') triggerId = 'meeting-accordion-trigger';
                else if (type === 'acle') triggerId = 'acle-accordion-trigger';
                
                const trigger = document.getElementById(triggerId);
                if (trigger) {
                    // Click accordion to expand it if not already open
                    if (!trigger.classList.contains('open')) {
                        trigger.click();
                    }
                    
                    // Determinar el mes actual según el calendario
                    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                    const currentMonthName = monthNames[new Date().getMonth()];

                    let targetItem;
                    const accordionSelector = type === 'pdf' ? '#months-accordion' : 
                                              type === 'video' ? '#video-accordion' : 
                                              type === 'meeting' ? '#meeting-accordion' : 
                                              '#acle-accordion';
                                              
                    // Buscar el botón del mes actual
                    targetItem = document.querySelector(`${accordionSelector} .nav-item[data-month="${currentMonthName}"]`);
                    
                    // Fallback al primer elemento si por alguna razón no se encuentra (ej: enero/febrero en vacaciones)
                    if (!targetItem) {
                        targetItem = document.querySelector(`${accordionSelector} .nav-item`);
                    }
                    
                    if (targetItem) {
                        targetItem.click();
                    }
                }
            });
        });
    }
    initKpiCards();
    
    // --- Video Logic ---
    function getYoutubeId(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    function getInstagramId(url) {
        if (!url) return null;
        // Soporta links de posts /p/, reels /reels/ y reel /reel/
        const regExp = /(?:instagram\.com\/(?:p|reels|reel)\/)([\w-]+)/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    }
    
    // --- Greeting Logic ---
    function updateGreeting() {
        const hour = new Date().getHours();
        let greeting = '¡Hola!';
        
        if (hour >= 6 && hour < 12) greeting = '¡Buenos días!';
        else if (hour >= 12 && hour < 19) greeting = '¡Buenas tardes!';
        else greeting = '¡Buenas noches!'; // Cubre el resto (19 a 5:59)
        
        const greetingEls = document.querySelectorAll('.js-greeting');
        greetingEls.forEach(el => {
            el.textContent = greeting;
        });
    }

    // --- Search Logic ---
    const globalSearch = document.getElementById('global-search');
    if (globalSearch) {
        let searchTimeout;
        globalSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const term = e.target.value.trim().toLowerCase();
                if (term.length > 2) {
                    performSearch(term);
                } else if (term.length === 0) {
                    showWelcome();
                }
            }, 300); // 300ms delay para estabilizar procesamiento
        });
    }

    function performSearch(term) {
        // Ocultar Dashboard y mostrar Sección Mensual/Búsqueda
        const dashboardView = document.getElementById('dashboard-view');
        const monthlySection = document.getElementById('monthly-section');
        if (dashboardView) dashboardView.style.display = 'none';
        if (monthlySection) monthlySection.style.display = 'block';

        const results = documents.filter(doc => 
            doc.title.toLowerCase().includes(term) || 
            doc.month.toLowerCase().includes(term)
        );

        sectionTitle.style.color = 'var(--primary-electric)';
        sectionTitle.innerHTML = `Resultados para: <span style="font-weight: 800; color: var(--primary-electric)">"${term}"</span>`;
        const banner = document.querySelector('.section-banner');
        if (banner) banner.style.borderLeftColor = 'var(--primary-electric)';
        // Clasificación para resumen de búsqueda
        const circs = results.filter(d => {
            const yt = getYoutubeId(d.link), ig = getInstagramId(d.link);
            return !d.link.startsWith('MEETING|') && !d.link.startsWith('ACLE|') && yt === null && ig === null;
        });
        const vids = results.filter(d => {
            const yt = getYoutubeId(d.link), ig = getInstagramId(d.link);
            return (yt !== null || ig !== null) && !d.link.startsWith('MEETING|') && !d.link.startsWith('ACLE|');
        });
        const meets = results.filter(d => d.link.startsWith('MEETING|'));
        const acls = results.filter(d => d.link.startsWith('ACLE|'));

        let sParts = [];
        if (circs.length > 0) sParts.push(`${circs.length} circular${circs.length > 1 ? 'es' : ''}`);
        if (vids.length > 0)  sParts.push(`${vids.length} video${vids.length > 1 ? 's' : ''}`);
        if (meets.length > 0) sParts.push(`${meets.length} reunión${meets.length > 1 ? 'es' : ''}`);
        if (acls.length > 0)  sParts.push(`${acls.length} taller${acls.length > 1 ? 'es' : ''} ACLE`);
        
        sectionDescription.textContent = sParts.length > 0 ? `Se encontraron: ${sParts.join(', ')}.` : 'No se encontraron resultados.';
        monthTitle.textContent = 'Búsqueda';

        renderSearchResults(results.sort(compareDocs));
    }

    function renderSearchResults(data) {
        documentGrid.innerHTML = '';
        if (data.length === 0) {
            documentGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem;">
                    <i class="fas fa-search-minus" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
                    <p>No encontramos nada que coincida con tu búsqueda.</p>
                </div>
            `;
            return;
        }

        data.forEach((doc, index) => {
            const isMeeting = doc.link.startsWith('MEETING|');
            const isAcle = doc.link.startsWith('ACLE|');
            const youtubeId = getYoutubeId(doc.link);
            const instagramId = getInstagramId(doc.link);
            const isVideo = (youtubeId !== null || instagramId !== null) && !isMeeting && !isAcle;
            
            const card = document.createElement('div');
            card.className = `doc-card fade-in ${isVideo ? 'video-card' : ''} ${isMeeting ? 'meeting-card' : ''} ${isAcle ? 'acle-card' : ''}`;
            card.style.animationDelay = `${index * 0.05}s`;
            
            if (isAcle) {
                const parts = doc.link.split('|');
                const horario = parts[1] || '';
                const lugar = parts[2] || '';

                card.innerHTML = `
                    <div class="acle-badge">ACLE</div>
                    <div class="acle-info-header">
                        <div class="acle-icon-circle"><i class="fas fa-running"></i></div>
                        <div>
                            <h3>${doc.title}</h3>
                            <span class="acle-instructor">${doc.date} (${doc.month})</span>
                        </div>
                    </div>
                    <div class="acle-details-grid">
                        <div class="acle-detail-item"><i class="far fa-clock"></i> <span>${horario}</span></div>
                        <div class="acle-detail-item"><i class="fas fa-map-marker-alt"></i> <span>${lugar}</span></div>
                    </div>
                    <div class="doc-actions search-actions" style="margin-top: 1rem;">
                        <button class="btn-search-nav" onclick="document.querySelector('[data-month=\\'${doc.month}\\'][data-type=\\'acle\\']').click()">
                            Ver en mes <i class="fas fa-external-link-alt" style="font-size: 0.7rem; margin-left: 5px;"></i>
                        </button>
                    </div>
                `;
            } else if (isMeeting) {
                const parts = doc.link.split('|');
                const diaNombre = parts[1] || '';
                const hora = parts[2] || '';
                const lugar = parts[3] || '';

                card.innerHTML = `
                    <div class="meeting-calendar-icon">
                        <span class="meeting-day-name">${diaNombre}</span>
                        <span class="meeting-day-num">${doc.date}</span>
                    </div>
                    <div class="meeting-details">
                        <h3>${doc.title}</h3>
                        <div class="meeting-info-row"><i class="far fa-clock"></i> <span>${hora}</span></div>
                        <div class="meeting-info-row"><i class="fas fa-map-marker-alt"></i> <span>${lugar}</span></div>
                        <div class="meeting-search-nav">
                             <button class="btn-search-nav-text" onclick="document.querySelector('[data-month=\\'${doc.month}\\'][data-type=\\'meeting\\']').click()">
                                Ver en mes <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                `;
            } else if (isVideo) {
                const platform = instagramId ? 'instagram' : 'youtube';
                const videoId = instagramId || youtubeId;
                const iconClass = platform === 'instagram' ? 'fab fa-instagram' : 'fab fa-youtube';

                card.innerHTML = `
                    <div class="doc-info" style="text-align: center;">
                        <div style="font-size: 0.7rem; font-weight: 800; color: #888; text-transform: uppercase;">${doc.month}</div>
                        <div class="video-icon-preview"><i class="${iconClass}"></i></div>
                        <h3>${doc.title}</h3>
                        <p class="doc-date"><i class="far fa-calendar-alt"></i> ${doc.date}</p>
                    </div>
                    <div class="doc-actions">
                        <button class="btn-view" onclick="window.openVideoModal('${videoId}', '${doc.title.replace(/'/g, "\\'")}', '${doc.date}', '${platform}')">
                            <i class="fas fa-play"></i> Reproducir
                        </button>
                    </div>
                `;
            } else {
                card.classList.add('pdf-card');
                card.innerHTML = `
                    <div class="pdf-details">
                        <div style="font-size: 0.7rem; font-weight: 800; color: var(--primary-electric); text-transform: uppercase; margin-bottom: 5px;">Circular - ${doc.month}</div>
                        <h3>${doc.title}</h3>
                        <p class="doc-date"><i class="far fa-calendar-alt"></i> ${doc.date}</p>
                        <div class="pdf-actions">
                            <a href="${doc.link}" target="_blank" class="btn-view">Ver Circular</a>
                        </div>
                    </div>
                `;
            }
            documentGrid.appendChild(card);
        });
    }

    // --- Recent Updates Sidebar ---
    function renderRecentUpdates() {
        const recentList = document.getElementById('recent-list');
        if (!recentList || documents.length === 0) return;

        // Tomar los últimos 3 (asumiendo que los más nuevos vienen al final o por lógica de mes)
        // Por ahora tomamos los últimos 3 del array
        const latest = [...documents].slice(-3).reverse();
        
        recentList.innerHTML = '';
        latest.forEach(doc => {
            const youtubeId = getYoutubeId(doc.link);
            const instagramId = getInstagramId(doc.link);
            const isVideo = (youtubeId !== null || instagramId !== null);
            const isMeeting = doc.link.startsWith('MEETING|');
            const isAcle = doc.link.startsWith('ACLE|');
            
            let icon = 'fa-file-pdf';
            if (isVideo) icon = 'fa-video';
            else if (isMeeting) icon = 'fa-calendar-alt';
            else if (isAcle) icon = 'fa-running';

            const item = document.createElement('a');
            item.href = '#';
            item.className = 'recent-item';
            item.onclick = (e) => {
                e.preventDefault();
                const youtubeId = getYoutubeId(doc.link);
                const instagramId = getInstagramId(doc.link);
                const isVideo = (youtubeId !== null || instagramId !== null);
                const type = isVideo ? 'video' : isMeeting ? 'meeting' : isAcle ? 'acle' : 'pdf';
                const trigger = document.querySelector(`[data-month='${doc.month}'][data-type='${type}']`);
                if (trigger) trigger.click();
            };

            item.innerHTML = `
                <div class="recent-icon"><i class="fas ${icon}"></i></div>
                <div class="recent-info">
                    <span class="recent-name">${doc.title}</span>
                    <span class="recent-meta">${doc.month.toUpperCase()}</span>
                </div>
            `;
            recentList.appendChild(item);
        });
    }

    const videoModal = document.getElementById('video-modal');
    const closeVideoBtn = document.getElementById('close-video-modal');
    const youtubePlayer = document.getElementById('youtube-player');
    const modalTitle = document.getElementById('modal-video-title');
    const modalDate = document.getElementById('modal-video-date');

    function openVideoModal(id, title, date, platform = 'youtube') {
        const videoWrapper = document.querySelector('.video-wrapper');
        const modalContent = document.querySelector('.modal-content');
        let embedUrl = '';
        
        if (platform === 'instagram') {
            // /embed/captioned/ muestra la publicación completa: foto/video + descripción + likes
            embedUrl = `https://www.instagram.com/p/${id}/embed/captioned/`;
            videoWrapper.classList.add('instagram-ratio');
            modalContent.classList.add('instagram-modal');
            // Ocultar info del modal ya que Instagram lo muestra dentro del embed
            modalTitle.style.display = 'none';
            modalDate.style.display = 'none';
        } else {
            embedUrl = `https://www.youtube.com/embed/${id}?autoplay=1`;
            videoWrapper.classList.remove('instagram-ratio');
            modalContent.classList.remove('instagram-modal');
            modalTitle.style.display = '';
            modalDate.style.display = '';
        }
        
        youtubePlayer.src = embedUrl;
        modalTitle.textContent = title;
        modalDate.textContent = date ? `Publicado el: ${date}` : '';
        videoModal.style.display = 'flex';
        setTimeout(() => videoModal.classList.add('active'), 10);
        document.body.style.overflow = 'hidden';
    }

    function closeVideoModal() {
        videoModal.classList.remove('active');
        setTimeout(() => {
            videoModal.style.display = 'none';
            youtubePlayer.src = ''; // Detener video
            // Limpiar clases de Instagram
            document.querySelector('.video-wrapper')?.classList.remove('instagram-ratio');
            document.querySelector('.modal-content')?.classList.remove('instagram-modal');
            modalTitle.style.display = '';
            modalDate.style.display = '';
        }, 300);
        document.body.style.overflow = '';
    }

    if (closeVideoBtn) closeVideoBtn.onclick = closeVideoModal;
    if (videoModal) {
        videoModal.querySelector('.modal-overlay').onclick = closeVideoModal;
    }

    // --- Photo Modal Logic ---
    const photoModal = document.getElementById('photo-modal');
    const closePhotoBtn = document.getElementById('close-photo-modal');
    const modalPhotoImg = document.getElementById('modal-photo-img');
    const modalPhotoTitle = document.getElementById('modal-photo-title');
    const modalPhotoDate = document.getElementById('modal-photo-date');

    window.openPhotoModal = function(url, title, date) {
        modalPhotoImg.src = url;
        modalPhotoTitle.textContent = title;
        modalPhotoDate.textContent = date ? `Publicado el: ${date}` : '';
        photoModal.style.display = 'flex';
        setTimeout(() => photoModal.classList.add('active'), 10);
        document.body.style.overflow = 'hidden';
    };

    function closePhotoModal() {
        photoModal.classList.remove('active');
        setTimeout(() => {
            photoModal.style.display = 'none';
            modalPhotoImg.src = '';
        }, 300);
        document.body.style.overflow = '';
    }

    if (closePhotoBtn) closePhotoBtn.onclick = closePhotoModal;
    if (photoModal) {
        photoModal.querySelector('.modal-overlay').onclick = closePhotoModal;
    }

    // --- Accordion Logic ---
    const accordionTriggers = document.querySelectorAll('.nav-accordion-trigger');

    accordionTriggers.forEach(trigger => {
        trigger.addEventListener('click', () => {
            let accordionId;
            if (trigger.id.includes('video')) accordionId = 'video-accordion';
            else if (trigger.id.includes('meeting')) accordionId = 'meeting-accordion';
            else if (trigger.id.includes('acle')) accordionId = 'acle-accordion';
            else accordionId = 'months-accordion';
            
            const accordionContent = document.getElementById(accordionId);
            const isOpen = trigger.classList.contains('open');
            
            // --- Auto-close others (Para mejorar usabilidad en móviles) ---
            if (!isOpen) {
                accordionTriggers.forEach(t => {
                    if (t !== trigger) {
                        t.classList.remove('open');
                        const otherContentId = t.id.includes('video') ? 'video-accordion' : 
                                               t.id.includes('meeting') ? 'meeting-accordion' :
                                               t.id.includes('acle') ? 'acle-accordion' : 'months-accordion';
                        document.getElementById(otherContentId).classList.remove('open');
                    }
                });
            }

            if (isOpen) {
                trigger.classList.remove('open');
                accordionContent.classList.remove('open');
            } else {
                trigger.classList.add('open');
                accordionContent.classList.add('open');
            }
        });
    });

    // --- Functions ---
    function parseCSVRow(str) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            if (char === '"' && str[i+1] === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    function parseCSV(csvText) {
        const lines = csvText.split('\n');
        const results = [];
        const startIdx = lines[0].toLowerCase().includes('mes') ? 1 : 0;
        
        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = parseCSVRow(line);
            
            if (cols.length >= 4) {
                let link = cols[3].trim();
                // Si el link no empieza con http, MEETING o ACLE, le agregamos la base automáticamente
                if (link && !link.startsWith('http') && !link.startsWith('MEETING') && !link.startsWith('ACLE')) {
                    link = CONFIG.BASE_PDF_URL + link;
                }

                const timestamp = cols[4] ? parseInt(cols[4].trim(), 10) : 0;

                results.push({
                    month: cols[0].trim().toLowerCase(),
                    title: cols[1].trim(),
                    date: cols[2].trim(),
                    link: link,
                    timestamp: timestamp,
                    originalIndex: i // Guardar posición original como desempate
                });
            }
        }
        return results;
    }

    function parseFAQCSV(csvText) {
        const lines = csvText.split('\n');
        const results = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.toLowerCase().includes('palabra')) continue;

            // Usar nuestra función estandarizada que soporta comas dentro de comillas
            let cols = parseCSVRow(line);
            
            // Backup provisional si usan un formato local separado por ;
            if (cols.length < 2 && line.includes(';')) {
                cols = line.split(';').map(c => c.trim().replace(/^"|"$/g, ''));
            }
            
            let rawKeywords = [];
            let response = "";

            if (cols.length >= 2) {
                // El primer campo suele ser la lista de palabras clave (puede contener ;)
                rawKeywords = cols[0].split(';');
                // El último campo suele ser la respuesta
                response = cols[cols.length - 1];
            }
            
            const cleanKeywords = rawKeywords
                .map(k => k.trim().toLowerCase())
                .filter(k => k.length > 0);

            if (cleanKeywords.length > 0 && response) {
                results.push({
                    keywords: cleanKeywords,
                    response: response
                });
            }
        }
        return results;
    }

    function showWelcome() {
        const dashboardView = document.getElementById('dashboard-view');
        const monthlySection = document.getElementById('monthly-section');
        const monthTitle = document.getElementById('month-title');
        
        if (monthTitle) monthTitle.textContent = 'Bienvenido';
        
        // Alternar vistas
        if (dashboardView) dashboardView.style.display = 'flex';
        if (monthlySection) monthlySection.style.display = 'none';

        // Asegurar que el botón Inicio esté activo
        navItems.forEach(i => {
            if (i.id === 'btn-inicio') {
                i.classList.add('active');
            } else {
                i.classList.remove('active');
            }
        });

        // Cerrar acordeones abiertos
        document.querySelectorAll('.nav-accordion-trigger').forEach(t => t.classList.remove('open'));
        document.querySelectorAll('.nav-group-content').forEach(c => c.classList.remove('open'));

        // Saludo dinámico y fecha en el Hero
        updateGreeting();
        const heroGreeting = document.getElementById('hero-greeting');
        if (heroGreeting) {
            const hour = new Date().getHours();
            let greetingText = '¡Hola';
            if (hour >= 6 && hour < 12) greetingText = '¡Buenos días';
            else if (hour >= 12 && hour < 19) greetingText = '¡Buenas tardes';
            else greetingText = '¡Buenas noches';
            heroGreeting.textContent = `${greetingText}, estimado Apoderado!`;
        }
        
        const heroDate = document.getElementById('hero-current-date');
        if (heroDate) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const todayStr = new Date().toLocaleDateString('es-ES', options);
            heroDate.textContent = todayStr.charAt(0).toUpperCase() + todayStr.slice(1);
        }

        // Calcular contadores para las KPI Cards
        let pdfCount = 0;
        let videoCount = 0;
        let meetingCount = 0;
        let acleCount = 0;

        if (documents && documents.length > 0) {
            documents.forEach(doc => {
                const isMeeting = doc.link.startsWith('MEETING|');
                const isAcle = doc.link.startsWith('ACLE|');
                const youtubeId = getYoutubeId(doc.link);
                const instagramId = getInstagramId(doc.link);
                const isVideo = (youtubeId !== null || instagramId !== null) && !isMeeting && !isAcle;

                if (isMeeting) meetingCount++;
                else if (isAcle) acleCount++;
                else if (isVideo) videoCount++;
                else pdfCount++;
            });
        }

        // Actualizar contadores en la UI
        const pdfCountEl = document.getElementById('kpi-pdf-count');
        const videoCountEl = document.getElementById('kpi-video-count');
        const meetingCountEl = document.getElementById('kpi-meeting-count');
        const acleCountEl = document.getElementById('kpi-acle-count');

        if (pdfCountEl) pdfCountEl.textContent = pdfCount;
        if (videoCountEl) videoCountEl.textContent = videoCount;
        if (meetingCountEl) meetingCountEl.textContent = meetingCount;
        if (acleCountEl) acleCountEl.textContent = acleCount;

        // Renderizar las 6 últimas publicaciones
        const latestGrid = document.getElementById('latest-updates-grid');
        if (!latestGrid) return;

        if (!documents || documents.length === 0) {
            latestGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-light);">
                    <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                    <p>No hay información cargada actualmente.</p>
                </div>
            `;
            return;
        }

        // Filtrar solo circulares y obtener las últimas 6 ordenadas por fecha
        const circulares = documents.filter(doc => {
            const isMeeting = doc.link.startsWith('MEETING|');
            const isAcle = doc.link.startsWith('ACLE|');
            const youtubeId = getYoutubeId(doc.link);
            const instagramId = getInstagramId(doc.link);
            const isVideo = (youtubeId !== null || instagramId !== null) && !isMeeting && !isAcle;
            return !isMeeting && !isAcle && !isVideo;
        });
        const latestDocs = circulares.sort(compareDocs).slice(0, 6);
        latestGrid.innerHTML = '';

        latestDocs.forEach((doc, index) => {
            const isMeeting = doc.link.startsWith('MEETING|');
            const isAcle = doc.link.startsWith('ACLE|');
            const youtubeId = getYoutubeId(doc.link);
            const instagramId = getInstagramId(doc.link);
            const isVideo = (youtubeId !== null || instagramId !== null) && !isMeeting && !isAcle;
            
            const card = document.createElement('div');
            card.className = `doc-card fade-in ${isVideo ? 'video-card' : ''} ${isMeeting ? 'meeting-card' : ''} ${isAcle ? 'acle-card' : ''}`;
            card.style.animationDelay = `${index * 0.08}s`;

            if (isAcle) {
                const parts = doc.link.split('|');
                const horario = parts[1] || '';
                const lugar = parts[2] || '';

                card.innerHTML = `
                    <div class="acle-badge">ACLE</div>
                    <div class="acle-info-header">
                        <div class="acle-icon-circle"><i class="fas fa-running"></i></div>
                        <div>
                            <h3>${doc.title}</h3>
                            <span class="acle-instructor">${doc.date} (${doc.month})</span>
                        </div>
                    </div>
                    <div class="acle-details-grid">
                        <div class="acle-detail-item"><i class="far fa-clock"></i> <span>${horario}</span></div>
                        <div class="acle-detail-item"><i class="fas fa-map-marker-alt"></i> <span>${lugar}</span></div>
                    </div>
                `;
            } else if (isMeeting) {
                const parts = doc.link.split('|');
                const diaNombre = parts[1] || '';
                const hora = parts[2] || '';
                const lugar = parts[3] || '';

                card.innerHTML = `
                    <div class="meeting-calendar-icon">
                        <span class="meeting-day-name">${diaNombre}</span>
                        <span class="meeting-day-num">${doc.date}</span>
                    </div>
                    <div class="meeting-details">
                        <h3>${doc.title}</h3>
                        <div class="meeting-info-row"><i class="far fa-clock"></i> <span>${hora}</span></div>
                        <div class="meeting-info-row"><i class="fas fa-map-marker-alt"></i> <span>${lugar}</span></div>
                        <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 5px; font-weight: 500;">Mes: ${doc.month}</div>
                    </div>
                `;
            } else if (isVideo) {
                const platform = instagramId ? 'instagram' : 'youtube';
                const videoId = instagramId || youtubeId;
                const iconClass = platform === 'instagram' ? 'fab fa-instagram' : 'fab fa-youtube';

                card.innerHTML = `
                    <div class="doc-info" style="text-align: center;">
                        <div style="font-size: 0.7rem; font-weight: 800; color: #888; text-transform: uppercase;">${doc.month}</div>
                        <div class="video-icon-preview"><i class="${iconClass}"></i></div>
                        <h3>${doc.title}</h3>
                        <p class="doc-date"><i class="far fa-calendar-alt"></i> ${doc.date}</p>
                    </div>
                    <div class="doc-actions">
                        <button class="btn-view" onclick="window.openVideoModal('${videoId}', '${doc.title.replace(/'/g, "\\'")}', '${doc.date}', '${platform}')">
                            <i class="fas fa-play"></i> Reproducir
                        </button>
                    </div>
                `;
            } else {
                card.classList.add('pdf-card');
                card.innerHTML = `
                    <div class="pdf-details">
                        <div style="font-size: 0.7rem; font-weight: 800; color: var(--primary-electric); text-transform: uppercase; margin-bottom: 5px;">Circular - ${doc.month}</div>
                        <h3>${doc.title}</h3>
                        <p class="doc-date"><i class="far fa-calendar-alt"></i> ${doc.date}</p>
                        <div class="pdf-actions">
                            <a href="${doc.link}" target="_blank" class="btn-view">Ver Circular</a>
                            <button class="btn-download-sm" onclick="forceDownload('${doc.link}', '${doc.title}')">
                                <i class="fas fa-download"></i> Descargar
                            </button>
                        </div>
                    </div>
                `;
            }
            latestGrid.appendChild(card);
        });
    }

    async function loadFAQData() {
        if (CONFIG.USE_SHEET_FAQ && CONFIG.SHEET_FAQ_URL !== 'TU_LINK_DE_GOOGLE_SHEETS_AQUI') {
            try {
                const separator = CONFIG.SHEET_FAQ_URL.includes('?') ? '&' : '?';
                const faqUrl = `${CONFIG.SHEET_FAQ_URL}${separator}nocache=${new Date().getTime()}`;

                const response = await fetch(faqUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const csvData = await response.text();
                remoteFAQ = parseFAQCSV(csvData);
                lastFAQError = null;
            } catch (error) {
                console.error('Error cargando FAQ remota', error);
                lastFAQError = error.message;
            }
        }
    }

    async function loadData() {
        if (CONFIG.USE_SHEET) {
            try {
                const separator = CONFIG.SHEET_URL.includes('?') ? '&' : '?';
                const fetchUrl = `${CONFIG.SHEET_URL}${separator}nocache=${new Date().getTime()}`;
                
                const response = await fetch(fetchUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const csvData = await response.text();
                documents = parseCSV(csvData);
                lastDocError = null;
                showWelcome();
                renderRecentUpdates();
                console.log('Documentos cargados desde Google Sheets');
            } catch (error) {
                console.error('Error cargando origen local remoto/excel:', error);
                documents = CONFIG.LOCAL_DOCUMENTS || [];
                lastDocError = error.message;
            }
        } else {
            documents = CONFIG.LOCAL_DOCUMENTS || [];
            console.log('Datos cargados desde Local Config');
        }
        
        // Show welcome by default
        showWelcome();
    }

    // --- Auto-refresco silencioso cada 10 minutos ---
    const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutos en ms

    async function silentRefresh() {
        if (!CONFIG.USE_SHEET) return; // Solo aplica si lee desde la fuente de datos
        try {
            const separator = CONFIG.SHEET_URL.includes('?') ? '&' : '?';
            const fetchUrl = `${CONFIG.SHEET_URL}${separator}nocache=${new Date().getTime()}`;
            
            const response = await fetch(fetchUrl);
            if (!response.ok) return;
            const csvData = await response.text();
            const newDocs = parseCSV(csvData);

            // Comparar si hay nuevos documentos (por cantidad o último ítem)
            const hasNewContent = newDocs.length !== documents.length ||
                (newDocs.length > 0 && documents.length > 0 &&
                 newDocs[newDocs.length - 1].title !== documents[documents.length - 1].title);

            if (hasNewContent) {
                documents = newDocs;
                renderRecentUpdates();

                // Si hay una sección activa abierta, refrescarla también
                const activeNav = document.querySelector('.nav-item.active');
                if (activeNav) {
                    const type = activeNav.getAttribute('data-type') || 'pdf';
                    if (type === 'inicio') {
                        showWelcome();
                    } else {
                        const month = activeNav.getAttribute('data-month');
                        if (month) renderContent(month, type);
                    }
                } else {
                    showWelcome();
                }

                // Notificar al apoderado de forma discreta
                showToast('🔔 ¡Hay información nueva disponible!', 'info');
                console.log(`[Auto-refresco] Contenido actualizado a las ${new Date().toLocaleTimeString()}`);
            }
        } catch (error) {
            // Falló silenciosamente, no interrumpir experiencia del usuario
            console.warn('[Auto-refresco] No se pudo verificar nuevos contenidos:', error.message);
        }
    }

    // Iniciar el temporizador de auto-refresco
    setInterval(silentRefresh, AUTO_REFRESH_INTERVAL);




    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const contentType = item.getAttribute('data-type') || 'pdf';
            const selectedMonth = item.getAttribute('data-month');
            window.navigateTo(contentType, selectedMonth, true);
        });
    });

    window.navigateTo = function(contentType, selectedMonth, pushHistory = true) {
        if (contentType === 'inicio') {
            showWelcome();
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('open');
            }
            if (pushHistory) history.pushState({type: contentType, month: selectedMonth}, '', '#inicio');
            return;
        }

        navItems.forEach(i => i.classList.remove('active'));
        const activeItem = Array.from(navItems).find(i => i.getAttribute('data-type') === contentType && i.getAttribute('data-month') === selectedMonth);
        if (activeItem) activeItem.classList.add('active');

        currentMonth = selectedMonth;
        const monthText = activeItem ? activeItem.textContent : selectedMonth;
        monthTitle.textContent = monthText;

        // Ocultar Dashboard y mostrar Sección Mensual
        const dashboardView = document.getElementById('dashboard-view');
        const monthlySection = document.getElementById('monthly-section');
        if (dashboardView) dashboardView.style.display = 'none';
        if (monthlySection) monthlySection.style.display = 'block';
        
        if (contentType === 'video') {
            sectionTitle.textContent = `Videos de ${monthText}`;
        } else if (contentType === 'meeting') {
            sectionTitle.textContent = `Reuniones de ${monthText}`;
        } else if (contentType === 'acle') {
            sectionTitle.textContent = `Talleres ACLE de ${monthText}`;
        } else if (contentType === 'admision') {
            sectionTitle.textContent = ``;
        } else {
            sectionTitle.textContent = `Documentos de ${monthText}`;
        }

        // --- Cambio dinámico de color según categoría ---
        let themeColor = 'var(--primary-electric)';
        if (contentType === 'video') themeColor = '#e67e22';
        else if (contentType === 'meeting') themeColor = '#27ae60';
        else if (contentType === 'acle') themeColor = '#8e44ad';
        else if (contentType === 'admision') themeColor = '#e74c3c';

        const banner = document.querySelector('.section-banner');
        if (banner) {
            banner.style.display = (contentType === 'admision') ? 'none' : '';
            banner.style.borderLeftColor = themeColor;
        }
        if (sectionTitle) sectionTitle.style.color = themeColor;

        // --- Animación de cambio de sección ---
        documentGrid.style.opacity = '0';
        documentGrid.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            documentGrid.innerHTML = '';
            documentGrid.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
            
            // --- Lógica de renderizado filtrada por tipo ---
            renderContent(selectedMonth, contentType);
            
            documentGrid.style.opacity = '1';
            documentGrid.style.transform = 'translateY(0)';
        }, 150);

        if (window.innerWidth <= 1024) {
            sidebar.classList.remove('open');
        }

        if (pushHistory) {
            history.pushState({type: contentType, month: selectedMonth}, '', `#${contentType}-${selectedMonth || ''}`);
        }
    };

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.type) {
            window.navigateTo(e.state.type, e.state.month, false);
        } else {
            window.navigateTo('inicio', null, false);
        }
    });

    // Registrar estado inicial
    history.replaceState({type: 'inicio', month: null}, '', '#inicio');

    function renderContent(month, type) {
        documentGrid.innerHTML = '';
        
        if (month === null) {
            monthTitle.textContent = 'Bienvenido';
            sectionTitle.textContent = '¡Bienvenido apoderado!';
            if (sectionDescription) sectionDescription.textContent = 'Navegue por el menú lateral para ver la información por meses.';
            
            documentGrid.innerHTML = `
                <div class="welcome-container fade-in" style="grid-column: 1/-1; text-align: center; padding: 4rem 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <img src="${CONFIG.LOGO_URL}" alt="Insignia" style="width: 120px; margin: 0 auto 2rem; display: block;">
                    <h3 style="font-size: 1.5rem; color: #003366; margin-bottom: 1rem;">${CONFIG.SCHOOL_NAME}</h3>
                    <p style="color: #636e72; font-size: 1.1rem; max-width: 500px; margin: 0 auto;">
                        Para comenzar, por favor seleccione una categoría (Videos o Documentos) y el mes en el menú lateral.
                    </p>
                    <div class="nav-tip" style="margin-top: 2rem; color: #e6b800; font-weight: 700;">
                        <span class="desktop-only"><i class="fas fa-arrow-left"></i> Utilice el menú lateral</span>
                        <span class="mobile-only" style="display:none;"><i class="fas fa-arrow-up"></i> Utilice el menú superior</span>
                    </div>
                </div>
            `;
            return;
        }

        const isVideoRequest = type === 'video';
        const isMeetingRequest = type === 'meeting';
        const isAcleRequest = type === 'acle';
        const isAdmisionRequest = type === 'admision';
        
        // Filtrar documentos por mes Y por tipo
        const filteredData = documents.filter(doc => {
            if (isAdmisionRequest) return doc.month === 'admision';

            const isMeetingEntry = doc.link.startsWith('MEETING|');
            const isAcleEntry = doc.link.startsWith('ACLE|');
            const youtubeId = getYoutubeId(doc.link);
            const instagramId = getInstagramId(doc.link);
            const isVideoEntry = (youtubeId !== null || instagramId !== null) && !isMeetingEntry && !isAcleEntry;

            if (isMeetingRequest) return doc.month === month && isMeetingEntry;
            if (isAcleRequest) return doc.month === month && isAcleEntry;
            if (isVideoRequest) return doc.month === month && isVideoEntry;
            return doc.month === month && !isVideoEntry && !isMeetingEntry && !isAcleEntry;
        }).sort(compareDocs);

        if (isMeetingRequest) {
            if (sectionDescription) sectionDescription.textContent = 'Citaciones y horarios de reuniones por curso';
        } else if (isAcleRequest) {
            if (sectionDescription) sectionDescription.textContent = 'Talleres deportivos, artísticos y culturales (ACLE)';
        } else if (isVideoRequest) {
            if (sectionDescription) sectionDescription.textContent = 'Cápsulas y tutoriales en video';
        } else if (isAdmisionRequest) {
            if (sectionDescription) sectionDescription.textContent = '';
        } else {
            if (sectionDescription) sectionDescription.textContent = 'Archivos y circulares oficiales';
        }

        // --- Lógica de Widgets para Admisión (Timeline y Portal) ---
        const widgetsContainer = document.getElementById('admision-widgets-container');
        if (widgetsContainer) {
            if (isAdmisionRequest) {
                widgetsContainer.style.display = 'block';
                
                const currentMonthNum = new Date().getMonth() + 1; // 1-12
                
                const introHTML = `
                    <div class="admision-intro-banner">
                        <div class="intro-content">
                            <h2>Portal de Admisión</h2>
                            <p>Toda la información y accesos necesarios para formar parte de nuestra comunidad educativa.</p>
                        </div>
                    </div>
                `;

                let timelineHTML = '<div class="timeline-container">';
                if (CONFIG.SAE_TIMELINE) {
                    CONFIG.SAE_TIMELINE.forEach((step, idx) => {
                        let isActive = currentMonthNum >= step.month ? 'active' : '';
                        timelineHTML += `
                            <div class="timeline-step ${isActive}">
                                <div class="timeline-dot"><i class="fas ${step.icon}"></i></div>
                                <div class="timeline-content">
                                    <h4>${step.label}</h4>
                                    <span>${step.desc}</span>
                                </div>
                            </div>
                        `;
                    });
                }
                timelineHTML += '</div>';

                const portalHTML = `
                    <div class="portals-grid">
                        <div class="pro-card sae-card">
                            <div class="card-icon-wrapper">
                                <i class="fas fa-university"></i>
                            </div>
                            <div class="card-info">
                                <h3>Portal del Mineduc</h3>
                                <p>Realiza tu postulación oficial directamente en el Sistema de Admisión Escolar (SAE).</p>
                                <a href="${CONFIG.SAE_PORTAL_URL}" target="_blank" class="btn-pro btn-sae">
                                    <span>Postular en SAE</span> <i class="fas fa-external-link-alt"></i>
                                </a>
                            </div>
                        </div>
                        
                        <div class="pro-card anotate-card">
                            <div class="card-icon-wrapper">
                                <i class="fas fa-user-plus"></i>
                            </div>
                            <div class="card-info">
                                <h3>Anótate en la lista</h3>
                                <p>Registro público para solicitar vacantes disponibles fuera del periodo regular de admisión.</p>
                                <a href="${CONFIG.ANOTATE_URL}" target="_blank" class="btn-pro btn-anotate">
                                    <span>Solicitar Vacante</span> <i class="fas fa-list-ol"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                `;

                const locationHTML = `
                    <div class="pro-card location-card">
                        <div class="location-header">
                            <div class="card-icon-wrapper">
                                <i class="fas fa-map-marked-alt"></i>
                            </div>
                            <div class="card-info">
                                <h3>Visítanos y Conéctate</h3>
                                <p>Encuentra fácilmente cómo llegar a nuestro establecimiento y síguenos en nuestras redes oficiales.</p>
                            </div>
                        </div>
                        <div class="location-actions">
                            <a href="${CONFIG.WAZE_URL}" target="_blank" class="btn-outline btn-waze">
                                <i class="fab fa-waze"></i> Waze
                            </a>
                            <a href="${CONFIG.MAPS_URL}" target="_blank" class="btn-outline btn-maps">
                                <i class="fas fa-map-marker-alt"></i> Google Maps
                            </a>
                            <a href="${CONFIG.FACEBOOK_URL}" target="_blank" class="btn-outline btn-facebook">
                                <i class="fab fa-facebook-f"></i> Facebook
                            </a>
                            <a href="${CONFIG.INSTAGRAM_URL}" target="_blank" class="btn-outline btn-instagram">
                                <i class="fab fa-instagram"></i> Instagram
                            </a>
                        </div>
                    </div>
                `;

                const contactHTML = `
                    <div class="pro-card contact-card" style="border-top: 4px solid #3498db; text-align: center;">
                        <div class="location-header" style="flex-direction: column; align-items: center; gap: 1rem;">
                            <div class="card-icon-wrapper" style="background: rgba(52, 152, 219, 0.1); color: #3498db; width: 70px; height: 70px; font-size: 2rem;">
                                <i class="fas fa-headset"></i>
                            </div>
                            <div class="card-info" style="width: 100%;">
                                <h3>¿Tienes problemas con tu postulación?</h3>
                                <p style="font-size: 1.1rem;">Contáctanos directamente y te ayudaremos con tu proceso de matrícula.</p>
                                
                                <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 2rem; margin-top: 1.5rem; background: #f8f9fa; padding: 1.5rem; border-radius: var(--radius);">
                                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 1.05rem; color: var(--text-dark);">
                                        <i class="fas fa-envelope" style="color: #3498db; font-size: 1.3rem;"></i>
                                        <a href="mailto:simon.bolivar@cormun.cl" style="color: inherit; text-decoration: none; font-weight: 700; transition: color 0.2s;" onmouseover="this.style.color='#3498db'" onmouseout="this.style.color='inherit'">simon.bolivar@cormun.cl</a>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 1.05rem; color: var(--text-dark);">
                                        <i class="fas fa-phone-alt" style="color: #3498db; font-size: 1.3rem;"></i>
                                        <a href="tel:22230676" style="color: inherit; text-decoration: none; font-weight: 700; transition: color 0.2s;" onmouseover="this.style.color='#3498db'" onmouseout="this.style.color='inherit'">22230676</a>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 1.05rem; color: var(--text-dark);">
                                        <i class="fas fa-map-marker-alt" style="color: #3498db; font-size: 1.3rem;"></i>
                                        <span style="font-weight: 700;">Baquedano #390</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const infoSAEHTML = `
                    <div class="sae-info-section pro-typography">
                        <div class="sae-info-header">
                            <span class="sae-info-badge">Liceo Integrado Simón Bolívar</span>
                            <h4>¿Qué es el Sistema de Admisión Escolar?</h4>
                            <p class="sae-lead">El <strong>Sistema de Admisión Escolar (SAE)</strong> es la plataforma oficial del Ministerio de Educación que permite postular en línea, de forma simple y centralizada, a los establecimientos educacionales públicos y particulares subvencionados.</p>
                        </div>
                        
                        <div class="sae-features-grid">
                            <div class="sae-feature-item">
                                <div class="sae-feature-icon"><i class="fas fa-laptop-house"></i></div>
                                <div class="sae-feature-text">
                                    <h5>Postulación 100% en Línea</h5>
                                    <p>En lugar de ir escuela por escuela, puedes postular a todos los establecimientos de tu interés desde cualquier lugar y con toda la información en un solo sitio.</p>
                                </div>
                            </div>
                            
                            <div class="sae-feature-item">
                                <div class="sae-feature-icon"><i class="fas fa-balance-scale"></i></div>
                                <div class="sae-feature-text">
                                    <h5>Transparente y Equitativo</h5>
                                    <p>El objetivo es asegurar un proceso ordenado para todas las familias. Las vacantes se asignan de manera justa, respetando criterios legales sin discriminaciones.</p>
                                </div>
                            </div>
                            
                            <div class="sae-feature-item">
                                <div class="sae-feature-icon"><i class="fas fa-hands-helping"></i></div>
                                <div class="sae-feature-text">
                                    <h5>Acompañamiento Constante</h5>
                                    <p>La herramienta te acompaña en cada paso, permitiendo recibir notificaciones por correo o SMS sobre fechas clave, todo desde tu celular o computador.</p>
                                </div>
                            </div>
                            
                            <div class="sae-feature-item">
                                <div class="sae-feature-icon"><i class="fas fa-clock"></i></div>
                                <div class="sae-feature-text">
                                    <h5>Ahorro de Tiempo</h5>
                                    <p>Facilita la búsqueda, reduce trámites presenciales y te otorga mayor poder de decisión con información exacta sobre las opciones de matrícula.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const tutorialHTML = ``;

                const pasoAPasoHTML = `
                    <div class="sae-paso-section">
                        <div class="sae-info-header" style="margin-bottom: 2rem;">
                            <h4>Paso a Paso para Postular</h4>
                            <p class="sae-lead">Sigue estos consejos clave para asegurar que tu postulación sea exitosa.</p>
                        </div>
                        <div class="pasos-grid">
                            <div class="paso-card">
                                <div class="paso-num">1</div>
                                <h5>El Orden de Preferencias</h5>
                                <p>Al postular, ordena los establecimientos desde el que más te gustaría al que menos. El sistema siempre intentará asignar la opción más alta posible. Si el estudiante queda en una opción, automáticamente se descartan las que están más abajo.</p>
                            </div>
                            <div class="paso-card">
                                <div class="paso-num">2</div>
                                <h5>Usa los Filtros del Buscador</h5>
                                <p>En la Vitrina puedes buscar colegios según tus necesidades filtrando por:</p>
                                <ul class="paso-list">
                                    <li><i class="fas fa-check"></i> Género del establecimiento</li>
                                    <li><i class="fas fa-check"></i> Adscritos a Subvención Preferencial (SEP)</li>
                                    <li><i class="fas fa-check"></i> Programa de Integración Escolar (PIE)</li>
                                    <li><i class="fas fa-check"></i> Dependencia (Municipal, Particular, etc.)</li>
                                    <li><i class="fas fa-check"></i> Gratuito o con copago</li>
                                </ul>
                            </div>
                            <div class="paso-card">
                                <div class="paso-num">3</div>
                                <h5>Envío y Comprobante</h5>
                                <p>Antes de enviar, puedes revisar y modificar el orden cuantas veces quieras. Una vez enviada, ese orden será el definitivo. <strong>¡No olvides descargar tu comprobante!</strong> El proceso solo termina cuando completas este paso.</p>
                            </div>
                            <div class="paso-card">
                                <div class="paso-num">4</div>
                                <h5>Recomendación Clave</h5>
                                <p>Te sugerimos incluir <strong>al menos 6 establecimientos</strong> por estudiante. Esto aumenta enormemente tus posibilidades de obtener un cupo. Construye una lista diversa y ajustada a tus necesidades.</p>
                            </div>
                        </div>
                    </div>
                `;

                const faqHTML = `
                    <div class="sae-faq-section">
                        <div class="sae-info-header" style="margin-bottom: 2rem;">
                            <h4>Preguntas Frecuentes</h4>
                            <p class="sae-lead">Resolvemos las dudas más comunes sobre el proceso de postulación.</p>
                        </div>
                        <div class="faq-accordion">
                            <details class="faq-item">
                                <summary>1. ¿Dónde debo postular?</summary>
                                <div class="faq-content">
                                    <p>Debes postular ingresando a <a href="https://www.sistemadeadmisionescolar.cl/" target="_blank">www.sistemadeadmisionescolar.cl</a> desde cualquier computador o celular con acceso a internet.</p>
                                </div>
                            </details>
                            <details class="faq-item">
                                <summary>2. ¿A cuántos establecimientos puedo postular?</summary>
                                <div class="faq-content">
                                    <p>Te sugerimos que postules, al menos, a 6 colegios. No existe un número máximo, puedes postular a todos los establecimientos en que estés dispuesto a matricularte.</p>
                                </div>
                            </details>
                            <details class="faq-item">
                                <summary>3. ¿Puedo modificar mi postulación tras enviarla?</summary>
                                <div class="faq-content">
                                    <p>Sí, puedes modificar tu postulación las veces que consideres necesaria dentro del periodo. Siempre se tomará como válida la última postulación enviada. ¡No olvides descargar tu comprobante!</p>
                                </div>
                            </details>
                            <details class="faq-item">
                                <summary>4. ¿Qué pasa si no alcanzo a postular en el Periodo Principal?</summary>
                                <div class="faq-content">
                                    <p>Puedes postular en el Periodo Complementario de postulación a las vacantes que queden disponibles después del Periodo Principal.</p>
                                </div>
                            </details>
                        </div>
                        <div style="text-align: center; margin-top: 2rem;">
                            <a href="https://www.sistemadeadmisionescolar.cl/preguntas_frecuentes.html" target="_blank" class="btn-outline">
                                Ver todas las preguntas frecuentes <i class="fas fa-external-link-alt"></i>
                            </a>
                        </div>
                    </div>
                `;

                widgetsContainer.innerHTML = introHTML + tutorialHTML + infoSAEHTML + pasoAPasoHTML + faqHTML + portalHTML + timelineHTML + locationHTML + contactHTML;
            } else {
                widgetsContainer.style.display = 'none';
                widgetsContainer.innerHTML = '';
            }
        }

        if (filteredData.length === 0) {
            let icon = 'fa-folder-open';
            let emptyText = `No hay documentos para ${month} aún.`;
            
            if (isMeetingRequest) {
                icon = 'fa-calendar-times';
                emptyText = `No hay reuniones programadas para ${month}.`;
            } else if (isAcleRequest) {
                icon = 'fa-running';
                emptyText = `No hay talleres registrados para ${month}.`;
            } else if (isVideoRequest) {
                icon = 'fa-video-slash';
                emptyText = `Aún no hay videos para ${month}.`;
            }

            documentGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #636e72;">
                    <i class="fas ${icon}" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                    <p>${emptyText}</p>
                </div>
            `;
            return;
        }

        function createCardElement(doc, index) {
            const isMeeting = doc.link.startsWith('MEETING|');
            const isAcle = doc.link.startsWith('ACLE|');
            const youtubeId = getYoutubeId(doc.link);
            const instagramId = getInstagramId(doc.link);
            const isVideo = (youtubeId !== null || instagramId !== null) && !isMeeting && !isAcle;
            const isPhoto = doc.link.match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null && !isMeeting && !isAcle;
            
            const card = document.createElement('div');
            card.className = `doc-card fade-in ${isVideo ? 'video-card' : ''} ${isMeeting ? 'meeting-card' : ''} ${isAcle ? 'acle-card' : ''} ${isPhoto ? 'photo-card' : ''}`;
            
            // Stagger animation: Escalonar la entrada de cada tarjeta
            card.style.animationDelay = `${index * 0.08}s`;
            
            if (isAcle) {
                const parts = doc.link.split('|');
                const horario = parts[1] || '';
                const lugar = parts[2] || '';

                card.innerHTML = `
                    <div class="acle-badge">ACLE</div>
                    <div class="acle-info-header">
                        <div class="acle-icon-circle">
                            <i class="fas fa-running"></i>
                        </div>
                        <div>
                            <h3>${doc.title}</h3>
                            <span class="acle-instructor">${doc.date}</span>
                        </div>
                    </div>
                    <div class="acle-details-grid">
                        <div class="acle-detail-item">
                            <i class="far fa-clock"></i> <span>${horario}</span>
                        </div>
                        <div class="acle-detail-item">
                            <i class="fas fa-map-marker-alt"></i> <span>${lugar}</span>
                        </div>
                    </div>
                `;
            } else if (isMeeting) {
                const parts = doc.link.split('|');
                const diaNombre = parts[1] || '';
                const hora = parts[2] || '';
                const lugar = parts[3] || '';

                card.innerHTML = `
                    <div class="meeting-calendar-icon">
                        <span class="meeting-day-name">${diaNombre}</span>
                        <span class="meeting-day-num">${doc.date}</span>
                    </div>
                    <div class="meeting-details">
                        <h3>${doc.title}</h3>
                        <div class="meeting-info-row">
                            <i class="far fa-clock"></i> <span>${hora}</span>
                        </div>
                        <div class="meeting-info-row">
                            <i class="fas fa-map-marker-alt"></i> <span>${lugar}</span>
                        </div>
                    </div>
                `;
            } else if (isVideo) {
                const platform = getInstagramId(doc.link) ? 'instagram' : 'youtube';
                const videoId = getInstagramId(doc.link) || getYoutubeId(doc.link);
                
                let coverHTML = '';
                if (platform === 'youtube') {
                    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                    coverHTML = `<div class="video-cover" style="background-image: url('${thumbnailUrl}');"></div>`;
                } else {
                    coverHTML = `
                        <div class="video-cover instagram-cover">
                            <i class="fab fa-instagram"></i>
                        </div>
                    `;
                }

                card.innerHTML = `
                    <div class="video-thumbnail-container" onclick="window.openVideoModal('${videoId}', '${doc.title.replace(/'/g, "\\'")}', '${doc.date}', '${platform}')">
                        ${coverHTML}
                        <div class="video-play-overlay">
                            <i class="fas fa-play"></i>
                        </div>
                        <div class="video-platform-badge badge-${platform}">
                            <i class="fab fa-${platform}"></i>
                        </div>
                    </div>
                    <div class="video-card-info">
                        <h3>${doc.title}</h3>
                        <div class="doc-date"><i class="far fa-calendar-alt"></i> ${doc.date}</div>
                    </div>
                `;
            } else if (isPhoto) {
                card.innerHTML = `
                    <div class="photo-thumbnail-container" onclick="window.openPhotoModal('${doc.link}', '${doc.title.replace(/'/g, "\\'")}', '${doc.date}')">
                        <img src="${doc.link}" alt="${doc.title}">
                        <div class="photo-thumbnail-overlay">
                            <i class="fas fa-expand"></i>
                        </div>
                    </div>
                    <div class="photo-card-info">
                        <h3>${doc.title}</h3>
                        <p><i class="far fa-calendar-alt"></i> ${doc.date}</p>
                    </div>
                `;
            } else {
                card.classList.add('pdf-card');
                
                // Personalización para Admisión
                const isAdmisionCard = doc.month === 'admision';
                if (isAdmisionCard) {
                    card.style.borderLeftColor = '#e74c3c';
                }
                
                const buttonText = isAdmisionCard ? 'Ver Documento' : 'Ver Circular';

                card.innerHTML = `
                    <div class="pdf-details">
                        <h3>${doc.title}</h3>
                        <div class="doc-date"><i class="far fa-calendar-alt"></i> ${doc.date}</div>
                        <div class="pdf-actions">
                            <a href="${doc.link}" target="_blank" class="btn-view"><i class="far fa-eye"></i> ${buttonText}</a>
                        </div>
                    </div>
                `;
            }
            return card;
        }

        if (isAdmisionRequest) {
            documentGrid.classList.remove('document-grid');
            
            const pdfs = [];
            const videos = [];
            const photos = [];

            filteredData.forEach(doc => {
                const isMeeting = doc.link.startsWith('MEETING|');
                const isAcle = doc.link.startsWith('ACLE|');
                const youtubeId = getYoutubeId(doc.link);
                const instagramId = getInstagramId(doc.link);
                const isVideo = (youtubeId !== null || instagramId !== null) && !isMeeting && !isAcle;
                const isPhoto = doc.link.match(/\.(jpeg|jpg|gif|png|webp)$/i) !== null && !isMeeting && !isAcle;
                
                if (isVideo) videos.push(doc);
                else if (isPhoto) photos.push(doc);
                else pdfs.push(doc);
            });

            videos.unshift({
                title: 'Tutorial SAE - Ministerio de Educación',
                date: 'Oficial',
                link: 'https://www.youtube.com/watch?v=beu4FjEJY2Y',
                month: 'admision'
            });

            if (pdfs.length > 0) {
                const section = document.createElement('div');
                section.className = 'admision-media-section';
                section.innerHTML = '<h3 class="admision-section-title"><i class="fas fa-file-pdf"></i> Documentos Importantes</h3>';
                const grid = document.createElement('div');
                grid.className = 'document-grid';
                pdfs.forEach((doc, i) => grid.appendChild(createCardElement(doc, i)));
                section.appendChild(grid);
                documentGrid.appendChild(section);
            }

            if (videos.length > 0) {
                const section = document.createElement('div');
                section.className = 'admision-media-section';
                section.innerHTML = '<h3 class="admision-section-title"><i class="fas fa-video"></i> Videos Informativos</h3>';
                const grid = document.createElement('div');
                grid.className = 'document-grid';
                videos.forEach((doc, i) => grid.appendChild(createCardElement(doc, i)));
                section.appendChild(grid);
                documentGrid.appendChild(section);
            }

            if (photos.length > 0) {
                const section = document.createElement('div');
                section.className = 'admision-media-section';
                section.innerHTML = '<h3 class="admision-section-title"><i class="fas fa-camera"></i> Galería de Fotos</h3>';
                const grid = document.createElement('div');
                grid.className = 'document-grid';
                photos.forEach((doc, i) => grid.appendChild(createCardElement(doc, i)));
                section.appendChild(grid);
                documentGrid.appendChild(section);
            }
        } else {
            documentGrid.classList.add('document-grid');
            filteredData.forEach((doc, index) => {
                documentGrid.appendChild(createCardElement(doc, index));
            });
        }
    }

    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
        menuToggle.classList.remove('menu-highlight'); // Detener la animación una vez presionado
    });

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && e.target !== menuToggle && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // --- Chatbot Logic ---
    const chatTrigger = document.getElementById('chat-trigger');
    const chatContainer = document.getElementById('chat-container');
    const closeChat = document.getElementById('close-chat');
    const chatInput = document.getElementById('chat-input');
    const sendChat = document.getElementById('send-chat');
    const chatMessages = document.getElementById('chat-messages');

    function toggleChat() {
        chatContainer.classList.toggle('active');
        window.toggleChat = toggleChat; // Exponer para uso global
        if (chatContainer.classList.contains('active')) {
            chatInput.focus();
            if (window.visualViewport && window.innerWidth <= 480) {
                // En móviles, sincronizar con el tamaño real inmediatamente
                chatContainer.style.height = window.visualViewport.height + 'px';
                chatContainer.style.top = window.visualViewport.offsetTop + 'px';
                chatContainer.style.bottom = 'auto'; // Eliminar bottom: 0 del CSS
            }
        } else {
            // Limpiar al cerrar
            chatContainer.style.height = '';
            chatContainer.style.top = '';
            chatContainer.style.bottom = '';
        }
    }

    // --- Ajuste para teclado virtual en móviles (Especial iOS Safari) ---
    function scrollChatToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    if (window.visualViewport) {
        function syncVisualViewport() {
            if (!chatContainer.classList.contains('active')) return;
            if (window.innerWidth > 480) return; // Solo afectar móviles
            
            // Forzar el chat a ocupar exactamente el espacio visible restante
            chatContainer.style.height = window.visualViewport.height + 'px';
            chatContainer.style.top = window.visualViewport.offsetTop + 'px';
            chatContainer.style.bottom = 'auto';
            
            // Scrollear al último mensaje al redimensionar
            scrollChatToBottom();
            // Truco para Safari: forzar reset de scroll del body
            window.scrollTo(0, 0);
        }

        window.visualViewport.addEventListener('resize', syncVisualViewport);
        window.visualViewport.addEventListener('scroll', syncVisualViewport);
    }

    chatInput.addEventListener('focus', () => {
        setTimeout(scrollChatToBottom, 300);
    });

    function addMessage(text, isUser = false, suggestions = []) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        if (isUser) {
            msgDiv.textContent = text;
        } else {
            msgDiv.innerHTML = text;
        }
        
        chatMessages.appendChild(msgDiv);

        // Add Feedback and Suggestions for Bot Messages
        if (!isUser) {
            // 1. Feedback Buttons (Small Thumbs)
            const feedbackDiv = document.createElement('div');
            feedbackDiv.className = 'feedback-container fade-in';
            feedbackDiv.innerHTML = `
                <button class="feedback-btn" onclick="handleFeedback(this, 'up')"><i class="far fa-thumbs-up"></i></button>
                <button class="feedback-btn" onclick="handleFeedback(this, 'down')"><i class="far fa-thumbs-down"></i></button>
            `;
            chatMessages.appendChild(feedbackDiv);

            // 2. Suggestions
            if (suggestions.length > 0) {
                const suggestionsDiv = document.createElement('div');
                suggestionsDiv.className = 'chat-suggestions fade-in';
                suggestions.forEach(label => {
                    const btn = document.createElement('button');
                    btn.className = 'suggestion-btn';
                    btn.textContent = label;
                    btn.onclick = () => {
                        addMessage(label, true);
                        processUserMessage(label);
                    };
                    suggestionsDiv.appendChild(btn);
                });
                chatMessages.appendChild(suggestionsDiv);
            }
        }

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Global feedback handler
    window.handleFeedback = (btn, type) => {
        const container = btn.parentElement;
        const allBtns = container.querySelectorAll('.feedback-btn');
        allBtns.forEach(b => {
            b.disabled = true;
            b.classList.remove('active-up', 'active-down');
        });

        if (type === 'up') {
            btn.classList.add('active-up');
            showToast('¡Gracias por tu feedback! 🐾', 'success');
        } else {
            btn.classList.add('active-down');
            showToast('Lo lamento, intentaré mejorar. 😿', 'info');
        }
    };

    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.id = 'typing-indicator';
        indicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }

    function simonaResponse(query) {
        const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const qRaw = query.toLowerCase().trim();
        const q = removeAccents(qRaw).replace(/[?.!,;]/g, '');

        // --- 0. Sinónimos ---
        let processedQuery = q;
        for (const [canonical, variants] of Object.entries(SYNONYMS)) {
            if (variants.some(v => q.includes(v))) {
                processedQuery += " " + canonical;
            }
        }

        // --- COMANDOS ESPECIALES ---
        if (qRaw === '/status') {
            let status = `📊 <strong>Estado de Simona:</strong><br>`;
            status += `• FAQ Remota: ${remoteFAQ.length} items ✅<br>`;
            status += `• Documentos: ${documents.length} cargados ${documents.length > 0 ? '✅' : '❌'}<br>`;
            status += `• FAQ Local: ${CONFIG.FAQ.length} items<br>`;
            status += `• Historial: ${conversationHistory.length} temas<br>`;
            if (lastDocError) status += `<br>❌ Error en Documentos: ${lastDocError}`;
            if (lastFAQError) status += `<br>❌ Error en FAQ: ${lastFAQError}`;
            return { text: status };
        }

        if (qRaw === '/historial' || q.includes('resumen') && q.includes('conversacion')) {
            if (conversationHistory.length === 0) {
                return { text: 'Aún no hemos conversado sobre ningún tema. ¡Pregúntame algo! 🐾' };
            }
            let historyHtml = `<div class="history-box">📝 <strong>Resumen de nuestra conversación:</strong><ul>`;
            conversationHistory.forEach(item => {
                historyHtml += `<li><i class="fas fa-check-circle"></i> ${item}</li>`;
            });
            historyHtml += `</ul></div>`;
            return { text: historyHtml };
        }

        const linkify = (text) => {
            if (!text) return text;
            const urlRegex = /([^="']|^)(https?:\/\/[^\s<]+)/g;
            return text.replace(urlRegex, '$1<a href="$2" target="_blank" style="text-decoration: underline; font-weight: bold; color: #0056b3;">$2</a>');
        };

        // --- 1. DETECCIÓN DE URGENCIA ---
        const isEmergency = EMERGENCY_WORDS.some(w => q.includes(removeAccents(w)));
        if (isEmergency) {
            conversationHistory.push('🚨 Consulta urgente');
            return { text: `🚨 <strong>Entiendo que es urgente.</strong> Te recomiendo comunicarte directamente:<br><br>
                <div class="emergency-box">
                    <strong>📞 Teléfono:</strong> 72 222 3067<br>
                    <strong>✉️ Correo:</strong> simon.bolivar@cormun.cl<br><br>
                    <a href="tel:+56722223067"><i class="fas fa-phone-alt"></i> Llamar ahora</a>
                </div>` };
        }

        // --- 1.5. DETECCIÓN DE ADMISIÓN Y ANÓTATE EN LA LISTA ---
        const admisionWords = ['admision', 'matricula', 'postula', 'inscrip', 'ingreso', 'nuevo alumno', 'sae', 'anotate', 'vacante'];
        const isAdmision = admisionWords.some(w => q.includes(w));
        if (isAdmision) {
            conversationHistory.push('🎓 Consulta sobre Admisión, SAE o Vacantes');
            return { text: `¡Hola! El proceso de postulación regular y el registro público <strong>"Anótate en la lista"</strong> para solicitar vacantes, se realizan a través del Sistema de Admisión Escolar (SAE). 🎓<br><br>
                📅 <strong>Etapas Clave Habituales:</strong><br>
                • <strong>Postulaciones Regulares:</strong> Agosto - Septiembre<br>
                • <strong>Matrículas:</strong> Diciembre<br>
                • <strong>Anótate en la Lista (Vacantes):</strong> A partir de Enero<br><br>
                Tenemos una sección especial en nuestra plataforma con accesos directos a estos portales del Mineduc, fechas y requisitos:<br><br>
                <div style="margin-top:1rem; text-align:center; display:flex; justify-content:center;">
                    <button class="btn-hero-admision pulse-red" onclick="if(window.toggleChat) window.toggleChat(); document.getElementById('btn-admision').click();" style="margin:0;">
                        <i class="fas fa-user-graduate"></i> Ver sección Admisión
                    </button>
                </div>` };
        }

        // --- 1.6. INFORMACIÓN INSTITUCIONAL Y SITIO WEB ---
        const schoolWords = ['liceo', 'institucion', 'colegio', 'sitio web', 'pagina', 'simon bolivar', 'historia', 'quienes somos'];
        const isSchoolInfo = schoolWords.some(w => q.includes(w));
        if (isSchoolInfo && !isAdmision) {
            conversationHistory.push('🏫 Consulta sobre el Liceo');
            return { text: `Para conocer más detalles sobre nuestra historia, misión, visión, y todas las noticias oficiales de nuestra comunidad educativa, te invito a visitar nuestro sitio web oficial:<br><br>
                🌐 <a href="https://www.liceo-simonbolivar.cl/views/" target="_blank" style="color:#0056b3; font-weight:bold; text-decoration:underline;">www.liceo-simonbolivar.cl</a><br><br>
                Allí encontrarás toda la información pública del establecimiento. 🏫` };
        }

        // --- 1.7. UBICACIÓN, MAPAS Y REDES SOCIALES ---
        const locationWords = ['ubicacion', 'llegar', 'donde quedan', 'donde estan', 'direccion', 'mapa', 'waze', 'google maps', 'redes sociales', 'facebook', 'instagram', 'contacto'];
        const isLocation = locationWords.some(w => q.includes(w));
        if (isLocation) {
            conversationHistory.push('📍 Consulta de Ubicación y Redes Sociales');
            return { text: `¡Por supuesto! Siempre serás bienvenido/a en el Liceo. 🏫<br><br>
                📍 <strong>Nuestra Ubicación:</strong> Puedes usar las siguientes aplicaciones para llegar fácilmente:<br>
                • <a href="${CONFIG.WAZE_URL}" target="_blank" style="color:#0056b3; font-weight:bold; text-decoration:underline;">🚗 Ir con Waze</a><br>
                • <a href="${CONFIG.MAPS_URL}" target="_blank" style="color:#0056b3; font-weight:bold; text-decoration:underline;">🗺️ Ver en Google Maps</a><br><br>
                📱 <strong>Nuestras Redes Sociales:</strong><br>
                Síguenos para mantenerte al día con nuestras actividades:<br>
                • <a href="${CONFIG.FACEBOOK_URL}" target="_blank" style="color:#0056b3; font-weight:bold; text-decoration:underline;">📘 Facebook Oficial</a><br>
                • <a href="${CONFIG.INSTAGRAM_URL}" target="_blank" style="color:#0056b3; font-weight:bold; text-decoration:underline;">📸 Instagram Oficial</a><br><br>
                <em>También puedes encontrar todos estos accesos agrupados en la sección de Admisión.</em>` };
        }

        // --- 2. BÚsqueda de Documentos por MES ---
        let combinedResponse = "";
        let docsFoundByMonth = [];

        const months = ['marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        let targetMonth = months.find(m => processedQuery.includes(m));

        if (!targetMonth && (processedQuery.includes('documentos') || processedQuery.includes('mas')) && chatContext.lastMonth) {
            targetMonth = chatContext.lastMonth;
        }

        const generateCarouselCard = (d) => {
            const youtubeId = getYoutubeId(d.link);
            const instagramId = getInstagramId(d.link);
            const isMeeting = d.link.startsWith('MEETING|');
            const isAcle = d.link.startsWith('ACLE|');
            const isVideo = (youtubeId !== null || instagramId !== null) && !isMeeting && !isAcle;
            
            let iconClass = 'fas fa-file-pdf';
            let label = 'Documento';
            let actionAttr = `target="_blank"`;
            let colorStyle = '';
            
            if (isMeeting) {
                iconClass = 'fas fa-calendar-check';
                label = 'Reunión';
                actionAttr = `onclick="event.preventDefault(); if(window.toggleChat) window.toggleChat(); document.querySelector('[data-month=\\'${d.month}\\'][data-type=\\'meeting\\']')?.click(); setTimeout(() => document.getElementById('section-title')?.scrollIntoView({behavior: 'smooth'}), 300);"`;
                colorStyle = 'color: #27ae60;';
            } else if (isAcle) {
                iconClass = 'fas fa-basketball-ball';
                label = 'Taller ACLE';
                actionAttr = `onclick="event.preventDefault(); if(window.toggleChat) window.toggleChat(); document.querySelector('[data-month=\\'${d.month}\\'][data-type=\\'acle\\']')?.click(); setTimeout(() => document.getElementById('section-title')?.scrollIntoView({behavior: 'smooth'}), 300);"`;
                colorStyle = 'color: #8e44ad;';
            } else if (isVideo) {
                iconClass = instagramId ? 'fab fa-instagram' : 'fab fa-youtube';
                label = instagramId ? 'Video Instagram' : 'Video YouTube';
                const platform = instagramId ? 'instagram' : 'youtube';
                const videoId = instagramId || youtubeId;
                actionAttr = `onclick="event.preventDefault(); window.openVideoModal('${videoId}', '${d.title.replace(/'/g, "\\'")}', '${d.date}', '${platform}')"`;
                colorStyle = instagramId ? 'color: #E1306C;' : 'color: #FF0000;';
            }

            if (isAcle) {
                const parts = d.link.split('|');
                const h = parts[1] || '';
                return `
                    <a href="#" ${actionAttr} class="doc-carousel-card acle-card-small">
                        <div style="font-size: 0.6rem; color: #888; margin-bottom: 3px; font-weight: 800; text-transform: uppercase;">${label}</div>
                        <div style="display: flex; align-items: center;">
                            <div style="background: #f7f1fb; padding: 5px; border-radius: 4px; text-align: center; min-width: 35px; margin-right: 8px; border: 1px solid #8e44ad;">
                                <i class="fas fa-star" style="font-size: 10px; color: #8e44ad;"></i>
                            </div>
                            <div style="flex-grow: 1;">
                                <span class="card-title">${d.title}</span>
                                <span class="card-date">${d.date} — ${h}</span>
                            </div>
                        </div>
                    </a>
                `;
            }

            if (isMeeting) {
                const parts = d.link.split('|');
                const h = parts[2] || '';
                return `
                    <a href="#" ${actionAttr} class="doc-carousel-card meeting-card-small">
                        <div style="font-size: 0.6rem; color: #888; margin-bottom: 3px; font-weight: 800; text-transform: uppercase;">${label}</div>
                        <div style="display: flex; align-items: center;">
                            <div style="background: #f1fcf4; padding: 5px; border-radius: 4px; text-align: center; min-width: 35px; margin-right: 8px; border: 1px solid #27ae60;">
                                <div style="font-size: 10px; font-weight: 900; color: #27ae60; line-height: 1;">${d.date}</div>
                            </div>
                            <div style="flex-grow: 1;">
                                <span class="card-title">${d.title}</span>
                                <span class="card-date">${h} — ${d.month}</span>
                            </div>
                        </div>
                    </a>
                `;
            }

            return `
                <a href="${d.link}" ${actionAttr} class="doc-carousel-card ${isVideo ? 'video-card-small' : ''}">
                    <div style="font-size: 0.6rem; color: #888; margin-bottom: 3px; font-weight: 800; text-transform: uppercase;">${label}</div>
                    <i class="${iconClass} card-icon" style="${colorStyle}"></i>
                    <span class="card-title">${d.title}</span>
                    <span class="card-date">${d.date} ${d.month ? '— ' + d.month : ''}</span>
                </a>
            `;
        };

        if (targetMonth) {
            chatContext.lastMonth = targetMonth;
            conversationHistory.push(`📅 Documentos de ${targetMonth}`);
            docsFoundByMonth = documents.filter(d => d.month === targetMonth).sort(compareDocs);
            if (docsFoundByMonth.length > 0) {
                // --- DESGLOSE POR TIPO ---
                const circulares = docsFoundByMonth.filter(d => {
                    const yt = getYoutubeId(d.link), ig = getInstagramId(d.link);
                    return !d.link.startsWith('MEETING|') && !d.link.startsWith('ACLE|') && yt === null && ig === null;
                });
                const videos = docsFoundByMonth.filter(d => {
                    const yt = getYoutubeId(d.link), ig = getInstagramId(d.link);
                    return (yt !== null || ig !== null) && !d.link.startsWith('MEETING|') && !d.link.startsWith('ACLE|');
                });
                const reuniones = docsFoundByMonth.filter(d => d.link.startsWith('MEETING|'));
                const acleItems = docsFoundByMonth.filter(d => d.link.startsWith('ACLE|'));

                // Construir resumen de tipos
                let summaryParts = [];
                if (circulares.length > 0) summaryParts.push(`📄 <strong>${circulares.length}</strong> circular${circulares.length > 1 ? 'es' : ''}`);
                if (videos.length > 0)     summaryParts.push(`🎬 <strong>${videos.length}</strong> video${videos.length > 1 ? 's' : ''}`);
                if (reuniones.length > 0)  summaryParts.push(`📅 <strong>${reuniones.length}</strong> reunión${reuniones.length > 1 ? 'es' : ''}`);
                if (acleItems.length > 0)  summaryParts.push(`⚽ <strong>${acleItems.length}</strong> taller${acleItems.length > 1 ? 'es' : ''} ACLE`);

                combinedResponse += `🔍 <strong>Para ${targetMonth} encontré ${docsFoundByMonth.length} elemento${docsFoundByMonth.length > 1 ? 's' : ''}:</strong><br>`;
                combinedResponse += `<div style="margin: 6px 0 10px; padding: 8px 12px; background: rgba(0,51,102,0.06); border-left: 3px solid var(--primary,#003366); border-radius: 6px; font-size: 0.88rem; line-height: 1.9;">`;
                combinedResponse += summaryParts.join('<br>');
                combinedResponse += `</div>`;

                // --- CARRUSEL DE DOCUMENTOS ---
                combinedResponse += `<div class="doc-carousel">`;
                docsFoundByMonth.forEach(d => {
                    combinedResponse += generateCarouselCard(d);
                });
                combinedResponse += `</div>`;
            } else {
                combinedResponse += `Aún no tengo nada registrado para ${targetMonth}. 😿<br><br>`;
            }
        }

        // --- 3. FAQ con Multi-Match (muestra varias coincidencias) ---
        const findAllMatches = (faqArray) => {
            const matches = [];
            faqArray.forEach(f => {
                let bestScore = 0;
                f.keywords.forEach(k => {
                    const cleanK = removeAccents(k.toLowerCase());
                    let score = 0;
                    if (processedQuery.includes(cleanK)) {
                        score = cleanK.length;
                    } else if (cleanK.includes(processedQuery) && processedQuery.length > 3) {
                        score = processedQuery.length;
                    }
                    if (score > bestScore) bestScore = score;
                });
                if (bestScore > 0) matches.push({ faq: f, score: bestScore });
            });
            // Ordenar por puntuación descendente
            matches.sort((a, b) => b.score - a.score);
            return matches;
        };

        const remoteMatches = findAllMatches(remoteFAQ);
        const localMatches = findAllMatches(CONFIG.FAQ);
        const allFAQMatches = [...remoteMatches, ...localMatches];

        let faqResponse = "";
        if (allFAQMatches.length > 0) {
            // Tomar las mejores coincidencias (máximo 20 para soportar listados extensos de talleres)
            const topMatches = allFAQMatches.slice(0, 20);
            topMatches.forEach((match, idx) => {
                const response = linkify(match.faq.response);
                faqResponse += response;
                if (idx < topMatches.length - 1) {
                    faqResponse += `<br><br>`;
                }
            });
            // Registrar en historial
            if (topMatches[0] && topMatches[0].faq.keywords) {
                conversationHistory.push(`❓ ${topMatches[0].faq.keywords[0]}`);
            }
        }

        // --- 4. Búsqueda de Documentos por TÍTULO ---
        if (docsFoundByMonth.length === 0 && documents.length > 0) {
            const queryWords = processedQuery.split(/\s+/).filter(w => w.length > 3);
            const matchingDocs = documents.filter(doc => {
                const cleanTitle = removeAccents(doc.title.toLowerCase());
                const matchCount = queryWords.filter(w => cleanTitle.includes(w)).length;
                const hasShortKeyMatch = queryWords.some(w => (w === 'acle' || w === 'taller') && cleanTitle.includes(w));
                return matchCount >= 2 || hasShortKeyMatch || queryWords.some(w => w.length > 5 && cleanTitle.includes(w));
            }).sort(compareDocs);

            if (matchingDocs.length > 0) {
                combinedResponse += combinedResponse ? `<br>` : '';
                combinedResponse += `📎 <strong>Resultados relacionados:</strong><br>`;
                combinedResponse += `<div class="doc-carousel">`;
                matchingDocs.forEach(d => {
                    combinedResponse += generateCarouselCard(d);
                });
                combinedResponse += `</div>`;
            }
        }

        // --- 5. Combinar FAQ + Documentos ---
        if (faqResponse) {
            let finalResponse = faqResponse;
            if (combinedResponse) {
                finalResponse += `<hr style="border:0; border-top:1px dashed #ccc; margin: 15px 0;">`;
                finalResponse += combinedResponse;
            }
            return { text: finalResponse };
        }

        if (combinedResponse) {
            return { text: combinedResponse };
        }

        // --- 6. Keywords Básicas con Fecha Dinámica ---
        if (processedQuery.includes('hola') || processedQuery.includes('buenos') || processedQuery.includes('saludos')) {
            const now = new Date();
            const hour = now.getHours();
            let greeting = '¡Hola';
            if (hour < 12) greeting = '¡Buenos días';
            else if (hour < 19) greeting = '¡Buenas tardes';
            else greeting = '¡Buenas noches';

            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const dayName = dayNames[now.getDay()];
            const isWeekend = (now.getDay() === 0 || now.getDay() === 6);
            const openInfo = isWeekend 
                ? `Hoy es ${dayName}, el liceo está cerrado. 🏚️` 
                : (now.getDay() === 5 
                    ? `Hoy es ${dayName}, el liceo atiende hasta las <strong>13:00 hrs</strong>. ⏰` 
                    : `Hoy es ${dayName}, el liceo atiende hasta las <strong>17:00 hrs</strong>. ⏰`);

            conversationHistory.push('👋 Saludo inicial');
            return { text: `${greeting}! Soy ${CONFIG.BOT_NAME}. 🐾<br><br>${openInfo}<br><br>¿Deseas consultar <strong>documentos</strong> del mes o tienes alguna duda?` };
        }

        if (processedQuery.includes('gracias') || processedQuery.includes('agradezco')) {
            return { text: "¡Un placer ayudarte! Miau... ✨" };
        }

        // --- 7. BÚsqueda Difusa (Fuzzy) antes del fallback ---
        const queryWords = q.split(/\s+/).filter(w => w.length >= 4);
        let fuzzyMatches = [];
        queryWords.forEach(word => {
            const matches = findFuzzyMatches(word);
            fuzzyMatches = fuzzyMatches.concat(matches);
        });
        fuzzyMatches = [...new Set(fuzzyMatches)]; // eliminar duplicados

        if (fuzzyMatches.length > 0) {
            let fuzzyHtml = `🤔 No encontré resultados, pero... <strong>¿quisiste decir?</strong><br><br>`;
            fuzzyMatches.forEach(suggestion => {
                fuzzyHtml += `<span class="fuzzy-suggestion" onclick="document.getElementById('chat-input').value='${suggestion}'; document.getElementById('send-chat').click();">${suggestion}</span> `;
            });
            return { text: fuzzyHtml };
        }

        // --- 8. Fallback final ---
        return { 
            text: `No estoy segura de entenderte... 🐾 pero puedo ayudarte con estos temas comunes:`,
            suggestions: ['Horarios de atención', 'Uso del uniforme', 'Dirección del liceo', 'Documentos Marzo']
        };
    }

    function processUserMessage(text) {
        showTypingIndicator();
        // Desactivar input mientras Simona procesa
        chatInput.disabled = true;
        setTimeout(() => {
            hideTypingIndicator();
            const result = simonaResponse(text);
            addMessage(result.text, false, result.suggestions || []);
            // Reactivar input y devolver foco
            chatInput.disabled = false;
            chatInput.value = '';
            scrollChatToBottom();
            // En móviles, refocus con delay para que el teclado no cierre
            setTimeout(() => {
                chatInput.focus();
                scrollChatToBottom();
            }, 100);
        }, 800);
    }

    chatTrigger.addEventListener('click', toggleChat);
    closeChat.addEventListener('click', toggleChat);

    sendChat.addEventListener('click', () => {
        const text = chatInput.value.trim();
        if (text && !chatInput.disabled) {
            addMessage(text, true);
            chatInput.value = '';
            processUserMessage(text);
        }
    });

    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Evitar comportamiento por defecto en móviles
            sendChat.click();
        }
    });

    // --- Greeting Proactive Dinámico ---
    function setupProactiveGreeting() {
        setTimeout(() => {
            if (chatContainer.classList.contains('active')) return;
            
            // Mensaje dinámico basado en documentos disponibles
            const now = new Date();
            const monthNames = ['', '', '', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
            const currentMonthName = monthNames[now.getMonth() + 1] || 'marzo';
            const docsThisMonth = documents.filter(d => d.month === currentMonthName);
            
            let greetingMsg = '';
            if (docsThisMonth.length > 0) {
                // Clasificación por tipo
                const circulares = docsThisMonth.filter(d => {
                    const yt = getYoutubeId(d.link), ig = getInstagramId(d.link);
                    return !d.link.startsWith('MEETING|') && !d.link.startsWith('ACLE|') && yt === null && ig === null;
                });
                const videos = docsThisMonth.filter(d => {
                    const yt = getYoutubeId(d.link), ig = getInstagramId(d.link);
                    return (yt !== null || ig !== null) && !d.link.startsWith('MEETING|') && !d.link.startsWith('ACLE|');
                });
                const reuniones = docsThisMonth.filter(d => d.link.startsWith('MEETING|'));
                const acleItems = docsThisMonth.filter(d => d.link.startsWith('ACLE|'));

                let parts = [];
                if (circulares.length > 0) parts.push(`<strong>${circulares.length}</strong> circular${circulares.length > 1 ? 'es' : ''}`);
                if (videos.length > 0)     parts.push(`<strong>${videos.length}</strong> video${videos.length > 1 ? 's' : ''}`);
                if (reuniones.length > 0)  parts.push(`<strong>${reuniones.length}</strong> reunión${reuniones.length > 1 ? 'es' : ''}`);
                if (acleItems.length > 0)  parts.push(`<strong>${acleItems.length}</strong> taller${acleItems.length > 1 ? 'es' : ''} ACLE`);

                // Unir partes con comas y "y" al final
                let breakdown = "";
                if (parts.length > 1) {
                    const last = parts.pop();
                    breakdown = parts.join(', ') + ' y ' + last;
                } else {
                    breakdown = parts[0];
                }

                greetingMsg = `¡Hola! Hay ${breakdown} de ${currentMonthName}. 🐾 <br>¿Quieres verlos?`;
            } else {
                greetingMsg = `¡Hola! Soy Simona. 🐾 ¿Tienes alguna duda sobre el liceo?`;
            }
            
            const bubble = document.createElement('div');
            bubble.className = 'proactive-bubble';
            bubble.innerHTML = greetingMsg;
            bubble.onclick = () => {
                bubble.remove();
                toggleChat();
            };
            document.body.appendChild(bubble);

            setTimeout(() => {
                if (bubble && bubble.parentNode) {
                    bubble.style.opacity = '0';
                    setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 600);
                }
            }, 10000);
        }, 8000);
    }

    // Exponer la función de abrir modal globalmente para el atributo onclick
    window.openVideoModal = openVideoModal;

    // Start App
    loadData();
    loadFAQData();
    setupProactiveGreeting();
});
