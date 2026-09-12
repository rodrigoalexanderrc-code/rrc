        // ==========================================
        // 6. ALUMNOS (CRUD)
        // ==========================================
        function getBadgeRiesgo(nombreAlumno) {
            const currentYearStr = today().substring(0, 4);
            let diasTotales = 0;
            let diasAusente = 0;
            
            asistenciaRegistros.forEach(r => {
                if (r.fecha.startsWith(currentYearStr)) {
                    r.registros.forEach(reg => {
                        if (reg.alumno === nombreAlumno) {
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
            
            if (diasTotales > 0) {
                const porcentaje = ((diasTotales - diasAusente) / diasTotales) * 100;
                if (porcentaje < 85) {
                    const color = porcentaje < 75 ? 'var(--danger)' : 'var(--warning)';
                    const icon = porcentaje < 75 ? 'fa-exclamation-circle' : 'fa-exclamation-triangle';
                    return ` <span class="badge" style="background-color: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; vertical-align: middle;" title="Riesgo de repitencia"><i class="fas ${icon}"></i> ${porcentaje.toFixed(1)}%</span>`;
                }
            }
            return '';
        }

        function cargarAlumnos() {
            const filtro = document.getElementById('filtroCursoAlumnos').value;
            const tbody = document.getElementById('tablaAlumnos');
            
            const btnReasignar = document.getElementById('btnReasignarLista');
            if (btnReasignar) btnReasignar.style.display = 'none';

            if (!filtro) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem 1rem; color: var(--gray-500);">
                    <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; color: var(--gray-300);"></i>
                    <strong style="font-size: 1rem;">Seleccione un curso</strong><br>
                    <span style="font-size: 0.85rem;">Escoja un curso en el filtro superior para ver sus alumnos y N° de Lista.</span>
                </td></tr>`;
                return;
            }
            
            if (btnReasignar) btnReasignar.style.display = 'inline-block';
            
            let filtrados = alumnos.filter(a => a.cursoId === parseInt(filtro));
            filtrados.sort((a, b) => {
                const numA = a.numeroLista ? parseInt(a.numeroLista) : 0;
                const numB = b.numeroLista ? parseInt(b.numeroLista) : 0;
                if (numA === 0 && numB === 0) return a.nombre.localeCompare(b.nombre);
                if (numA === 0) return 1;   // A sin número → va después
                if (numB === 0) return -1;  // B sin número → A va antes
                return numA - numB;
            });

            if (filtrados.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay alumnos en este curso</td></tr>`;
                return;
            }
            
            tbody.innerHTML = filtrados.map((a, i) => {
                const isRetirado = a.estado === 'retirado';
                const rowClass = isRetirado ? 'alumno-retirado-row' : '';
                const textClass = isRetirado ? 'alumno-retirado' : '';
                return `
                <tr class="${rowClass} draggable-row" draggable="true" data-rut="${a.rut}" ondragstart="handleDragStart(event)" ondragover="handleDragOver(event)" ondrop="handleDrop(event)" ondragenter="handleDragEnter(event)" ondragleave="handleDragLeave(event)">
                    <td style="cursor: grab;">
                        <div class="flex" style="align-items: center; gap: 8px;">
                            <i class="fas fa-grip-vertical text-gray-400" title="Arrastrar para reordenar" style="cursor: grab;"></i>
                            ${a.numeroLista ? `<strong>${a.numeroLista}</strong>` : '<span style="color:var(--gray-400); font-size:0.8rem;">Sin asignar</span>'}
                        </div>
                    </td>
                    <td class="${textClass}">${a.rut}</td>
                    <td><strong class="${textClass}">${a.nombre}</strong>${isRetirado ? ' <span class="badge" style="background:var(--gray-500);color:white;font-size:0.7rem;">Retirado</span>' : getBadgeRiesgo(a.nombre)}</td>
                    <td><span class="badge-curso">${getCursoNombre(a.cursoId)}</span></td>
                    <td class="${textClass}">${a.apoderado}</td>
                    <td class="${textClass}">${a.telefono}</td>
                    <td>
                        <div class="flex gap-1">
                            ${isRetirado ? `<button class="btn btn-sm btn-success offline-restrict" onclick="reincorporarAlumno('${a.rut}')" title="Reincorporar alumno"><i class="fas fa-user-plus"></i></button>` : `<button class="btn btn-sm btn-retirar offline-restrict" onclick="retirarAlumno('${a.rut}')" title="Retirar alumno"><i class="fas fa-user-times"></i></button>`}
                            <button class="btn btn-warning btn-sm offline-restrict" onclick="editarAlumno('${a.rut}')" title="Editar"><i class="fas fa-edit"></i></button>
                            <!-- El botón de eliminar se oculta para forzar el uso de 'Retirar' -->
                            <button class="btn btn-danger btn-sm offline-restrict" onclick="eliminarAlumno('${a.rut}')" title="Eliminar" style="display:none;"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
                `;
            }).join('');
        }

        function cargarSelectsAlumnos() {
            const select = document.getElementById('alumnoCurso');
            const selectReincorporar = document.getElementById('reincorporarCurso');
            const opciones = '<option value="">Seleccione...</option>' +
                cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
                
            select.innerHTML = opciones;
            if (selectReincorporar) selectReincorporar.innerHTML = opciones;

            const filtro = document.getElementById('filtroCursoAlumnos');
            filtro.innerHTML = '<option value="">Seleccione un curso...</option>' +
                cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        }

        function abrirModalAlumno(data = null) {
            document.getElementById('alumnoEditId').value = data ? data.rut : '';
            document.getElementById('modalAlumnoTitle').textContent = data ? 'Editar Alumno' : 'Nuevo Alumno';
            document.getElementById('alumnoRut').value = data ? data.rut : '';
            document.getElementById('alumnoNumeroLista').value = data && data.numeroLista ? data.numeroLista : '';
            document.getElementById('alumnoNombre').value = data ? data.nombre : '';
            document.getElementById('alumnoCurso').value = data ? data.cursoId : '';
            document.getElementById('alumnoApoderado').value = data && data.apoderado && data.apoderado !== 'Sin apoderado' ? data.apoderado : '';
            document.getElementById('alumnoTelefono').value = data && data.telefono && data.telefono !== 'Sin teléfono' ? data.telefono : '';
            document.getElementById('alumnoCorreo').value = data && data.correo && data.correo !== 'Sin correo' ? data.correo : '';
            document.getElementById('modalAlumno').classList.add('active');
        }

        async function guardarAlumno(e) {
            e.preventDefault();
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }
            const originalRut = document.getElementById('alumnoEditId').value;
            const rut = document.getElementById('alumnoRut').value.trim();
            const numeroLista = document.getElementById('alumnoNumeroLista').value.trim();
            let nombre = document.getElementById('alumnoNombre').value.trim();
            if (window.formatearNombreApellidos) {
                nombre = window.formatearNombreApellidos(nombre);
            }
            const cursoId = parseInt(document.getElementById('alumnoCurso').value);
            const apoderado = document.getElementById('alumnoApoderado').value.trim() || 'Sin apoderado';
            const telefono = document.getElementById('alumnoTelefono').value.trim() || 'Sin teléfono';
            const correo = document.getElementById('alumnoCorreo').value.trim() || 'Sin correo';

            if (!rut) { showToast('El RUT es obligatorio', 'error'); return; }
            if (!validarRut(rut)) {
                showToast('RUT inválido o falso. Formato esperado: 12345678-5 (sin puntos, con guion)', 'error');
                return;
            }
            if (alumnos.some(a => a.rut === rut && a.rut !== originalRut)) {
                showToast(`El RUT ${rut} ya existe en la plataforma`, 'error');
                return;
            }
            if (!nombre) { showToast('El nombre es obligatorio', 'error'); return; }
            if (!cursoId) { showToast('Seleccione un curso', 'error'); return; }
            
            // Validar N° de Lista duplicado en el mismo curso
            if (numeroLista) {
                const duplicado = alumnos.find(a => 
                    a.cursoId === cursoId && 
                    String(a.numeroLista) === String(numeroLista) && 
                    a.rut !== rut
                );
                if (duplicado) {
                    showToast(`El N° de Lista ${numeroLista} ya está asignado a ${duplicado.nombre} en este curso`, 'error');
                    return;
                }
            }

            if (originalRut) {
                const alumno = alumnos.find(a => a.rut === originalRut);
                if (alumno) {
                    const nombreAntiguo = alumno.nombre;
                    const rutAntiguo = alumno.rut;
                    const apoderadoAntiguo = alumno.apoderado;
                    const telefonoAntiguo = alumno.telefono;
                    const correoAntiguo = alumno.correo;

                    // Opción 1: Mapear nombres anteriores si cambió el nombre
                    if (nombreAntiguo && nombreAntiguo !== nombre) {
                        let pastNames = [];
                        if (alumno.nombresAnteriores) {
                            pastNames = alumno.nombresAnteriores.split(',').map(n => n.trim());
                        }
                        if (!pastNames.includes(nombreAntiguo)) {
                            pastNames.push(nombreAntiguo);
                        }
                        alumno.nombresAnteriores = pastNames.join(', ');
                    }

                    Object.assign(alumno, { rut, numeroLista, nombre, cursoId, apoderado, telefono, correo });
                    await apiCall('update', 'Alumnos', alumno);

                    const changedNameRut = nombreAntiguo !== nombre || rutAntiguo !== rut;
                    const changedContact = apoderadoAntiguo !== apoderado || telefonoAntiguo !== telefono || correoAntiguo !== correo;

                    if (changedNameRut || changedContact) {
                        const promesasUpdate = [];

                        // 1. Comunicaciones Pendientes
                        comunicacionesPendientes.forEach(c => {
                            if (c.estudiante && c.estudiante.trim().toLowerCase() === nombreAntiguo.trim().toLowerCase()) {
                                let updated = false;
                                if (changedNameRut) { c.estudiante = nombre; updated = true; }
                                if (changedContact) {
                                    if (c.apoderado !== undefined) c.apoderado = apoderado;
                                    if (c.telefono !== undefined) c.telefono = telefono;
                                    if (c.correo !== undefined) c.correo = correo;
                                    updated = true;
                                }
                                if (updated && (c.id !== undefined && c.id !== null && c.id !== "")) promesasUpdate.push(apiCall('update', 'Comunicaciones', c, c.id));
                            }
                        });

                        // 2. Comunicaciones Historial
                        comunicacionesHistorial.forEach(h => {
                            if (h.estudiante && h.estudiante.trim().toLowerCase() === nombreAntiguo.trim().toLowerCase()) {
                                let updated = false;
                                if (changedNameRut) { h.estudiante = nombre; updated = true; }
                                if (changedContact) {
                                    if (h.apoderado !== undefined) h.apoderado = apoderado;
                                    if (h.telefono !== undefined) h.telefono = telefono;
                                    if (h.correo !== undefined) h.correo = correo;
                                    updated = true;
                                }
                                if (updated && (h.id !== undefined && h.id !== null && h.id !== "")) promesasUpdate.push(apiCall('update', 'Historial', h, h.id));
                            }
                        });

                        // 3. Bitácora Llamadas
                        bitacoraLlamadas.forEach(b => {
                            if (b.estudiante && b.estudiante.trim().toLowerCase() === nombreAntiguo.trim().toLowerCase()) {
                                let updated = false;
                                if (changedNameRut) { b.estudiante = nombre; updated = true; }
                                if (changedContact) {
                                    if (b.apoderado !== undefined) b.apoderado = apoderado;
                                    if (b.telefono !== undefined) b.telefono = telefono;
                                    if (b.correo !== undefined) b.correo = correo;
                                    updated = true;
                                }
                                if (updated && (b.id !== undefined && b.id !== null && b.id !== "")) promesasUpdate.push(apiCall('update', 'Bitacora', b, b.id));
                            }
                        });

                        // 4. Asistencia
                        if (changedNameRut) {
                            asistenciaRegistros.forEach(r => {
                                if (r.registros) {
                                    r.registros.forEach(reg => {
                                        if (reg.alumno && reg.alumno.trim().toLowerCase() === nombreAntiguo.trim().toLowerCase()) {
                                            reg.alumno = nombre;
                                        }
                                    });
                                }
                            });
                        }

                        if (promesasUpdate.length > 0) {
                            showToast(`Actualizando registros vinculados a ${nombre}...`, 'info');
                            await Promise.all(promesasUpdate);
                        }
                    }
                }
            } else {
                const nuevoAlumno = { id: nextAlumnoId++, rut, numeroLista, nombre, cursoId, apoderado, telefono, correo };
                alumnos.push(nuevoAlumno);
                await apiCall('insert', 'Alumnos', nuevoAlumno);
            }
            cerrarModal('modalAlumno');
            cargarAlumnos();
            actualizarDashboard();
            cargarSelectsAsistencia();
            cargarListaAsistencia();
            cargarSelectsAlumnos();
            cargarPlanillaAlertas();
            cargarComunicaciones();
            cargarBitacora();
        }

        function editarAlumno(rut) {
            const alumno = alumnos.find(a => a.rut === rut);
            if (alumno) abrirModalAlumno(alumno);
        }

        async function retirarAlumno(rut) {
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }
            if (!confirm('¿Seguro que desea marcar a este alumno como RETIRADO? Dejará de contabilizarse en la asistencia, pero no perderá su historial ni número de lista.')) return;

            const alumno = alumnos.find(a => a.rut === rut);
            if (!alumno) return;

            alumno.estado = 'retirado';
            await apiCall('update', 'Alumnos', alumno);
            showToast(`El alumno ${alumno.nombre} ha sido marcado como retirado`, 'success');
            
            cargarAlumnos();
            if (typeof actualizarDashboard === 'function') actualizarDashboard();
        }

        function reincorporarAlumno(rut) {
            const alumno = alumnos.find(a => a.rut === rut);
            if (!alumno) return;
            
            document.getElementById('reincorporarRut').value = alumno.rut;
            document.getElementById('reincorporarNombreText').textContent = alumno.nombre;
            document.getElementById('reincorporarCurso').value = alumno.cursoId;
            document.getElementById('reincorporarNumeroLista').value = '';
            document.getElementById('modalReincorporar').classList.add('active');
        }

        async function guardarReincorporacion(e) {
            e.preventDefault();
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }

            const rut = document.getElementById('reincorporarRut').value;
            const nuevoCursoId = parseInt(document.getElementById('reincorporarCurso').value);
            const nuevoNumeroLista = document.getElementById('reincorporarNumeroLista').value.trim();

            if (!nuevoCursoId || !nuevoNumeroLista) {
                showToast('Por favor, complete todos los campos.', 'error');
                return;
            }

            // Validar N° de Lista duplicado en el curso destino
            const duplicado = alumnos.find(a => 
                a.cursoId === nuevoCursoId && 
                String(a.numeroLista) === String(nuevoNumeroLista) && 
                a.rut !== rut
            );
            if (duplicado) {
                showToast(`El N° de Lista ${nuevoNumeroLista} ya está asignado a ${duplicado.nombre} en este curso`, 'error');
                return;
            }

            const alumno = alumnos.find(a => a.rut === rut);
            if (!alumno) return;

            alumno.estado = 'activo';
            alumno.cursoId = nuevoCursoId;
            alumno.numeroLista = nuevoNumeroLista;
            
            await apiCall('update', 'Alumnos', alumno);
            showToast(`El alumno ${alumno.nombre} ha sido reincorporado exitosamente.`, 'success');
            
            cerrarModal('modalReincorporar');
            cargarAlumnos();
            if (typeof actualizarDashboard === 'function') actualizarDashboard();
            if (typeof cargarSelectsAsistencia === 'function') cargarSelectsAsistencia();
            if (typeof cargarListaAsistencia === 'function') cargarListaAsistencia();
            if (typeof cargarSelectsAlumnos === 'function') cargarSelectsAlumnos();
        }

        async function eliminarAlumno(rut) {
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }
            if (!confirm('¿Eliminar este alumno y TODO SU HISTORIAL (Asistencia, Bitácora, Comunicaciones)? Esta acción es irreversible.')) return;

            const alumno = alumnos.find(a => a.rut === rut);
            if (!alumno) return;
            const nombreAlumno = alumno.nombre;

            // 1. Borrar de Alumnos (por ID original)
            await apiCall('delete', 'Alumnos', null, alumno.id);

            // 2. Borrar de Asistencia (No tiene ID único, omitido en la nube para evitar borrar todo)

            // 3. Borrar de Comunicaciones (por ID)
            const coms = comunicacionesPendientes.filter(c => c.estudiante && c.estudiante.trim().toLowerCase() === nombreAlumno.trim().toLowerCase());
            for (let c of coms) await apiCall('delete', 'Comunicaciones', null, c.id);

            // 4. Borrar de Historial (por ID)
            const hists = comunicacionesHistorial.filter(h => h.estudiante && h.estudiante.trim().toLowerCase() === nombreAlumno.trim().toLowerCase());
            for (let h of hists) await apiCall('delete', 'Historial', null, h.id);

            // 5. Borrar de Bitacora (por ID)
            const bits = bitacoraLlamadas.filter(b => b.estudiante && b.estudiante.trim().toLowerCase() === nombreAlumno.trim().toLowerCase());
            for (let b of bits) await apiCall('delete', 'Bitacora', null, b.id);

            showToast(`🗑️ ${nombreAlumno} y todo su historial han sido eliminados`, 'success');

            // Refrescar todos los datos desde la BD para sincronizar la interfaz
            await fetchData();
            cargarAlumnos();
            cargarComunicaciones();
            cargarBitacora();
            actualizarDashboard();
        }

        async function reasignarNumerosLista() {
            const filtro = document.getElementById('filtroCursoAlumnos').value;
            if (!filtro) {
                showToast('Seleccione un curso primero.', 'warning');
                return;
            }
            
            const cursoId = parseInt(filtro);
            const cursoObj = cursos.find(c => c.id === cursoId);
            const nombreCurso = cursoObj ? cursoObj.nombre : 'este curso';
            
            if (!confirm(`¿Está seguro que desea reasignar el N° de Lista a todos los alumnos de ${nombreCurso}? Se ordenarán alfabéticamente y se enumerarán desde el 1. Esta acción sobrescribirá los números actuales.`)) {
                return;
            }

            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }

            // Filtrar alumnos del curso
            let alumnosCurso = alumnos.filter(a => a.cursoId === cursoId);
            if (alumnosCurso.length === 0) {
                showToast('No hay alumnos en este curso.', 'warning');
                return;
            }

            // Ordenar alfabéticamente
            alumnosCurso.sort((a, b) => a.nombre.localeCompare(b.nombre));

            // Botón en estado de carga
            const btn = document.getElementById('btnReasignarLista');
            const htmlOriginal = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reordenando...';
            btn.disabled = true;

            try {
                // Actualizar números y guardar en DB
                let count = 0;
                let actualizaciones = [];
                for (let i = 0; i < alumnosCurso.length; i++) {
                    const alumno = alumnosCurso[i];
                    alumno.numeroLista = i + 1;
                    
                    actualizaciones.push(alumno);
                    count++;
                }
                if (actualizaciones.length > 0) {
                    await apiCall('bulk_update', 'Alumnos', actualizaciones);
                }

                showToast(`✅ Se reasignaron los números a ${count} alumnos.`, 'success');
                cargarAlumnos(); // Refrescar la tabla
            } catch (err) {
                showToast('❌ Ocurrió un error al reasignar los números.', 'error');
            } finally {
                btn.innerHTML = htmlOriginal;
                btn.disabled = false;
            }
        }

        // ==========================================
        // DRAG AND DROP - ORDENAMIENTO MANUAL
        // ==========================================
        let draggedRow = null;

        function handleDragStart(e) {
            draggedRow = e.target.closest('tr');
            e.dataTransfer.effectAllowed = 'move';
            // Algunos navegadores requieren datos para funcionar
            e.dataTransfer.setData('text/plain', draggedRow.getAttribute('data-rut'));
            setTimeout(() => { draggedRow.classList.add('dragging'); }, 0);
        }

        function handleDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            return false;
        }

        function handleDragEnter(e) {
            e.preventDefault();
            const targetRow = e.target.closest('tr');
            if (targetRow && targetRow !== draggedRow && targetRow.classList.contains('draggable-row')) {
                targetRow.classList.add('drag-over');
            }
        }

        function handleDragLeave(e) {
            const targetRow = e.target.closest('tr');
            if (targetRow) {
                targetRow.classList.remove('drag-over');
            }
        }

        async function handleDrop(e) {
            e.stopPropagation();
            e.preventDefault();
            const targetRow = e.target.closest('tr');
            
            if (draggedRow) draggedRow.classList.remove('dragging');
            
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

            if (draggedRow && targetRow && draggedRow !== targetRow && targetRow.classList.contains('draggable-row')) {
                const tbody = document.getElementById('tablaAlumnos');
                const rows = Array.from(tbody.querySelectorAll('.draggable-row'));
                const draggedIndex = rows.indexOf(draggedRow);
                const targetIndex = rows.indexOf(targetRow);

                if (draggedIndex < targetIndex) {
                    targetRow.parentNode.insertBefore(draggedRow, targetRow.nextSibling);
                } else {
                    targetRow.parentNode.insertBefore(draggedRow, targetRow);
                }
                
                // Recalcular y guardar el nuevo orden
                await guardarNuevoOrdenVisual();
            }
            return false;
        }

        async function guardarNuevoOrdenVisual() {
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet.', 'error');
                cargarAlumnos(); // Revertir visualmente
                return;
            }

            const tbody = document.getElementById('tablaAlumnos');
            const rows = Array.from(tbody.querySelectorAll('.draggable-row'));
            
            const btn = document.getElementById('btnReasignarLista');
            const oldHtml = btn ? btn.innerHTML : '';
            if (btn) {
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
                btn.disabled = true;
            }
            
            let count = 0;
            let actualizaciones = [];
            
            rows.forEach((row, index) => {
                const rut = row.getAttribute('data-rut');
                const alumno = alumnos.find(a => a.rut === rut);
                if (alumno) {
                    const nuevoNum = index + 1;
                    if (parseInt(alumno.numeroLista) !== nuevoNum) {
                        alumno.numeroLista = nuevoNum;
                        actualizaciones.push(alumno);
                        count++;
                    }
                }
            });

            if (actualizaciones.length > 0) {
                try {
                    await apiCall('bulk_update', 'Alumnos', actualizaciones);
                    showToast(`✅ Nuevo orden guardado (${count} alumnos actualizados)`, 'success');
                } catch(e) {
                    showToast('❌ Error al guardar el nuevo orden.', 'error');
                }
            } else {
                showToast('✅ El orden no cambió.', 'info');
            }
            
            if (btn) {
                btn.innerHTML = oldHtml;
                btn.disabled = false;
            }
            cargarAlumnos();
        }

