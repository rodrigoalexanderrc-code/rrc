        // ==========================================
        // 12. COMUNICACIÓN
        // ==========================================
        function obtenerMesAño(fechaStr) {
            if (!fechaStr) return null;
            fechaStr = fechaStr.trim();
            // Intenta formato ISO: 2026-07-10...
            let match = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
                return {
                    año: parseInt(match[1]),
                    mes: parseInt(match[2])
                };
            }
            // Intenta formato local: DD/MM/YYYY o DD-MM-YYYY
            match = fechaStr.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
            if (match) {
                return {
                    año: parseInt(match[3]),
                    mes: parseInt(match[2])
                };
            }
            // Fallback Date parser
            const d = new Date(fechaStr);
            if (!isNaN(d.getTime())) {
                return {
                    año: d.getFullYear(),
                    mes: d.getMonth() + 1
                };
            }
            return null;
        }

        function formatearFechaLegible(fechaStr) {
            if (!fechaStr) return '-';
            fechaStr = fechaStr.trim();
            let año, mes, dia, horas = 0, minutos = 0;

            // 1. Intenta formato ISO: 2026-07-10T17:22:27.000Z
            let match = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
            if (match) {
                año = parseInt(match[1]);
                mes = parseInt(match[2]);
                dia = parseInt(match[3]);
                horas = parseInt(match[4]);
                minutos = parseInt(match[5]);
            } else {
                // 2. Intenta formato local: DD/MM/YYYY o DD-MM-YYYY y horas:minutos
                match = fechaStr.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
                if (match) {
                    dia = parseInt(match[1]);
                    mes = parseInt(match[2]);
                    año = parseInt(match[3]);
                    
                    const horaMatch = fechaStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);
                    if (horaMatch) {
                        horas = parseInt(horaMatch[1]);
                        minutos = parseInt(horaMatch[2]);
                        const ampm = horaMatch[4] ? horaMatch[4].toLowerCase().replace(/\s/g, '') : '';
                        if (ampm.includes('p') && horas < 12) {
                            horas += 12;
                        } else if (ampm.includes('a') && horas === 12) {
                            horas = 0;
                        }
                    }
                } else {
                    const d = new Date(fechaStr);
                    if (!isNaN(d.getTime())) {
                        año = d.getFullYear();
                        mes = d.getMonth() + 1;
                        dia = d.getDate();
                        horas = d.getHours();
                        minutos = d.getMinutes();
                    } else {
                        return fechaStr;
                    }
                }
            }

            const diaPad = String(dia).padStart(2, '0');
            const mesPad = String(mes).padStart(2, '0');
            const minPad = String(minutos).padStart(2, '0');
            const hrPad = String(horas).padStart(2, '0');
            return `${diaPad}/${mesPad}/${año} - ${hrPad}:${minPad}`;
        }

        function actualizarFiltroMeses() {
            const selectMes = document.getElementById('historialFiltroMes');
            if (!selectMes) return;
            const valAnterior = selectMes.value;

            const mesesUnicos = new Map();
            const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

            comunicacionesHistorial.forEach(h => {
                const info = obtenerMesAño(h.fecha);
                if (info) {
                    const key = `${info.año}-${String(info.mes).padStart(2, '0')}`;
                    if (!mesesUnicos.has(key)) {
                        const etiqueta = `${nombresMeses[info.mes - 1]} ${info.año}`;
                        mesesUnicos.set(key, { key, año: info.año, mes: info.mes, etiqueta });
                    }
                }
            });

            const mesesOrdenados = Array.from(mesesUnicos.values()).sort((a, b) => b.key.localeCompare(a.key));

            let html = '<option value="">Todos los meses</option>';
            mesesOrdenados.forEach(m => {
                html += `<option value="${m.key}">${m.etiqueta}</option>`;
            });

            selectMes.innerHTML = html;
            selectMes.value = valAnterior;
            if (selectMes.value !== valAnterior) {
                selectMes.value = '';
            }
        }

        function cargarComunicaciones() {
            const select = document.getElementById('comunicacionEstudiante');
            select.innerHTML = '<option value="">Seleccione...</option>' +
                alumnos.map(a => `<option value="${a.rut}">${a.nombre} (${getCursoNombre(a.cursoId)})</option>`).join('');

            // Pendientes
            const container = document.getElementById('comunicacionesContainer');
            if (comunicacionesPendientes.length === 0) {
                container.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--success);"></i><p>No hay pendientes</p></div>`;
            } else {
                // Filtrar duplicados (si por error en la red se guardó dos veces el mismo estudiante)
                const unicos = [];
                const estudiantesVistos = new Set();
                for (const c of comunicacionesPendientes) {
                    // Si es una alerta de asistencia o genérica repetida
                    if (!estudiantesVistos.has(c.estudiante)) {
                        estudiantesVistos.add(c.estudiante);
                        unicos.push(c);
                    }
                }
                comunicacionesPendientes = unicos;

                // Ordenar por nivel de gravedad (Roja primero)
                const severityOrder = { 'Roja': 1, 'Naranja': 2, 'Amarilla': 3, undefined: 4 };
                comunicacionesPendientes.sort((a, b) => severityOrder[a.nivel] - severityOrder[b.nivel]);

                container.innerHTML = comunicacionesPendientes.map((c, i) => {
                    const alumnoData = alumnos.find(a => a.nombre === c.estudiante) || {};
                    const emailTexto = alumnoData.email ? ` · ✉️ ${alumnoData.email}` : ' · ✉️ Sin correo';
                    let borderColor = 'var(--gray-300)';
                    let badgeHtml = '';
                    if (c.nivel === 'Roja') { borderColor = '#b91c1c'; badgeHtml = `<span style="background:#fee2e2;color:#b91c1c;padding:2px 6px;border-radius:4px;font-size:0.75rem;font-weight:bold;margin-right:5px;border:1px solid #b91c1c33;">${c.nivel}</span>`; }
                    else if (c.nivel === 'Naranja') { borderColor = '#c2410c'; badgeHtml = `<span style="background:#ffedd5;color:#c2410c;padding:2px 6px;border-radius:4px;font-size:0.75rem;font-weight:bold;margin-right:5px;border:1px solid #c2410c33;">${c.nivel}</span>`; }
                    else if (c.nivel === 'Amarilla') { borderColor = '#b45309'; badgeHtml = `<span style="background:#fef3c7;color:#b45309;padding:2px 6px;border-radius:4px;font-size:0.75rem;font-weight:bold;margin-right:5px;border:1px solid #b4530933;">${c.nivel}</span>`; }
                    else { borderColor = 'var(--danger)'; }
                    let motivoDisplay = c.motivo;
                    if (motivoDisplay && motivoDisplay.startsWith('Inasistencia mensual')) {
                        const currentMonthStr = today().substring(0, 7);
                        const registrosFaltas = asistenciaRegistros.filter(r =>
                            r.fecha.startsWith(currentMonthStr) &&
                            r.registros.some(reg => reg.alumno === c.estudiante && reg.estado === 'ausente')
                        );
                        if (registrosFaltas.length > 0) {
                            const fechasFaltas = registrosFaltas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).map(r => r.fecha.split('-').reverse().join('/')).join(', ');
                            motivoDisplay = `Inasistencia mensual (${registrosFaltas.length} faltas: ${fechasFaltas})`;
                            c.motivo = motivoDisplay; // <-- Actualizar el objeto real para que se guarde correctamente en el historial
                        }
                    }

                    return `
    <div style="background:var(--gray-50);padding:1rem;border-radius:8px;margin-bottom:0.8rem;border-left:4px solid ${borderColor};display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
            <div style="font-weight:700;">${c.estudiante}</div>
            <div style="font-size:0.85rem;color:var(--gray-500);">👤 ${c.apoderado} · 📱 ${c.telefono}${emailTexto}</div>
            <div style="font-size:0.85rem;color:${borderColor}; margin-top:4px;">${badgeHtml}⚠️ ${motivoDisplay}</div>
        </div>
        <div class="flex gap-1" style="flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" onclick="marcarContactado(${i})"><i class="fas fa-check"></i> Ingresar Acción Realizada</button>
        </div>
    </div>
`}).join('');
            }

            // Historial
            const tbody = document.getElementById('historialComunicaciones');
            actualizarFiltroMeses();

            const searchInput = document.getElementById('historialFiltroTexto');
            const searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const selectMes = document.getElementById('historialFiltroMes');
            const searchMes = selectMes ? selectMes.value : '';

            let filteredHistory = comunicacionesHistorial;

            if (searchMes) {
                filteredHistory = filteredHistory.filter(h => {
                    const info = obtenerMesAño(h.fecha);
                    if (!info) return false;
                    const key = `${info.año}-${String(info.mes).padStart(2, '0')}`;
                    return key === searchMes;
                });
            }

            if (searchText) {
                filteredHistory = filteredHistory.filter(h => {
                    const estudiante = normalizeSearchText(h.estudiante);
                    const apoderado = normalizeSearchText(h.apoderado);
                    const motivo = normalizeSearchText(h.motivo);
                    const medio = normalizeSearchText(h.medio);
                    const nota = normalizeSearchText(h.nota);
                    const fecha = normalizeSearchText(h.fecha);
                    const estado = normalizeSearchText(h.estado);
                    return estudiante.includes(searchText) ||
                           apoderado.includes(searchText) ||
                           motivo.includes(searchText) ||
                           medio.includes(searchText) ||
                           nota.includes(searchText) ||
                           fecha.includes(searchText) ||
                           estado.includes(searchText);
                });
            }

            if (filteredHistory.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">${(searchText || searchMes) ? 'No se encontraron coincidencias' : 'Sin historial'}</td></tr>`;
            } else {
                tbody.innerHTML = filteredHistory.map((h) => {
                    const idx = comunicacionesHistorial.indexOf(h);
                    return `
    <tr>
        <td style="white-space: nowrap;">${formatearFechaLegible(h.fecha)}</td>
        <td><a href="#" onclick="verDetalleComunicacion(${idx}); return false;" style="color:var(--primary);font-weight:600;text-decoration:none;" title="Ver detalles completos">${h.estudiante}</a></td>
        <td>${h.apoderado}</td>
        <td style="font-size: 0.85rem; color: var(--gray-600);">${h.motivo || 'Gestión manual'}</td>
        <td>${h.medio}</td>
        <td>${h.responsable || '-'}</td>
        <td style="max-width: 250px; word-break: break-word; white-space: normal;" title="${h.nota || ''}">${h.nota || '-'}</td>
        <td style="white-space: nowrap;">
            <span style="color:var(--success);font-weight:600;">${h.estado}</span>
            <button class="btn btn-outline btn-sm" onclick="editarComunicacion(${idx})" style="margin-left:8px;padding:2px 6px;" title="Editar historial"><i class="fas fa-pencil-alt"></i></button>
        </td>
    </tr>
`;
                }).join('');
            }

            document.getElementById('pendientesBadge').textContent = comunicacionesPendientes.length;
        }

        function actualizarDatosComunicacion() {
            const rut = document.getElementById('comunicacionEstudiante').value;
            const alumno = alumnos.find(a => a.rut === rut);
            if (alumno) {
                document.getElementById('comunicacionApoderado').value = alumno.apoderado;
                document.getElementById('comunicacionTelefono').value = alumno.telefono;
            } else {
                document.getElementById('comunicacionApoderado').value = '';
                document.getElementById('comunicacionTelefono').value = '';
            }
        }

        function abrirModalComunicacion() {
            document.getElementById('modalComunicacion').classList.add('active');
            cargarComunicaciones();
        }

        async function enviarComunicacion(e) {
            e.preventDefault();
            const estudianteRut = document.getElementById('comunicacionEstudiante').value;
            const alumno = alumnos.find(a => a.rut === estudianteRut);
            if (!alumno) { showToast('Seleccione un estudiante', 'error'); return; }

            const medio = document.getElementById('comunicacionMedio').value;
            const responsable = document.getElementById('comunicacionResponsable').value;
            const nota = document.getElementById('comunicacionNota').value;

            const pendientesAEliminar = comunicacionesPendientes.filter(c => c.estudiante === alumno.nombre);
            const motivoResuelto = pendientesAEliminar.length > 0 ? pendientesAEliminar[0].motivo : 'Gestión manual';

            const nuevaHistorial = {
                id: nextHistorialId++,
                fecha: new Date().toLocaleString(),
                estudiante: alumno.nombre,
                apoderado: alumno.apoderado,
                motivo: motivoResuelto,
                medio: medio,
                responsable: responsable,
                nota: nota,
                estado: '✅ Realizada'
            };
            comunicacionesHistorial.unshift(nuevaHistorial);
            await apiCall('insert', 'Historial', nuevaHistorial);

            comunicacionesPendientes = comunicacionesPendientes.filter(c => c.estudiante !== alumno.nombre);
            if (pendientesAEliminar.length > 0) {
                for (let p of pendientesAEliminar) {
                    await apiCall('delete', 'Comunicaciones', null, p.id);
                }
            }

            showToast(`📞 Comunicación registrada con ${alumno.apoderado}`);
            cerrarModal('modalComunicacion');
            cargarComunicaciones();
            actualizarDashboard();
            document.getElementById('pendientesBadge').textContent = comunicacionesPendientes.length;
        }

        async function contactarPendiente(index) {
            const c = comunicacionesPendientes[index];
            showToast(`📞 Llamando a ${c.apoderado}...`, 'info');
            const nuevaHistorial = {
                id: nextHistorialId++,
                fecha: new Date().toLocaleString(),
                estudiante: c.estudiante,
                apoderado: c.apoderado,
                medio: 'Llamada',
                estado: '✅ Realizada'
            };
            comunicacionesHistorial.unshift(nuevaHistorial);
            await apiCall('insert', 'Historial', nuevaHistorial);

            comunicacionesPendientes.splice(index, 1);
            await apiCall('delete', 'Comunicaciones', null, c.id);

            cargarComunicaciones();
            actualizarDashboard();
            document.getElementById('pendientesBadge').textContent = comunicacionesPendientes.length;
        }

        async function enviarSMS(index) {
            const c = comunicacionesPendientes[index];
            showToast(`✉️ SMS enviado a ${c.apoderado}`, 'success');
            const nuevaHistorial = {
                id: nextHistorialId++,
                fecha: new Date().toLocaleString(),
                estudiante: c.estudiante,
                apoderado: c.apoderado,
                medio: 'SMS',
                estado: '✅ Enviado'
            };
            comunicacionesHistorial.unshift(nuevaHistorial);
            await apiCall('insert', 'Historial', nuevaHistorial);

            comunicacionesPendientes.splice(index, 1);
            await apiCall('delete', 'Comunicaciones', null, c.id);

            cargarComunicaciones();
            actualizarDashboard();
            document.getElementById('pendientesBadge').textContent = comunicacionesPendientes.length;
        }

        function marcarContactado(index) {
            const c = comunicacionesPendientes[index];
            const alumno = alumnos.find(a => a.nombre === c.estudiante);

            // Abrir el modal de nueva comunicación
            abrirModalComunicacion();

            // Pre-seleccionar al estudiante si existe en la base de datos de alumnos
            if (alumno) {
                document.getElementById('comunicacionEstudiante').value = alumno.rut;
                actualizarDatosComunicacion(); // Actualizar apoderado y teléfono en el formulario
            } else {
                showToast(`Estudiante no encontrado en la base de datos de alumnos.`, 'warning');
            }
        }

        function verDetalleComunicacion(index) {
            const h = comunicacionesHistorial[index];
            document.getElementById('editComunicacionIndex').value = index;
            document.getElementById('editComunicacionId').value = h.id || '';
            document.getElementById('editComunicacionEstudiante').value = h.estudiante;
            document.getElementById('editComunicacionApoderado').value = h.apoderado;

            // Set selects safely
            const medioSelect = document.getElementById('editComunicacionMedio');
            if (!Array.from(medioSelect.options).some(o => o.value === h.medio)) {
                medioSelect.add(new Option(h.medio, h.medio));
            }
            medioSelect.value = h.medio;

            const estadoSelect = document.getElementById('editComunicacionEstado');
            if (!Array.from(estadoSelect.options).some(o => o.value === h.estado)) {
                estadoSelect.add(new Option(h.estado, h.estado));
            }
            estadoSelect.value = h.estado;

            document.getElementById('editComunicacionResponsable').value = h.responsable || '';
            document.getElementById('editComunicacionNota').value = h.nota || '';

            document.getElementById('modalEditarComunicacion').classList.add('active');
        }

        function editarComunicacion(index) {
            verDetalleComunicacion(index); // Reutilizamos la misma vista
        }

        async function guardarEdicionComunicacion(e) {
            e.preventDefault();
            const index = document.getElementById('editComunicacionIndex').value;
            const h = comunicacionesHistorial[index];

            h.medio = document.getElementById('editComunicacionMedio').value;
            h.responsable = document.getElementById('editComunicacionResponsable').value;
            h.estado = document.getElementById('editComunicacionEstado').value;
            h.nota = document.getElementById('editComunicacionNota').value;

            if (h.id !== undefined && h.id !== null && h.id !== "") {
                await apiCall('update', 'Historial', h, h.id);
            } else {
                // Mock local update if no ID is available
                await apiCall('update', 'Historial', h);
            }

            cerrarModal('modalEditarComunicacion');
            cargarComunicaciones();
            showToast('✅ Historial actualizado', 'success');
        }

        // ==========================================
        // 13. BITÁCORA DE LLAMADAS
        // ==========================================
        function actualizarBitacoraFiltroMeses() {
            const selectMes = document.getElementById('bitacoraFiltroMes');
            if (!selectMes) return;
            const valAnterior = selectMes.value;

            const mesesUnicos = new Map();
            const nombresMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

            bitacoraLlamadas.forEach(e => {
                const info = obtenerMesAño(e.fecha);
                if (info) {
                    const key = `${info.año}-${String(info.mes).padStart(2, '0')}`;
                    if (!mesesUnicos.has(key)) {
                        const etiqueta = `${nombresMeses[info.mes - 1]} ${info.año}`;
                        mesesUnicos.set(key, { key, año: info.año, mes: info.mes, etiqueta });
                    }
                }
            });

            const mesesOrdenados = Array.from(mesesUnicos.values()).sort((a, b) => b.key.localeCompare(a.key));

            let html = '<option value="">Todos los meses</option>';
            mesesOrdenados.forEach(m => {
                html += `<option value="${m.key}">${m.etiqueta}</option>`;
            });

            selectMes.innerHTML = html;
            selectMes.value = valAnterior;
            if (selectMes.value !== valAnterior) {
                selectMes.value = '';
            }
        }

        function cargarBitacora() {
            const container = document.getElementById('bitacoraContainer');
            actualizarBitacoraFiltroMeses();

            // Leer filtros
            const filtroTexto = normalizeSearchText(document.getElementById('bitacoraFiltroTexto')?.value);
            const filtroCat = document.getElementById('bitacoraFiltroCategoria')?.value || '';
            const selectMes = document.getElementById('bitacoraFiltroMes');
            const filtroMes = selectMes ? selectMes.value : '';

            // Aplicar filtros
            let filtradas = bitacoraLlamadas;
            // FILTRO: Ocultar intervenciones de Asistente Social en la bitácora normal
            filtradas = filtradas.filter(e => e.categoria !== 'Intervención Asistente Social');
            
            if (filtroMes) {
                filtradas = filtradas.filter(e => {
                    const info = obtenerMesAño(e.fecha);
                    if (!info) return false;
                    const key = `${info.año}-${String(info.mes).padStart(2, '0')}`;
                    return key === filtroMes;
                });
            }
            if (filtroTexto) {
                filtradas = filtradas.filter(e => 
                    normalizeSearchText(e.estudiante).includes(filtroTexto) || 
                    normalizeSearchText(e.motivo).includes(filtroTexto)
                );
            }
            if (filtroCat) {
                if (filtroCat === 'Otro') {
                    filtradas = filtradas.filter(e => {
                        const c = e.categoria || 'Otro';
                        return c === 'Otro' || !['Salud', 'Retiro', 'Citacion'].includes(c);
                    });
                } else {
                    filtradas = filtradas.filter(e => e.categoria === filtroCat);
                }
            }

            if (filtradas.length === 0) {
                container.innerHTML = `<div class="empty-state"><i class="fas fa-book"></i><p>No hay registros que coincidan con la búsqueda</p></div>`;
                return;
            }

            container.innerHTML = filtradas.map(entry => {
                let badgeColor = 'var(--gray-500)';
                let bgBadge = 'var(--gray-200)';
                let icon = 'fa-tag';
                const cat = entry.categoria || 'Otro';

                if (cat === 'Conducta') { badgeColor = '#b91c1c'; bgBadge = '#fee2e2'; icon = 'fa-user-times'; }
                else if (cat === 'Salud') { badgeColor = '#1d4ed8'; bgBadge = '#dbeafe'; icon = 'fa-briefcase-medical'; }
                else if (cat === 'Uniforme') { badgeColor = '#b45309'; bgBadge = '#fef3c7'; icon = 'fa-tshirt'; }
                else if (cat === 'Retiro') { badgeColor = '#047857'; bgBadge = '#d1fae5'; icon = 'fa-walking'; }
                else if (cat === 'Citacion') { badgeColor = '#6d28d9'; bgBadge = '#ede9fe'; icon = 'fa-user-clock'; }

                return `
    <div class="log-entry" style="position: relative; padding-right: 80px;">
        <div class="flex-between" style="flex-wrap: wrap; gap: 5px;">
            <span class="log-time"><i class="far fa-clock"></i> ${entry.fecha}</span>
            <div class="flex gap-2">
                <span style="font-size: 0.75rem; font-weight: bold; background-color: ${bgBadge}; color: ${badgeColor}; padding: 2px 8px; border-radius: 12px;"><i class="fas ${icon}"></i> ${cat}</span>
                <span class="badge-status" style="background:${entry.resultado === 'Contacto exitoso' ? '#dcfce7' : '#fef3c7'};color:${entry.resultado === 'Contacto exitoso' ? '#166534' : '#92400e'};">${entry.resultado || entry.estado || ''}</span>
            </div>
        </div>
        <div class="log-content">👤 ${entry.estudiante} → ${entry.apoderado} (${entry.telefono})</div>
        <div class="log-detail">📝 ${entry.motivo}</div>
        ${entry.responsable ? `<div class="log-detail" style="margin-top: 4px; color: var(--primary);"><i class="fas fa-user-edit"></i> <strong>Responsable:</strong> ${entry.responsable}</div>` : ''}
        <button class="btn btn-sm btn-outline" style="position: absolute; right: 15px; bottom: 15px; padding: 4px 8px; font-size: 0.75rem; border-radius: 4px;" onclick="abrirEditarBitacora(${entry.id})">
            <i class="fas fa-edit"></i> Editar
        </button>
    </div>
`}).join('');
        }

        function imprimirHojaVida() {
            const filtroTexto = normalizeSearchText(document.getElementById('bitacoraFiltroTexto')?.value);
            if (!filtroTexto) {
                showToast('Por favor, busca el nombre de un alumno en el filtro antes de exportar la Hoja de Vida', 'warning');
                return;
            }

            const alumno = alumnos.find(a => normalizeSearchText(a.nombre).includes(filtroTexto));
            if (!alumno) {
                showToast('No se encontró al alumno', 'error');
                return;
            }

            const cursoStr = getCursoNombre(alumno.cursoId);
            const registrosAlumno = bitacoraLlamadas.filter(e => normalizeSearchText(e.estudiante) === normalizeSearchText(alumno.nombre));

            let trs = registrosAlumno.map(r => `
                <tr>
                    <td style="padding:0.75rem; border:1px solid #ccc; font-size:0.9rem; white-space:nowrap;">${r.fecha.split(',')[0]}<br><small>${r.fecha.split(',')[1] || ''}</small></td>
                    <td style="padding:0.75rem; border:1px solid #ccc; font-size:0.9rem; font-weight:bold;">${r.categoria || 'Registro'}</td>
                    <td style="padding:0.75rem; border:1px solid #ccc; font-size:0.9rem;">${r.motivo}</td>
                    <td style="padding:0.75rem; border:1px solid #ccc; font-size:0.9rem;">${r.resultado || r.estado || ''}</td>
                </tr>
            `).join('');

            if (registrosAlumno.length === 0) {
                trs = `<tr><td colspan="4" style="padding:1rem; text-align:center; color:#666;">No hay registros disciplinarios o de incidentes para este alumno.</td></tr>`;
            }

            const logoSrc = document.querySelector('.sidebar-brand img')?.src || '';

            const contentHtml = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #1e3a8a; padding-bottom: 1rem; margin-bottom: 2rem;">
                    <img src="${logoSrc}" alt="Insignia" style="height: 60px; width: auto; object-fit: contain;">
                    <div>
                        <h3 style="margin:0; color:#1f2937; font-size:1.2rem; text-transform:uppercase; font-family: sans-serif;">Liceo Simón Bolívar</h3>
                        <p style="margin:0; color:#6b7280; font-size:0.9rem; font-family: sans-serif;">Inspectoría General - Departamento de Convivencia Escolar</p>
                    </div>
                </div>
                
                <h2 style="text-align:center; color:#1e3a8a; margin-bottom: 2rem; font-family: sans-serif;">HOJA DE VIDA Y COMPORTAMIENTO</h2>
                
                <table style="margin-bottom: 2rem; width:100%; border-collapse: collapse; font-family: sans-serif;">
                    <tr>
                        <td style="border:none; padding: 0.5rem 0;"><strong>Nombre del Estudiante:</strong> ${alumno.nombre}</td>
                        <td style="border:none; padding: 0.5rem 0;"><strong>Curso:</strong> ${cursoStr}</td>
                    </tr>
                    <tr>
                        <td style="border:none; padding: 0.5rem 0;"><strong>RUT:</strong> ${alumno.rut}</td>
                        <td style="border:none; padding: 0.5rem 0;"><strong>Apoderado:</strong> ${alumno.apoderado}</td>
                    </tr>
                    <tr>
                        <td style="border:none; padding: 0.5rem 0;"><strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString('es-CL')}</td>
                        <td style="border:none; padding: 0.5rem 0;"></td>
                    </tr>
                </table>

                <h3 style="color:#374151; margin-bottom: 1rem; font-family: sans-serif;">Registro de Incidentes y Novedades</h3>
                <table style="width:100%; border-collapse: collapse; font-family: sans-serif;">
                    <thead>
                        <tr style="background:#f1f5f9;">
                            <th style="width:15%; padding:0.75rem; border:1px solid #ccc; text-align:left;">Fecha</th>
                            <th style="width:15%; padding:0.75rem; border:1px solid #ccc; text-align:left;">Categoría</th>
                            <th style="width:50%; padding:0.75rem; border:1px solid #ccc; text-align:left;">Motivo / Descripción</th>
                            <th style="width:20%; padding:0.75rem; border:1px solid #ccc; text-align:left;">Resolución</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${trs}
                    </tbody>
                </table>

                <div style="margin-top: 5rem; display: flex; justify-content: space-around; text-align: center; font-family: sans-serif;">
                    <div>
                        <div style="width: 200px; border-bottom: 1px solid #6b7280; margin-bottom: 0.5rem; margin-inline: auto;"></div>
                        <p style="margin:0; font-size:0.9rem; color:#1f2937; font-weight:600;">Inspector(a) General</p>
                        <p style="margin:0; font-size:0.8rem; color:#6b7280;">Firma y Timbre</p>
                    </div>
                    <div>
                        <div style="width: 200px; border-bottom: 1px solid #6b7280; margin-bottom: 0.5rem; margin-inline: auto;"></div>
                        <p style="margin:0; font-size:0.9rem; color:#1f2937; font-weight:600;">Toma de Conocimiento</p>
                        <p style="margin:0; font-size:0.8rem; color:#6b7280;">Firma Apoderado / Fecha</p>
                    </div>
                </div>
            `;

            document.getElementById('hojaVidaPaper').innerHTML = contentHtml;
            document.getElementById('modalPreviewHojaVida').classList.add('active');
        }

        function imprimirHojaVidaDesdePreview() {
            const content = document.getElementById('hojaVidaPaper').innerHTML;
            
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`
                <html>
                <head>
                    <title>Hoja de Vida</title>
                    <style>
                        body { font-family: sans-serif; padding: 2rem; background: white; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
                        th, td { padding: 0.75rem; border: 1px solid #ccc; text-align: left; }
                        th { background: #f1f5f9; }
                        @media print {
                            body { padding: 0; }
                            @page { margin: 1.5cm; }
                        }
                    </style>
                </head>
                <body>
                    ${content}
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

        function limpiarFiltrosBitacora() {
            const txt = document.getElementById('bitacoraFiltroTexto');
            const cat = document.getElementById('bitacoraFiltroCategoria');
            const mes = document.getElementById('bitacoraFiltroMes');
            if (txt) txt.value = '';
            if (cat) cat.value = '';
            if (mes) mes.value = '';
            cargarBitacora();
        }

        function limpiarFiltrosHistorial() {
            const txt = document.getElementById('historialFiltroTexto');
            const mes = document.getElementById('historialFiltroMes');
            if (txt) txt.value = '';
            if (mes) mes.value = '';
            cargarComunicaciones();
        }

        function toggleCategoriaOtra() {
            const select = document.getElementById('bitacoraCategoria');
            const input = document.getElementById('bitacoraCategoriaOtra');
            if (select.value === 'Otro') {
                input.style.display = 'block';
                input.required = true;
            } else {
                input.style.display = 'none';
                input.required = false;
                input.value = '';
            }
        }

        function abrirModalBitacora() {
            document.getElementById('modalBitacora').classList.add('active');

            // Fecha por defecto
            const now = new Date();
            const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
            document.getElementById('bitacoraFecha').value = local.toISOString().slice(0, 16);

            // Limpiar campo Otro
            const inputOtra = document.getElementById('bitacoraCategoriaOtra');
            if (inputOtra) {
                inputOtra.style.display = 'none';
                inputOtra.value = '';
                inputOtra.required = false;
            }

            // Cargar estudiantes en datalist
            const datalist = document.getElementById('listaEstudiantesBitacora');
            if (datalist) {
                datalist.innerHTML = alumnos.map(a => {
                    const suffix = a.rut ? ` - ${a.rut}` : '';
                    return `<option value="${a.nombre}${suffix}">${removeAccents(a.nombre)}${suffix}</option>`;
                }).join('');
            }
            const inputEstudiante = document.getElementById('bitacoraEstudianteInput');
            if (inputEstudiante) inputEstudiante.value = '';
        }

        async function guardarBitacora(e) {
            e.preventDefault();
            const fecha = document.getElementById('bitacoraFecha').value;

            const inputVal = document.getElementById('bitacoraEstudianteInput').value.trim();
            const partes = inputVal.split(' - ');
            const nombreStr = partes[0].trim();
            const rutStr = partes.length > 1 ? partes[1].trim() : '';

            let alumno;
            if (rutStr && rutStr !== 'undefined') {
                alumno = alumnos.find(a => a.rut === rutStr);
            }
            if (!alumno) {
                alumno = alumnos.find(a => a.nombre.toLowerCase() === nombreStr.toLowerCase());
            }

            if (!alumno) {
                showToast('Por favor, seleccione un estudiante válido de la lista', 'error');
                return;
            }

            const apoderado = document.getElementById('bitacoraApoderado').value.trim();
            const telefono = document.getElementById('bitacoraTelefono').value.trim();
            const motivo = document.getElementById('bitacoraMotivo').value.trim();
            const resultado = document.getElementById('bitacoraResultado').value;
            const responsable = document.getElementById('bitacoraResponsable').value.trim();
            let categoria = document.getElementById('bitacoraCategoria').value;
            if (categoria === 'Otro') {
                categoria = document.getElementById('bitacoraCategoriaOtra').value.trim() || 'Otro';
            }

            const nuevaLlamada = {
                id: nextBitacoraId++,
                fecha: new Date(fecha).toLocaleString(),
                estudiante: alumno.nombre,
                apoderado: apoderado || alumno.apoderado,
                telefono: telefono || alumno.telefono,
                categoria: categoria,
                motivo: motivo,
                resultado: resultado,
                responsable: responsable
            };
            bitacoraLlamadas.unshift(nuevaLlamada);
            await apiCall('insert', 'Bitacora', nuevaLlamada);

            const derivarAS = document.getElementById('bitacoraDerivarAS');
            if (derivarAS && derivarAS.checked) {
                const nuevaIntervencion = {
                    id: nextBitacoraId++,
                    fecha: nuevaLlamada.fecha,
                    estudiante: nuevaLlamada.estudiante,
                    apoderado: nuevaLlamada.apoderado,
                    telefono: nuevaLlamada.telefono,
                    categoria: 'Intervención Asistente Social',
                    motivo: `Derivación desde Bitácora | Categoría: ${categoria} | Motivo: ${motivo} | Acuerdos: (Pendiente)`,
                    resultado: '🔴 Abierto',
                    responsable: responsable
                };
                bitacoraLlamadas.unshift(nuevaIntervencion);
                await apiCall('insert', 'Bitacora', nuevaIntervencion);
                derivarAS.checked = false;
                cargarAsistenteSocial();
            }

            showToast('📝 Incidente registrado en la bitácora', 'success');
            cerrarModal('modalBitacora');
            cargarBitacora();
            actualizarDashboard();
        }

        function abrirEditarBitacora(id) {
            const entry = bitacoraLlamadas.find(b => b.id === id);
            if (!entry) return;

            document.getElementById('editBitacoraId').value = id;

            let dateVal = '';
            try {
                let d = new Date(entry.fecha);
                if (isNaN(d.getTime())) {
                    // Try parsing Spanish locale format: '9/7/2026, 3:19:00 p.m.' -> '2026-07-09T15:19:00'
                    // We split and reformat
                    let parts = entry.fecha.split(', ');
                    if (parts.length === 2) {
                        let dateParts = parts[0].split('/');
                        let timeParts = parts[1].split(' ')[0].split(':');
                        let isPm = parts[1].toLowerCase().includes('p.m.');
                        
                        let day = parseInt(dateParts[0]);
                        let month = parseInt(dateParts[1]) - 1;
                        let year = parseInt(dateParts[2]);
                        
                        let hour = parseInt(timeParts[0]);
                        if (isPm && hour < 12) hour += 12;
                        if (!isPm && hour === 12) hour = 0;
                        let min = parseInt(timeParts[1]);
                        
                        d = new Date(year, month, day, hour, min);
                    }
                }
                if (isNaN(d.getTime())) {
                    d = new Date();
                }
                const offset = d.getTimezoneOffset() * 60000;
                const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
                dateVal = localISOTime;
            } catch (err) {
                const now = new Date();
                const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
                dateVal = local.toISOString().slice(0, 16);
            }

            document.getElementById('editBitacoraFecha').value = dateVal;
            document.getElementById('editBitacoraEstudiante').value = entry.estudiante;
            document.getElementById('editBitacoraApoderado').value = entry.apoderado || '';
            document.getElementById('editBitacoraTelefono').value = entry.telefono || '';

            const cat = entry.categoria || 'Otro';
            const catSelect = document.getElementById('editBitacoraCategoria');
            const catOtraInput = document.getElementById('editBitacoraCategoriaOtra');

            if (['Salud', 'Retiro', 'Citacion'].includes(cat)) {
                catSelect.value = cat;
                catOtraInput.style.display = 'none';
                catOtraInput.value = '';
            } else {
                catSelect.value = 'Otro';
                catOtraInput.style.display = 'block';
                catOtraInput.value = cat;
            }

            document.getElementById('editBitacoraMotivo').value = entry.motivo || '';
            document.getElementById('editBitacoraResultado').value = entry.resultado || entry.estado || 'Contacto exitoso';
            document.getElementById('editBitacoraResponsable').value = entry.responsable || '';

            document.getElementById('modalEditarBitacora').classList.add('active');
        }

        function toggleEditCategoriaOtra() {
            const select = document.getElementById('editBitacoraCategoria');
            const inputOtra = document.getElementById('editBitacoraCategoriaOtra');
            if (select.value === 'Otro') {
                inputOtra.style.display = 'block';
                inputOtra.focus();
            } else {
                inputOtra.style.display = 'none';
                inputOtra.value = '';
            }
        }

        async function guardarEdicionBitacora(e) {
            e.preventDefault();
            const id = parseInt(document.getElementById('editBitacoraId').value);
            const index = bitacoraLlamadas.findIndex(b => b.id === id);
            if (index === -1) return;

            const fecha = document.getElementById('editBitacoraFecha').value;
            const apoderado = document.getElementById('editBitacoraApoderado').value.trim();
            const telefono = document.getElementById('editBitacoraTelefono').value.trim();
            const motivo = document.getElementById('editBitacoraMotivo').value.trim();
            const resultado = document.getElementById('editBitacoraResultado').value;
            const responsable = document.getElementById('editBitacoraResponsable').value.trim();
            let categoria = document.getElementById('editBitacoraCategoria').value;
            if (categoria === 'Otro') {
                categoria = document.getElementById('editBitacoraCategoriaOtra').value.trim() || 'Otro';
            }

            const h = bitacoraLlamadas[index];
            h.fecha = new Date(fecha).toLocaleString();
            h.apoderado = apoderado;
            h.telefono = telefono;
            h.categoria = categoria;
            h.motivo = motivo;
            h.resultado = resultado;
            h.responsable = responsable;

            showToast('Actualizando incidente...', 'info');

            if (h.id !== undefined && h.id !== null && h.id !== 0) {
                await apiCall('update', 'Bitacora', h, h.id);
            } else {
                await apiCall('update', 'Bitacora', h);
            }

            cerrarModal('modalEditarBitacora');
            cargarBitacora();
            saveToLocalBackup();
            showToast('✅ Incidente actualizado con éxito', 'success');
        }


