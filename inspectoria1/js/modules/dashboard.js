// ==========================================
        // 4. DASHBOARD
        // ==========================================
        function actualizarDashboard() {
            const totalAlumnos = alumnos.filter(a => a.estado !== 'retirado').length;
            const totalCursos = cursos.length;
            const pendientes = comunicacionesPendientes.length;
            const totalNovedades = bitacoraLlamadas.length;

            const avisoContainer = document.getElementById('dashAvisoFechaInicio');
            if (avisoContainer) {
                if (window.configuracionGlobal?.fecha_inicio_uso) {
                    const fechaArr = window.configuracionGlobal.fecha_inicio_uso.split('-');
                    const fechaFormateada = `${fechaArr[2]}/${fechaArr[1]}/${fechaArr[0]}`;
                    avisoContainer.innerHTML = `
                        <div style="background-color: var(--blue-50); border: 1px solid var(--blue-200); border-left: 4px solid var(--primary); padding: 10px 15px; border-radius: 8px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <i class="fas fa-info-circle text-primary" style="font-size: 1.2rem;"></i>
                            <span style="font-size: 0.95rem; color: var(--blue-900);">
                                <strong>Inicio de Plataforma:</strong> Todas las métricas del Dashboard ignoran los días previos al <strong>${fechaFormateada}</strong>.
                            </span>
                        </div>
                    `;
                    avisoContainer.style.display = 'block';
                } else {
                    avisoContainer.innerHTML = '';
                    avisoContainer.style.display = 'none';
                }
            }

            // --- 1. CÁLCULO DE ASISTENCIA SEMANAL ---
            const getMonday = (d) => {
                const date = new Date(d);
                const day = date.getDay();
                const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                return new Date(date.setDate(diff));
            };

            const todayDate = new Date();
            const currentMonday = getMonday(todayDate);
            currentMonday.setHours(0,0,0,0);

            const prevMonday = new Date(currentMonday);
            prevMonday.setDate(prevMonday.getDate() - 7);

            const prevSunday = new Date(currentMonday);
            prevSunday.setDate(prevSunday.getDate() - 1);
            prevSunday.setHours(23,59,59,999);

            const getAttendancePctForRange = (startDate, endDate) => {
                let totalPresentes = 0;
                let totalAlumnosReg = 0;
                asistenciaRegistros.forEach(record => {
                    if (record.cursoId === 0) return; // Ignorar registros de día sin clases
                    const recordDate = new Date(record.fecha + 'T00:00:00');
                    if (recordDate >= startDate && recordDate <= endDate) {
                        record.registros.forEach(reg => {
                            const alumnoObj = alumnos.find(a => a.nombre.trim().toLowerCase() === reg.alumno.trim().toLowerCase());
                            if (alumnoObj && alumnoObj.estado === 'retirado') return;
                            
                            const estadoNormal = reg.estado ? reg.estado.trim().toLowerCase() : '';
                            if (estadoNormal === 'presente' || estadoNormal === 'tarde') {
                                totalPresentes++;
                            }
                            totalAlumnosReg++;
                        });
                    }
                });
                return totalAlumnosReg > 0 ? (totalPresentes / totalAlumnosReg) * 100 : null;
            };

            const currentWeekPct = getAttendancePctForRange(currentMonday, todayDate);
            const prevWeekPct = getAttendancePctForRange(prevMonday, prevSunday);

            let weeklyAttendanceText = 'Sin datos';
            let trendHtml = '';

            if (currentWeekPct !== null) {
                weeklyAttendanceText = `${Math.round(currentWeekPct)}%`;
                if (prevWeekPct !== null) {
                    const diff = (currentWeekPct - prevWeekPct).toFixed(1);
                    if (diff > 0) {
                        trendHtml = `<span style="font-size:0.75rem;color:var(--success);font-weight:bold;margin-top:4px;display:block;"><i class="fas fa-arrow-up"></i> +${diff}% vs anterior</span>`;
                    } else if (diff < 0) {
                        trendHtml = `<span style="font-size:0.75rem;color:var(--danger);font-weight:bold;margin-top:4px;display:block;"><i class="fas fa-arrow-down"></i> ${diff}% vs anterior</span>`;
                    } else {
                        trendHtml = `<span style="font-size:0.75rem;color:var(--gray-500);font-weight:bold;margin-top:4px;display:block;"><i class="fas fa-arrow-right"></i> = vs anterior</span>`;
                    }
                } else {
                    trendHtml = `<span style="font-size:0.7rem;color:var(--gray-500);margin-top:4px;display:block;">Primera semana</span>`;
                }
            } else {
                trendHtml = `<span style="font-size:0.7rem;color:var(--gray-500);margin-top:4px;display:block;">Sin registros esta semana</span>`;
            }

            document.getElementById('statsGrid').innerHTML = `
                <div class="stat-card"><div class="label">Alumnos</div><div class="value primary">${totalAlumnos}</div></div>
                <div class="stat-card" style="border-left-color:var(--success);"><div class="label">Cursos</div><div class="value success">${totalCursos}</div></div>
                <div class="stat-card" style="border-left-color:var(--warning);"><div class="label">Comunicaciones Pendientes</div><div class="value warning">${pendientes}</div></div>
                <div class="stat-card" style="border-left-color:var(--primary);"><div class="label">Asist. Semanal</div><div class="value" style="color:var(--primary);">${weeklyAttendanceText}</div><div>${trendHtml}</div></div>
            `;

            // Sincronizar burbuja roja de notificaciones
            const badge = document.getElementById('pendientesBadge');
            if (badge) badge.textContent = pendientes;

            // --- CÁLCULO DE ALERTAS DE ASISTENCIA OLVIDADA (MES ACTUAL COMPLETO) ---
            const obtenerDiasHabilesMesActual = () => {
                const dias = [];
                const hoy = new Date();
                const year = window.configuracionGlobal?.anio_lectivo || hoy.getFullYear();
                const month = hoy.getMonth();

                // Enero y febrero son vacaciones de verano
                if (month === 0 || month === 1) return [];

                // Recorrer desde el día 1 de este mes hasta hoy
                for (let d = 1; d <= hoy.getDate(); d++) {
                    const dateObj = new Date(year, month, d);
                    const dayOfWeek = dateObj.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Lunes a Viernes
                        const y = dateObj.getFullYear();
                        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const dayStr = String(dateObj.getDate()).padStart(2, '0');
                        const fechaStr = `${y}-${m}-${dayStr}`;
                        
                        // Omitir si es antes de la fecha de inicio de uso
                        const fechaInicioUso = window.configuracionGlobal?.fecha_inicio_uso;
                        const esPrevioAlInicio = fechaInicioUso && fechaStr < fechaInicioUso;
                        
                        // Omitir si es un día sin clases (suspendido)
                        if (!esDiaSinClases(fechaStr) && !esPrevioAlInicio) {
                            dias.push(fechaStr);
                        }
                    }
                }
                return dias;
            };

            const ultimosDias = obtenerDiasHabilesMesActual();
            const pendientesOlvidadas = [];

            ultimosDias.forEach(f => {
                cursos.forEach(c => {
                    const alumnosCurso = getAlumnosPorCurso(c.id);
                    if (alumnosCurso.length > 0) {
                        const yaRegistrado = asistenciaRegistros && asistenciaRegistros.some(r => r.cursoId === c.id && r.fecha === f);
                        if (!yaRegistrado) {
                            pendientesOlvidadas.push({ cursoNombre: c.nombre, fecha: f, cursoId: c.id });
                        }
                    }
                });
            });

            const alertasContainer = document.getElementById('asistenciaAlertasOlvido');
            if (alertasContainer) {
                if (pendientesOlvidadas.length === 0) {
                    alertasContainer.innerHTML = '';
                    alertasContainer.style.display = 'none';
                } else {
                    const mesesAnio = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    const nombreMesActual = mesesAnio[new Date().getMonth()];

                    alertasContainer.style.display = 'block';
                    alertasContainer.innerHTML = `
                        <div class="card" style="border-left: 4px solid var(--danger); background: #fef2f2; margin-bottom: 1.5rem;">
                            <div class="card-body" style="padding: 1rem 1.25rem;">
                                <h4 style="color: var(--danger); font-size: 1rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 8px; font-weight: 600;">
                                    <i class="fas fa-exclamation-circle"></i> Alerta de Inspectoría: Asistencias Pendientes
                                </h4>
                                <p style="font-size: 0.9rem; color: var(--gray-700); margin-bottom: 0.75rem;">
                                    Las siguientes planillas de asistencia no han sido registradas en el mes de <strong>${nombreMesActual}</strong> (haz clic en una para registrarla):
                                </p>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap; max-height: 150px; overflow-y: auto; padding: 4px 0;">
                                    ${pendientesOlvidadas.map(p => {
                                        const fechaFormateada = p.fecha.split('-').reverse().join('/');
                                        return `
                                            <span class="badge" style="background-color: var(--danger); color: white; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s;" onclick="irARegistrarFechaCurso(${p.cursoId}, '${p.fecha}')" title="Ir a registrar">
                                                <i class="far fa-calendar-alt"></i> ${p.cursoNombre} - ${fechaFormateada}
                                            </span>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                }
            }

            // WIDGET: Alumnos en Riesgo (Asistencia < Config Anual)
            const currentYear = window.configuracionGlobal?.anio_lectivo || new Date().getFullYear();
            const riesgoMedio = window.configuracionGlobal?.riesgo_medio || 85;
            const riesgoCritico = window.configuracionGlobal?.riesgo_critico || 75;

            const statsPorAlumno = {};
            asistenciaRegistros.forEach(record => {
                const dInfo = parseYearMonth(record.fecha);
                if (dInfo.year === currentYear) {
                    record.registros.forEach(reg => {
                        const nombre = reg.alumno;
                        const alumnoObj = alumnos.find(a => a.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
                        if (alumnoObj && alumnoObj.estado === 'retirado') return;
                        
                        const estadoNormal = reg.estado ? reg.estado.trim().toLowerCase() : '';
                        
                        if (!statsPorAlumno[nombre]) {
                            statsPorAlumno[nombre] = { diasTotales: 0, diasAusente: 0 };
                        }
                        
                        if (estadoNormal === 'ausente') {
                            statsPorAlumno[nombre].diasTotales++;
                            statsPorAlumno[nombre].diasAusente++;
                        } else if (estadoNormal === 'presente' || estadoNormal === 'atrasado' || estadoNormal === 'ausente justificado') {
                            // Si agregamos más estados en el futuro, o para presente normal
                            statsPorAlumno[nombre].diasTotales++;
                        }
                    });
                }
            });

            const topAlumnos = Object.entries(statsPorAlumno)
                .map(([nombre, stats]) => {
                    const porcentaje = stats.diasTotales > 0 
                        ? ((stats.diasTotales - stats.diasAusente) / stats.diasTotales) * 100 
                        : 100;
                    return { nombre, porcentaje, diasTotales: stats.diasTotales, diasAusente: stats.diasAusente };
                })
                .filter(a => a.porcentaje < riesgoMedio && a.diasTotales > 0)
                .sort((a, b) => a.porcentaje - b.porcentaje); // Menor porcentaje primero

            const containerRiesgo = document.getElementById('dashAlumnosRiesgo');
            if (topAlumnos.length === 0) {
                containerRiesgo.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--success);"></i><p>No hay alumnos en riesgo este año.</p></div>`;
            } else {
                containerRiesgo.innerHTML = topAlumnos.map(a => {
                    let color = a.porcentaje < riesgoCritico ? 'var(--danger)' : 'var(--warning)';
                    let icon = a.porcentaje < riesgoCritico ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
                    return `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--gray-200);">
                        <span style="font-size:0.9rem;"><strong>${a.nombre}</strong> <br><small class="text-muted">${a.diasAusente} faltas de ${a.diasTotales} días</small></span>
                        <span class="badge-status" style="background:${color}; color:white;"><i class="fas ${icon}"></i> ${a.porcentaje.toFixed(1)}%</span>
                    </div>`;
                }).join('');
            }

            const badgeRiesgo = document.getElementById('badgeAlumnosRiesgo');
            if (badgeRiesgo) {
                if (topAlumnos.length > 0) {
                    badgeRiesgo.textContent = topAlumnos.length;
                    badgeRiesgo.style.display = 'inline-block';
                } else {
                    badgeRiesgo.style.display = 'none';
                }
            }

            // WIDGET 2.5: Alerta Temprana (Ausencias Consecutivas)
            const containerAlertasConsecutivas = document.getElementById('dashAlertasConsecutivas');
            if (containerAlertasConsecutivas) {
                const umbralConsecutivas = window.configuracionGlobal?.alerta_ausencias_consecutivas || 3;
                // Fechas únicas ordenadas de más reciente a más antigua, ignorando días sin clases
                const fechasOrdenadasDesc = [...new Set(asistenciaRegistros.map(r => r.fecha))]
                    .filter(f => !esDiaSinClases(f))
                    .sort((a, b) => b.localeCompare(a));
                
                // Mapear historial por alumno: { "Alumno": ["ausente", "presente", "ausente"] }
                const historialAlumnos = {};
                
                fechasOrdenadasDesc.slice(0, umbralConsecutivas + 5).forEach(fecha => {
                    const registrosFecha = asistenciaRegistros.filter(r => r.fecha === fecha);
                    registrosFecha.forEach(cursoRecord => {
                        cursoRecord.registros.forEach(reg => {
                            const alumnoObj = alumnos.find(a => a.nombre.trim().toLowerCase() === reg.alumno.trim().toLowerCase());
                            if (alumnoObj && alumnoObj.estado === 'retirado') return;
                            
                            const est = reg.estado ? reg.estado.trim().toLowerCase() : '';
                            if (!historialAlumnos[reg.alumno]) historialAlumnos[reg.alumno] = [];
                            // Si estado es en blanco, se asume no ausente para romper racha, o se ignora?
                            // Vamos a agregarlo a la lista
                            historialAlumnos[reg.alumno].push({ fecha, estado: est });
                        });
                    });
                });

                const alumnosAlerta = [];
                for (const alumno in historialAlumnos) {
                    const dias = historialAlumnos[alumno];
                    let ausenciasConsecutivas = 0;
                    for (let i = 0; i < dias.length; i++) {
                        // Verificamos si los más recientes son ausente
                        if (dias[i].estado === 'ausente') {
                            ausenciasConsecutivas++;
                        } else {
                            break; // Rompe la racha si está presente, tarde, o sin estado
                        }
                    }
                    if (ausenciasConsecutivas >= umbralConsecutivas) {
                        alumnosAlerta.push({ nombre: alumno, racha: ausenciasConsecutivas, ultimaFecha: dias[0].fecha });
                    }
                }

                if (alumnosAlerta.length === 0) {
                    containerAlertasConsecutivas.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--success);"></i><p>Sin alertas de inasistencias consecutivas.</p></div>`;
                } else {
                    alumnosAlerta.sort((a, b) => b.racha - a.racha);
                    containerAlertasConsecutivas.innerHTML = alumnosAlerta.map(a => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--gray-200);">
                            <span style="font-size:0.9rem;"><strong>${a.nombre}</strong> <br><small class="text-muted">Última falta: ${a.ultimaFecha.split('-').reverse().join('/')}</small></span>
                            <span class="badge-status" style="background:#dc2626; color:white;"><i class="fas fa-bell"></i> ${a.racha} días seguidos</span>
                        </div>
                    `).join('');
                }
            }

            // (El widget Últimas Novedades fue reemplazado por Tendencia Semanal)

            // --- 2. WIDGET: AUSENTISMO POR CURSO (HOY) ---
            const containerAusentismo = document.getElementById('dashAusentismoCursos');
            if (containerAusentismo) {
                let fechaReciente = today();
                if (asistenciaRegistros.length > 0) {
                    const fechasSorted = asistenciaRegistros.map(r => r.fecha).sort().reverse();
                    fechaReciente = fechasSorted[0];
                }

                const registrosFecha = asistenciaRegistros.filter(r => r.fecha === fechaReciente);
                const ausentismoPorCurso = [];

                cursos.forEach(c => {
                    const record = registrosFecha.find(r => r.cursoId === c.id);
                    const alumnosCurso = alumnos.filter(a => a.cursoId === c.id && a.estado !== 'retirado');
                    if (record && alumnosCurso.length > 0) {
                        let ausentes = 0;
                        record.registros.forEach(reg => {
                            const estadoNormal = reg.estado ? reg.estado.trim().toLowerCase() : '';
                            const perteneceAlCurso = alumnosCurso.some(a => a.nombre.trim().toLowerCase() === reg.alumno.trim().toLowerCase());
                            if (perteneceAlCurso && estadoNormal === 'ausente') {
                                ausentes++;
                            }
                        });
                        const pct = Math.round((ausentes / alumnosCurso.length) * 100);
                        if (pct > 0) {
                            ausentismoPorCurso.push({ nombre: c.nombre, pct: pct, ausentes: ausentes });
                        }
                    }
                });

                ausentismoPorCurso.sort((a, b) => b.pct - a.pct);

                if (ausentismoPorCurso.length === 0) {
                    containerAusentismo.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--success);"></i><p>Excelente asistencia general el ${fechaReciente.split('-').reverse().join('/')}</p></div>`;
                    if (chartAusentismoCursos) { chartAusentismoCursos.destroy(); chartAusentismoCursos = null; }
                } else {
                    containerAusentismo.innerHTML = `
                        <div style="font-size:0.75rem;color:var(--gray-500);margin-bottom:8px;text-align:right;">Datos al: ${fechaReciente.split('-').reverse().join('/')}</div>
                        <div class="chart-container-bar">
                            <canvas id="chartAusentismoCursos"></canvas>
                        </div>
                    `;
                    
                    if (chartAusentismoCursos) { chartAusentismoCursos.destroy(); }
                    
                    if (typeof Chart !== 'undefined') {
                        const ctx = document.getElementById('chartAusentismoCursos');
                        if (ctx) {
                            chartAusentismoCursos = new Chart(ctx, {
                                type: 'bar',
                                data: {
                                    labels: ausentismoPorCurso.map(c => c.nombre),
                                    datasets: [{
                                        label: '% Ausentismo',
                                        data: ausentismoPorCurso.map(c => c.pct),
                                        backgroundColor: 'rgba(220, 38, 38, 0.7)',
                                        borderColor: 'rgb(220, 38, 38)',
                                        borderWidth: 1,
                                        borderRadius: 4
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    indexAxis: 'y',
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            callbacks: {
                                                label: function(context) {
                                                    const data = ausentismoPorCurso[context.dataIndex];
                                                    return `${data.pct}% (${data.ausentes} alumnos)`;
                                                }
                                            },
                                            titleFont: { family: "'Segoe UI', system-ui" },
                                            bodyFont: { family: "'Segoe UI', system-ui" }
                                        }
                                    },
                                    scales: {
                                        x: { beginAtZero: true, max: 100 }
                                    },
                                    animation: { duration: 600, easing: 'easeOutQuart' }
                                }
                            });
                        }
                    }
                }
            }

            // --- 3. WIDGET: CONTACTO DE APODERADOS (PROGRESO SEMANAL) ---
            const containerContacto = document.getElementById('dashContactoProgreso');
            if (containerContacto) {
                const MS_IN_DAY = 24 * 60 * 60 * 1000;
                const sevenDaysAgo = new Date(Date.now() - 7 * MS_IN_DAY);

                const contactadosRecientes = comunicacionesHistorial.filter(h => {
                    try {
                        let datePart = h.fecha.split(' ')[0];
                        let parts = datePart.includes('-') ? datePart.split('-') : datePart.split('/');
                        if (parts.length === 3) {
                            let parsedDate;
                            if (parts[0].length === 4) {
                                parsedDate = new Date(parts[0], parts[1]-1, parts[2]);
                            } else {
                                parsedDate = new Date(parts[2], parts[1]-1, parts[0]);
                            }
                            return parsedDate >= sevenDaysAgo;
                        }
                    } catch(e) {}
                    return false;
                }).length;

                const totalAlertasRecientes = contactadosRecientes + pendientes;
                const pctProgreso = totalAlertasRecientes > 0 ? Math.round((contactadosRecientes / totalAlertasRecientes) * 100) : 100;

                let nombresPendientesHTML = '';
                if (pendientes > 0) {
                    const listaNombres = comunicacionesPendientes.map(c => `
                        <div style="padding: 8px 10px; border-bottom: 1px solid var(--gray-200); display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; align-items: flex-start; gap: 6px; color: var(--gray-800);">
                                <i class="fas fa-user-circle text-danger" style="margin-top: 2px;"></i>
                                <strong style="font-size: 0.85rem; line-height: 1.2;">${c.estudiante || 'Desconocido'}</strong>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--gray-600); background: var(--gray-100); padding: 4px 8px; border-radius: 4px; line-height: 1.3; border-left: 3px solid var(--danger);">
                                ${c.motivo || 'Alerta'}
                            </div>
                        </div>
                    `).join('');
                    
                    nombresPendientesHTML = `
                        <div style="margin-top: 4px; background: white; border: 1px solid var(--gray-200); border-radius: 8px; overflow: hidden;">
                            <div style="background: #fee2e2; padding: 6px 10px; font-size: 0.75rem; font-weight: bold; color: var(--danger); border-bottom: 1px solid #fca5a5;">
                                Estudiantes Pendientes
                            </div>
                            <div style="max-height: 160px; overflow-y: auto;">
                                ${listaNombres}
                            </div>
                        </div>
                    `;
                }

                containerContacto.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 12px; padding: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background-color: var(--primary-light); border-radius: 8px; border-left: 4px solid var(--primary);">
                            <div>
                                <div style="font-size: 0.85rem; color: var(--gray-700); font-weight: 600;">Alertas (Últimos 7 días)</div>
                                <div style="font-size: 1.8rem; font-weight: 700; color: var(--primary); margin-top: -2px;">${totalAlertasRecientes}</div>
                            </div>
                            <i class="fas fa-bell" style="font-size: 2rem; color: var(--primary); opacity: 0.8;"></i>
                        </div>
                        
                        <div style="display: flex; gap: 10px;">
                            <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; padding: 12px; background-color: #dcfce7; border-radius: 8px; border-left: 4px solid var(--success);">
                                <div>
                                    <div style="font-size: 0.75rem; color: var(--gray-700); font-weight: 600;">Contactados</div>
                                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--success); margin-top: -2px;">${contactadosRecientes}</div>
                                </div>
                                <i class="fas fa-check-circle" style="font-size: 1.5rem; color: var(--success); opacity: 0.8;"></i>
                            </div>
                            
                            <div style="flex: 1; display: flex; justify-content: space-between; align-items: center; padding: 12px; background-color: #fee2e2; border-radius: 8px; border-left: 4px solid var(--danger);">
                                <div>
                                    <div style="font-size: 0.75rem; color: var(--gray-700); font-weight: 600;">Pendientes</div>
                                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--danger); margin-top: -2px;">${pendientes}</div>
                                </div>
                                <i class="fas fa-clock" style="font-size: 1.5rem; color: var(--danger); opacity: 0.8;"></i>
                            </div>
                        </div>
                        
                        ${nombresPendientesHTML}
                        
                        <button class="btn btn-success" style="width: 100%; margin-top: 4px; padding: 10px; display: flex; justify-content: center; align-items: center; gap: 8px; font-weight: bold;" onclick="mostrarPanel('comunicacion')">
                            <i class="fas fa-phone-alt"></i> Gestionar Alertas
                        </button>
                    </div>
                `;

                if (typeof chartContactoProgreso !== 'undefined' && chartContactoProgreso) {
                    chartContactoProgreso.destroy();
                }
            }

            // --- 4. WIDGET: SEMÁFORO DE ASISTENCIA POR CURSO ---
            const containerSemaforo = document.getElementById('dashSemaforoAsistencia');
            if (containerSemaforo) {
                const currentMonth = new Date().getMonth();
                const currentYear = window.configuracionGlobal?.anio_lectivo || new Date().getFullYear();
                const semaforoExcelente = window.configuracionGlobal?.semaforo_excelente || 95;
                const semaforoPrecaucion = window.configuracionGlobal?.semaforo_precaucion || 90;

                const asistenciaCursosMes = {};

                asistenciaRegistros.forEach(record => {
                    const dInfo = parseYearMonth(record.fecha);
                    if (dInfo.year === currentYear && dInfo.month === currentMonth) {
                        record.registros.forEach(reg => {
                            const alumno = alumnos.find(a => a.nombre.trim().toLowerCase() === reg.alumno.trim().toLowerCase());
                            if (alumno) {
                                const cursoId = alumno.cursoId;
                                if (!asistenciaCursosMes[cursoId]) {
                                    asistenciaCursosMes[cursoId] = { presentes: 0, total: 0 };
                                }
                                const estadoNormal = reg.estado ? reg.estado.trim().toLowerCase() : '';
                                if (estadoNormal === 'presente' || estadoNormal === 'tarde') {
                                    asistenciaCursosMes[cursoId].presentes++;
                                }
                                asistenciaCursosMes[cursoId].total++;
                            }
                        });
                    }
                });

                const semaforoData = [];
                cursos.forEach(c => {
                    const stats = asistenciaCursosMes[c.id];
                    let pct = null;
                    if (stats && stats.total > 0) {
                        pct = Math.round((stats.presentes / stats.total) * 100);
                    }
                    if (pct !== null) {
                        let colorText = '';
                        let colorBg = '';
                        if (pct >= semaforoExcelente) {
                            colorText = '#166534';
                            colorBg = '#dcfce7';
                        } else if (pct >= semaforoPrecaucion) {
                            colorText = '#92400e';
                            colorBg = '#fef3c7';
                        } else {
                            colorText = '#991b1b';
                            colorBg = '#fee2e2';
                        }
                        semaforoData.push({ nombre: c.nombre, pct: pct, colorText: colorText, colorBg: colorBg });
                    }
                });

                semaforoData.sort((a, b) => b.pct - a.pct);

                const nombreMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const mesActualTexto = nombreMeses[currentMonth];

                if (semaforoData.length === 0) {
                    containerSemaforo.innerHTML = `<div class="empty-state"><p>No hay registros de asistencia en ${mesActualTexto}.</p></div>`;
                    if (chartSemaforoAsistencia) { chartSemaforoAsistencia.destroy(); chartSemaforoAsistencia = null; }
                } else {
                    containerSemaforo.innerHTML = `
                        <div style="font-size:0.75rem;color:var(--gray-500);margin-bottom:8px;text-align:right;">Mes: ${mesActualTexto} de ${currentYear}</div>
                        <div class="chart-container-bar">
                            <canvas id="chartSemaforoAsistencia"></canvas>
                        </div>
                    `;
                    
                    if (chartSemaforoAsistencia) { chartSemaforoAsistencia.destroy(); }
                    
                    if (typeof Chart !== 'undefined') {
                        const ctx = document.getElementById('chartSemaforoAsistencia');
                        if (ctx) {
                            const backgroundColors = semaforoData.map(c => {
                                if (c.pct >= 95) return 'rgba(22, 163, 74, 0.7)'; // success
                                if (c.pct >= 90) return 'rgba(245, 158, 11, 0.7)'; // warning
                                return 'rgba(220, 38, 38, 0.7)'; // danger
                            });
                            const borderColors = semaforoData.map(c => {
                                if (c.pct >= 95) return 'rgb(22, 163, 74)';
                                if (c.pct >= 90) return 'rgb(245, 158, 11)';
                                return 'rgb(220, 38, 38)';
                            });

                            chartSemaforoAsistencia = new Chart(ctx, {
                                type: 'bar',
                                data: {
                                    labels: semaforoData.map(c => c.nombre),
                                    datasets: [{
                                        label: '% Asistencia',
                                        data: semaforoData.map(c => c.pct),
                                        backgroundColor: backgroundColors,
                                        borderColor: borderColors,
                                        borderWidth: 1,
                                        borderRadius: 4
                                    }]
                                },
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    indexAxis: 'y',
                                    plugins: {
                                        legend: { display: false },
                                        tooltip: {
                                            callbacks: {
                                                label: function(context) {
                                                    return `${context.raw}% asistencia`;
                                                }
                                            },
                                            titleFont: { family: "'Segoe UI', system-ui" },
                                            bodyFont: { family: "'Segoe UI', system-ui" }
                                        }
                                    },
                                    scales: {
                                        x: { 
                                            beginAtZero: false,
                                            min: Math.max(0, Math.min(...semaforoData.map(c => c.pct)) - 5),
                                            max: 100,
                                            grid: {
                                                color: function(context) {
                                                    if (context.tick.value === 90) {
                                                        return 'rgba(245, 158, 11, 0.5)';
                                                    } else if (context.tick.value === 95) {
                                                        return 'rgba(22, 163, 74, 0.5)';
                                                    }
                                                    return 'rgba(0, 0, 0, 0.1)';
                                                },
                                                lineWidth: function(context) {
                                                    return (context.tick.value === 90 || context.tick.value === 95) ? 2 : 1;
                                                }
                                            }
                                        }
                                    },
                                    animation: { duration: 600, easing: 'easeOutQuart' }
                                }
                            });
                        }
                    }
                }
            }
            // --- 5. WIDGET: TENDENCIA SEMANAL (ÚLTIMOS 5 DÍAS HÁBILES) ---
            const containerTendencia = document.getElementById('dashTendenciaSemanal');
            if (containerTendencia && typeof Chart !== 'undefined') {
                // Obtener los últimos 5 días hábiles únicos desde asistenciaRegistros
                const fechasUnicas = [...new Set(asistenciaRegistros.map(r => r.fecha))].sort();
                
                // Excluir días sin clases
                const diasTendencia = window.configuracionGlobal?.dias_grafico_tendencia || 5;
                const diasHabilesReales = fechasUnicas.filter(f => !esDiaSinClases(f)).slice(-diasTendencia);
                
                const tendenciaData = diasHabilesReales.map(fecha => {
                    const registrosDia = asistenciaRegistros.filter(r => r.fecha === fecha);
                    let presentes = 0;
                    let total = 0;
                    
                    registrosDia.forEach(cursoRecord => {
                        cursoRecord.registros.forEach(reg => {
                            const estadoNormal = reg.estado ? reg.estado.trim().toLowerCase() : '';
                            if (estadoNormal === 'presente' || estadoNormal === 'tarde') presentes++;
                            total++;
                        });
                    });
                    
                    const pct = total > 0 ? Math.round((presentes / total) * 100) : null;
                    return { fecha, pct };
                }).filter(d => d.pct !== null);

                if (tendenciaData.length === 0) {
                    containerTendencia.innerHTML = `<div class="empty-state"><p>No hay datos suficientes para la tendencia.</p></div>`;
                    if (chartTendenciaSemanal) { chartTendenciaSemanal.destroy(); chartTendenciaSemanal = null; }
                } else {
                    containerTendencia.innerHTML = `
                        <div class="chart-container-line">
                            <canvas id="chartTendenciaSemanal"></canvas>
                        </div>
                    `;
                    
                    if (chartTendenciaSemanal) { chartTendenciaSemanal.destroy(); }
                    
                    const ctx = document.getElementById('chartTendenciaSemanal');
                    if (ctx) {
                        chartTendenciaSemanal = new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: tendenciaData.map(d => d.fecha.split('-').reverse().slice(0,2).join('/')),
                                datasets: [{
                                    label: '% Asistencia',
                                    data: tendenciaData.map(d => d.pct),
                                    borderColor: '#3b82f6',
                                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                    borderWidth: 2,
                                    pointBackgroundColor: '#2563eb',
                                    pointBorderColor: '#fff',
                                    pointBorderWidth: 2,
                                    pointRadius: 4,
                                    pointHoverRadius: 6,
                                    fill: true,
                                    tension: 0.3
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        callbacks: {
                                            label: function(context) {
                                                return `${context.raw}% asistencia`;
                                            }
                                        },
                                        titleFont: { family: "'Segoe UI', system-ui" },
                                        bodyFont: { family: "'Segoe UI', system-ui" }
                                    }
                                },
                                scales: {
                                    y: {
                                        min: Math.max(0, Math.min(...tendenciaData.map(d => d.pct)) - 5),
                                        max: 100,
                                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                                    },
                                    x: {
                                        grid: { display: false }
                                    }
                                },
                                animation: { duration: 600, easing: 'easeOutQuart' }
                            }
                        });
                    }
                }
            }
        }

        function actualizarResumenDia() {
            const hoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            document.getElementById('fechaResumen').textContent = hoy;

            let ausentesHoy = 0;
            let presentesHoy = 0;
            let atrasosHoy = 0;
            const fechaHoy = today();

            // Verificar si hoy está suspendido
            if (esDiaSinClases(fechaHoy)) {
                const motivo = obtenerMotivoDiaSinClases(fechaHoy);
                document.getElementById('resumenDia').innerHTML = `
                    <div style="text-align:center; padding: 1.5rem 1rem; background: #fef2f2; border: 1px solid var(--danger); border-radius: var(--radius); margin-bottom: 1rem;">
                        <div style="font-size: 2.2rem; font-weight: 700; color: var(--danger); margin-bottom: 0.5rem;"><i class="fas fa-calendar-times"></i> Sin Clases</div>
                        <div style="font-size: 0.95rem; color: var(--gray-700); font-weight: 600;">Motivo: ${motivo}</div>
                        <div style="font-size: 0.8rem; color: var(--gray-500); margin-top: 8px;">Este día ha sido excluido de los registros y promedios.</div>
                    </div>
                `;
                return;
            }

            const registrosHoy = asistenciaRegistros.filter(r => r.fecha === fechaHoy && r.cursoId !== 0);
            const cursosRegistradosHoy = registrosHoy.length;
            const totalCursos = (typeof cursos !== 'undefined' && Array.isArray(cursos)) ? cursos.length : '?';

            let cursosBreakdownHTML = '';
            
            if (registrosHoy.length > 0) {
                const listaCursos = registrosHoy.map(cursoRecord => {
                    const curso = (typeof cursos !== 'undefined' && Array.isArray(cursos)) ? cursos.find(c => c.id == cursoRecord.cursoId) : null;
                    const nombreCurso = curso ? curso.nombre : `Curso ID ${cursoRecord.cursoId}`;
                    
                    let pres = 0;
                    let aus = 0;
                    cursoRecord.registros.forEach(reg => {
                        const est = reg.estado ? reg.estado.trim().toLowerCase() : '';
                        if (est === 'ausente') aus++;
                        else if (est === 'presente' || est === 'tarde') pres++;
                    });
                    const tot = pres + aus;
                    const pct = tot > 0 ? Math.round((pres/tot)*100) : 0;
                    let color = 'var(--success)';
                    if (pct < (window.configuracionGlobal?.riesgo_medio || 85)) color = 'var(--warning)';
                    if (pct < (window.configuracionGlobal?.riesgo_critico || 75)) color = 'var(--danger)';
                    
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--gray-200);">
                            <span style="font-size: 0.8rem; font-weight: 600; color: var(--gray-700);">${nombreCurso}</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 0.7rem; color: var(--gray-500);">${pres}/${tot} pres.</span>
                                <span style="font-size: 0.85rem; font-weight: bold; color: ${color}; width: 35px; text-align: right;">${pct}%</span>
                            </div>
                        </div>
                    `;
                }).join('');
                
                cursosBreakdownHTML = `
                    <div style="margin-top: 10px; background: white; border: 1px solid var(--gray-200); border-radius: 6px; padding: 8px;">
                        <div style="font-size: 0.75rem; font-weight: bold; color: var(--gray-600); margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid var(--gray-200);">
                            Detalle por Curso Evaluado
                        </div>
                        <div>
                            ${listaCursos}
                        </div>
                    </div>
                `;
            }

            registrosHoy.forEach(cursoRecord => {
                cursoRecord.registros.forEach(reg => {
                    const estadoNormal = reg.estado ? reg.estado.trim().toLowerCase() : '';
                    if (estadoNormal === 'ausente') {
                        ausentesHoy++;
                    } else if (estadoNormal === 'tarde' || estadoNormal === 'presente') {
                        presentesHoy++;
                    }
                });
            });

            const total = presentesHoy + ausentesHoy;
            const porcentaje = total > 0 ? `${Math.round((presentesHoy / total) * 100)}%` : 'Sin datos';
            let barColor = 'var(--success)';
            if (porcentaje !== 'Sin datos') {
                const val = parseInt(porcentaje);
                if (val < (window.configuracionGlobal?.riesgo_medio || 85)) barColor = 'var(--warning)';
                if (val < (window.configuracionGlobal?.riesgo_critico || 75)) barColor = 'var(--danger)';
            }

            document.getElementById('resumenDia').innerHTML = `
                <div class="chart-container-donut" style="margin-bottom: 10px;">
                    <canvas id="chartAsistenciaDia"></canvas>
                    <div class="chart-center-label">
                        <div class="chart-pct" style="color: ${barColor};">${porcentaje}</div>
                        <div class="chart-sub">Asistencia Hoy</div>
                    </div>
                </div>
                
                <div style="background: var(--gray-50); padding: 12px; border-radius: 8px; border: 1px solid var(--gray-200);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--gray-200);">
                        <span style="font-size: 0.8rem; color: var(--gray-600); font-weight: 600;">
                            <i class="fas fa-users" style="color: var(--primary);"></i> Alumnos Evaluados
                        </span>
                        <span style="font-size: 1rem; font-weight: 700; color: var(--gray-800);">${total}</span>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                        <div style="background: white; border-left: 3px solid var(--success); padding: 8px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; flex-direction: column; align-items: center;">
                            <span style="font-size: 0.7rem; color: var(--gray-500); font-weight: 600; text-transform: uppercase;">Presentes</span>
                            <span style="font-size: 1.2rem; font-weight: 700; color: var(--success);">${presentesHoy}</span>
                        </div>
                        <div style="background: white; border-left: 3px solid var(--danger); padding: 8px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: flex; flex-direction: column; align-items: center;">
                            <span style="font-size: 0.7rem; color: var(--gray-500); font-weight: 600; text-transform: uppercase;">Ausentes</span>
                            <span style="font-size: 1.2rem; font-weight: 700; color: var(--danger);">${ausentesHoy}</span>
                        </div>
                    </div>

                    ${cursosBreakdownHTML}

                    <div style="margin-top: 10px; text-align: center; font-size: 0.75rem; color: var(--gray-500);">
                        <i class="fas fa-check-double"></i> Cursos con asistencia pasada: <strong>${cursosRegistradosHoy}</strong> de <strong>${totalCursos}</strong>
                    </div>
                </div>
            `;

            if (chartAsistenciaDia) {
                chartAsistenciaDia.destroy();
            }
            
            if (total > 0 && typeof Chart !== 'undefined') {
                const ctx = document.getElementById('chartAsistenciaDia');
                if (ctx) {
                    chartAsistenciaDia = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: ['Presentes', 'Ausentes'],
                            datasets: [{
                                data: [presentesHoy, ausentesHoy],
                                backgroundColor: ['#16a34a', '#dc2626'],
                                borderWidth: 0,
                                hoverOffset: 4
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            cutout: '75%',
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                    padding: 12,
                                    cornerRadius: 8,
                                    titleFont: { family: "'Segoe UI', system-ui" },
                                    bodyFont: { family: "'Segoe UI', system-ui" }
                                }
                            },
                            animation: { duration: 600, easing: 'easeOutQuart' }
                        }
                    });
                }
            } else if (total === 0) {
                document.getElementById('resumenDia').innerHTML = `<div class="empty-state"><p>No hay registros para hoy.</p></div>`;
            }
        }

        // ==========================================
        // 9. REPORTE DIARIO CONSOLIDADO
        // ==========================================
        function generarReporteDiario() {
            const fechaInput = document.getElementById('reporteFecha');
            const fecha = fechaInput.value;
            if (!fecha) {
                showToast('Debe seleccionar una fecha para generar el reporte.', 'warning');
                return;
            }

            const dateObj = new Date(fecha + 'T00:00:00');
            const month = dateObj.getMonth();
            if (month === 0 || month === 1) {
                showToast('Enero y febrero corresponden al periodo de vacaciones de verano. Seleccione una fecha entre marzo y diciembre.', 'error');
                fechaInput.value = '';
                document.getElementById('reporteDiarioContainer').innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>Seleccione una fecha dentro del año escolar (marzo a diciembre)</p></div>`;
                return;
            }
            const dayOfWeek = dateObj.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                showToast('No se puede generar reporte de asistencia para fines de semana.', 'error');
                fechaInput.value = '';
                document.getElementById('reporteDiarioContainer').innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>Seleccione un día hábil (lunes a viernes)</p></div>`;
                return;
            }

            const container = document.getElementById('reporteDiarioContainer');
            const targetFecha = normalizeDate(fecha);
            const registrosHoy = asistenciaRegistros.filter(r => normalizeDate(r.fecha) === targetFecha);

            let totalAlumnosGlobal = 0;
            let presentesGlobal = 0;
            let ausentesGlobal = 0;

            // Resumen por curso
            let resumenCursos = cursos.map(c => {
                const alumnosCurso = getAlumnosPorCurso(c.id);
                const total = alumnosCurso.filter(a => a.estado !== 'retirado').length;

                const registroCurso = registrosHoy.find(r => r.cursoId === c.id);
                let presentes = 0;
                let ausentes = 0;

                if (registroCurso && registroCurso.registros) {
                    registroCurso.registros.forEach(r => {
                        const estadoNormal = r.estado ? r.estado.trim().toLowerCase() : '';
                        const perteneceAlCurso = alumnosCurso.some(a => a.nombre.trim().toLowerCase() === r.alumno.trim().toLowerCase() && a.estado !== 'retirado');
                        if (perteneceAlCurso) {
                            if (estadoNormal === 'presente') presentes++;
                            if (estadoNormal === 'ausente') ausentes++;
                        }
                    });
                } else {
                    // Si no se ha tomado asistencia, se marcan como 0
                    presentes = 0;
                    ausentes = 0;
                }

                totalAlumnosGlobal += total;
                presentesGlobal += presentes;
                ausentesGlobal += ausentes;

                return {
                    curso: c.nombre,
                    total: total,
                    ausentes: ausentes,
                    presentes: presentes,
                    tomada: !!registroCurso
                };
            });

            const sinRegistroGlobal = totalAlumnosGlobal - presentesGlobal - ausentesGlobal;
            const totalAsistenciaGlobal = presentesGlobal + ausentesGlobal;
            const porcentajeAsistencia = totalAsistenciaGlobal > 0 ? `${Math.round((presentesGlobal / totalAsistenciaGlobal) * 100)}%` : 'Sin datos';

            const [y, m, d] = fecha.split('-');
            const fechaFormateada = new Date(y, m - 1, d).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            let html = `
                <div class="report-document" style="padding: 2rem; background: #fff; border: 1px solid var(--gray-200); border-radius: 8px;">
                    <!-- Membrete -->
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 3px solid var(--primary); padding-bottom: 1rem; margin-bottom: 2rem;">
                        <div style="display:flex; align-items:center; gap: 1rem;">
                            <img src="insignia.jpg" alt="Insignia" style="height: 60px; width: auto; object-fit: contain;">
                            <div>
                                <h3 style="margin:0; color:var(--gray-800); font-size:1.2rem; text-transform:uppercase;">Liceo Simón Bolívar</h3>
                                <p style="margin:0; color:var(--gray-500); font-size:0.9rem;">Inspectoría General</p>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <h2 style="margin:0; font-size:1.5rem; color:var(--primary); text-transform:uppercase;">Reporte de Asistencia</h2>
                            <p style="margin:0; font-weight:600; color:var(--gray-700); text-transform:capitalize;">${fechaFormateada}</p>
                        </div>
                    </div>

                    <!-- Estadísticas Globales -->
                    <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:2rem;">
                        <div class="stat-card" style="border-left-color:var(--primary);"><div class="label">Matrícula Total</div><div class="value primary">${totalAlumnosGlobal}</div></div>
                        <div class="stat-card" style="border-left-color:var(--success);"><div class="label">Presentes</div><div class="value success">${presentesGlobal}</div></div>
                        <div class="stat-card" style="border-left-color:var(--danger);"><div class="label">Ausentes</div><div class="value danger">${ausentesGlobal}</div></div>
                        <div class="stat-card" style="border-left-color:var(--warning);"><div class="label">Sin Registro</div><div class="value warning">${sinRegistroGlobal}</div></div>
                        <div class="stat-card" style="border-left-color:var(--info);"><div class="label">Asistencia General</div><div class="value info">${porcentajeAsistencia}</div></div>
                    </div>

                    <!-- Tabla de Detalles -->
                    <h4 style="margin-bottom:1rem; border-bottom:1px solid var(--gray-200); padding-bottom:0.5rem; color:var(--gray-800);">📊 Desglose de Asistencia por Curso</h4>
                    <div class="table-responsive">
                        <table style="width:100%; border-collapse:collapse;">
                            <thead style="background-color:var(--gray-100);">
                                <tr>
                                    <th style="padding:0.75rem; border:1px solid var(--gray-200); text-align:left;">Curso</th>
                                    <th style="padding:0.75rem; border:1px solid var(--gray-200); text-align:center;">Total</th>
                                    <th style="padding:0.75rem; border:1px solid var(--gray-200); text-align:center;">Presentes</th>
                                    <th style="padding:0.75rem; border:1px solid var(--gray-200); text-align:center;">Ausentes</th>
                                    <th style="padding:0.75rem; border:1px solid var(--gray-200); text-align:center;">% Asistencia</th>
                                    <th style="padding:0.75rem; border:1px solid var(--gray-200); text-align:center;">Estado Libro</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            resumenCursos.forEach(c => {
                const porcentaje = c.total > 0 && c.tomada ? Math.round((c.presentes / c.total) * 100) : 0;
                const estadoTxt = c.tomada ? '<span style="color:var(--success);"><i class="fas fa-check-circle"></i> Tomada</span>' : '<span style="color:var(--warning);"><i class="fas fa-clock"></i> Pendiente</span>';

                html += `
                                <tr>
                                    <td style="padding:0.75rem; border:1px solid var(--gray-200);"><strong>${c.curso}</strong></td>
                                    <td style="padding:0.75rem; border:1px solid var(--gray-200); text-align:center;">${c.total}</td>
                                    <td style="padding:0.75rem; border:1px solid var(--gray-200); text-align:center; color:var(--success); font-weight:600;">${c.tomada ? c.presentes : '-'}</td>
                                    <td style="padding:0.75rem; border:1px solid var(--gray-200); text-align:center; color:var(--danger); font-weight:600;">${c.tomada ? c.ausentes : '-'}</td>
                                    <td style="padding:0.75rem; border:1px solid var(--gray-200); text-align:center; font-weight:600;">${c.tomada ? porcentaje + '%' : '-'}</td>
                                    <td style="padding:0.75rem; border:1px solid var(--gray-200); text-align:center;">${estadoTxt}</td>
                                </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>

                    <!-- Firmas -->
                    <div style="margin-top: 4rem; display: flex; justify-content: space-around; text-align: center;">
                        <div>
                            <div style="width: 200px; border-bottom: 1px solid var(--gray-500); margin-bottom: 0.5rem; margin-inline: auto;"></div>
                            <p style="margin:0; font-size:0.9rem; color:var(--gray-800); font-weight:600;">Inspector(a) General</p>
                            <p style="margin:0; font-size:0.8rem; color:var(--gray-500);">Firma y Timbre</p>
                        </div>
                        <div>
                            <div style="width: 200px; border-bottom: 1px solid var(--gray-500); margin-bottom: 0.5rem; margin-inline: auto;"></div>
                            <p style="margin:0; font-size:0.9rem; color:var(--gray-800); font-weight:600;">Director(a)</p>
                            <p style="margin:0; font-size:0.8rem; color:var(--gray-500);">Toma de Conocimiento</p>
                        </div>
                    </div>

                    <!-- Pie de página -->
                    <div style="margin-top:3rem; padding-top:1rem; font-size:0.75rem; color:var(--gray-500); text-align:right;">
                        <i class="fas fa-print"></i> Documento oficial generado por Plataforma Inspectoría · ${new Date().toLocaleString('es-CL')}
                    </div>
                </div>
            `;

            container.innerHTML = html;
            // Reporte diario generado silenciosamente
        }

        function imprimirReporteDiario() {
            const content = document.getElementById('reporteDiarioContainer');
            if (content.querySelector('.empty-state')) {
                showToast('Primero debes hacer clic en "Generar"', 'warning');
                return;
            }

            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`
                <html>
                <head>
                    <title>Reporte Diario</title>
                    ${document.head.innerHTML}
                    <style>
                        /* Estilos específicos para limpieza de impresión */
                        body { background: white !important; padding: 2rem !important; margin: 0 !important; }
                        .report-document { border: none !important; box-shadow: none !important; padding: 0 !important; }
                    </style>
                </head>
                <body>
                    ${content.innerHTML}
                </body>
                </html>
            `);
            doc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => document.body.removeChild(iframe), 1000);
            }, 500);
        }

        async function exportarReporteDiarioPDF() {
            const content = document.getElementById('reporteDiarioContainer');
            if (content.querySelector('.empty-state')) {
                showToast('Primero debes hacer clic en "Generar"', 'warning');
                return;
            }
            showToast('Generando PDF, por favor espere...', 'info');
            try {
                const canvas = await html2canvas(content, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                pdf.save('Reporte_Diario.pdf');
                showToast('✅ PDF exportado correctamente', 'success');
            } catch (err) {
                console.error(err);
                showToast('Error al generar PDF', 'error');
            }
        }

        window.limpiarFiltrosReporteDiario = function() {
            const fechaInput = document.getElementById('reporteFecha');
            if (fechaInput) fechaInput.value = '';

            const container = document.getElementById('reporteDiarioContainer');
            if (container) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>Seleccione una fecha y presione "Generar"</p></div>';
            }
        };
