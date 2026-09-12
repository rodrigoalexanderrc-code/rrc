        // ==========================================
        // 3. COMUNICACIÓN CON GOOGLE SHEETS
        // ==========================================
        async function fetchData(silent = false) {
            if (!silent) {
                document.getElementById('pageTitle').textContent = "Cargando datos...";
                document.getElementById('pageSubtitle').textContent = "Conectando con la Base de Datos...";
            }
            updateDbStatus('syncing');
            try {
                const response = await fetch(CONFIG.API_URL);
                const result = await response.json();
                if (result.status === 'success') {
                    cursos = sanitizeRows(result.data.cursos || []);
                    alumnos = sanitizeRows(result.data.alumnos || []).map(a => {
                        if (a.nombre) a.nombre = window.formatearNombreApellidos(a.nombre);
                        return a;
                    });

                    if (result.data.configuracion) {
                        const configRows = sanitizeRows(result.data.configuracion);
                        const c = {};
                        configRows.forEach(row => {
                            if (row.id) c[row.id] = parseInt(row.valor) || 0;
                        });
                        
                        // Merge with existing configuration to not lose defaults if missing
                        window.configuracionGlobal = {
                            ...window.configuracionGlobal,
                            riesgo_critico: c.riesgo_critico || window.configuracionGlobal?.riesgo_critico || 75,
                            riesgo_medio: c.riesgo_medio || window.configuracionGlobal?.riesgo_medio || 85,
                            semaforo_excelente: c.semaforo_excelente || window.configuracionGlobal?.semaforo_excelente || 95,
                            semaforo_precaucion: c.semaforo_precaucion || window.configuracionGlobal?.semaforo_precaucion || 90,
                            alerta_ausencias_consecutivas: c.alerta_ausencias_consecutivas || window.configuracionGlobal?.alerta_ausencias_consecutivas || 3,
                            dias_grafico_tendencia: c.dias_grafico_tendencia || window.configuracionGlobal?.dias_grafico_tendencia || 5,
                            anio_lectivo: c.anio_lectivo || window.configuracionGlobal?.anio_lectivo || "",
                            fecha_inicio_uso: (result.data.configuracion && result.data.configuracion.find(r => r.id === 'fecha_inicio_uso')?.valor) || window.configuracionGlobal?.fecha_inicio_uso || ""
                        };
                    }

                    const suppressAttendanceHydration = window.__clearAttendanceOnNextFetch === true || localStorage.getItem(CLEAR_ATTENDANCE_FLAG_KEY) === '1';
                    if (suppressAttendanceHydration) {
                        asistenciaRegistros = [];
                    } else {
                        const flatAsistencia = sanitizeRows(result.data.asistencia || []);
                        const groupedAsistencia = {};
                        flatAsistencia.forEach(row => {
                            if (!row.alumno || !row.fecha) return; // Omitir filas corruptas o vacías
                            let rawF = row.fecha ? row.fecha.toString().split('T')[0] : '';
                            let f = normalizeDate(rawF);
                            if (!f) return; // Omitir si el formateo de fecha falla
                            
                            // Ignorar todos los registros previos a la fecha de inicio oficial (si existe)
                            if (window.configuracionGlobal?.fecha_inicio_uso && f < window.configuracionGlobal.fecha_inicio_uso) {
                                return;
                            }
                            const key = `${row.cursoId}_${f}`;
                            if (!groupedAsistencia[key]) groupedAsistencia[key] = { cursoId: parseInt(row.cursoId), fecha: f, registros: [] };

                            const regList = groupedAsistencia[key].registros;
                            const canonAlumno = alumnos.find(a => {
                                const mainMatch = normalizeSearchText(a.nombre) === normalizeSearchText(row.alumno);
                                if (mainMatch) return true;
                                if (a.nombresAnteriores) {
                                    const pastNames = a.nombresAnteriores.split(',').map(n => normalizeSearchText(n));
                                    return pastNames.includes(normalizeSearchText(row.alumno));
                                }
                                return false;
                            });
                            const canonicalName = canonAlumno ? canonAlumno.nombre : row.alumno;
                            if (parseInt(row.cursoId) === 0) {
                                // Para día sin clases (cursoId === 0), la última fila en la base de datos sobrescribe el estado del día entero.
                                // Esto evita duplicidad acumulativa entre estado 'suspendido' y 'activo' al habilitar/suspender clases repetidamente.
                                groupedAsistencia[key].registros = [{ alumno: canonicalName, estado: row.estado, fecha: f }];
                            } else {
                                const existingIdx = regList.findIndex(r => r.alumno.trim().toLowerCase() === canonicalName.trim().toLowerCase());
                                if (existingIdx > -1) {
                                    regList[existingIdx].estado = row.estado; // Sobreescribir con el último estado
                                } else {
                                    regList.push({ alumno: canonicalName, estado: row.estado, fecha: f });
                                }
                            }
                        });
                        asistenciaRegistros = Object.values(groupedAsistencia);
                    }

                    let crudas = sanitizeRows(result.data.comunicaciones || []);
                    crudas.forEach(c => c.id = (c.id !== undefined && c.id !== null && c.id !== "") ? (parseInt(c.id) || 0) : 0);

                    // Filtrar duplicados en el mismo listado, pero conservar entradas aunque aún no
                    // exista un alumno con nombre exacto en la tabla de alumnos. Esto evita ocultar
                    // alertas que sí llegaron desde la fuente remota y que el usuario debería ver.
                    const unicos = [];
                    const vistos = new Set();
                    for (const c of crudas) {
                        if (c.estudiante) {
                            if (c.motivo && c.motivo.includes('Asistencia Anual: 0.0%')) continue; // Eliminar alertas fantasma
                            const nombreNorm = c.estudiante.trim().toLowerCase();
                            if (!vistos.has(nombreNorm)) {
                                vistos.add(nombreNorm);
                                unicos.push(c);
                            }
                        }
                    }
                    comunicacionesPendientes = unicos;
                    comunicacionesHistorial = sanitizeRows(result.data.historial || []);
                    comunicacionesHistorial.forEach(h => h.id = (h.id !== undefined && h.id !== null && h.id !== "") ? (parseInt(h.id) || 0) : 0);
                    comunicacionesHistorial.reverse(); // Mostrar del más reciente al más antiguo
                    const _allBitacora = sanitizeRows(result.data.bitacora || []);
                    window.semanasMesGlobal = _allBitacora.filter(b => b.estudiante === 'MATRIZ_SEMANAL');
                    bitacoraLlamadas = _allBitacora.filter(b => b.estudiante !== 'MATRIZ_SEMANAL');
                    comprobantes = sanitizeRows(result.data.comprobantes || []);

                    cursos.forEach(c => c.id = parseInt(c.id) || 0);
                    alumnos.forEach(a => {
                        a.id = parseInt(a.id) || 0;
                        a.cursoId = parseInt(a.cursoId) || 0;
                    });
                    bitacoraLlamadas.forEach(b => b.id = parseInt(b.id) || 0);
                    comprobantes.forEach(c => c.id = parseInt(c.id) || 0);

                    sanitizeDataModel();

                    nextCursoId = cursos.length > 0 ? Math.max(...cursos.map(c => c.id)) + 1 : 1;
                    nextAlumnoId = alumnos.length > 0 ? Math.max(...alumnos.map(a => a.id)) + 1 : 1;
                    nextBitacoraId = _allBitacora.length > 0 ? Math.max(..._allBitacora.map(b => parseInt(b.id) || 0)) + 1 : 1;
                    nextComprobanteId = comprobantes.length > 0 ? Math.max(...comprobantes.map(c => c.id)) + 1 : 1;
                    nextComunicacionId = crudas.length > 0 ? Math.max(...crudas.map(c => c.id)) + 1 : 1;
                    nextHistorialId = comunicacionesHistorial.length > 0 ? Math.max(...comunicacionesHistorial.map(h => h.id || 0)) + 1 : 1;

                    updateDbStatus('connected');
                    saveToLocalBackup(); // Respaldar datos tras carga exitosa
                    try { cambiarFiltroInforme(); } catch(e) {}
                    // Procesar cola offline si hay operaciones pendientes
                    if (offlineQueue.length > 0) await processOfflineQueue();
                } else {
                    showToast("Error al cargar datos", "error");
                    updateDbStatus('error');
                }
            } catch (err) {
                console.error(err);
                if (window.__clearAttendanceOnNextFetch === true) {
                    asistenciaRegistros = [];
                    limpiarEstadoAsistenciaLocal();
                    showToast('🧹 Se limpió localmente la asistencia para evitar que el respaldo recargue los registros viejos.', 'info');
                    updateDbStatus('connected');
                    return;
                }
                showToast("Error de conexión", "error");
                updateDbStatus('error');
                // Intentar cargar desde backup local
                if (loadFromLocalBackup()) {
                    showToast('📦 Datos cargados desde respaldo local', 'info');
                }
            }
            if (!silent) {
                document.getElementById('pageTitle').textContent = "Dashboard";
                document.getElementById('pageSubtitle').textContent = "Vista general del sistema";
            }
        }

        async function apiCall(action, sheet, payloadData, id = null, silent = false) {
            if ((id === null || id === undefined || id === "") && payloadData && (payloadData.id !== undefined && payloadData.id !== null && payloadData.id !== "")) {
                id = payloadData.id;
            }
            pendingRequests++;
            updateDbStatus('syncing');
            try {
                if (!silent) showToast("Guardando en base de datos...", "info");

                // Sanitizar para evitar #ERROR! en Google Sheets con signos + y =
                let sanitizedData;
                if (Array.isArray(payloadData)) {
                    sanitizedData = payloadData.map(item => {
                        const sanitizedItem = { ...item };
                        for (let key in sanitizedItem) {
                            if (typeof sanitizedItem[key] === 'string' && (sanitizedItem[key].startsWith('+') || sanitizedItem[key].startsWith('='))) {
                                sanitizedItem[key] = "'" + sanitizedItem[key];
                            }
                        }
                        return sanitizedItem;
                    });
                } else if (payloadData && typeof payloadData === 'object') {
                    sanitizedData = { ...payloadData };
                    for (let key in sanitizedData) {
                        if (typeof sanitizedData[key] === 'string' && (sanitizedData[key].startsWith('+') || sanitizedData[key].startsWith('='))) {
                            sanitizedData[key] = "'" + sanitizedData[key];
                        }
                    }
                } else {
                    sanitizedData = payloadData;
                }

                const body = { action, sheet, data: sanitizedData };
                if (id !== null && id !== undefined && id !== "") body.id = id;

                const response = await fetch(CONFIG.API_URL, {
                    method: 'POST',
                    body: JSON.stringify(body)
                });
                const result = await response.json();
                if (result.status === 'success') {
                    if (!silent) showToast("✅ Guardado correctamente", "success");
                    saveToLocalBackup(); // Respaldar datos localmente tras éxito
                    return true;
                } else {
                    showToast("Error al guardar. Se guardará localmente para reenviar.", "warning");
                    addToOfflineQueue(action, sheet, sanitizedData, id);
                    return false;
                }
            } catch (err) {
                showToast("⚠️ Sin conexión. Operación guardada localmente.", "warning");
                // Guardar en cola offline para reenviar después
                let sanitizedData = payloadData;
                if (Array.isArray(payloadData)) {
                    sanitizedData = payloadData.map(item => {
                        const s = { ...item };
                        for (let k in s) { if (typeof s[k] === 'string' && (s[k].startsWith('+') || s[k].startsWith('='))) s[k] = "'" + s[k]; }
                        return s;
                    });
                } else if (payloadData && typeof payloadData === 'object') {
                    sanitizedData = { ...payloadData };
                    for (let k in sanitizedData) { if (typeof sanitizedData[k] === 'string' && (sanitizedData[k].startsWith('+') || sanitizedData[k].startsWith('='))) sanitizedData[k] = "'" + sanitizedData[k]; }
                }
                addToOfflineQueue(action, sheet, sanitizedData, id);
                return false;
            } finally {
                pendingRequests--;
                if (pendingRequests === 0) updateDbStatus(navigator.onLine ? 'connected' : 'error');
            }
        }

        async function fetchHistoryFull() {
            showToast("Cargando historial completo (todo el año)... esto tomará unos segundos.", "info");
            updateDbStatus('syncing');
            try {
                const response = await fetch(CONFIG.API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'fetch_history_full', sheet: '', data: {} })
                });
                const res = await response.json();
                if (res.status === 'success' && res.result) {
                    
                    const fullAsistencia = sanitizeRows(res.result.asistencia || []);
                    const groupedAsistencia = {};
                    fullAsistencia.forEach(row => {
                        if (!row.alumno || !row.fecha) return; 
                        let rawF = row.fecha ? row.fecha.toString().split('T')[0] : '';
                        let f = normalizeDate(rawF);
                        if (!f) return; 
                        const key = `${row.cursoId}_${f}`;
                        if (!groupedAsistencia[key]) groupedAsistencia[key] = { cursoId: parseInt(row.cursoId), fecha: f, registros: [] };
                        const regList = groupedAsistencia[key].registros;
                        const canonAlumno = alumnos.find(a => {
                            const mainMatch = normalizeSearchText(a.nombre) === normalizeSearchText(row.alumno);
                            if (mainMatch) return true;
                            if (a.nombresAnteriores) {
                                const pastNames = a.nombresAnteriores.split(',').map(n => normalizeSearchText(n));
                                return pastNames.includes(normalizeSearchText(row.alumno));
                            }
                            return false;
                        });
                        const canonicalName = canonAlumno ? canonAlumno.nombre : row.alumno;
                        if (parseInt(row.cursoId) === 0) {
                            groupedAsistencia[key].registros = [{ alumno: canonicalName, estado: row.estado, fecha: f }];
                        } else {
                            const existingIdx = regList.findIndex(r => r.alumno.trim().toLowerCase() === canonicalName.trim().toLowerCase());
                            if (existingIdx > -1) {
                                regList[existingIdx].estado = row.estado;
                            } else {
                                regList.push({ alumno: canonicalName, estado: row.estado, fecha: f });
                            }
                        }
                    });
                    asistenciaRegistros = Object.values(groupedAsistencia);

                    comunicacionesHistorial = sanitizeRows(res.result.historial || []);
                    comunicacionesHistorial.forEach(h => h.id = (h.id !== undefined && h.id !== null && h.id !== "") ? (parseInt(h.id) || 0) : 0);
                    comunicacionesHistorial.reverse(); 

                    const _allBitacora2 = sanitizeRows(res.result.bitacora || []);
                    window.semanasMesGlobal = _allBitacora2.filter(b => b.estudiante === 'MATRIZ_SEMANAL');
                    bitacoraLlamadas = _allBitacora2.filter(b => b.estudiante !== 'MATRIZ_SEMANAL');
                    bitacoraLlamadas.forEach(b => b.id = parseInt(b.id) || 0);

                    sanitizeDataModel();
                    
                    // Update UI
                    if (typeof cargarListaAsistencia === 'function') cargarListaAsistencia();
                    if (typeof cargarBitacora === 'function') cargarBitacora();
                    if (typeof actualizarDashboard === 'function') { actualizarDashboard(); actualizarResumenDia(); }
                    
                    showToast("Historial completo cargado exitosamente.", "success");
                    updateDbStatus('connected');
                } else {
                    showToast("Error al cargar historial completo.", "error");
                    updateDbStatus('error');
                }
            } catch (err) {
                console.error(err);
                showToast("Error de conexión al cargar historial.", "error");
                updateDbStatus('error');
            }
        }
