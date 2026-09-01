        // ==========================================
        // 5. CURSOS (CRUD)
        // ==========================================
        function cargarCursos() {
            const tbody = document.getElementById('tablaCursos');
            if (cursos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No hay cursos</td></tr>`;
                return;
            }
            tbody.innerHTML = cursos.map((c, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td><strong>${c.nombre}</strong></td>
                    <td><span class="badge-curso">${c.nivel}</span></td>
                    <td>${getAlumnosPorCurso(c.id).length}</td>
                    <td>
                        <div class="flex gap-1">
                            <button class="btn btn-warning btn-sm offline-restrict" onclick="editarCurso(${c.id})"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-danger btn-sm offline-restrict" onclick="eliminarCurso(${c.id})"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }

        function abrirModalCurso(data = null) {
            document.getElementById('cursoEditId').value = data ? data.id : '';
            document.getElementById('modalCursoTitle').textContent = data ? 'Editar Curso' : 'Nuevo Curso';
            document.getElementById('cursoNombre').value = data ? data.nombre : '';
            document.getElementById('cursoNivel').value = data ? data.nivel : '';
            document.getElementById('modalCurso').classList.add('active');
        }

        async function guardarCurso(e) {
            e.preventDefault();
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }
            const id = document.getElementById('cursoEditId').value;
            const nombre = document.getElementById('cursoNombre').value.trim();
            const nivel = document.getElementById('cursoNivel').value;

            if (id) {
                const curso = cursos.find(c => c.id === parseInt(id));
                if (curso) {
                    curso.nombre = nombre; curso.nivel = nivel;
                    await apiCall('update', 'Cursos', curso);
                }
            } else {
                const nuevoCurso = { id: nextCursoId++, nombre, nivel };
                cursos.push(nuevoCurso);
                await apiCall('insert', 'Cursos', nuevoCurso);
            }
            cerrarModal('modalCurso');
            cargarCursos();
            actualizarDashboard();
            cargarSelectsAsistencia();
            cargarSelectsAlumnos();
            cargarSelectsPlanilla();
        }

        function editarCurso(id) {
            const curso = cursos.find(c => c.id === id);
            if (curso) abrirModalCurso(curso);
        }

        async function eliminarCurso(id) {
            if (!navigator.onLine) {
                showToast('❌ Esta acción requiere conexión a internet activa para evitar conflictos.', 'error');
                return;
            }
            const curso = cursos.find(c => c.id === id);
            if (!curso) return;
            if (!confirm(`¿Eliminar el curso "${curso.nombre}" y todos sus alumnos?`)) return;

            const alumnosCurso = alumnos.filter(a => a.cursoId === id);

            // Eliminar curso en la nube
            await apiCall('delete', 'Cursos', null, id);

            // Eliminar alumnos en la nube
            if (alumnosCurso.length > 0) {
                showToast(`Eliminando ${alumnosCurso.length} alumno(s) del curso...`, 'info');
                for (let i = 0; i < alumnosCurso.length; i++) {
                    await apiCall('delete', 'Alumnos', null, alumnosCurso[i].id);
                }
            }

            // Actualizar memoria local
            alumnos = alumnos.filter(a => a.cursoId !== id);
            cursos = cursos.filter(c => c.id !== id);

            cargarCursos();
            actualizarDashboard();
            cargarSelectsAsistencia();
            cargarSelectsAlumnos();
            cargarSelectsPlanilla();
            showToast(`Curso "${curso.nombre}" y sus alumnos eliminados correctamente`, 'success');
        }

        // ==========================================
        // IMPRIMIR LISTADO DE ALUMNOS
        // ==========================================
        function imprimirListadoAlumnos() {
            const tableHtml = document.querySelector('#panel-alumnos .table-responsive').innerHTML;
            const cursoFiltro = document.getElementById('filtroCursoAlumnos');
            const cursoNombre = cursoFiltro.options[cursoFiltro.selectedIndex].text;
            const titulo = cursoFiltro.value ? `Listado de Alumnos - ${cursoNombre}` : 'Listado de Alumnos (Todos los cursos)';

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
                    <title>${titulo}</title>
                    ${document.head.innerHTML}
                    <style>
                        body { background: white !important; padding: 2rem !important; margin: 0 !important; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        td:last-child, th:last-child { display: none; } /* Ocultar columna Acciones */
                        .card-header, .btn, select, input { display: none !important; }
                        .badge { display: none !important; } /* Ocultar el porcentaje de riesgo en rojo */
                    </style>
                </head>
                <body>
                    <h2 style="color: var(--primary);"><i class="fas fa-user-graduate"></i> ${titulo}</h2>
                    <p style="color: var(--gray-600); margin-bottom: 2rem;">Generado el ${new Date().toLocaleDateString('es-CL')}</p>
                    ${tableHtml}
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

        async function descargarPDFListadoAlumnos() {
            showToast('Generando PDF, por favor espere...', 'info');
            try {
                const cursoFiltro = document.getElementById('filtroCursoAlumnos').value;
                let filtrados = cursoFiltro ? alumnos.filter(a => a.cursoId === parseInt(cursoFiltro)) : alumnos;

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'pt', 'a4');

                const comboCurso = document.getElementById('filtroCursoAlumnos');
                const cursoNombre = comboCurso.options[comboCurso.selectedIndex].text;
                const titulo = cursoFiltro ? `Listado de Alumnos - ${cursoNombre}` : 'Listado de Alumnos (Todos los cursos)';

                doc.setFontSize(14);
                doc.setTextColor(11, 92, 255); // Color primario
                doc.text(titulo, 40, 40);

                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`, 40, 60);

                const tableBody = filtrados.map((a, index) => {
                    return [
                        index + 1,
                        a.rut,
                        a.nombre, // Solo el nombre, sin insignias de riesgo
                        getCursoNombre(a.cursoId),
                        a.apoderado === 'Sin apoderado' ? '-' : a.apoderado,
                        a.telefono === 'Sin teléfono' ? '-' : a.telefono
                    ];
                });

                doc.autoTable({
                    startY: 75,
                    head: [['#', 'RUT', 'Nombre', 'Curso', 'Apoderado', 'Teléfono']],
                    body: tableBody,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 5 },
                    headStyles: { fillColor: [242, 242, 242], textColor: [50, 50, 50], fontStyle: 'bold' },
                    alternateRowStyles: { fillColor: [250, 250, 250] },
                    margin: { top: 75 }
                });

                doc.save('Listado_Alumnos.pdf');
                showToast('✅ PDF exportado correctamente', 'success');
            } catch (err) {
                console.error(err);
                showToast('Error al generar PDF.', 'error');
            }
        }



        // ==========================================
        // PANEL: ALUMNOS EN RIESGO
        // ==========================================
        function imprimirAlumnosRiesgo() {
            const tableHtml = document.querySelector('#panel-alumnos-riesgo .table-responsive').innerHTML;
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
                    <title>Alumnos en Riesgo de Repitencia</title>
                    ${document.head.innerHTML}
                    <style>
                        body { background: white !important; padding: 2rem !important; margin: 0 !important; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .card-header, .btn, select, input { display: none !important; }
                    </style>
                </head>
                <body>
                    <h2 style="color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Alumnos en Riesgo de Repitencia (Asistencia < ${window.configuracionGlobal?.riesgo_medio || 85}%)</h2>
                    <p style="color: var(--gray-600); margin-bottom: 2rem;">Generado el ${new Date().toLocaleDateString('es-CL')}</p>
                    ${tableHtml}
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

        function cargarAlumnosRiesgoPanel() {
            const selectCurso = document.getElementById('filtroRiesgoCurso');
            selectCurso.innerHTML = '<option value="">Todos los cursos</option>' + 
                cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
            
            // Set current month as default (or 'todos' for annual)
            document.getElementById('filtroRiesgoMes').value = 'todos';
            document.getElementById('filtroRiesgoAlumno').value = '';
            
            const lbl = document.getElementById('lblRiesgoUmbralPanel');
            if (lbl) lbl.textContent = window.configuracionGlobal?.riesgo_medio || 85;

            renderizarTablaAlumnosRiesgo();
        }

        function limpiarFiltrosRiesgo() {
            document.getElementById('filtroRiesgoCurso').value = '';
            document.getElementById('filtroRiesgoMes').value = 'todos';
            document.getElementById('filtroRiesgoAlumno').value = '';
            renderizarTablaAlumnosRiesgo();
        }

        function renderizarTablaAlumnosRiesgo() {
            const tbody = document.getElementById('tablaAlumnosRiesgoBody');
            const cursoFiltro = document.getElementById('filtroRiesgoCurso').value;
            const mesFiltro = document.getElementById('filtroRiesgoMes').value;
            const alumnoFiltro = normalizeSearchText(document.getElementById('filtroRiesgoAlumno').value);
            const currentYearStr = today().substring(0, 4);
            const riesgoMedio = window.configuracionGlobal?.riesgo_medio || 85;
            const riesgoCritico = window.configuracionGlobal?.riesgo_critico || 75;

            let alumnosEnRiesgo = [];

            alumnos.forEach(alumno => {
                // Filtro por curso
                if (cursoFiltro && alumno.cursoId !== parseInt(cursoFiltro)) return;
                // Filtro por nombre
                if (alumnoFiltro && !normalizeSearchText(alumno.nombre).includes(alumnoFiltro) && !normalizeSearchText(alumno.rut).includes(alumnoFiltro)) return;

                let diasTotales = 0;
                let diasAusente = 0;

                asistenciaRegistros.forEach(r => {
                    const dInfo = parseYearMonth(r.fecha);
                    if (dInfo.year.toString() === currentYearStr) {
                        // Check month filter
                        if (mesFiltro === 'todos' || dInfo.month.toString() === mesFiltro) {
                            r.registros.forEach(reg => {
                                if (reg.alumno.trim().toLowerCase() === alumno.nombre.trim().toLowerCase()) {
                                    const est = reg.estado ? reg.estado.trim().toLowerCase() : '';
                                    if (est === 'ausente') {
                                        diasTotales++;
                                        diasAusente++;
                                    } else if (est === 'presente' || est === 'atrasado' || est === 'ausente justificado' || est === 'tarde') {
                                        diasTotales++;
                                    }
                                }
                            });
                        }
                    }
                });

                if (diasTotales > 0) {
                    const porcentaje = ((diasTotales - diasAusente) / diasTotales) * 100;
                    if (porcentaje < riesgoMedio) {
                        alumnosEnRiesgo.push({
                            alumno,
                            diasTotales,
                            diasAusente,
                            porcentaje
                        });
                    }
                }
            });

            // Sort by lowest percentage first
            alumnosEnRiesgo.sort((a, b) => a.porcentaje - b.porcentaje);

            if (alumnosEnRiesgo.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center text-success" style="font-weight:600;"><i class="fas fa-check-circle"></i> No hay alumnos en riesgo (con asistencia menor a ${riesgoMedio}%) bajo estos filtros.</td></tr>`;
                return;
            }

            tbody.innerHTML = alumnosEnRiesgo.map((item, i) => {
                const badgeClass = item.porcentaje < riesgoCritico ? 'bg-danger' : 'bg-warning';
                const textColor = item.porcentaje < riesgoCritico ? 'var(--danger)' : 'var(--warning)';
                
                const yaDerivado = bitacoraLlamadas.some(b => 
                    b.categoria === 'Intervención Asistente Social' && 
                    (b.estudiante || '').trim().toLowerCase() === item.alumno.nombre.trim().toLowerCase()
                );
                
                let btnHtml = '';
                if (yaDerivado) {
                    btnHtml = `<button class="btn btn-sm" style="background-color: #9ca3af; color: white; border: none; padding:4px 8px; font-size:12px; font-weight:600; cursor: not-allowed;" disabled title="Alumno ya derivado a Asistente Social">
                        <i class="fas fa-check-circle"></i> Alumno ya derivado
                    </button>`;
                } else {
                    btnHtml = `<button class="btn btn-sm" style="background-color: #8b5cf6; color: white; border: none; padding:4px 8px; font-size:12px; font-weight:600;" onclick="derivarAlumnoDesdeRiesgo('${item.alumno.nombre}', ${item.porcentaje.toFixed(1)})" title="Derivar a Asistente Social">
                        <i class="fas fa-bell"></i> Derivar a Asistente Social
                    </button>`;
                }

                return `
                <tr>
                    <td>${i + 1}</td>
                    <td style="white-space: nowrap;">${item.alumno.rut}</td>
                    <td><strong>${item.alumno.nombre}</strong></td>
                    <td style="white-space: nowrap;"><span class="badge-curso">${getCursoNombre(item.alumno.cursoId)}</span></td>
                    <td style="text-align:center;">${item.diasTotales}</td>
                    <td style="text-align:center; color:var(--danger); font-weight:bold;">${item.diasAusente}</td>
                    <td style="text-align:center;">
                        <span class="badge" style="background-color: ${textColor}; color: white; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
                            ${item.porcentaje.toFixed(1)}%
                        </span>
                    </td>
                    <td style="white-space: nowrap;"><span class="badge-status" style="background:${item.porcentaje < 75 ? 'var(--danger)' : 'var(--warning)'}; color:white;">${item.porcentaje < 75 ? 'Crítico (Roja)' : 'Alerta (Naranja)'}</span></td>
                    <td style="text-align:center;">
                        ${btnHtml}
                    </td>
                </tr>
                `;
            }).join('');
        }
        
        async function derivarAlumnoDesdeRiesgo(nombre, porcentaje) {
            const alumno = alumnos.find(a => a.nombre === nombre);
            if (!alumno) return;
            
            if (!confirm(`¿Derivar a ${nombre} al equipo Psicosocial/Asistente Social?`)) return;
            
            const nuevaIntervencion = {
                id: nextBitacoraId++,
                fecha: new Date().toLocaleString('es-CL'),
                estudiante: alumno.nombre,
                apoderado: alumno.apoderado || '',
                telefono: alumno.telefono || '',
                categoria: 'Intervención Asistente Social',
                motivo: `Derivación desde Riesgo de Inasistencia | Asistencia crítica: ${porcentaje}% | Acuerdos: (Pendiente de contactar a familia)`,
                resultado: '🔴 Abierto',
                responsable: 'Inspectoría (Derivación Automática)'
            };

            bitacoraLlamadas.unshift(nuevaIntervencion);
            const ok = await apiCall('insert', 'Bitacora', nuevaIntervencion);
            if (ok) {
                showToast(`🔔 ${alumno.nombre} derivado a Asistente Social exitosamente.`, 'success');
                cargarAsistenteSocial();
                renderizarTablaAlumnosRiesgo();
            } else {
                showToast(`❌ Error al derivar a ${alumno.nombre}.`, 'error');
            }
        }


