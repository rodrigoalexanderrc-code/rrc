        // ==========================================
        // 14. MANTENCIÓN Y REINICIO
        // ==========================================
        function cargarMantencionSelects() {
            const cursoSelect1 = document.getElementById('mantencionCursoSelect');
            const cursoSelect2 = document.getElementById('mantencionAlumnoCursoSelect');
            const cursoSelect3 = document.getElementById('mantencionVaciarCursoSelect');
            const alumnoSelect = document.getElementById('mantencionAlumnoSelect');

            const cursoOptions = '<option value="">Seleccione curso...</option>' +
                cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

            cursoSelect1.innerHTML = cursoOptions;
            cursoSelect2.innerHTML = cursoOptions;
            cursoSelect3.innerHTML = cursoOptions;
            alumnoSelect.innerHTML = '<option value="">Seleccione primero un curso...</option>';
        }

        function mantencionFiltrarAlumnosPorCurso() {
            const cursoIdStr = document.getElementById('mantencionAlumnoCursoSelect').value;
            const alumnoSelect = document.getElementById('mantencionAlumnoSelect');
            if (!cursoIdStr) {
                alumnoSelect.innerHTML = '<option value="">Seleccione primero un curso...</option>';
                return;
            }
            const cursoId = parseInt(cursoIdStr);
            const alumnosCurso = getAlumnosPorCurso(cursoId);
            if (alumnosCurso.length === 0) {
                alumnoSelect.innerHTML = '<option value="">Sin alumnos en este curso</option>';
            } else {
                alumnoSelect.innerHTML = '<option value="">Seleccione alumno...</option>' +
                    alumnosCurso.map(a => `<option value="${a.rut}">${a.nombre} (${a.rut})</option>`).join('');
            }
        }

        async function mantencionEliminarCurso() {
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }
            const cursoIdStr = document.getElementById('mantencionCursoSelect').value;
            if (!cursoIdStr) { showToast('Seleccione un curso para eliminar', 'warning'); return; }
            const cursoId = parseInt(cursoIdStr);
            const curso = cursos.find(c => c.id === cursoId);
            if (!curso) return;

            if (!confirm(`¿Está seguro de que desea eliminar el curso "${curso.nombre}"?\nEsta acción eliminará el curso y desvinculará todos sus alumnos de forma local y en la nube.`)) return;

            showToast(`Eliminando curso "${curso.nombre}"...`, 'info');
            await apiCall('delete', 'Cursos', null, cursoId);

            // Eliminar todos los alumnos de ese curso en Google Sheets
            const alumnosCurso = alumnos.filter(a => a.cursoId === cursoId);
            if (alumnosCurso.length > 0) {
                showToast(`Eliminando ${alumnosCurso.length} alumno(s) asociado(s) al curso...`, 'info');
                for (let i = 0; i < alumnosCurso.length; i++) {
                    await apiCall('delete', 'Alumnos', null, alumnosCurso[i].id);
                }
            }

            await fetchData();
            cargarMantencionSelects();
            actualizarDashboard();
            showToast(`Curso "${curso.nombre}" eliminado correctamente`, 'success');
        }

        async function mantencionEliminarAlumno() {
            const rut = document.getElementById('mantencionAlumnoSelect').value;
            if (!rut) { showToast('Seleccione un alumno para eliminar', 'warning'); return; }

            const alumno = alumnos.find(a => a.rut === rut);
            if (!alumno) return;

            await eliminarAlumno(rut);
            cargarMantencionSelects();
        }

        async function mantencionEliminarAlumnosDeCurso() {
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }
            const cursoIdStr = document.getElementById('mantencionVaciarCursoSelect').value;
            if (!cursoIdStr) { showToast('Seleccione un curso para vaciar sus alumnos', 'warning'); return; }
            const cursoId = parseInt(cursoIdStr);
            const curso = cursos.find(c => c.id === cursoId);
            if (!curso) return;

            const alumnosCurso = alumnos.filter(a => a.cursoId === cursoId);
            if (alumnosCurso.length === 0) { showToast(`El curso "${curso.nombre}" ya está vacío`, 'warning'); return; }

            if (!confirm(`⚠️ ¡ADVERTENCIA! ⚠️\n¿Está seguro de que desea eliminar a los ${alumnosCurso.length} alumnos del curso "${curso.nombre}"?\nEsta acción es irreversible.`)) return;

            showToast(`Eliminando alumnos de "${curso.nombre}"...`, 'info');
            const total = alumnosCurso.length;
            for (let i = 0; i < total; i++) {
                const a = alumnosCurso[i];
                showToast(`Eliminando alumno ${i + 1}/${total}: ${a.nombre}`, 'info');

                // Borrar de Alumnos
                await apiCall('delete', 'Alumnos', null, a.id);

                // Borrar de Comunicaciones Pendientes de este alumno
                const coms = comunicacionesPendientes.filter(c => c.estudiante && c.estudiante.trim().toLowerCase() === a.nombre.trim().toLowerCase());
                for (let c of coms) {
                    await apiCall('delete', 'Comunicaciones', null, c.id);
                }
            }

            await fetchData();
            cargarMantencionSelects();
            actualizarDashboard();
            showToast(`Se han eliminado todos los alumnos del curso "${curso.nombre}"`, 'success');
        }

        async function mantencionEliminarTodosCursos() {
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }
            if (cursos.length === 0) { showToast('No hay cursos para eliminar', 'warning'); return; }

            if (!confirm('⚠️ ¡ADVERTENCIA CRÍTICA! ⚠️\n¿Está seguro de que desea eliminar TODOS los cursos de la plataforma?\nEsto desvinculará a todos los alumnos.')) return;
            if (!confirm('Segunda Confirmación: ¿Realmente desea borrar todos los cursos de la base de datos?')) return;

            const total = cursos.length;
            showToast(`Eliminando ${total} cursos...`, 'info');
            for (let i = 0; i < total; i++) {
                const c = cursos[i];
                showToast(`Eliminando curso ${i + 1}/${total}: ${c.nombre}`, 'info');
                await apiCall('delete', 'Cursos', null, c.id);
            }

            await fetchData();
            cargarMantencionSelects();
            actualizarDashboard();
            showToast('Todos los cursos han sido eliminados', 'success');
        }

        async function limpiarAsistenciaEnNube() {
            setClearAttendanceOnNextFetch(true);
            limpiarEstadoAsistenciaLocal();

            try {
                const ok = await apiCall('delete', 'Asistencia', { clearAll: true, force: true, mode: 'bulk_clear' }, null);
                if (ok) return true;
            } catch (e) {
                console.warn('Intento principal de limpieza de Asistencia falló:', e);
            }

            try {
                const direct = await fetch(CONFIG.API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'delete', sheet: 'Asistencia', data: { clearAll: true, force: true, mode: 'bulk_clear' } })
                });
                const directResult = await direct.json();
                if (directResult && directResult.status === 'success') return true;
            } catch (e) {
                console.warn('Intento directo de limpieza de Asistencia falló:', e);
            }

            return false;
        }

        async function mantencionReiniciarBaseDatos() {
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }
            if (!confirm('🚨 ¡ALERTA DE SEGURIDAD MÁXIMA! 🚨\nEstá a punto de reiniciar por completo la base de datos para el inicio de año escolar.\nEsto eliminará permanentemente TODOS los cursos, alumnos, asistencia, alertas, historial, bitácora y comprobantes.')) return;
            if (!confirm('¿Confirma que desea borrar TODO para iniciar el año escolar limpio? Esta acción NO se puede deshacer y borrará toda la información, incluyendo la asistencia.')) return;

            const clave = prompt('Para confirmar esta acción extremadamente destructiva, escriba la palabra "REINICIAR" en mayúsculas:');
            if (clave !== 'REINICIAR') {
                showToast('Acción cancelada. La palabra clave no coincide.', 'error');
                return;
            }

            showToast('Iniciando reinicio completo del sistema...', 'warning');

            try {
                // Borrar masivamente en la nube usando el mecanismo bulk_clear
                showToast(`Limpiando Alumnos...`, 'warning');
                await apiCall('delete', 'Alumnos', { mode: 'bulk_clear' });
                
                showToast(`Limpiando Cursos...`, 'warning');
                await apiCall('delete', 'Cursos', { mode: 'bulk_clear' });
                
                showToast(`Limpiando Comunicaciones...`, 'warning');
                await apiCall('delete', 'Comunicaciones', { mode: 'bulk_clear' });
                
                showToast(`Limpiando Historial...`, 'warning');
                await apiCall('delete', 'Historial', { mode: 'bulk_clear' });
                
                showToast(`Limpiando Bitácora...`, 'warning');
                await apiCall('delete', 'Bitacora', { mode: 'bulk_clear' });
                
                showToast(`Limpiando Comprobantes...`, 'warning');
                await apiCall('delete', 'Comprobantes', { mode: 'bulk_clear' });
                
            } catch (err) {
                console.error("Error durante limpieza masiva: ", err);
                showToast("Hubo un error al contactar con Google para el borrado masivo.", "error");
            }

            // Intentar limpiar la pestaña de asistencia en la nube y vaciar el estado local
            showToast('Limpiando historial de asistencia...', 'warning');
            const asistenciaLimpia = await limpiarAsistenciaEnNube();
            asistenciaRegistros = [];
            limpiarEstadoAsistenciaLocal();

            showToast('Sincronizando cambios finales...', 'info');
            await fetchData();
            setClearAttendanceOnNextFetch(false);
            asistenciaRegistros = [];
            limpiarEstadoAsistenciaLocal();
            cargarMantencionSelects();
            actualizarDashboard();
            cargarListaAsistencia();

            if (asistenciaLimpia) {
                showToast('✅ Base de datos limpiada. La asistencia se borró exitosamente.', 'success');
                alert('Reinicio de Año Escolar completado con éxito.\\n\\nToda la información, incluyendo la asistencia, ha sido borrada.');
            } else {
                showToast('⚠️ Ocurrió un problema al limpiar la asistencia. Verifica la base de datos.', 'warning');
                alert('Reinicio de Año Escolar completado, pero puede que la asistencia no se haya borrado completamente. Por favor, verifica tu base de datos.');
            }
        }

        // ==========================================
        // 16. INICIALIZACIÓN Y RESTRICCIONES GLOBALES
        // ==========================================
        function aplicarRestriccionesFechasGlobales() {
            const currentYear = new Date().getFullYear();
            const minDate = `${currentYear}-03-01`;
            const maxDate = `${currentYear}-12-31`;
            const minMonth = `${currentYear}-03`;
            const maxMonth = `${currentYear}-12`;

            // Aplicar restricciones iniciales a los inputs existentes
            document.querySelectorAll('input[type="date"]').forEach(el => {
                el.min = minDate;
                el.max = maxDate;
            });
            document.querySelectorAll('input[type="month"]').forEach(el => {
                el.min = minMonth;
                el.max = maxMonth;
            });

            // Delegación de eventos para validar cambios en cualquier input de fecha o mes (incluso los creados dinámicamente)
            document.body.addEventListener('change', (e) => {
                if (e.target.tagName === 'INPUT') {
                    if (e.target.type === 'date') {
                        const fechaStr = e.target.value;
                        if (!fechaStr) return;
                        
                        const partes = fechaStr.split('-');
                        if (partes.length === 3) {
                            const y = parseInt(partes[0]);
                            const m = parseInt(partes[1]);
                            const d = parseInt(partes[2]);
                            
                            // Validar año y mes (Marzo a Diciembre del año actual)
                            if (m < 3 || m > 12 || y !== currentYear) {
                                if (typeof showToast === 'function') {
                                    showToast('El año escolar es de Marzo a Diciembre del año actual.', 'warning');
                                } else {
                                    alert('El año escolar es de Marzo a Diciembre del año actual.');
                                }
                                e.target.value = '';
                                return;
                            }
                            
                            // Validar fin de semana
                            const fecha = new Date(y, m - 1, d);
                            const dia = fecha.getDay();
                            if (dia === 0 || dia === 6) {
                                if (typeof showToast === 'function') {
                                    showToast('No se puede seleccionar sábado o domingo.', 'warning');
                                } else {
                                    alert('No se puede seleccionar sábado o domingo.');
                                }
                                e.target.value = '';
                            }
                        }
                    } else if (e.target.type === 'month') {
                        const val = e.target.value; // YYYY-MM
                        if (!val) return;
                        const partes = val.split('-');
                        if (partes.length === 2) {
                            const y = parseInt(partes[0]);
                            const m = parseInt(partes[1]);
                            
                            if (m < 3 || y !== currentYear) {
                                if (typeof showToast === 'function') {
                                    showToast('El año escolar comienza en Marzo del año actual.', 'warning');
                                } else {
                                    alert('El año escolar comienza en Marzo del año actual.');
                                }
                                e.target.value = `${currentYear}-03`;
                            }
                        }
                    }
                }
            });
        }

        function checkLockdownMode() {
            const date = new Date();
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const hoyStr = `${y}-${m}-${d}`;
            if (window.configuracionGlobal?.fecha_inicio_uso && hoyStr < window.configuracionGlobal.fecha_inicio_uso) {
                document.body.classList.add('lockdown-mode');
                const fArr = window.configuracionGlobal.fecha_inicio_uso.split('-');
                const fFormateada = `${fArr[2]}/${fArr[1]}/${fArr[0]}`;
                const banner = document.getElementById('lockdownBanner');
                if (banner) {
                    banner.innerHTML = `<i class="fas fa-lock"></i> <strong>MODO LECTOR (BLOQUEO TEMPORAL):</strong> La plataforma comenzará a operar oficialmente el ${fFormateada}. Hasta entonces, los módulos de registro están bloqueados.`;
                }
            } else {
                document.body.classList.remove('lockdown-mode');
            }
        }

        function renderAllUI() {
            checkLockdownMode();
            cargarSelectsAlumnos();
            cargarSelectsAsistencia();
            cargarSelectsPlanilla();
            actualizarDashboard();
            actualizarResumenDia();
            cargarCursos();
            cargarAlumnos();
            cargarListaAsistencia();
            cargarPlanillaAlertas();
            cargarComunicaciones();
            cargarBitacora();
            cargarComprobantes();
            
            if (typeof cargarCursosInformeAsist === 'function') {
                cargarCursosInformeAsist();
            }

            document.getElementById('pendientesBadge').textContent = comunicacionesPendientes.length;
            if (typeof actualizarBadgeInasistencias === 'function') actualizarBadgeInasistencias();
        }

        async function init() {
            aplicarRestriccionesFechasGlobales();
            actualizarEstadoConexion();
            if (localStorage.getItem(CLEAR_ATTENDANCE_FLAG_KEY) === '1') {
                setClearAttendanceOnNextFetch(true);
                limpiarEstadoAsistenciaLocal();
            }
            document.getElementById('fechaActual').textContent = new Date().toLocaleDateString('es-CL', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // TÉCNICA: Stale-While-Revalidate (Caché Frontend)
            const tieneBackup = loadFromLocalBackup();
            if (tieneBackup) {
                // 1. Mostrar instantáneamente los datos de ayer/hace rato
                renderAllUI();
                // 2. Buscar datos frescos silenciosamente en segundo plano
                fetchData(true).then(() => {
                    renderAllUI();
                    console.log('🔄 UI actualizada silenciosamente con datos frescos del servidor');
                });
            } else {
                // Si es la primera vez en la vida que abre, debe esperar el Loading
                await fetchData();
                renderAllUI();
            }

            // Medición de inactividad
            let ultimaActividad = Date.now();
            ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'].forEach(evt => {
                window.addEventListener(evt, () => { ultimaActividad = Date.now(); });
            });

            // Sincronización silenciosa cada 5 minutos (300000 ms) condicionada a inactividad
            setInterval(async () => {
                const minutosInactivo = (Date.now() - ultimaActividad) / 60000;
                const modalAbierto = document.querySelector('.modal.active') !== null;
                const guardando = pendingRequests > 0;

                // Sincronizar solo si lleva >= 3 minutos inactivo, sin modales abiertos y sin guardados en cola
                if (minutosInactivo >= 3 && !modalAbierto && !guardando) {
                    console.log('🔄 Detectada inactividad. Iniciando actualización automática de datos...');
                    await fetchData(true); // silent = true
                    actualizarDashboard();
                    actualizarResumenDia();
                    cargarComunicaciones();
                    cargarBitacora();
                    document.getElementById('pendientesBadge').textContent = comunicacionesPendientes.length;
                    if (typeof actualizarBadgeInasistencias === 'function') actualizarBadgeInasistencias();

                    // Refrescar el panel que esté viendo el usuario en este momento
                    const panelActivo = document.querySelector('.panel.active');
                    if (panelActivo) {
                        const panelId = panelActivo.id.replace('panel-', '');
                        const refrescadores = {
                            dashboard: () => { actualizarDashboard(); actualizarResumenDia(); },
                            cursos: cargarCursos,
                            alumnos: () => { cargarAlumnos(); },
                            asistencia: () => { cargarListaAsistencia(); },
                            'planilla-alertas': () => { cargarPlanillaAlertas(); },
                            comunicacion: cargarComunicaciones,
                            bitacora: cargarBitacora,
                            'asistente-social': cargarAsistenteSocial,
                            comprobantes: cargarComprobantes,
                        };
                        if (refrescadores[panelId]) {
                            refrescadores[panelId]();
                            console.log(`👁️ Panel "${panelId}" refrescado con datos nuevos.`);
                        }
                    }
                }
            }, 300000);

            console.log('🚀 EduAsist v3.0 inicializado con Google Sheets');
        }

        document.addEventListener('DOMContentLoaded', init);
