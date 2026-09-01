        // ==========================================
        // 8. ASISTENCIA
        // ==========================================
        function cargarSelectsAsistencia() {
            const select = document.getElementById('asistenciaFiltro');
            if (select) {
                select.innerHTML = '<option value="">[Mostrar todos los cursos]</option>' +
                    cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
            }
            
            // Si hay parámetros de anulación, usarlos y omitir inicialización por defecto
            if (window._overrideAsistenciaParams) {
                const selectFecha = document.getElementById('asistenciaFecha');
                if (select) select.value = window._overrideAsistenciaParams.cursoId.toString();
                if (selectFecha) selectFecha.value = window._overrideAsistenciaParams.fecha;
                
                // Abrir el acordeón del curso solicitado
                cursoAccordionAbiertos = {};
                cursoAccordionAbiertos[window._overrideAsistenciaParams.cursoId] = true;
                
                // Limpiar la anulación
                window._overrideAsistenciaParams = null;
                return;
            }
            
            // Si hoy es fin de semana, por defecto usar el viernes anterior. Si es enero o febrero, usar el 1 de marzo.
            const tDate = new Date();
            const month = tDate.getMonth();
            if (month === 0 || month === 1) {
                tDate.setMonth(2); // Marzo
                tDate.setDate(1);
            } else {
                const day = tDate.getDay();
                if (day === 0) { // Domingo
                    tDate.setDate(tDate.getDate() - 2);
                } else if (day === 6) { // Sábado
                    tDate.setDate(tDate.getDate() - 1);
                }
            }
            const y = tDate.getFullYear();
            const m = String(tDate.getMonth() + 1).padStart(2, '0');
            const d = String(tDate.getDate()).padStart(2, '0');
            
            const inputFecha = document.getElementById('asistenciaFecha');
            if (inputFecha) {
                inputFecha.value = `${y}-${m}-${d}`;
                if (window.configuracionGlobal?.fecha_inicio_uso) {
                    inputFecha.min = window.configuracionGlobal.fecha_inicio_uso;
                }
            }
        }

        // Variable global para recordar qué acordeones están abiertos al refrescar
        let cursoAccordionAbiertos = {};

        let vistaAsistenciaActual = 'rapida';

        window.setVistaAsistencia = function(vista) {
            vistaAsistenciaActual = vista;
            const btnClasica = document.getElementById('btnVistaClasica');
            const btnRapida = document.getElementById('btnVistaRapida');
            
            if (vista === 'clasica') {
                btnClasica.classList.remove('btn-outline');
                btnClasica.classList.add('btn-primary');
                btnClasica.style.background = '';
                
                btnRapida.classList.remove('btn-primary');
                btnRapida.classList.add('btn-outline');
                btnRapida.style.background = 'white';
                
                document.getElementById('asistenciaListaContainer').style.display = 'block';
                document.getElementById('asistenciaRapidaContainer').style.display = 'none';
            } else {
                btnRapida.classList.remove('btn-outline');
                btnRapida.classList.add('btn-primary');
                btnRapida.style.background = '';
                
                btnClasica.classList.remove('btn-primary');
                btnClasica.classList.add('btn-outline');
                btnClasica.style.background = 'white';
                
                document.getElementById('asistenciaListaContainer').style.display = 'none';
                document.getElementById('asistenciaRapidaContainer').style.display = 'block';
            }
            
            cargarListaAsistencia();
        };

        window.procesarInasistenciasRapida = function(inputId, cursoId, fecha) {
            const input = document.getElementById(inputId);
            const numerosStr = input.value.trim();
            const alumnosCurso = getAlumnosPorCurso(cursoId);
            
            // Reset all to present visually
            alumnosCurso.forEach((a, i) => {
                if (a.estado !== 'retirado') {
                    const item = document.getElementById(`alumno-item-${cursoId}-${i}`);
                    if (item) {
                        item.classList.remove('ausente');
                    }
                }
            });
            
            let faltantesCount = 0;
            let retiradosIngresados = [];
            let invalidosIngresados = [];
            if (numerosStr !== '') {
                const numerosArr = numerosStr.split('-').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                numerosArr.forEach(num => {
                    const idx = alumnosCurso.findIndex((a, i) => {
                        const numLista = a.numeroLista ? parseInt(a.numeroLista) : i + 1;
                        return numLista === num;
                    });
                    
                    if (idx >= 0) {
                        if (alumnosCurso[idx].estado !== 'retirado') {
                            const item = document.getElementById(`alumno-item-${cursoId}-${idx}`);
                            if (item) {
                                item.classList.add('ausente');
                                faltantesCount++;
                            }
                        } else {
                            retiradosIngresados.push(num);
                        }
                    } else {
                        invalidosIngresados.push(num);
                    }
                });
            }
            
            // Update stats
            const faltantesEl = document.getElementById('faltantes-count-rapida');
            if (faltantesEl) {
                faltantesEl.textContent = faltantesCount;
            }

            // Warning
            const avisoEl = document.getElementById('aviso-retirado-rapida');
            if (avisoEl) {
                let advertencias = [];
                if (retiradosIngresados.length > 0) {
                    advertencias.push(`N° ${retiradosIngresados.join(', ')} es un alumno retirado.`);
                }
                if (invalidosIngresados.length > 0) {
                    advertencias.push(`N° ${invalidosIngresados.join(', ')} no existe en este curso.`);
                }
                
                if (advertencias.length > 0) {
                    avisoEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${advertencias.join(' ')}`;
                    avisoEl.style.display = 'block';
                } else {
                    avisoEl.style.display = 'none';
                }
            }
        };

        window.guardarAsistenciaRapida = async function(cursoId, fecha, inputId) {
            const input = document.getElementById(inputId);
            const numerosStr = input.value.trim();
            const alumnosCurso = getAlumnosPorCurso(cursoId);
            
            const numerosArr = numerosStr.split('-').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
            
            const registros = [];
            const registrosPlanos = [];
            alumnosCurso.forEach((a, i) => {
                const numLista = a.numeroLista ? parseInt(a.numeroLista) : i + 1;
                const isAusente = numerosArr.includes(numLista);
                let estadoReg = isAusente ? 'ausente' : 'presente';
                if (a.estado === 'retirado') estadoReg = 'retirado';
                registros.push({
                    alumno: a.nombre,
                    estado: estadoReg
                });
                registrosPlanos.push({
                    cursoId: cursoId,
                    fecha: fecha,
                    alumno: a.nombre,
                    estado: estadoReg
                });
            });
            
            // Guardar localmente en memoria
            let existingIdx = -1;
            if (asistenciaRegistros) {
                existingIdx = asistenciaRegistros.findIndex(r => r.cursoId === cursoId && r.fecha === fecha);
            } else {
                asistenciaRegistros = [];
            }

            if (existingIdx >= 0) {
                asistenciaRegistros[existingIdx].registros = registros;
            } else {
                asistenciaRegistros.push({ cursoId, fecha, registros });
            }

            saveToLocalBackup();
            
            // Usar API oficial para enviar a Google Sheets
            await apiCall('bulk_insert', 'Asistencia', registrosPlanos);
            showToast('✅ Asistencia guardada (Vista Rápida)', 'success');
            
            cargarListaAsistencia(); // Refresh UI
        };

        function cargarListaAsistenciaRapida(cursoId, fecha, progHtml = '') {
            const container = document.getElementById('asistenciaRapidaContainer');
            
            if (!cursoId) {
                container.innerHTML = progHtml + `<div class="empty-state"><i class="fas fa-hand-pointer"></i><p>Debe seleccionar un curso en el filtro de arriba para usar esta vista.</p></div>`;
                return;
            }
            
            const c = cursos.find(c => c.id === parseInt(cursoId));
            const alumnosCurso = getAlumnosPorCurso(c.id);
            
            if (alumnosCurso.length === 0) {
                container.innerHTML = progHtml + `<div class="empty-state"><i class="fas fa-users"></i><p>El curso no tiene alumnos registrados.</p></div>`;
                return;
            }
            
            // Buscar registro existente
            let registroAnterior = null;
            if (asistenciaRegistros) {
                registroAnterior = asistenciaRegistros.find(r => r.cursoId === c.id && r.fecha === fecha);
            }
            
            let inasistenciasGuardadas = [];
            if (registroAnterior && registroAnterior.registros) {
                registroAnterior.registros.forEach((reg, index) => {
                    if (reg.estado === 'ausente') {
                        inasistenciasGuardadas.push(index + 1);
                    }
                });
            }
            const inasistenciasStr = inasistenciasGuardadas.length > 0 ? inasistenciasGuardadas.join('-') : '';
            const statusText = registroAnterior ? "Guardado" : "No Guardado";
            const btnText = registroAnterior ? "Actualizar" : "Guardar";

            const alumnosActivos = alumnosCurso.filter(a => a.estado !== 'retirado').length;

            const fechaFormateada = fecha.split('-').reverse().join('-');
            let html = progHtml + `
                <div class="stats-header-rapida" style="gap: 20px; flex-wrap: wrap;">
                    <div class="date-nav-rapida" style="white-space: nowrap;">
                        <i class="fas fa-calendar-alt"></i> ${fechaFormateada}
                    </div>
                    <div style="font-size:1.1rem; font-weight:bold; color:var(--primary-dark); white-space: nowrap; margin-right: auto;">Curso: ${c.nombre}</div>
                    <table class="stats-table" style="min-width: 200px;">
                        <tr><th class="text-center">Matrícula</th><th class="text-center">Faltantes</th></tr>
                        <tr><td class="text-center">${alumnosActivos}</td><td class="text-center" id="faltantes-count-rapida">${inasistenciasGuardadas.length}</td></tr>
                    </table>
                </div>

                <table class="table-modulos">
                    <thead>
                        <tr>
                            <th>Módulo</th>
                            <th>Estado</th>
                            <th style="width: 250px;">Inasistencia (N° Lista)</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="text-center"><strong>Jornada General</strong></td>
                            <td class="text-center">
                                ${registroAnterior ? '<span class="badge" style="background:var(--success);color:white;"><i class="fas fa-check"></i> '+statusText+'</span>' : '<span class="badge" style="background:var(--warning);color:white;"><i class="fas fa-exclamation-triangle"></i> '+statusText+'</span>'}
                            </td>
                            <td>
                                <input type="text" id="input-inasist-rapida" class="input-inasistencia" value="${inasistenciasStr}" placeholder="Ej: 2-5-14" autocomplete="off" oninput="procesarInasistenciasRapida('input-inasist-rapida', ${c.id}, '${fecha}')">
                                <div id="aviso-retirado-rapida" style="color:var(--danger); font-size:0.75rem; margin-top:4px; display:none; font-weight:600;"></div>
                            </td>
                            <td class="text-center">
                                <button class="btn btn-primary" style="padding: 6px 12px; font-size:0.85rem;" onclick="guardarAsistenciaRapida(${c.id}, '${fecha}', 'input-inasist-rapida')"><i class="fas fa-save"></i> ${btnText}</button>
                            </td>
                        </tr>
                    </tbody>
                </table>
                
                <h4 style="margin-bottom: 15px; margin-top: 25px; color: var(--gray-700); font-weight:700;"><i class="fas fa-list-ol text-primary"></i> Lista de Alumnos</h4>
                <div class="alumnos-lista-rapida">
            `;
            
            alumnosCurso.forEach((a, i) => {
                const numLista = a.numeroLista ? parseInt(a.numeroLista) : i + 1;
                const isAusente = inasistenciasGuardadas.includes(numLista);
                const isRetirado = a.estado === 'retirado';
                html += `
                    <div class="alumno-item ${isAusente && !isRetirado ? 'ausente' : ''} ${isRetirado ? 'alumno-retirado-row' : ''}" id="alumno-item-${c.id}-${i}">
                        <span class="ord ${isRetirado ? 'alumno-retirado' : ''}">${numLista}</span>
                        <span class="name ${isRetirado ? 'alumno-retirado' : ''}">${a.nombre}</span>
                        ${isRetirado ? '<span class="badge" style="background:var(--gray-500);color:white;font-size:0.65rem;padding:2px 6px;margin-left:6px;vertical-align:middle;border-radius:4px;text-decoration:none;display:inline-block;">Retirado</span>' : ''}
                    </div>
                `;
            });
            
            html += `</div>`;
            container.innerHTML = html;
        }

        function toggleCursoAccordion(cursoId) {
            const body = document.getElementById(`body-curso-${cursoId}`);
            const arrow = document.getElementById(`arrow-curso-${cursoId}`);
            if (!body) return;
            if (body.style.display === 'none' || body.style.display === '') {
                body.style.display = 'block';
                cursoAccordionAbiertos[cursoId] = true;
                if (arrow) arrow.style.transform = 'rotate(90deg)';
            } else {
                body.style.display = 'none';
                cursoAccordionAbiertos[cursoId] = false;
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            }
        }

        function cargarListaAsistencia() {
            const fecha = document.getElementById('asistenciaFecha').value;
            const container = document.getElementById('asistenciaListaContainer');
            const filterVal = document.getElementById('asistenciaFiltro')?.value || '';

            if (fecha) {
                const dateObj = new Date(fecha + 'T00:00:00');
                const month = dateObj.getMonth();
                if (month === 0 || month === 1) {
                    showToast('Enero y febrero corresponden al periodo de vacaciones de verano. Seleccione una fecha entre marzo y diciembre.', 'error');
                    document.getElementById('asistenciaFecha').value = '';
                    container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>Seleccione una fecha dentro del año escolar (marzo a diciembre)</p></div>`;
                    if (document.getElementById('btnSuspenderClases')) document.getElementById('btnSuspenderClases').style.display = 'none';
                    return;
                }
                const dayOfWeek = dateObj.getDay();
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    showToast('Los fines de semana (sábado y domingo) no son días escolares hábiles.', 'error');
                    document.getElementById('asistenciaFecha').value = '';
                    container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-times"></i><p>Seleccione un día escolar hábil (lunes a viernes)</p></div>`;
                    if (document.getElementById('btnSuspenderClases')) document.getElementById('btnSuspenderClases').style.display = 'none';
                    return;
                }

                // Verificar si es día sin clases
                if (esDiaSinClases(fecha)) {
                    const motivo = obtenerMotivoDiaSinClases(fecha);
                    container.innerHTML = `
                        <div class="empty-state" style="background: #fef2f2; border: 1px solid var(--danger); border-radius: var(--radius); padding: 2.5rem; text-align: center; margin-top: 1rem;">
                            <i class="fas fa-calendar-times" style="color: var(--danger); font-size: 3.5rem; margin-bottom: 1.25rem;"></i>
                            <h3 style="color: var(--danger); font-weight: 700; margin-bottom: 0.5rem; font-size: 1.3rem;">Día Sin Clases (Feriado o Suspensión)</h3>
                            <p style="font-size: 1.05rem; color: var(--gray-700); margin-bottom: 1.25rem;"><strong>Motivo:</strong> ${motivo}</p>
                            <p style="font-size: 0.9rem; color: var(--gray-500); max-width: 500px; margin: 0 auto 1.5rem auto; line-height: 1.4;">Este día ha sido excluido de las planillas de asistencia, alertas de inspectoría y estadísticas de ausentismo.</p>
                            <button type="button" class="btn btn-success" onclick="toggleDiaSinClases()" style="display: inline-flex; align-items: center; gap: 8px; font-weight: 600; padding: 0.6rem 1.2rem; border-radius: 6px; border: none; cursor: pointer; transition: background-color 0.2s;">
                                <i class="fas fa-calendar-check"></i> Habilitar Clases Nuevamente
                            </button>
                        </div>
                    `;
                    actualizarBotonSuspension(true);
                    return;
                } else {
                    actualizarBotonSuspension(false);
                }
            } else {
                container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar"></i><p>Seleccione una fecha</p></div>`;
                if (document.getElementById('btnSuspenderClases')) document.getElementById('btnSuspenderClases').style.display = 'none';
                return;
            }

            if (!cursos || cursos.length === 0) {
                container.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>No hay cursos registrados</p></div>`;
                return;
            }

            // Calcular progreso general de la jornada (antes del filtro para que refleje el total real)
            let totalCursosConAlumnos = 0;
            let registradosCount = 0;
            cursos.forEach(c => {
                const alumnosCurso = getAlumnosPorCurso(c.id);
                if (alumnosCurso.length > 0) {
                    totalCursosConAlumnos++;
                    const registroAnterior = asistenciaRegistros ? asistenciaRegistros.find(r => r.cursoId === c.id && r.fecha === fecha) : null;
                    if (registroAnterior && registroAnterior.registros && registroAnterior.registros.length > 0) {
                        registradosCount++;
                    }
                }
            });
            const pct = totalCursosConAlumnos > 0 ? Math.round((registradosCount / totalCursosConAlumnos) * 100) : 0;
            
            const progHtml = `
                <div class="asistencia-progreso-card" style="background: white; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 1.25rem; box-shadow: var(--shadow);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.95rem;">
                        <span style="color: var(--gray-700);"><i class="fas fa-tasks" style="color:var(--primary); margin-right:6px;"></i> Progreso del Registro Diario</span>
                        <span style="color: ${pct === 100 ? 'var(--primary)' : 'var(--warning)'}; font-weight: 700;">${registradosCount} de ${totalCursosConAlumnos} Cursos (${pct}%)</span>
                    </div>
                    <div style="background: var(--gray-100); height: 10px; border-radius: 5px; overflow: hidden; width: 100%;">
                        <div style="background: var(--primary); height: 100%; width: ${pct}%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;

            if (vistaAsistenciaActual === 'rapida') {
                cargarListaAsistenciaRapida(filterVal, fecha, progHtml);
                return;
            }

            // Filtrar cursos por ID seleccionado
            const cursosFiltrados = cursos.filter(c => !filterVal || c.id === parseInt(filterVal));

            if (cursosFiltrados.length === 0) {
                // Incluso si no hay resultados de búsqueda, mostrar la barra de progreso general
                container.innerHTML = progHtml + `
                    <div class="empty-state"><i class="fas fa-search"></i><p>No se encontraron cursos que coincidan con la búsqueda</p></div>
                `;
                return;
            }

            let html = progHtml + `
                <div class="multicurso-container" style="display:flex; flex-direction:column; gap:12px;">
            `;

            cursosFiltrados.forEach((c) => {
                const alumnosCurso = getAlumnosPorCurso(c.id);
                if (alumnosCurso.length === 0) return;

                // Buscar si ya hay un registro guardado para este curso y fecha
                let registroAnterior = null;
                if (asistenciaRegistros) {
                    registroAnterior = asistenciaRegistros.find(r => r.cursoId === c.id && r.fecha === fecha);
                }

                // Calcular estadísticas del curso
                let totalAlumnos = alumnosCurso.filter(a => a.estado !== 'retirado').length;
                let presentesCount = 0;
                let ausentesCount = 0;
                let registrado = false;

                if (registroAnterior && registroAnterior.registros && registroAnterior.registros.length > 0) {
                    registrado = true;
                    registroAnterior.registros.forEach(reg => {
                        if (reg.estado === 'presente') presentesCount++;
                        else if (reg.estado === 'ausente') ausentesCount++;
                    });
                }

                let badgeHtml = '';
                if (registrado) {
                    badgeHtml = `<span class="badge" style="background-color: var(--info); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                        ✅ Registrado (${presentesCount} Presentes, ${ausentesCount} Ausentes)
                    </span>`;
                } else {
                    badgeHtml = `<span class="badge" style="background-color: var(--danger); color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                        ⚠️ Sin Registrar (${totalAlumnos} Alumnos)
                    </span>`;
                }

                const isOpen = !!cursoAccordionAbiertos[c.id];
                const cardClass = registrado ? 'registrado' : 'pendiente';

                html += `
                    <div class="curso-accordion-card ${cardClass}">
                        <!-- Cabecera del Accordion -->
                        <div class="curso-accordion-header">
                            <div class="curso-accordion-header-left" onclick="toggleCursoAccordion(${c.id})">
                                <i class="fas fa-chevron-right" id="arrow-curso-${c.id}" style="transition: transform 0.2s; transform: ${isOpen ? 'rotate(90deg)' : 'rotate(0deg)'};"></i>
                                <span style="font-weight: 700; font-size: 1.05rem; color: var(--gray-900);">${c.nombre}</span>
                                ${badgeHtml}
                            </div>
                            <div>
                                <button class="btn btn-success" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: 6px; display: flex; align-items: center; gap: 4px;" onclick="marcarCursoTodoPresente(${c.id}, '${fecha}')">
                                    <i class="fas fa-check-double"></i> Guardar curso con un 100% de asistencia
                                </button>
                            </div>
                        </div>
                        
                        <!-- Cuerpo del Accordion -->
                        <div class="curso-accordion-body" id="body-curso-${c.id}" style="display: ${isOpen ? 'block' : 'none'};">
                            <div class="table-responsive">
                                <table>
                                    <thead><tr><th>#</th><th>RUT</th><th>Nombre</th><th>Asistencia</th></tr></thead>
                                    <tbody>
                `;

                alumnosCurso.forEach((a, i) => {
                    let estadoGuardado = "presente";
                    if (registroAnterior && registroAnterior.registros) {
                        const r = registroAnterior.registros.find(reg => reg.alumno === a.nombre);
                        if (r && r.estado) estadoGuardado = r.estado;
                    }

                    const isRetirado = a.estado === 'retirado';
                    const trClass = isRetirado ? 'alumno-retirado-row' : '';
                    const textClass = isRetirado ? 'alumno-retirado' : '';

                    html += `
                        <tr class="${trClass}">
                            <td><strong>${a.numeroLista || i + 1}</strong></td>
                            <td class="${textClass}">${a.rut}</td>
                            <td><strong class="${textClass}">${a.nombre}</strong>${isRetirado ? ' <span class="badge" style="background:var(--gray-500);color:white;font-size:0.7rem;">Retirado</span>' : getBadgeRiesgo(a.nombre)}</td>
                            <td>
                                <div class="flex gap-2" style="flex-wrap:wrap;">
                                    ${isRetirado ? `
                                        <span class="text-muted" style="font-size:0.85rem;"><i class="fas fa-user-times"></i> Retirado (No se contabiliza)</span>
                                        <input type="hidden" name="asist_curso_${c.id}_idx_${i}" value="retirado">
                                    ` : `
                                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.85rem;">
                                            <input type="radio" name="asist_curso_${c.id}_idx_${i}" value="presente" ${estadoGuardado === 'presente' ? 'checked' : ''}> ✅ Presente
                                        </label>
                                        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:0.85rem;">
                                            <input type="radio" name="asist_curso_${c.id}_idx_${i}" value="ausente" ${estadoGuardado === 'ausente' ? 'checked' : ''}> ❌ Ausente
                                        </label>
                                        <label style="display:none;align-items:center;gap:4px;cursor:pointer;font-size:0.85rem;">
                                            <input type="radio" name="asist_curso_${c.id}_idx_${i}" value="tarde" ${estadoGuardado === 'tarde' ? 'checked' : ''}> ⏰ Tarde
                                        </label>
                                    `}
                                </div>
                            </td>
                        </tr>
                    `;
                });

                html += `
                                    </tbody>
                                </table>
                            </div>
                            <div style="padding: 1rem 0 0 0; text-align: right;">
                                <button class="btn btn-primary" onclick="guardarAsistenciaPorCurso(${c.id}, '${fecha}')">
                                    <i class="fas fa-save"></i> Guardar Asistencia Curso
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `</div>`;
            container.innerHTML = html;
        }

        async function marcarCursoTodoPresente(cursoId, fecha) {
            const alumnosCurso = getAlumnosPorCurso(cursoId);
            let registros = [];
            let payloadArray = [];

            alumnosCurso.forEach((a) => {
                const estado = a.estado === 'retirado' ? 'retirado' : 'presente';
                registros.push({ alumno: a.nombre, estado: estado, fecha });
                payloadArray.push({ cursoId, fecha, alumno: a.nombre, estado: estado });
            });

            // Evitar duplicados en memoria local
            const indexReg = asistenciaRegistros.findIndex(r => r.cursoId === cursoId && r.fecha === fecha);
            if (indexReg > -1) {
                asistenciaRegistros[indexReg].registros = registros;
            } else {
                asistenciaRegistros.push({ cursoId, fecha, registros });
            }

            await apiCall('bulk_insert', 'Asistencia', payloadArray);

            showToast(`✅ Se registró 100% de asistencia para ${cursos.find(c => c.id === cursoId)?.nombre}`);
            actualizarDashboard();
            cargarListaAsistencia();
        }

        async function guardarAsistenciaPorCurso(cursoId, fecha) {
            const alumnosCurso = getAlumnosPorCurso(cursoId);
            let registros = [];
            let ausentes = [];
            let payloadArray = [];

            alumnosCurso.forEach((a, i) => {
                const selected = document.querySelector(`input[name="asist_curso_${cursoId}_idx_${i}"]:checked`);
                if (selected) {
                    const estado = selected.value;
                    registros.push({ alumno: a.nombre, estado, fecha });
                    payloadArray.push({ cursoId, fecha, alumno: a.nombre, estado });
                    if (estado === 'ausente') ausentes.push(a.nombre);
                }
            });

            // Evitar duplicados en memoria local
            const indexReg = asistenciaRegistros.findIndex(r => r.cursoId === cursoId && r.fecha === fecha);
            if (indexReg > -1) {
                asistenciaRegistros[indexReg].registros = registros;
            } else {
                asistenciaRegistros.push({ cursoId, fecha, registros });
            }

            await apiCall('bulk_insert', 'Asistencia', payloadArray);

            // Detectar inasistencias reiteradas (Semáforo Mensual)
            const insertsAlertas = [];
            const updatesAlertas = [];
            if (ausentes.length > 0) {
                const currentMonthStr = today().substring(0, 7); // 'YYYY-MM'
                for (const nombre of ausentes) {
                    const alumno = alumnos.find(a => a.nombre === nombre);
                    if (alumno) {
                        const registrosFaltas = asistenciaRegistros.filter(r =>
                            r.fecha.startsWith(currentMonthStr) &&
                            r.registros.some(reg => reg.alumno === nombre && reg.estado === 'ausente')
                        );
                        const faltas = registrosFaltas.length;
                        const fechasFaltas = registrosFaltas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).map(r => r.fecha.split('-').reverse().join('/')).join(', ');

                        let nivel = '';
                        if (faltas >= 6) nivel = 'Roja';
                        else if (faltas >= 4) nivel = 'Naranja';
                        else if (faltas >= 2) nivel = 'Amarilla';

                        if (nivel) {
                            const motivo = `Inasistencia mensual (${faltas} faltas: ${fechasFaltas})`;
                            const yaPendienteIndex = comunicacionesPendientes.findIndex(c => c.estudiante === nombre);
                            const yaResuelto = comunicacionesHistorial.some(h => h.estudiante === nombre && h.motivo === motivo);

                            if (yaPendienteIndex > -1) {
                                if (comunicacionesPendientes[yaPendienteIndex].motivo !== motivo) {
                                    comunicacionesPendientes[yaPendienteIndex].motivo = motivo;
                                    comunicacionesPendientes[yaPendienteIndex].nivel = nivel;
                                    updatesAlertas.push(comunicacionesPendientes[yaPendienteIndex]);
                                    
                                    showToast(`⚠️ Gravedad actualizada: ${nombre} (${nivel})`, 'warning');
                                }
                            } else if (!yaResuelto) {
                                const nuevaCom = { id: nextComunicacionId++, estudiante: nombre, apoderado: alumno.apoderado, telefono: alumno.telefono, motivo: motivo, nivel: nivel };
                                comunicacionesPendientes.push(nuevaCom);
                                insertsAlertas.push(nuevaCom);
                                showToast(`⚠️ Alerta: ${nombre} (${nivel})`, 'warning');
                            }
                        }
                    }
                }
            }
            
            const promesasAlertas = [];
            if (insertsAlertas.length > 0) promesasAlertas.push(apiCall('bulk_insert', 'Comunicaciones', insertsAlertas, null, true));
            if (updatesAlertas.length > 0) promesasAlertas.push(apiCall('bulk_update', 'Comunicaciones', updatesAlertas, null, true));

            if (promesasAlertas.length > 0) {
                await Promise.all(promesasAlertas);
            }

            showToast(`✅ Asistencia guardada para ${registros.length} alumnos`);
            document.getElementById('pendientesBadge').textContent = comunicacionesPendientes.length;
            if (typeof actualizarBadgeInasistencias === 'function') actualizarBadgeInasistencias();
            actualizarDashboard();
            cargarListaAsistencia();
        }

        async function guardarAsistencia() {
            // Retrocompatibilidad - No-op
        }

        function irARegistrarFechaCurso(cursoId, fecha) {
            window._overrideAsistenciaParams = { cursoId, fecha };
            mostrarPanel('asistencia');
        }


