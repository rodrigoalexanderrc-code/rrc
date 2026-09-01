        window.normalizeSearchText = function(text) {
            if (!text) return '';
            return text.toString().toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        };

        window.removeAccents = function(text) {
            if (!text) return '';
            return text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        };

        window.formatearNombreApellidos = function(nombreCompleto) {
            if (!nombreCompleto) return '';
            let nombre = nombreCompleto.trim().toUpperCase();
            if (nombre.includes(',')) return nombre; // Ya está formateado
            
            let parts = nombre.split(' ').filter(p => p.trim() !== '');
            if (parts.length >= 3) {
                // Asumimos 2 apellidos al final
                let apellidos = parts.slice(-2).join(' ');
                let nombres = parts.slice(0, -2).join(' ');
                return `${apellidos}, ${nombres}`;
            } else if (parts.length === 2) {
                return `${parts[1]}, ${parts[0]}`;
            }
            return nombre;
        };


        function esDiaSinClases(fecha) {
            return asistenciaRegistros && asistenciaRegistros.some(r => r.cursoId === 0 && r.fecha === fecha && r.registros.some(reg => reg.estado === 'suspendido'));
        }

        function obtenerMotivoDiaSinClases(fecha) {
            const record = asistenciaRegistros && asistenciaRegistros.find(r => r.cursoId === 0 && r.fecha === fecha);
            if (record && record.registros && record.registros.length > 0) {
                const reg = record.registros.find(rg => rg.estado === 'suspendido');
                if (reg && reg.alumno) {
                    return reg.alumno.replace(/^SUSPENDIDO:\s*/, '');
                }
            }
            return "Feriado / Suspensión de clases";
        }

        function actualizarBotonSuspension(estaSuspendido) {
            const btn = document.getElementById('btnSuspenderClases');
            const fecha = document.getElementById('asistenciaFecha').value;
            if (!btn) return;
            
            if (!fecha) {
                btn.style.display = 'none';
                return;
            }
            
            btn.style.display = 'inline-flex';
            if (estaSuspendido) {
                btn.innerHTML = '<i class="fas fa-calendar-check"></i> Habilitar Clases';
                btn.style.backgroundColor = 'var(--success)';
                btn.style.color = 'white';
            } else {
                btn.innerHTML = '<i class="fas fa-calendar-times"></i> Suspender Clases';
                btn.style.backgroundColor = 'var(--danger)';
                btn.style.color = 'white';
            }
        }

        async function toggleDiaSinClases() {
            const fecha = document.getElementById('asistenciaFecha').value;
            if (!fecha) {
                showToast('Debe seleccionar una fecha para suspender/habilitar clases.', 'warning');
                return;
            }
            
            const suspendidoActualmente = esDiaSinClases(fecha);
            
            if (suspendidoActualmente) {
                if (!confirm(`¿Está seguro de que desea reactivar las clases para el día ${fecha.split('-').reverse().join('/')}? Esto restablecerá las planillas de asistencia y alertas.`)) {
                    return;
                }
                
                const payloadArray = [{ cursoId: 0, fecha: fecha, alumno: "TODOS", estado: "activo" }];
                
                const indexReg = asistenciaRegistros.findIndex(r => r.cursoId === 0 && r.fecha === fecha);
                if (indexReg > -1) {
                    asistenciaRegistros[indexReg].registros = [{ alumno: "TODOS", estado: "activo", fecha }];
                } else {
                    asistenciaRegistros.push({ cursoId: 0, fecha, registros: [{ alumno: "TODOS", estado: "activo", fecha }] });
                }
                
                showToast('Guardando cambios en base de datos...', 'info');
                await apiCall('bulk_insert', 'Asistencia', payloadArray);
                showToast('✅ Clases reactivadas con éxito.', 'success');
                
                actualizarDashboard();
                actualizarResumenDia();
                cargarListaAsistencia();
                if (typeof actualizarBadgeInasistencias === 'function') actualizarBadgeInasistencias();
            } else {
                const motivo = prompt(`Ingrese el motivo de la suspensión de clases para el día ${fecha.split('-').reverse().join('/')}:\n(Ej: Feriado, Día del Profesor, Catástrofe, etc.)`);
                if (motivo === null) return;
                
                const motivoFinal = motivo.trim() || 'Suspensión extraordinaria';
                
                if (!confirm(`¿Está seguro de que desea marcar el día ${fecha.split('-').reverse().join('/')} como SIN CLASES?\nMotivo: "${motivoFinal}"\n\nEsto desactivará las alertas y estadísticas de este día.`)) {
                    return;
                }
                
                const payloadArray = [{ cursoId: 0, fecha: fecha, alumno: `SUSPENDIDO: ${motivoFinal}`, estado: "suspendido" }];
                
                const indexReg = asistenciaRegistros.findIndex(r => r.cursoId === 0 && r.fecha === fecha);
                if (indexReg > -1) {
                    asistenciaRegistros[indexReg].registros = [{ alumno: `SUSPENDIDO: ${motivoFinal}`, estado: "suspendido", fecha }];
                } else {
                    asistenciaRegistros.push({ cursoId: 0, fecha, registros: [{ alumno: `SUSPENDIDO: ${motivoFinal}`, estado: "suspendido", fecha }] });
                }
                
                showToast('Guardando suspensión en base de datos...', 'info');
                await apiCall('bulk_insert', 'Asistencia', payloadArray);
                showToast('✅ Clases suspendidas con éxito.', 'success');
                
                actualizarDashboard();
                actualizarResumenDia();
                cargarListaAsistencia();
                if (typeof actualizarBadgeInasistencias === 'function') actualizarBadgeInasistencias();
            }
        }

        function validarRut(rutCompleto) {
            if (!/^\d{7,9}-[0-9Kk]$/.test(rutCompleto)) return false;
            let [cuerpo, dv] = rutCompleto.replace(/\./g, '').split('-');
            dv = dv.toUpperCase();

            // Omitir validación matemática si es RUT provisorio de educación (IPE o IPA)
            if (cuerpo.startsWith('100') || cuerpo.startsWith('200')) {
                return true;
            }

            let suma = 0;
            let multiplo = 2;

            for (let i = 1; i <= cuerpo.length; i++) {
                suma += multiplo * parseInt(cuerpo.charAt(cuerpo.length - i));
                multiplo = multiplo < 7 ? multiplo + 1 : 2;
            }

            let dvEsperado = 11 - (suma % 11);
            dvEsperado = (dvEsperado === 11) ? 0 : dvEsperado;
            dvEsperado = (dvEsperado === 10) ? 'K' : dvEsperado.toString();

            return dv === dvEsperado;
        }

        // ==========================================
        // 2. FUNCIONES AUXILIARES
        // ==========================================
        function getCursoNombre(id) {
            const c = cursos.find(c => c.id === id);
            return c ? c.nombre : 'Sin curso';
        }

        function getAlumnosPorCurso(cursoId) {
            return alumnos.filter(a => a.cursoId === cursoId).sort((a, b) => {
                const numA = a.numeroLista ? parseInt(a.numeroLista) : 0;
                const numB = b.numeroLista ? parseInt(b.numeroLista) : 0;
                if (numA === 0 && numB === 0) return a.nombre.localeCompare(b.nombre);
                if (numA === 0) return 1;
                if (numB === 0) return -1;
                return numA - numB;
            });
        }

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast');
            const icon = document.getElementById('toastIcon');
            const msg = document.getElementById('toastMessage');
            toast.className = 'toast ' + type;
            icon.className = type === 'success' ? 'fas fa-check-circle' :
                type === 'error' ? 'fas fa-exclamation-circle' :
                    type === 'warning' ? 'fas fa-exclamation-triangle' : 'fas fa-info-circle';
            msg.textContent = message;
            toast.classList.add('show');
            clearTimeout(toast._timeout);
            toast._timeout = setTimeout(() => toast.classList.remove('show'), 3500);
        }


