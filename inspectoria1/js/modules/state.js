        // ==========================================
        // 1. DATOS GLOBALES
        // ==========================================

        let cursos = [];
        let alumnos = [];
        let asistenciaRegistros = [];
        let comunicacionesHistorial = [];
        let comunicacionesPendientes = [];
        let bitacoraLlamadas = [];
        let comprobantes = [];
        let excelData = [];
        window.configuracionGlobal = {
            riesgo_medio: 85,
            riesgo_critico: 75,
            semaforo_excelente: 95,
            semaforo_precaucion: 90,
            alerta_ausencias_consecutivas: 3,
            dias_grafico_tendencia: 5,
            anio_lectivo: ""
        };
        
        // Chart.js instances
        let chartAsistenciaDia = null;
        let chartAusentismoCursos = null;
        let chartContactoProgreso = null;
        let chartSemaforoAsistencia = null;
        let chartTendenciaSemanal = null;

        let nextCursoId = 1;
        let nextAlumnoId = 1;
        let nextBitacoraId = 1;
        let nextComprobanteId = 1;
        let nextComunicacionId = 1;
        let nextHistorialId = 1;

        let pendingRequests = 0;
        let offlineQueue = JSON.parse(localStorage.getItem('eduasist_offline_queue') || '[]');
        const CLEAR_ATTENDANCE_FLAG_KEY = 'eduasist_clear_attendance_next_fetch';

        function setClearAttendanceOnNextFetch(value) {
            window.__clearAttendanceOnNextFetch = !!value;
            if (value) {
                localStorage.setItem(CLEAR_ATTENDANCE_FLAG_KEY, '1');
            } else {
                localStorage.removeItem(CLEAR_ATTENDANCE_FLAG_KEY);
            }
        }

        function hasSuspiciousContent(value) {
            if (typeof value !== 'string') return false;
            return /(<\s*(script|img|svg|iframe|a|button|input|form)|javascript:|on[a-z]+\s*=|window\.|document\.|eval\(|alert\s*\(|prompt\s*\()/i.test(value);
        }

        function sanitizeDisplayValue(value) {
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') {
                if (hasSuspiciousContent(value)) {
                    return '[Contenido bloqueado por seguridad]';
                }
                const withoutScripts = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
                const withoutTags = withoutScripts.replace(/<[^>]*>/g, ' ');
                return withoutTags
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;')
                    .trim();
            }
            if (Array.isArray(value)) return value.map(item => sanitizeDisplayValue(item));
            if (typeof value === 'object') {
                const copy = {};
                Object.keys(value).forEach(key => {
                    copy[key] = sanitizeDisplayValue(value[key]);
                });
                return copy;
            }
            return value;
        }

        function sanitizeRows(rows) {
            const safeRows = [];
            for (const item of (rows || [])) {
                const sanitized = sanitizeDisplayValue(item);
                if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) continue;
                const hasBlockedValue = Object.values(sanitized).some(value => {
                    return typeof value === 'string' && value === '[Contenido bloqueado por seguridad]';
                });
                if (!hasBlockedValue) safeRows.push(sanitized);
            }
            return safeRows;
        }

        function sanitizeDataModel() {
            cursos = sanitizeRows(cursos);
            alumnos = sanitizeRows(alumnos);
            asistenciaRegistros = sanitizeRows(asistenciaRegistros);
            comunicacionesPendientes = sanitizeRows(comunicacionesPendientes);
            comunicacionesHistorial = sanitizeRows(comunicacionesHistorial);
            bitacoraLlamadas = sanitizeRows(bitacoraLlamadas);
            comprobantes = sanitizeRows(comprobantes);
        }

        // --- SISTEMA DE RESPALDO LOCAL ---
        function saveToLocalBackup() {
            try {
                const backup = {
                    timestamp: new Date().toISOString(),
                    cursos, alumnos, asistenciaRegistros,
                    comunicacionesPendientes, comunicacionesHistorial,
                    bitacoraLlamadas, comprobantes, configuracionGlobal: window.configuracionGlobal
                };
                localStorage.setItem('eduasist_backup', JSON.stringify(backup));
            } catch (e) { console.warn('No se pudo guardar backup local:', e); }
        }

        function loadFromLocalBackup() {
            try {
                const raw = localStorage.getItem('eduasist_backup');
                if (!raw) return false;
                const backup = JSON.parse(raw);
                cursos = backup.cursos || [];
                alumnos = backup.alumnos || [];
                asistenciaRegistros = backup.asistenciaRegistros || [];
                comunicacionesPendientes = backup.comunicacionesPendientes || [];
                comunicacionesHistorial = backup.comunicacionesHistorial || [];
                bitacoraLlamadas = backup.bitacoraLlamadas || [];
                comprobantes = backup.comprobantes || [];
                if (backup.configuracionGlobal) {
                    window.configuracionGlobal = backup.configuracionGlobal;
                }
                sanitizeDataModel();
                return true;
            } catch (e) { return false; }
        }

        function limpiarEstadoAsistenciaLocal() {
            try {
                asistenciaRegistros = [];
                offlineQueue = [];
                localStorage.setItem('eduasist_offline_queue', '[]');
                const backup = {
                    timestamp: new Date().toISOString(),
                    cursos,
                    alumnos,
                    asistenciaRegistros,
                    comunicacionesPendientes,
                    comunicacionesHistorial,
                    bitacoraLlamadas,
                    comprobantes,
                    configuracionGlobal: window.configuracionGlobal
                };
                localStorage.setItem('eduasist_backup', JSON.stringify(backup));
            } catch (e) {
                console.warn('No se pudo limpiar el estado local de asistencia:', e);
            }
        }

        function addToOfflineQueue(action, sheet, data, id) {
            offlineQueue.push({ action, sheet, data, id, timestamp: new Date().toISOString(), retries: 0 });
            localStorage.setItem('eduasist_offline_queue', JSON.stringify(offlineQueue));
        }

        async function processOfflineQueue() {
            if (offlineQueue.length === 0) return;
            // Filtrar y limpiar operaciones que ya superaron los 3 reintentos antes de empezar
            offlineQueue = offlineQueue.filter(op => (op.retries || 0) < 3);
            if (offlineQueue.length === 0) {
                localStorage.setItem('eduasist_offline_queue', '[]');
                return;
            }

            showToast(`🔄 Reenviando ${offlineQueue.length} operación(es) pendiente(s)...`, 'info');
            const queueCopy = [...offlineQueue];
            offlineQueue = [];
            localStorage.setItem('eduasist_offline_queue', '[]');

            for (const op of queueCopy) {
                try {
                    const body = { action: op.action, sheet: op.sheet, data: op.data };
                    if (op.id !== undefined && op.id !== null && op.id !== "") body.id = op.id;
                    const response = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(body) });
                    const result = await response.json();
                    
                    if (result.status !== 'success') {
                        op.retries = (op.retries || 0) + 1;
                        if (op.retries < 3) {
                            offlineQueue.push(op);
                        } else {
                            console.warn("Operación descartada por servidor (rechazada 3 veces):", op);
                        }
                    }
                } catch (err) {
                    op.retries = (op.retries || 0) + 1;
                    if (op.retries < 5) {
                        offlineQueue.push(op);
                    } else {
                        console.warn("Operación descartada por falta de red (reintentada 5 veces):", op);
                    }
                }
            }
            localStorage.setItem('eduasist_offline_queue', JSON.stringify(offlineQueue));
            if (offlineQueue.length === 0) {
                showToast('✅ Todas las operaciones pendientes se sincronizaron', 'success');
            } else {
                showToast(`⚠️ Aún quedan ${offlineQueue.length} operación(es) por sincronizar`, 'warning');
            }
        }

        function actualizarEstadoConexion() {
            if (navigator.onLine) {
                document.body.classList.remove('modo-offline');
            } else {
                document.body.classList.add('modo-offline');
            }
        }

        // Detectar cuando vuelve la conexión a Internet
        window.addEventListener('online', async () => {
            showToast('🌐 Conexión restablecida. Sincronizando...', 'success');
            actualizarEstadoConexion();
            updateDbStatus('syncing');
            await processOfflineQueue();
            await fetchData(true);
            actualizarDashboard();
            actualizarResumenDia();
            cargarComunicaciones();
            cargarSelects();
            renderStats();
            updateDbStatus('connected');
        });

        window.addEventListener('offline', () => {
            showToast('⚠️ Sin conexión a Internet. Los datos se guardarán localmente.', 'warning');
            actualizarEstadoConexion();
            updateDbStatus('error');
        });

        function updateDbStatus(status) {
            const ind = document.getElementById('dbStatusIndicator');
            if (!ind) return;
            if (status === 'syncing') {
                ind.style.background = '#fef3c7'; ind.style.color = '#92400e';
                ind.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sincronizando...';
            } else if (status === 'connected') {
                ind.style.background = '#dcfce7'; ind.style.color = '#166534';
                ind.innerHTML = '<i class="fas fa-check-circle"></i> Conectado';
            } else if (status === 'error') {
                ind.style.background = '#fee2e2'; ind.style.color = '#991b1b';
                ind.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error de Red';
            }
        }

        window.addEventListener('beforeunload', function (e) {
            if (pendingRequests > 0) {
                e.preventDefault();
                e.returnValue = 'Aún hay datos guardándose en la nube. ¿Seguro que deseas salir sin esperar?';
            }
        });


