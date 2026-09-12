// ==========================================
// 10. GENERADOR DE INFORMES DINÁMICOS
// ==========================================
function cambiarFiltroInforme() {
    const tipo = document.getElementById('filtroTipoInforme').value;
    const selectCurso = document.getElementById('filtroInformeCurso');
    const wrapperAlumno = document.getElementById('filtroInformeAlumnoWrapper');
    const selectMes = document.getElementById('filtroInformeMes');

    selectCurso.style.display = 'none';
    wrapperAlumno.style.display = 'none';
    selectMes.style.display = 'none';

    if (tipo) {
        selectMes.style.display = 'block';
        // Inicializar en el mes actual la primera vez que se interactúa
        if (selectMes.dataset.initialized !== 'true') {
            const currentMonth = new Date().getMonth();
            if (currentMonth < 2) {
                selectMes.value = '2'; // Por defecto Marzo
            } else {
                selectMes.value = currentMonth.toString();
            }
            selectMes.dataset.initialized = 'true';
        }
    }

    if (tipo === 'curso' || tipo === 'correlacion') {
        selectCurso.style.display = 'block';
        selectCurso.innerHTML = '<option value="">Seleccione curso...</option>' +
            cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } else if (tipo === 'alumno') {
        wrapperAlumno.style.display = 'flex';
        const datalist = document.getElementById('listaEstudiantesInforme');
        datalist.innerHTML = alumnos.map(a => `<option value="${a.rut} | ${a.nombre}">${a.rut} | ${removeAccents(a.nombre)}</option>`).join('');
    }
}

function limpiarBusquedaAlumno() {
    const input = document.getElementById('filtroInformeAlumno');
    input.value = '';
    document.getElementById('informeSemanalContainer').innerHTML = `
                <div class="empty-state"><i class="fas fa-file-alt"></i>
                    <p>Seleccione un tipo de informe y haga clic en <strong>Generar</strong> para ver los resultados.</p>
                </div>
            `;
    input.focus();
}

function obtenerSimilitud(s1, s2) {
    let longer = s1.toLowerCase();
    let shorter = s2.toLowerCase();
    if (s1.length < s2.length) {
        longer = s2.toLowerCase();
        shorter = s1.toLowerCase();
    }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

function generarInformeDinamico() {
    const tipo = document.getElementById('filtroTipoInforme').value;
    const container = document.getElementById('informeSemanalContainer');

    if (!tipo) {
        showToast('Seleccione un tipo de informe', 'warning');
        return;
    }

    const mesSeleccionado = document.getElementById('filtroInformeMes').value;
    const esAnual = mesSeleccionado === 'todos';
    const mesFiltroNum = esAnual ? -1 : parseInt(mesSeleccionado);
    const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const etiquetaPeriodo = esAnual ? "Anual (Todo el año)" : nombresMeses[mesFiltroNum];
    const currentYear = new Date().getFullYear();

    if (tipo === 'curso') {
        const cursoIdValue = document.getElementById('filtroInformeCurso').value;
        if (!cursoIdValue) {
            showToast('Seleccione un curso', 'warning');
            return;
        }
        const cursoId = parseInt(cursoIdValue);
        const curso = cursos.find(c => c.id === cursoId);
        const alumnosCurso = alumnos.filter(a => a.cursoId === cursoId);

        // --- DATOS DEL CURSO ---
        // 1. Asistencia
        let totalPresentes = 0;
        let totalAusentes = 0;
        const faltasPorAlumno = {};

        asistenciaRegistros.forEach(record => {
            const dInfo = parseYearMonth(record.fecha);
            const añoCoincide = dInfo.year === currentYear;
            const mesCoincide = esAnual || dInfo.month === mesFiltroNum;

            if (añoCoincide && mesCoincide) {
                const dt = new Date(record.fecha + 'T00:00:00');
                const dayOfWeek = dt.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6 && record.cursoId === cursoId) {
                    record.registros.forEach(reg => {
                        const alumno = alumnos.find(a => a.nombre.trim().toLowerCase() === reg.alumno.trim().toLowerCase() && a.estado !== 'retirado');
                        const estadoNormal = reg.estado ? reg.estado.trim().toLowerCase() : '';
                        if (alumno && estadoNormal === 'ausente') {
                            totalAusentes++;
                            faltasPorAlumno[reg.alumno] = (faltasPorAlumno[reg.alumno] || 0) + 1;
                        } else if (alumno && (estadoNormal === 'presente' || estadoNormal === 'tarde')) {
                            totalPresentes++;
                        }
                    });
                }
            }
        });
        const totalAsistencia = totalPresentes + totalAusentes;
        const porcentaje = totalAsistencia > 0 ? `${Math.round((totalPresentes / totalAsistencia) * 100)}%` : 'Sin datos';

        // 2. Top Faltas (Alumnos del curso en Riesgo)
        const umbralRiesgo = esAnual ? 15 : 4;
        const enRiesgo = Object.entries(faltasPorAlumno)
            .map(([nombre, faltas]) => ({ nombre, faltas }))
            .filter(a => a.faltas >= umbralRiesgo)
            .sort((a, b) => b.faltas - a.faltas);

        // 3. Resumen de Novedades del Curso (Filtrado por periodo)
        const nombresAlumnosCurso = alumnosCurso.map(a => a.nombre.trim().toLowerCase());
        const bitacoraCurso = bitacoraLlamadas.filter(b => {
            if (!b.estudiante) return false;
            const esDeCurso = nombresAlumnosCurso.includes(b.estudiante.trim().toLowerCase());
            if (!esDeCurso) return false;
            const dInfo = parseYearMonth(b.fecha);
            const añoCoincide = dInfo.year === currentYear;
            const mesCoincide = esAnual || dInfo.month === mesFiltroNum;
            return añoCoincide && mesCoincide;
        });

        // --- RENDER HTML CURSO ---
        container.innerHTML = `
                <div class="report-document" style="padding: 2rem; background: #fff; border: 1px solid var(--gray-200); border-radius: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 3px solid var(--primary); padding-bottom: 1rem; margin-bottom: 2rem;">
                        <div style="display:flex; align-items:center; gap: 1rem;">
                            <img src="insignia.jpg" alt="Insignia" style="height: 60px; width: auto; object-fit: contain;">
                            <div>
                                <h3 style="margin:0; color:var(--gray-800); font-size:1.2rem; text-transform:uppercase;">Liceo Simón Bolívar</h3>
                                <p style="margin:0; color:var(--gray-500); font-size:0.9rem;">Inspectoría General</p>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <h2 style="margin:0; font-size:1.5rem; color:var(--primary); text-transform:uppercase;">Informe de Curso</h2>
                            <p style="margin:0; font-weight:600; color:var(--gray-700);">${curso.nombre}</p>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:20px; margin-bottom: 2rem; flex-wrap:wrap;">
                        <div style="flex:1; min-width:200px; padding:1.5rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; text-align:center;">
                            <h4 style="margin:0 0 10px 0; color:var(--gray-600);">Matrícula</h4>
                            <div style="font-size:2.5rem; font-weight:700; color:var(--primary);">${alumnosCurso.filter(a => a.estado !== 'retirado').length}</div>
                        </div>
                        <div style="flex:1; min-width:200px; padding:1.5rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; text-align:center;">
                            <h4 style="margin:0 0 10px 0; color:var(--gray-600);">Asistencia Promedio (${esAnual ? 'Anual' : 'Mes'})</h4>
                            <div style="font-size:2.5rem; font-weight:700; color:${porcentaje === 'Sin datos' ? 'var(--gray-500)' : (parseInt(porcentaje) < (window.configuracionGlobal?.riesgo_medio || 85) ? 'var(--danger)' : 'var(--success)')};">${porcentaje}</div>
                        </div>
                        <div style="flex:1; min-width:200px; padding:1.5rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; text-align:center; display:none !important;">
                            <h4 style="margin:0 0 10px 0; color:var(--gray-600);">Total Novedades (${esAnual ? 'Anual' : 'Mes'})</h4>
                            <div style="font-size:2.5rem; font-weight:700; color:var(--info);">${bitacoraCurso.length}</div>
                        </div>
                    </div>

                    <h3 style="border-bottom: 2px solid var(--gray-200); padding-bottom: 0.5rem; color: var(--gray-800); margin-top: 2rem;"><i class="fas fa-exclamation-triangle" style="color:var(--danger);"></i> Estudiantes en Riesgo (Faltas Críticas: ${esAnual ? 'Anual' : 'Mes'})</h3>
                    ${enRiesgo.length > 0 ? `
                        <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
                            <thead>
                                <tr style="background:var(--gray-100);">
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:left;">Estudiante</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:center;">Inasistencias</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:center;">Gravedad</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${enRiesgo.map(a => `
                                <tr>
                                    <td style="padding:10px; border:1px solid var(--gray-300);"><strong>${a.nombre}</strong>${getBadgeRiesgo(a.nombre)}</td>
                                    <td style="padding:10px; border:1px solid var(--gray-300); text-align:center; font-weight:bold; font-size:1.1rem;">${a.faltas}</td>
                                    <td style="padding:10px; border:1px solid var(--gray-300); text-align:center;"><span class="badge-status" style="background:${esAnual ? (a.faltas >= 20 ? 'var(--danger)' : 'var(--warning)') : (a.faltas >= 6 ? 'var(--danger)' : 'var(--warning)')}; color:white;">${esAnual ? (a.faltas >= 20 ? 'Crítico (Roja)' : 'Alerta (Naranja)') : (a.faltas >= 6 ? 'Crítico (Roja)' : 'Alerta (Naranja)')}</span></td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : `<p style="color:var(--success); font-weight:600;"><i class="fas fa-check-circle"></i> No hay alumnos en riesgo por asistencia en este periodo (${etiquetaPeriodo}).</p>`}

                    <div style="display: none !important;">
                        <h3 style="border-bottom: 2px solid var(--gray-200); padding-bottom: 0.5rem; color: var(--gray-800); margin-top: 3rem;"><i class="fas fa-book" style="color:var(--info);"></i> Últimas Novedades (Últimos 10 registros)</h3>
                    ${bitacoraCurso.length > 0 ? `
                        <ul style="list-style:none; padding:0;">
                            ${bitacoraCurso.slice(0, 10).map(b => `
                                <li style="padding:10px; border:1px solid var(--gray-200); border-radius:6px; margin-bottom:10px; background:var(--gray-50);">
                                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                        <strong>${b.estudiante}</strong>
                                        <span style="color:var(--gray-500); font-size:0.9rem;">${b.fecha}</span>
                                    </div>
                                    <div style="margin-bottom:5px;"><span class="badge-status" style="background:#e0e7ff; color:#3730a3;">${b.categoria || 'Otro'}</span></div>
                                    <p style="margin:0; font-size:0.9rem; color:var(--gray-700);">${b.motivo}</p>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p style="color:var(--gray-500);">No hay registros en bitácora para este curso.</p>'}
                    </div>

                    <div style="margin-top: 4rem; text-align: center; font-size:0.9rem; color:var(--gray-500);">
                        <p>Documento oficial generado por Plataforma Inspectoría · ${new Date().toLocaleString('es-CL')}</p>
                    </div>
                </div>`;
        showToast('Informe de curso generado', 'success');

    } else if (tipo === 'directivo') {
        // --- DATOS DIRECTIVOS ---
        const currentYear = new Date().getFullYear();
        let totalPresentes = 0;
        let totalAusentes = 0;
        const asistenciaPorCurso = {};

        cursos.forEach(c => asistenciaPorCurso[c.id] = { presentes: 0, ausentes: 0, nombre: c.nombre });

        asistenciaRegistros.forEach(record => {
            const dInfo = parseYearMonth(record.fecha);
            const añoCoincide = dInfo.year === currentYear;
            const mesCoincide = esAnual || dInfo.month === mesFiltroNum;
            if (añoCoincide && mesCoincide) {
                const dt = new Date(record.fecha + 'T00:00:00');
                const dayOfWeek = dt.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    record.registros.forEach(reg => {
                        const alumno = alumnos.find(a => a.nombre.trim().toLowerCase() === reg.alumno.trim().toLowerCase() && a.estado !== 'retirado');
                        if (alumno) {
                            const estadoNormal = reg.estado ? reg.estado.trim().toLowerCase() : '';
                            if (estadoNormal === 'ausente') {
                                totalAusentes++;
                                if (asistenciaPorCurso[alumno.cursoId]) asistenciaPorCurso[alumno.cursoId].ausentes++;
                            } else if (estadoNormal === 'presente' || estadoNormal === 'tarde') {
                                totalPresentes++;
                                if (asistenciaPorCurso[alumno.cursoId]) asistenciaPorCurso[alumno.cursoId].presentes++;
                            }
                        }
                    });
                }
            }
        });

        const totalAsistencia = totalPresentes + totalAusentes;
        const porcentajeGeneral = totalAsistencia > 0 ? `${Math.round((totalPresentes / totalAsistencia) * 100)}%` : 'Sin datos';

        const ranking = Object.values(asistenciaPorCurso).map(c => {
            const total = c.presentes + c.ausentes;
            const porc = total > 0 ? Math.round((c.presentes / total) * 100) : 0;
            return { nombre: c.nombre, porcentaje: porc, total: total };
        }).filter(c => c.total > 0).sort((a, b) => b.porcentaje - a.porcentaje);

        const top3 = ranking.filter(c => c.porcentaje > 0).slice(0, 3);
        const bottom3 = ranking.filter(c => c.porcentaje < 100).slice().reverse().slice(0, 3);

        let totalNovedadesPeriodo = 0;
        bitacoraLlamadas.forEach(b => {
            const dInfo = parseYearMonth(b.fecha);
            const añoCoincide = dInfo.year === currentYear;
            const mesCoincide = esAnual || dInfo.month === mesFiltroNum;
            if (añoCoincide && mesCoincide) {
                totalNovedadesPeriodo++;
            }
        });

        container.innerHTML = `
                <div class="report-document" style="padding: 2rem; background: #fff; border: 1px solid var(--gray-200); border-radius: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 3px solid var(--primary); padding-bottom: 1rem; margin-bottom: 2rem;">
                        <div style="display:flex; align-items:center; gap: 1rem;">
                            <img src="insignia.jpg" alt="Insignia" style="height: 60px; width: auto; object-fit: contain;">
                            <div>
                                <h3 style="margin:0; color:var(--gray-800); font-size:1.2rem; text-transform:uppercase;">Liceo Simón Bolívar</h3>
                                <p style="margin:0; color:var(--gray-500); font-size:0.9rem;">Inspectoría General</p>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <h2 style="margin:0; font-size:1.5rem; color:var(--primary); text-transform:uppercase;">Reporte Directivo Consolidado</h2>
                            <p style="margin:0; font-weight:600; color:var(--gray-700);">${etiquetaPeriodo}</p>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:20px; margin-bottom: 2rem; flex-wrap:wrap;">
                        <div style="flex:1; min-width:200px; padding:1.5rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; text-align:center;">
                            <h4 style="margin:0 0 10px 0; color:var(--gray-600);">Matrícula Total</h4>
                            <div style="font-size:2.5rem; font-weight:700; color:var(--primary);">${alumnos.filter(a => a.estado !== 'retirado').length}</div>
                        </div>
                        <div style="flex:1; min-width:200px; padding:1.5rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; text-align:center;">
                            <h4 style="margin:0 0 10px 0; color:var(--gray-600);">Asistencia General</h4>
                            <div style="font-size:2.5rem; font-weight:700; color:${porcentajeGeneral === 'Sin datos' ? 'var(--gray-500)' : (parseInt(porcentajeGeneral) < (window.configuracionGlobal?.riesgo_medio || 85) ? 'var(--danger)' : 'var(--success)')};">${porcentajeGeneral}</div>
                        </div>
                        <div style="flex:1; min-width:200px; padding:1.5rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; text-align:center; display:none !important;">
                            <h4 style="margin:0 0 10px 0; color:var(--gray-600);">Total Novedades (${esAnual ? 'Anual' : 'Mes'})</h4>
                            <div style="font-size:2.5rem; font-weight:700; color:var(--info);">${totalNovedadesPeriodo}</div>
                        </div>
                    </div>

                    <div style="display:flex; gap:20px; margin-bottom: 2rem; flex-wrap:wrap;">
                        <div style="flex:1; min-width:300px; background:var(--gray-50); padding:1rem; border-radius:8px; border:1px solid var(--gray-200);">
                            <h3 style="border-bottom: 2px solid var(--success); padding-bottom: 0.5rem; color: var(--gray-800); margin-top:0;"><i class="fas fa-trophy" style="color:var(--success);"></i> Mejores Asistencias</h3>
                            <ul style="list-style:none; padding:0; margin:0;">
                                ${top3.length > 0 ? top3.map((c, i) => `<li style="padding:10px; border-bottom:1px solid var(--gray-200); display:flex; justify-content:space-between;"><span>${i + 1}. ${c.nombre}</span> <strong style="color:var(--success);">${c.porcentaje}%</strong></li>`).join('') : '<li>Sin datos</li>'}
                            </ul>
                        </div>
                        <div style="flex:1; min-width:300px; background:var(--gray-50); padding:1rem; border-radius:8px; border:1px solid var(--gray-200);">
                            <h3 style="border-bottom: 2px solid var(--danger); padding-bottom: 0.5rem; color: var(--gray-800); margin-top:0;"><i class="fas fa-exclamation-triangle" style="color:var(--danger);"></i> Peores Asistencias</h3>
                            <ul style="list-style:none; padding:0; margin:0;">
                                ${bottom3.length > 0 ? bottom3.map((c, i) => `<li style="padding:10px; border-bottom:1px solid var(--gray-200); display:flex; justify-content:space-between;"><span>${i + 1}. ${c.nombre}</span> <strong style="color:var(--danger);">${c.porcentaje}%</strong></li>`).join('') : '<li>Sin datos</li>'}
                            </ul>
                        </div>
                    </div>

                    <div style="margin-top: 4rem; text-align: center; font-size:0.9rem; color:var(--gray-500);">
                        <p>Documento oficial generado por Plataforma Inspectoría · ${new Date().toLocaleString('es-CL')}</p>
                    </div>
                </div>`;
        showToast('Reporte directivo generado', 'success');

    } else if (tipo === 'sat') {
        // --- SISTEMA DE ALERTA TEMPRANA (S.A.T.) ---
        const currentYear = new Date().getFullYear();
        const faltasPorAlumno = {};
        const bitacoraPorAlumno = {};

        asistenciaRegistros.forEach(record => {
            const dInfo = parseYearMonth(record.fecha);
            const añoCoincide = dInfo.year === currentYear;
            const mesCoincide = esAnual || dInfo.month === mesFiltroNum;

            if (añoCoincide && mesCoincide) {
                const dt = new Date(record.fecha + 'T00:00:00');
                const dayOfWeek = dt.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    record.registros.forEach(reg => {
                        const estadoNormal = reg.estado ? reg.estado.trim().toLowerCase() : '';
                        if (estadoNormal === 'ausente') {
                            faltasPorAlumno[reg.alumno] = (faltasPorAlumno[reg.alumno] || 0) + 1;
                        }
                    });
                }
            }
        });

        bitacoraLlamadas.forEach(b => {
            if (!b.estudiante) return;
            const dInfo = parseYearMonth(b.fecha);
            const añoCoincide = dInfo.year === currentYear;
            const mesCoincide = esAnual || dInfo.month === mesFiltroNum;

            if (añoCoincide && mesCoincide) {
                bitacoraPorAlumno[b.estudiante] = (bitacoraPorAlumno[b.estudiante] || 0) + 1;
            }
        });

        const casosCriticos = [];
        const umbralFaltas = esAnual ? 15 : 4;
        const umbralIncidentes = esAnual ? 15 : 5;

        alumnos.forEach(a => {
            const faltas = faltasPorAlumno[a.nombre] || 0;
            const incidentes = bitacoraPorAlumno[a.nombre] || 0;
            const curso = cursos.find(c => c.id === a.cursoId);

            if (faltas >= umbralFaltas || incidentes >= umbralIncidentes) {
                let nivel = 'Amarilla';
                if (esAnual) {
                    if (faltas >= 25 || incidentes >= 25) nivel = 'Roja';
                    else if (faltas >= 20 || incidentes >= 20) nivel = 'Naranja';
                } else {
                    if (faltas >= 6 || incidentes >= 10) nivel = 'Roja';
                    else if (faltas >= 5 || incidentes >= 7) nivel = 'Naranja';
                }

                casosCriticos.push({
                    nombre: a.nombre,
                    curso: curso ? curso.nombre : 'Sin curso',
                    faltas: faltas,
                    incidentes: incidentes,
                    nivel: nivel
                });
            }
        });

        const severityOrder = { 'Roja': 1, 'Naranja': 2, 'Amarilla': 3 };
        casosCriticos.sort((a, b) => {
            if (severityOrder[a.nivel] !== severityOrder[b.nivel]) return severityOrder[a.nivel] - severityOrder[b.nivel];
            return b.faltas - a.faltas;
        });

        container.innerHTML = `
                <div class="report-document" style="padding: 2rem; background: #fff; border: 1px solid var(--gray-200); border-radius: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 3px solid var(--primary); padding-bottom: 1rem; margin-bottom: 2rem;">
                        <div style="display:flex; align-items:center; gap: 1rem;">
                            <img src="insignia.jpg" alt="Insignia" style="height: 60px; width: auto; object-fit: contain;">
                            <div>
                                <h3 style="margin:0; color:var(--gray-800); font-size:1.2rem; text-transform:uppercase;">Liceo Simón Bolívar</h3>
                                <p style="margin:0; color:var(--gray-500); font-size:0.9rem;">Inspectoría General / S.A.T.</p>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <h2 style="margin:0; font-size:1.5rem; color:var(--primary); text-transform:uppercase;">Sistema de Alerta Temprana</h2>
                            <p style="margin:0; font-weight:600; color:var(--gray-700);">Prevención de Deserción Escolar</p>
                        </div>
                    </div>
                    
                    <p style="color:var(--gray-600); margin-bottom:2rem;">Este reporte lista a los estudiantes de todo el establecimiento que se encuentran en riesgo alto debido a inasistencias críticas en el periodo (${etiquetaPeriodo})</p>

                    <div style="display:flex; gap:20px; margin-bottom: 2rem; flex-wrap:wrap;">
                        <div style="flex:1; min-width:200px; padding:1.5rem; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; text-align:center;">
                            <h4 style="margin:0 0 10px 0; color:#b91c1c;">Total Casos S.A.T. (${etiquetaPeriodo})</h4>
                            <div style="font-size:2.5rem; font-weight:700; color:#991b1b;">${casosCriticos.length}</div>
                        </div>
                    </div>

                    ${casosCriticos.length > 0 ? `
                        <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
                            <thead>
                                <tr style="background:var(--gray-100);">
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:left;">Estudiante</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:left;">Curso</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:center;">Faltas (${esAnual ? 'Anual' : 'Mes'})</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:center; display:none !important;">Novedades (${esAnual ? 'Anual' : 'Mes'})</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:center;">Nivel Riesgo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${casosCriticos.map(c => {
            let badgeColor = '', badgeBg = '';
            if (c.nivel === 'Roja') { badgeColor = '#b91c1c'; badgeBg = '#fee2e2'; }
            else if (c.nivel === 'Naranja') { badgeColor = '#c2410c'; badgeBg = '#ffedd5'; }
            else { badgeColor = '#b45309'; badgeBg = '#fef3c7'; }

            return `
                                    <tr>
                                        <td style="padding:10px; border:1px solid var(--gray-300); font-weight:600;">${c.nombre}</td>
                                        <td style="padding:10px; border:1px solid var(--gray-300);">${c.curso}</td>
                                        <td style="padding:10px; border:1px solid var(--gray-300); text-align:center; font-weight:bold; color:${c.faltas >= umbralFaltas ? 'var(--danger)' : 'inherit'};">${c.faltas}</td>
                                        <td style="padding:10px; border:1px solid var(--gray-300); text-align:center; display:none !important;">${c.incidentes}</td>
                                        <td style="padding:10px; border:1px solid var(--gray-300); text-align:center;">
                                            <span style="background:${badgeBg}; color:${badgeColor}; padding:4px 8px; border-radius:4px; font-weight:bold; font-size:0.85rem;">${c.nivel}</span>
                                        </td>
                                    </tr>
                                    `;
        }).join('')}
                            </tbody>
                        </table>
                    ` : '<div style="padding:2rem; text-align:center; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; color:#065f46; font-weight:bold;">¡Felicidades! No hay estudiantes en niveles críticos de riesgo actualmente.</div>'}

                    <div style="margin-top: 4rem; text-align: center; font-size:0.9rem; color:var(--gray-500);">
                        <p>Documento oficial generado por Plataforma Inspectoría · ${new Date().toLocaleString('es-CL')}</p>
                    </div>
                </div>`;
        showToast('Reporte S.A.T. generado', 'success');

    } else if (tipo === 'correlacion') {
        // --- CORRELACIÓN ACADÉMICA / GRILLA ASISTENCIA ---
        const cursoIdValue = document.getElementById('filtroInformeCurso').value;
        if (!cursoIdValue) {
            showToast('Seleccione un curso', 'warning');
            return;
        }
        const cursoId = parseInt(cursoIdValue);
        const curso = cursos.find(c => c.id === cursoId);
        const alumnosCurso = alumnos.filter(a => a.cursoId === cursoId);

        const currentYear = new Date().getFullYear();
        let grillaHTML = '';

        if (esAnual) {
            // --- GRILLA ANUAL POR MESES ---
            const mesesValidos = [
                { val: 2, label: 'Marzo' },
                { val: 3, label: 'Abril' },
                { val: 4, label: 'Mayo' },
                { val: 5, label: 'Junio' },
                { val: 6, label: 'Julio' },
                { val: 7, label: 'Agosto' },
                { val: 8, label: 'Septiembre' },
                { val: 9, label: 'Octubre' },
                { val: 10, label: 'Noviembre' },
                { val: 11, label: 'Diciembre' }
            ];

            const asistenciaMensual = {};
            alumnosCurso.forEach(a => {
                asistenciaMensual[a.nombre] = {};
                mesesValidos.forEach(m => {
                    asistenciaMensual[a.nombre][m.val] = { presentes: 0, totales: 0 };
                });
            });

            asistenciaRegistros.forEach(record => {
                const dInfo = parseYearMonth(record.fecha);
                if (dInfo.year === currentYear && record.cursoId === cursoId) {
                    const mes = dInfo.month;
                    if (mes >= 2 && mes <= 11) {
                        record.registros.forEach(reg => {
                            const aNombre = reg.alumno;
                            if (asistenciaMensual[aNombre]) {
                                const estadoNormal = reg.estado ? reg.estado.trim().toLowerCase() : '';
                                if (estadoNormal === 'presente' || estadoNormal === 'tarde') {
                                    asistenciaMensual[aNombre][mes].presentes++;
                                    asistenciaMensual[aNombre][mes].totales++;
                                } else if (estadoNormal === 'ausente') {
                                    asistenciaMensual[aNombre][mes].totales++;
                                }
                            }
                        });
                    }
                }
            });

            grillaHTML = `
                        <table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-bottom: 2rem;">
                            <thead>
                                <tr>
                                    <th style="padding:8px; border:1px solid var(--gray-400); background:var(--gray-100); text-align:left; min-width:180px;">Estudiante</th>
                                    ${mesesValidos.map(m => `<th style="padding:8px; border:1px solid var(--gray-400); background:var(--gray-100); text-align:center; min-width:60px;">${m.label}</th>`).join('')}
                                    <th style="padding:8px; border:1px solid var(--gray-400); background:var(--gray-200); text-align:center; min-width:80px;">Asist. Anual</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${alumnosCurso.map(a => {
                let sumaTotalPresentes = 0;
                let sumaTotalClases = 0;

                const celdasMeses = mesesValidos.map(m => {
                    const datosMes = asistenciaMensual[a.nombre][m.val];
                    if (datosMes && datosMes.totales > 0) {
                        const pct = Math.round((datosMes.presentes / datosMes.totales) * 100);
                        sumaTotalPresentes += datosMes.presentes;
                        sumaTotalClases += datosMes.totales;

                        const bg = pct < (window.configuracionGlobal?.riesgo_medio || 85) ? '#fee2e2' : '#dcfce7';
                        const color = pct < (window.configuracionGlobal?.riesgo_medio || 85) ? '#b91c1c' : '#15803d';
                        return `<td style="padding:6px; border:1px solid var(--gray-300); text-align:center; background:${bg}; color:${color}; font-weight:bold;">${pct}%</td>`;
                    } else {
                        return `<td style="padding:6px; border:1px solid var(--gray-300); text-align:center; color:var(--gray-400); background:#f9fafb;">-</td>`;
                    }
                }).join('');

                const promedioAnual = sumaTotalClases > 0 ? Math.round((sumaTotalPresentes / sumaTotalClases) * 100) : 0;
                const anualBg = promedioAnual < (window.configuracionGlobal?.riesgo_medio || 85) ? '#fee2e2' : '#dcfce7';
                const anualColor = promedioAnual < (window.configuracionGlobal?.riesgo_medio || 85) ? '#b91c1c' : '#15803d';

                return `
                                    <tr>
                                        <td style="padding:8px; border:1px solid var(--gray-300); font-weight:600;">${a.nombre}</td>
                                        ${celdasMeses}
                                        <td style="padding:8px; border:1px solid var(--gray-400); background:${anualBg}; color:${anualColor}; text-align:center; font-weight:bold; font-size:0.9rem;">${sumaTotalClases > 0 ? promedioAnual + '%' : '-'}</td>
                                    </tr>`;
            }).join('')}
                            </tbody>
                        </table>`;
        } else {
            // --- MANTENER LA GRILLA DE ASISTENCIA DIARIA DEL MES SELECCIONADO ---
            const diasConRegistro = new Set();
            asistenciaRegistros.forEach(record => {
                const dInfo = parseYearMonth(record.fecha);
                if (dInfo.year === currentYear && dInfo.month === mesFiltroNum) {
                    if (record.cursoId === cursoId) {
                        const dt = new Date(record.fecha + 'T00:00:00');
                        const dayOfWeek = dt.getDay();
                        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                            diasConRegistro.add(record.fecha);
                        }
                    }
                }
            });

            const diasOrdenados = Array.from(diasConRegistro).sort((a, b) => new Date(a) - new Date(b));

            if (diasOrdenados.length === 0) {
                showToast(`No hay registros de asistencia en ${etiquetaPeriodo} para este curso.`, 'warning');
                container.innerHTML = `<div class="alert alert-warning">No hay registros de asistencia en ${etiquetaPeriodo} para este curso.</div>`;
                return;
            }

            const matrizAsistencia = {};
            alumnosCurso.forEach(a => matrizAsistencia[a.nombre] = {});

            asistenciaRegistros.forEach(record => {
                if (diasConRegistro.has(record.fecha) && record.cursoId === cursoId) {
                    record.registros.forEach(reg => {
                        if (matrizAsistencia[reg.alumno] !== undefined) {
                            matrizAsistencia[reg.alumno][record.fecha] = reg.estado;
                        }
                    });
                }
            });

            const celdasHeader = diasOrdenados.map(d => `<th style="padding:6px; border:1px solid var(--gray-400); background:var(--gray-100); text-align:center; min-width:30px;" title="${d}">${d.split('-')[2]}</th>`).join('');

            const filasAlumnos = alumnosCurso.map(a => {
                let p = 0, aus = 0;
                const celdas = diasOrdenados.map(d => {
                    const est = matrizAsistencia[a.nombre][d];
                    let bg = 'transparent', texto = '';
                    if (est === 'presente') { bg = '#dcfce7'; texto = 'P'; p++; }
                    else if (est === 'ausente') { bg = '#fee2e2'; texto = 'A'; aus++; }
                    else if (est === 'tarde') { bg = '#fef3c7'; texto = 'T'; p++; }
                    return `<td style="padding:4px; border:1px solid var(--gray-300); text-align:center; background:${bg}; font-weight:bold;">${texto}</td>`;
                }).join('');

                const total = p + aus;
                const porc = total > 0 ? Math.round((p / total) * 100) : 0;
                const porcBg = porc < (window.configuracionGlobal?.riesgo_medio || 85) ? '#fee2e2' : '#dcfce7';
                const porcColor = porc < (window.configuracionGlobal?.riesgo_medio || 85) ? '#b91c1c' : '#15803d';

                return `
                                    <tr>
                                        <td style="padding:6px; border:1px solid var(--gray-300); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;" title="${a.nombre}">${a.nombre}</td>
                                        ${celdas}
                                        <td style="padding:6px; border:1px solid var(--gray-400); background:${porcBg}; color:${porcColor}; text-align:center; font-weight:bold;">${porc}%</td>
                                    </tr>`;
            }).join('');

            grillaHTML = `
                        <div style="display:flex; gap: 15px; margin-bottom: 1rem; font-size:0.85rem; font-weight:bold;">
                            <div style="display:flex; align-items:center; gap:5px;"><span style="display:inline-block; width:15px; height:15px; background:#dcfce7; border:1px solid #86efac;"></span> Presente (P)</div>
                            <div style="display:flex; align-items:center; gap:5px;"><span style="display:inline-block; width:15px; height:15px; background:#fee2e2; border:1px solid #fca5a5;"></span> Ausente (A)</div>
                        </div>

                        <table style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-bottom: 2rem;">
                            <thead>
                                <tr>
                                    <th style="padding:6px; border:1px solid var(--gray-400); background:var(--gray-100); text-align:left; min-width:180px;">Estudiante</th>
                                    ${celdasHeader}
                                    <th style="padding:6px; border:1px solid var(--gray-400); background:var(--gray-200); text-align:center;">% Asist.</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filasAlumnos}
                            </tbody>
                        </table>`;
        }

        container.innerHTML = `
                <div class="report-document" style="padding: 2rem; background: #fff; border: 1px solid var(--gray-200); border-radius: 8px; width: 100%; overflow-x: auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 3px solid var(--primary); padding-bottom: 1rem; margin-bottom: 2rem;">
                        <div style="display:flex; align-items:center; gap: 1rem;">
                            <img src="insignia.jpg" alt="Insignia" style="width: 70px; height: auto; margin-bottom: 10px; border-radius: 8px; object-fit: contain;">
                            <div>
                                <h3 style="margin:0; color:var(--gray-800); font-size:1.2rem; text-transform:uppercase;">Liceo Simón Bolívar</h3>
                                <p style="margin:0; color:var(--gray-500); font-size:0.9rem;">Inspectoría General / U.T.P.</p>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <h2 style="margin:0; font-size:1.5rem; color:var(--primary); text-transform:uppercase;">Correlación Académica</h2>
                            <p style="margin:0; font-weight:600; color:var(--gray-700);">Grilla ${esAnual ? 'Anual' : 'Mensual'}: ${curso.nombre}</p>
                        </div>
                    </div>
                    
                    <p style="color:var(--gray-600); margin-bottom:1rem;">Esta grilla detalla la asistencia del curso en el periodo (${etiquetaPeriodo}). Puede cruzar esta información con el calendario de evaluaciones para identificar patrones de inasistencia en días de pruebas o periodos clave.</p>

                    ${grillaHTML}

                    <div style="margin-top: 4rem; text-align: center; font-size:0.9rem; color:var(--gray-500);">
                        <p>Documento oficial generado por Plataforma Inspectoría · ${new Date().toLocaleString('es-CL')}</p>
                    </div>
                </div>`;
        showToast('Reporte correlación académica generado', 'success');

    } else if (tipo === 'alumno') {
        const inputVal = document.getElementById('filtroInformeAlumno').value.trim();
        if (!inputVal) {
            showToast('Escriba y seleccione un alumno', 'warning');
            return;
        }

        let alumno = null;
        // 1. Intentar buscar por RUT si viene con el formato del datalist (RUT | Nombre)
        const parts = inputVal.split(' | ');
        if (parts.length > 1) {
            const rutBuscado = parts[0].trim().toLowerCase();
            alumno = alumnos.find(a => a.rut.toLowerCase() === rutBuscado);
        }

        // 2. Si no se encuentra, buscar por coincidencia exacta de RUT
        if (!alumno) {
            alumno = alumnos.find(a => a.rut.toLowerCase() === inputVal.toLowerCase());
        }

        // 3. Buscar si todos los términos ingresados por el usuario están en el nombre o RUT (independiente del orden y mayúsculas/minúsculas)
        if (!alumno) {
            const searchTerms = normalizeSearchText(inputVal).split(/\s+/).filter(t => t.length > 0);
            alumno = alumnos.find(a => {
                const nombreNorm = normalizeSearchText(a.nombre);
                const rutNorm = normalizeSearchText(a.rut);
                return searchTerms.every(term => nombreNorm.includes(term) || rutNorm.includes(term));
            });
        }

        // 4. Si aún no, buscar coincidencia por similitud de caracteres (Levenshtein) para corregir errores tipográficos menores
        if (!alumno) {
            let mejorMatch = null;
            let maxSimilitud = 0;
            alumnos.forEach(a => {
                const sim = obtenerSimilitud(inputVal, a.nombre);
                if (sim > maxSimilitud) {
                    maxSimilitud = sim;
                    mejorMatch = a;
                }
            });
            if (mejorMatch && maxSimilitud >= 0.6) {
                alumno = mejorMatch;
                showToast(`No se encontró "${inputVal}". Mostrando reporte de: ${alumno.nombre}`, 'info');
            }
        }

        if (!alumno) {
            showToast('Alumno no encontrado. Verifique el nombre o RUT.', 'error');
            return;
        }

        const curso = cursos.find(c => c.id === alumno.cursoId);
        const nombreCurso = curso ? curso.nombre : 'Sin curso';

        // --- DATOS DEL ALUMNO ---
        // Asistencia
        const currentYear = new Date().getFullYear();
        let faltasTotales = 0;
        let diasFaltados = [];
        asistenciaRegistros.forEach(record => {
            const dInfo = parseYearMonth(record.fecha);
            const añoCoincide = dInfo.year === currentYear;
            const mesCoincide = esAnual || dInfo.month === mesFiltroNum;
            if (añoCoincide && mesCoincide) {
                const dt = new Date(record.fecha + 'T00:00:00');
                const dayOfWeek = dt.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                    record.registros.forEach(reg => {
                        if (reg.alumno && reg.alumno.trim().toLowerCase() === alumno.nombre.trim().toLowerCase() && reg.estado === 'ausente') {
                            faltasTotales++;
                            diasFaltados.push(record.fecha);
                        }
                    });
                }
            }
        });

        // Bitácora
        const bitacoraAlumno = bitacoraLlamadas.filter(b => {
            if (!b.estudiante || b.estudiante.trim().toLowerCase() !== alumno.nombre.trim().toLowerCase()) return false;
            const dInfo = parseYearMonth(b.fecha);
            const añoCoincide = dInfo.year === currentYear;
            const mesCoincide = esAnual || dInfo.month === mesFiltroNum;
            return añoCoincide && mesCoincide;
        });

        // Comprobantes
        const comprobantesAlumno = comprobantes.filter(c => {
            if (!c.estudiante || c.estudiante.trim().toLowerCase() !== alumno.nombre.trim().toLowerCase()) return false;
            const dInfo = parseYearMonth(c.fecha);
            const añoCoincide = dInfo.year === currentYear;
            const mesCoincide = esAnual || dInfo.month === mesFiltroNum;
            return añoCoincide && mesCoincide;
        });

        // Historial de Comunicaciones
        const comunicacionesAlumno = comunicacionesHistorial.filter(c => {
            if (!c.estudiante || c.estudiante.trim().toLowerCase() !== alumno.nombre.trim().toLowerCase()) return false;
            const dInfo = parseYearMonth(c.fecha);
            const añoCoincide = dInfo.year === currentYear;
            const mesCoincide = esAnual || dInfo.month === mesFiltroNum;
            return añoCoincide && mesCoincide;
        });

        // --- RENDER HTML ALUMNO ---
        container.innerHTML = `
                <div class="report-document" style="padding: 2rem; background: #fff; border: 1px solid var(--gray-200); border-radius: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 3px solid var(--primary); padding-bottom: 1rem; margin-bottom: 2rem;">
                        <div style="display:flex; align-items:center; gap: 1rem;">
                            <img src="insignia.jpg" alt="Insignia" style="height: 60px; width: auto; object-fit: contain;">
                            <div>
                                <h3 style="margin:0; color:var(--gray-800); font-size:1.2rem; text-transform:uppercase;">Liceo Simón Bolívar</h3>
                                <p style="margin:0; color:var(--gray-500); font-size:0.9rem;">Inspectoría General</p>
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <h2 style="margin:0; font-size:1.5rem; color:var(--primary); text-transform:uppercase;">Hoja de Vida Estudiantil</h2>
                            <p style="margin:0; font-weight:600; color:var(--gray-700);">${new Date().toLocaleDateString('es-CL')}</p>
                        </div>
                    </div>
                    
                    <div style="background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; padding:1.5rem; margin-bottom:2rem;">
                        <h3 style="margin-top:0; border-bottom:1px solid var(--gray-300); padding-bottom:10px;">👤 Antecedentes Personales</h3>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-top:15px;">
                            <div><strong>Nombre:</strong> ${alumno.nombre} ${getBadgeRiesgo(alumno.nombre)}</div>
                            <div><strong>RUT:</strong> ${alumno.rut}</div>
                            <div><strong>Curso:</strong> ${nombreCurso}</div>
                            <div><strong>Apoderado:</strong> ${alumno.apoderado}</div>
                            <div><strong>Teléfono:</strong> ${alumno.telefono}</div>
                            <div><strong>Email:</strong> ${alumno.correo}</div>
                        </div>
                    </div>

                    <div style="display:flex; gap:20px; margin-bottom: 2rem; flex-wrap:wrap;">
                        <div style="flex:1; min-width:200px; padding:1.5rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; text-align:center;">
                            <h4 style="margin:0 0 10px 0; color:var(--gray-600);">Inasistencias (${etiquetaPeriodo})</h4>
                            <div style="font-size:2.5rem; font-weight:700; color:${faltasTotales >= (esAnual ? 15 : 6) ? 'var(--danger)' : faltasTotales >= (esAnual ? 10 : 4) ? 'var(--warning)' : 'var(--primary)'};">${faltasTotales}</div>
                        </div>
                        <div style="flex:1; min-width:200px; padding:1.5rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; text-align:center; display:none !important;">
                            <h4 style="margin:0 0 10px 0; color:var(--gray-600);">Anotaciones Bitácora (${etiquetaPeriodo})</h4>
                            <div style="font-size:2.5rem; font-weight:700; color:var(--info);">${bitacoraAlumno.length}</div>
                        </div>
                        <div style="flex:1; min-width:200px; padding:1.5rem; background:var(--gray-50); border:1px solid var(--gray-200); border-radius:8px; text-align:center;">
                            <h4 style="margin:0 0 10px 0; color:var(--gray-600);">Comprobantes (${etiquetaPeriodo})</h4>
                            <div style="font-size:2.5rem; font-weight:700; color:var(--gray-700);">${comprobantesAlumno.length}</div>
                        </div>
                    </div>

                    <div style="display: none !important;">
                    <h3 style="border-bottom: 2px solid var(--gray-200); padding-bottom: 0.5rem; color: var(--gray-800); margin-top: 2rem;"><i class="fas fa-book" style="color:var(--info);"></i> Historial de Bitácora</h3>
                    ${bitacoraAlumno.length > 0 ? `
                        <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
                            <thead>
                                <tr style="background:var(--gray-100);">
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:left; width:150px;">Fecha</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:left; width:150px;">Categoría</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:left;">Motivo / Observación</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bitacoraAlumno.map(b => `
                                <tr>
                                    <td style="padding:10px; border:1px solid var(--gray-300);">${b.fecha}</td>
                                    <td style="padding:10px; border:1px solid var(--gray-300);"><span class="badge-status" style="background:#e0e7ff; color:#3730a3;">${b.categoria || 'Otro'}</span></td>
                                    <td style="padding:10px; border:1px solid var(--gray-300); font-size:0.9rem;">${b.motivo}</td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p style="color:var(--gray-500);">El estudiante no registra anotaciones en la bitácora.</p>'}
                    </div>

                    <h3 style="border-bottom: 2px solid var(--gray-200); padding-bottom: 0.5rem; color: var(--gray-800); margin-top: 3rem;"><i class="fas fa-calendar-times" style="color:var(--danger);"></i> Días de Inasistencia</h3>
                    ${diasFaltados.length > 0 ? `
                        <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:1rem;">
                            ${diasFaltados.map(d => `<span style="background:var(--gray-100); border:1px solid var(--gray-300); padding:5px 10px; border-radius:15px; font-size:0.9rem;">${d}</span>`).join('')}
                        </div>
                    ` : '<p style="color:var(--gray-500);">El estudiante no registra inasistencias en el sistema.</p>'}

                    <h3 style="border-bottom: 2px solid var(--gray-200); padding-bottom: 0.5rem; color: var(--gray-800); margin-top: 3rem;"><i class="fas fa-phone-alt" style="color:var(--success);"></i> Historial de Comunicaciones</h3>
                    ${comunicacionesAlumno.length > 0 ? `
                        <table style="width:100%; border-collapse:collapse; margin-top:1rem;">
                            <thead>
                                <tr style="background:var(--gray-100);">
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:left; width:150px;">Fecha</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:left; width:120px;">Medio</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:left;">Detalle de Comunicación / Observación</th>
                                    <th style="padding:10px; border:1px solid var(--gray-300); text-align:left; width:120px;">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${comunicacionesAlumno.map(c => `
                                <tr>
                                    <td style="padding:10px; border:1px solid var(--gray-300);">${c.fecha}</td>
                                    <td style="padding:10px; border:1px solid var(--gray-300); font-weight:600;">${c.medio}</td>
                                    <td style="padding:10px; border:1px solid var(--gray-300); font-size:0.9rem;">
                                        <strong>Motivo:</strong> ${c.motivo}<br>
                                        ${c.nota ? `<strong>Observación:</strong> ${c.nota}` : ''}
                                    </td>
                                    <td style="padding:10px; border:1px solid var(--gray-300);"><span class="badge-status" style="background:#dcfce7; color:#166534;">${c.estado || 'Realizada'}</span></td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p style="color:var(--gray-500);">No se registran contactos ni comunicaciones en el sistema para este estudiante.</p>'}

                    <div style="margin-top: 4rem; text-align: center; font-size:0.9rem; color:var(--gray-500);">
                        <p>Documento oficial generado por Plataforma Inspectoría · ${new Date().toLocaleString('es-CL')}</p>
                    </div>
                </div>`;
        showToast('Hoja de vida generada', 'success');
    }
}

function imprimirInforme() {
    const content = document.getElementById('informeSemanalContainer');
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
                    <title>Informe Oficial</title>
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

// 11. PLANILLA DE SEGUIMIENTO DE ALERTAS
// ==========================================
function cargarSelectsPlanilla() {
    const select = document.getElementById('planillaCurso');
    select.innerHTML = '<option value="">Todos los cursos</option>' +
        cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

async function recalcularAlertasDesdeAsistencia() {
    const currentYearStr = today().substring(0, 4); // 'YYYY'
    const currentMonthStr = today().substring(0, 7); // 'YYYY-MM'
    let nuevasAlertas = 0;
    let actualizadas = 0;
    const inserts = [];
    const updates = [];

    for (const alumno of alumnos) {
        const nombre = alumno.nombre;

        // 1. Estadísticas anuales
        let diasTotales = 0;
        let diasAusente = 0;

        asistenciaRegistros.forEach(r => {
            if (r.fecha.startsWith(currentYearStr)) {
                r.registros.forEach(reg => {
                    if (reg.alumno === nombre) {
                        const est = reg.estado ? reg.estado.trim().toLowerCase() : '';
                        if (est === 'ausente') {
                            diasTotales++;
                            diasAusente++;
                        } else if (est === 'presente' || est === 'atrasado' || est === 'ausente justificado') {
                            diasTotales++;
                        }
                    }
                });
            }
        });

        const porcentaje = diasTotales > 0 ? ((diasTotales - diasAusente) / diasTotales) * 100 : 100;

        // 2. Faltas del mes actual (lógica anterior)
        const registrosFaltas = asistenciaRegistros.filter(r =>
            r.fecha.startsWith(currentMonthStr) &&
            r.registros.some(reg => reg.alumno === nombre && reg.estado === 'ausente')
        );
        const faltas = registrosFaltas.length;

        let nivel = '';
        let motivo = '';

        if (porcentaje < (window.configuracionGlobal?.riesgo_medio || 85) && diasTotales > 0) {
            nivel = 'Roja';
            motivo = `Riesgo de repitencia (Asistencia Anual: ${porcentaje.toFixed(1)}%)`;
        } else if (faltas >= 6) {
            nivel = 'Roja';
        } else if (faltas >= 4) {
            nivel = 'Naranja';
        } else if (faltas >= 2) {
            nivel = 'Amarilla';
        }

        if (nivel) {
            if (!motivo) {
                const fechasFaltas = registrosFaltas
                    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
                    .map(r => r.fecha.split('-').reverse().join('/'))
                    .join(', ');
                motivo = `Inasistencia mensual (${faltas} faltas: ${fechasFaltas})`;
            }
            const yaPendienteIndex = comunicacionesPendientes.findIndex(c => c.estudiante && c.estudiante.trim().toLowerCase() === nombre.trim().toLowerCase());
            const yaResuelto = comunicacionesHistorial.some(h => h.estudiante && h.estudiante.trim().toLowerCase() === nombre.trim().toLowerCase() && h.motivo === motivo);

            if (yaPendienteIndex > -1) {
                // Siempre actualizar nivel y motivo en alertas existentes
                if (comunicacionesPendientes[yaPendienteIndex].motivo !== motivo || comunicacionesPendientes[yaPendienteIndex].nivel !== nivel) {
                    comunicacionesPendientes[yaPendienteIndex].motivo = motivo;
                    comunicacionesPendientes[yaPendienteIndex].nivel = nivel;
                    updates.push(comunicacionesPendientes[yaPendienteIndex]);
                    actualizadas++;
                }
            } else if (!yaResuelto) {
                const nuevaCom = {
                    id: nextComunicacionId++,
                    estudiante: nombre,
                    apoderado: alumno.apoderado,
                    telefono: alumno.telefono,
                    motivo: motivo,
                    nivel: nivel
                };
                comunicacionesPendientes.push(nuevaCom);
                inserts.push(nuevaCom);
                nuevasAlertas++;
            }
        }
    }

    document.getElementById('pendientesBadge').textContent = comunicacionesPendientes.length;
    
    const promesas = [];
    if (inserts.length > 0) promesas.push(apiCall('bulk_insert', 'Comunicaciones', inserts, null, true));
    if (updates.length > 0) promesas.push(apiCall('bulk_update', 'Comunicaciones', updates, null, true));
    
    if (promesas.length > 0) {
        await Promise.all(promesas);
    }
    
    saveToLocalBackup();
    return { nuevasAlertas, actualizadas };
}

function cargarPlanillaAlertas(esActualizacionManual = false) {
    const cursoId = document.getElementById('planillaCurso').value;
    const container = document.getElementById('planillaAlertasContainer');
    const btnActualizar = document.querySelector('#panel-planilla-alertas .btn-primary');

    // Recalcular siempre de fondo para tener datos actualizados
    if (esActualizacionManual && btnActualizar) {
        btnActualizar.disabled = true;
        btnActualizar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    }

    setTimeout(async () => {
        try {
            const resultado = await recalcularAlertasDesdeAsistencia();

            if (esActualizacionManual) {
                if (resultado.nuevasAlertas > 0 || resultado.actualizadas > 0) {
                    let msg = '🔄 Alertas actualizadas: ';
                    if (resultado.nuevasAlertas > 0) msg += `${resultado.nuevasAlertas} nueva(s)`;
                    if (resultado.nuevasAlertas > 0 && resultado.actualizadas > 0) msg += ', ';
                    if (resultado.actualizadas > 0) msg += `${resultado.actualizadas} modificada(s)`;
                    showToast(msg, 'warning');
                } else {
                    showToast('✅ Alertas al día, no hay cambios nuevos', 'success');
                }
            }
        } catch (e) {
            console.error('Error al recalcular alertas:', e);
            if (esActualizacionManual) showToast('❌ Error al actualizar alertas', 'error');
        } finally {
            if (esActualizacionManual && btnActualizar) {
                btnActualizar.disabled = false;
                btnActualizar.innerHTML = '<i class="fas fa-sync"></i> Actualizar';
            }
            // Renderizar la tabla con los datos más recientes
            renderizarTablaPlanilla(cursoId, container);
        }
    }, esActualizacionManual ? 300 : 0);
}

function renderizarTablaPlanilla(cursoId, container) {
    let alertas = comunicacionesPendientes.map(p => {
        const alumno = alumnos.find(a => a.nombre.trim().toLowerCase() === p.estudiante.trim().toLowerCase());
        return { ...p, cursoId: alumno ? alumno.cursoId : null, curso: alumno ? getCursoNombre(alumno.cursoId) : 'Sin curso' };
    });

    if (cursoId) {
        alertas = alertas.filter(a => a.cursoId === parseInt(cursoId));
    }

    if (alertas.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>No hay alertas para este curso</p></div>`;
        return;
    }

    // Ordenar por nivel de gravedad (Roja primero), luego por más recientes primero
    const severityOrder = { 'Roja': 1, 'Naranja': 2, 'Amarilla': 3, undefined: 4 };
    alertas.sort((a, b) => {
        if (severityOrder[a.nivel] !== severityOrder[b.nivel]) {
            return severityOrder[a.nivel] - severityOrder[b.nivel];
        }
        return (b.id || 0) - (a.id || 0);
    });

    let html = `
<div style="margin-bottom:1.5rem; display:flex; flex-direction:column; gap:1rem;">
    <!-- Ayuda al usuario -->
    <div style="background:#f8fafc; padding:1.2rem; border-radius:8px; border:1px solid #e2e8f0; border-left:4px solid #3b82f6;">
        <h4 style="margin: 0 0 0.5rem 0; color: #1e293b; font-size: 1rem; display:flex; align-items:center; gap:0.5rem;">
            <i class="fas fa-question-circle" style="color:#3b82f6;"></i> ¿Para qué sirve esta planilla?
        </h4>
        <p style="margin: 0; color: #475569; font-size: 0.9rem; line-height: 1.5;">
            Esta pantalla genera un <strong>reporte imprimible</strong> con el resumen de alumnos en riesgo por curso. Es de solo lectura.
            Si necesitas contactar a un apoderado o marcar un caso como resuelto, dirígete al módulo de <strong>Comunicación</strong>.
        </p>
    </div>
    
    <!-- Guía de colores y total -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
        <div style="display:flex; flex-wrap:wrap; gap:1rem; font-size:0.85rem; background:white; padding:0.8rem 1.2rem; border-radius:6px; border:1px solid #e2e8f0; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <span style="display:flex; align-items:center; color:#64748b;"><strong>Guía de Gravedad:</strong></span>
            <span style="display:flex; align-items:center; gap:0.4rem;"><span style="display:inline-block; padding:2px 6px; border-radius:4px; font-weight:bold; background-color:#fee2e2; color:#b91c1c; border:1px solid #b91c1c33;">Roja</span> Crítico (6+ faltas al mes o Repitencia anual)</span>
            <span style="display:flex; align-items:center; gap:0.4rem;"><span style="display:inline-block; padding:2px 6px; border-radius:4px; font-weight:bold; background-color:#ffedd5; color:#c2410c; border:1px solid #c2410c33;">Naranja</span> 4 a 5 faltas al mes</span>
            <span style="display:flex; align-items:center; gap:0.4rem;"><span style="display:inline-block; padding:2px 6px; border-radius:4px; font-weight:bold; background-color:#fef3c7; color:#b45309; border:1px solid #b4530933;">Amarilla</span> 2 a 3 faltas al mes</span>
        </div>
        
        <div class="alert alert-info" style="margin:0; background:#dbeafe; padding:0.8rem 1.2rem; border-radius:6px; border-left:4px solid var(--primary); display:flex; align-items:center; gap:0.5rem; font-size:0.95rem;">
            <i class="fas fa-list-ul"></i> <span>Total de alertas: <strong>${alertas.length}</strong></span>
        </div>
    </div>
</div>
<div class="table-responsive">
    <table>
        <thead><tr><th>#</th><th style="min-width: 230px;">Estudiante</th><th>Curso</th><th>Apoderado</th><th>Teléfono</th><th>Motivo</th><th>Estado</th></tr></thead>
        <tbody>
`;

    alertas.forEach((a, i) => {
        let badgeColor = 'var(--gray-500)';
        let bgBadgeColor = 'var(--gray-200)';
        if (a.nivel === 'Roja') { badgeColor = '#b91c1c'; bgBadgeColor = '#fee2e2'; }
        else if (a.nivel === 'Naranja') { badgeColor = '#c2410c'; bgBadgeColor = '#ffedd5'; }
        else if (a.nivel === 'Amarilla') { badgeColor = '#b45309'; bgBadgeColor = '#fef3c7'; }

        const badgeHtml = a.nivel ? `<span style="display:inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; background-color: ${bgBadgeColor}; color: ${badgeColor}; margin-right: 5px; border: 1px solid ${badgeColor}33;">${a.nivel}</span>` : '';

        html += `
    <tr>
        <td>${i + 1}</td>
        <td><strong>${a.estudiante}</strong></td>
        <td style="white-space: nowrap;"><span class="badge-curso">${a.curso}</span></td>
        <td>${a.apoderado}</td>
        <td style="white-space: nowrap;">${a.telefono}</td>
        <td style="font-size:0.85rem;">${badgeHtml}${a.motivo}</td>
        <td style="white-space: nowrap;"><span class="badge-status" style="background:#fef3c7;color:#92400e;">⚠️ Pendiente</span></td>
    </tr>
`;
    });

    html += `
        </tbody>
    </table>
</div>
`;

    container.innerHTML = html;
}

function imprimirPlanillaAlertas() {
    const content = document.getElementById('planillaAlertasContainer');
    if (!content || !content.innerHTML.trim() || content.querySelector('.empty-state')) {
        showToast('⚠️ No hay alertas para imprimir', 'warning');
        return;
    }

    // Obtener la insignia del sidebar (ya tiene el base64)
    const sidebarImg = document.querySelector('.sidebar-brand img');
    const insigniaSrc = sidebarImg ? sidebarImg.src : '';

    // Obtener curso seleccionado
    const selectCurso = document.getElementById('planillaCurso');
    const cursoTexto = selectCurso.options[selectCurso.selectedIndex].text;

    // Fecha actual formateada
    const fechaHoy = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Usar iframe oculto en vez de abrir pestaña nueva
    let iframe = document.getElementById('printFrame');
    if (iframe) iframe.remove();

    iframe = document.createElement('iframe');
    iframe.id = 'printFrame';
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;left:-9999px;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`
    <html><head><title>Planilla de Alertas</title>
    <style>
        body { font-family: sans-serif; padding: 2rem; margin: 0; }
        .membrete { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .membrete-left { display: flex; align-items: center; gap: 1rem; }
        .membrete-left img { height: 60px; width: auto; object-fit: contain; }
        .membrete-left h2 { margin: 0; font-size: 1.2rem; text-transform: uppercase; color: #1e293b; }
        .membrete-left p { margin: 0; font-size: 0.85rem; color: #64748b; }
        .membrete-right { text-align: right; }
        .membrete-right h3 { margin: 0; font-size: 1.1rem; color: #2563eb; text-transform: uppercase; }
        .membrete-right p { margin: 0; font-size: 0.85rem; color: #475569; }
        table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
        th, td { padding: 0.5rem; border: 1px solid #ddd; text-align: left; font-size: 0.85rem; }
        th { background: #f1f5f9; font-weight: 600; }
        .badge-curso { background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
        .badge-status { padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; }
        .alert { padding: 0.6rem 1rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 1rem; }
        @media print { body { padding: 1rem; } }
    </style></head>
    <body>
        <div class="membrete">
            <div class="membrete-left">
                ${insigniaSrc ? `<img src="${insigniaSrc}" alt="Insignia">` : ''}
                <div>
                    <h2>Liceo Simón Bolívar</h2>
                    <p>Inspectoría General</p>
                </div>
            </div>
            <div class="membrete-right">
                <h3>Planilla de Seguimiento de Alertas</h3>
                <p>${cursoTexto} — ${fechaHoy}</p>
            </div>
        </div>
        ${content.innerHTML}
    </body></html>
`);
    doc.close();

    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    // Limpiar iframe después de imprimir
    setTimeout(() => { iframe.remove(); }, 1000);
}

window.limpiarFiltrosInformesGeneral = function () {
    const select = document.getElementById('filtroTipoInforme');
    if (select) {
        select.value = '';
        cambiarFiltroInforme();
    }

    const container = document.getElementById('informeSemanalContainer');
    if (container) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>Seleccione los filtros y presione "Generar"</p></div>';
    }
};
