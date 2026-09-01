        // ==========================================
        // MÓDULO ASISTENTE SOCIAL
        // ==========================================
        function abrirModalAsistenteSocial() {
            document.getElementById('formAsistenteSocial').reset();
            document.getElementById('asistSocialId').value = '';
            const selectCurso = document.getElementById('asistSocialCurso');
            const selectEstudiante = document.getElementById('asistSocialEstudiante');
            
            let htmlCursos = '<option value="">Seleccione curso...</option>';
            cursos.forEach(c => {
                htmlCursos += `<option value="${c.id}">${c.nombre}</option>`;
            });
            selectCurso.innerHTML = htmlCursos;
            
            selectEstudiante.innerHTML = '<option value="">Seleccione curso primero...</option>';
            
            document.getElementById('asistSocialFecha').valueAsDate = new Date();
            document.getElementById('modalAsistenteSocial').classList.add('active');
        }

        function cargarAlumnosPorCursoAsistSocial() {
            const cursoId = parseInt(document.getElementById('asistSocialCurso').value);
            const selectEstudiante = document.getElementById('asistSocialEstudiante');
            
            if (isNaN(cursoId)) {
                selectEstudiante.innerHTML = '<option value="">Seleccione curso primero...</option>';
                return;
            }
            
            const alumnosCurso = alumnos.filter(a => a.cursoId === cursoId && a.estado !== 'retirado');
            let html = '<option value="">Seleccione estudiante...</option>';
            alumnosCurso.forEach(a => {
                html += `<option value="${a.nombre}">${a.nombre}</option>`;
            });
            selectEstudiante.innerHTML = html;
        }

        function autocompletarDatosAsistSocial() {
            const nombre = document.getElementById('asistSocialEstudiante').value;
            const al = alumnos.find(a => a.nombre === nombre);
            if (al) {
                document.getElementById('asistSocialApoderado').value = al.apoderado || '';
                document.getElementById('asistSocialTelefono').value = al.telefono || '';
            }
        }

        function limpiarFiltrosAsistSocial() {
            if (document.getElementById('filtroAsistSocialFecha')) document.getElementById('filtroAsistSocialFecha').value = '';
            if (document.getElementById('filtroAsistSocialCurso')) document.getElementById('filtroAsistSocialCurso').value = '';
            if (document.getElementById('filtroAsistSocialNombre')) document.getElementById('filtroAsistSocialNombre').value = '';
            cargarAsistenteSocial();
        }

        function cargarAsistenteSocial() {
            // Restringir calendarios de Asistente Social a Marzo - Diciembre
            const currentYear = new Date().getFullYear();
            const minDate = `${currentYear}-03-01`;
            const maxDate = `${currentYear}-12-31`;

            const f1 = document.getElementById('filtroAsistSocialFecha');
            if (f1) { f1.min = minDate; f1.max = maxDate; }
            
            const f2 = document.getElementById('asistSocialFecha');
            if (f2) { f2.min = minDate; f2.max = maxDate; }

            const selectCurso = document.getElementById('filtroAsistSocialCurso');
            if (selectCurso && selectCurso.options.length <= 1) {
                let htmlCursos = '<option value="">Todos los cursos</option>';
                cursos.forEach(c => {
                    htmlCursos += `<option value="${c.id}">${c.nombre}</option>`;
                });
                selectCurso.innerHTML = htmlCursos;
            }

            const tbody = document.querySelector('#tablaAsistenteSocial tbody');
            const intervenciones = bitacoraLlamadas.filter(b => b.categoria === 'Intervención Asistente Social');
            
            // Mostrar todas las intervenciones sin agrupar, para mantener el historial completo por estudiante
            let casosFiltrados = [...intervenciones];

            const cursoFiltro = selectCurso ? selectCurso.value : '';
            const nombreFiltro = normalizeSearchText(document.getElementById('filtroAsistSocialNombre') ? document.getElementById('filtroAsistSocialNombre').value : '');
            const fechaFiltroInput = document.getElementById('filtroAsistSocialFecha') ? document.getElementById('filtroAsistSocialFecha').value : '';
            
            let fechaFiltroFormateada = '';
            if (fechaFiltroInput) {
                const [year, month, day] = fechaFiltroInput.split('-');
                fechaFiltroFormateada = `${day}-${month}-${year}`; // Formato normalizado
            }

            if (cursoFiltro || nombreFiltro || fechaFiltroFormateada) {
                casosFiltrados = casosFiltrados.filter(inv => {
                    const estNombre = normalizeSearchText(inv.estudiante);
                    const alumno = alumnos.find(a => normalizeSearchText(a.nombre) === estNombre);
                    
                    if (cursoFiltro && alumno && alumno.cursoId !== parseInt(cursoFiltro)) return false;
                    if (nombreFiltro && !estNombre.includes(nombreFiltro)) return false;
                    
                    if (fechaFiltroFormateada) {
                        const fechaAlternativa = fechaFiltroFormateada.replace(/-/g, '/'); // "DD/MM/YYYY"
                        if (!inv.fecha.includes(fechaFiltroFormateada) && !inv.fecha.includes(fechaAlternativa)) {
                            return false;
                        }
                    }
                    
                    return true;
                });
            }

            // Ordenar de más reciente a más antiguo
            casosFiltrados.sort((a, b) => {
                const parseToTime = (fechaStr) => {
                    if (!fechaStr) return 0;
                    const parts = fechaStr.match(/(\d+)[-/](\d+)[-/](\d+)/);
                    if (!parts) return 0;
                    const timeParts = fechaStr.match(/(\d+):(\d+)/);
                    const hours = timeParts ? parseInt(timeParts[1]) : 0;
                    const mins = timeParts ? parseInt(timeParts[2]) : 0;
                    return new Date(parts[3], parts[2] - 1, parts[1], hours, mins).getTime();
                };
                
                const timeA = parseToTime(a.fecha);
                const timeB = parseToTime(b.fecha);
                
                if (timeA !== timeB) return timeB - timeA;
                return (b.id || 0) - (a.id || 0);
            });

            if (casosFiltrados.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay intervenciones registradas que coincidan con los filtros</td></tr>';
                return;
            }

            let html = '';
            for (const inv of casosFiltrados) {
                let badgeClass = 'info';
                const estado = inv.resultado || '';
                const estudiante = inv.estudiante || 'Desconocido';
                const alumnoObj = alumnos.find(a => a.nombre === estudiante);
                const cursoNombre = alumnoObj ? getCursoNombre(alumnoObj.cursoId) : '-';

                if (estado.includes('Abierto')) badgeClass = 'danger';
                if (estado.includes('Proceso')) badgeClass = 'warning';
                if (estado.includes('Seguimiento')) badgeClass = 'primary';
                if (estado.includes('Cerrado')) badgeClass = 'success';

                html += `
                    <tr>
                        <td style="white-space: nowrap; font-size: 0.85rem;">${inv.fecha.split(' ')[0]}</td>
                        <td class="fw-600">${estudiante}</td>
                        <td><span class="badge-curso" style="font-size: 0.75rem; white-space: nowrap;">${cursoNombre}</span></td>
                        <td style="font-size: 0.85rem;">${inv.motivo.split('|')[0] || '-'}</td>
                        <td>${inv.motivo.split('|')[1] || '-'}</td>
                        <td>${inv.motivo.split('|')[2] ? inv.motivo.split('|')[2].replace('Acuerdos:', '').trim() : '-'}</td>
                        <td>${inv.responsable}</td>
                        <td><span class="badge-status ${badgeClass}">${estado}</span></td>
                        <td style="text-align:center;">
                            <button class="btn btn-sm btn-primary" style="padding:4px 8px; font-size:12px;" onclick="actualizarCasoAsistSocial('${inv.id}')" title="Actualizar / Intervenir">
                                <i class="fas fa-edit"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }
            tbody.innerHTML = html;
        }

        function actualizarCasoAsistSocial(idIntervencion) {
            abrirModalAsistenteSocial();
            
            const intervencion = bitacoraLlamadas.find(b => String(b.id) === String(idIntervencion));
            if (!intervencion) {
                showToast('Intervención no encontrada', 'error');
                return;
            }

            const nombreEstudiante = intervencion.estudiante || '';
            const alumno = alumnos.find(a => a.nombre.trim().toLowerCase() === nombreEstudiante.trim().toLowerCase());
            
            if (alumno) {
                const selectCurso = document.getElementById('asistSocialCurso');
                selectCurso.value = alumno.cursoId || '';
                
                cargarAlumnosPorCursoAsistSocial();
                
                const selectEstudiante = document.getElementById('asistSocialEstudiante');
                selectEstudiante.value = alumno.nombre;
                
                autocompletarDatosAsistSocial();
            } else {
                const selectEstudiante = document.getElementById('asistSocialEstudiante');
                selectEstudiante.innerHTML = `<option value="${nombreEstudiante}">${nombreEstudiante}</option>`;
                selectEstudiante.value = nombreEstudiante;
            }

            document.getElementById('asistSocialId').value = intervencion.id;
            
            if (intervencion.fecha) {
                let dParts = intervencion.fecha.split(' ')[0].split('-');
                if (dParts.length === 3) {
                    document.getElementById('asistSocialFecha').value = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
                }
            }
            
            const motivoStr = intervencion.motivo || '';
            const partes = motivoStr.split('|');
            const tipo = partes[0] ? partes[0].trim() : '';
            const motivo = partes[1] ? partes[1].trim() : '';
            const acuerdos = partes[2] ? partes[2].replace('Acuerdos:', '').trim() : '';

            document.getElementById('asistSocialTipo').value = tipo || 'Llamada Telefónica';
            document.getElementById('asistSocialEstado').value = intervencion.resultado || '🔴 Abierto (Inicia seguimiento)';
            document.getElementById('asistSocialMotivo').value = motivo;
            document.getElementById('asistSocialAcuerdos').value = acuerdos;
            document.getElementById('asistSocialResponsable').value = intervencion.responsable || '';
            
            if (intervencion.apoderado) document.getElementById('asistSocialApoderado').value = intervencion.apoderado;
            if (intervencion.telefono) document.getElementById('asistSocialTelefono').value = intervencion.telefono;
        }

        document.getElementById('formAsistenteSocial').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const fecha = document.getElementById('asistSocialFecha').value;
            const estudiante = document.getElementById('asistSocialEstudiante').value;
            const apoderado = document.getElementById('asistSocialApoderado').value;
            const telefono = document.getElementById('asistSocialTelefono').value;
            const tipo = document.getElementById('asistSocialTipo').value;
            const estado = document.getElementById('asistSocialEstado').value;
            const motivo = document.getElementById('asistSocialMotivo').value;
            const acuerdos = document.getElementById('asistSocialAcuerdos').value;
            const responsable = document.getElementById('asistSocialResponsable').value;
            
            const editId = document.getElementById('asistSocialId').value;
            
            // Asegurar que la fecha evite el desfase de zona horaria (UTC a local)
            let fechaFormateada = '';
            if (fecha) {
                const parts = fecha.split('-'); // YYYY-MM-DD
                const timeStr = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                fechaFormateada = `${parts[2]}-${parts[1]}-${parts[0]}, ${timeStr}`;
            } else {
                fechaFormateada = new Date().toLocaleString('es-CL');
            }
            
            const nuevaIntervencion = {
                id: editId ? Number(editId) : nextBitacoraId++, // id debe ser la primera propiedad para Google Sheets
                fecha: fechaFormateada,
                estudiante: estudiante,
                apoderado: apoderado,
                telefono: telefono,
                categoria: 'Intervención Asistente Social',
                motivo: `${tipo} | ${motivo} | Acuerdos: ${acuerdos}`,
                resultado: estado, 
                responsable: responsable
            };

            let ok = false;

            if (editId) {
                const idx = bitacoraLlamadas.findIndex(b => b.id === nuevaIntervencion.id);
                if (idx !== -1) {
                    bitacoraLlamadas[idx] = nuevaIntervencion;
                }
                ok = await apiCall('update', 'Bitacora', nuevaIntervencion, nuevaIntervencion.id);
            } else {
                bitacoraLlamadas.unshift(nuevaIntervencion);
                ok = await apiCall('insert', 'Bitacora', nuevaIntervencion);
            }

            if (ok) {
                showToast(editId ? '🏠 Intervención actualizada' : '🏠 Intervención registrada', 'success');
                cerrarModal('modalAsistenteSocial');
                cargarAsistenteSocial();
            } else {
                showToast('❌ Error al guardar', 'error');
            }
            
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
        });

        function imprimirAsistenteSocial() {
            const tableHtml = document.querySelector('#panel-asistente-social .table-responsive').innerHTML;
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
                    <title>Reporte Asistente Social</title>
                    ${document.head.innerHTML}
                    <style>
                        body { background: white !important; padding: 2rem !important; margin: 0 !important; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .btn, button, .badge-status { display: none !important; } /* Ocultar botones en impresión */
                        td:last-child, th:last-child { display: none !important; } /* Ocultar columna Acción */
                    </style>
                </head>
                <body>
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <h2>Reporte de Intervenciones - Asistente Social</h2>
                        <p>Fecha de emisión: ${new Date().toLocaleDateString('es-CL')}</p>
                    </div>
                    ${tableHtml}
                </body>
                </html>
            `);
            doc.close();

            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                document.body.removeChild(iframe);
            }, 500);
        }

        function descargarPdfAsistenteSocial() {
            try {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('landscape');
                
                doc.setFontSize(16);
                doc.text('Reporte de Intervenciones - Asistente Social', 14, 15);
                doc.setFontSize(10);
                doc.text('Fecha: ' + new Date().toLocaleDateString('es-CL'), 14, 22);

                const table = document.getElementById('tablaAsistenteSocial');
                const rows = table.querySelectorAll('tbody tr');
                const tableBody = [];

                rows.forEach(tr => {
                    const cells = tr.querySelectorAll('td');
                    if (cells.length > 1) { // Ignorar fila de "No hay intervenciones"
                        tableBody.push([
                            cells[0].innerText, // Fecha
                            cells[1].innerText, // Estudiante
                            cells[2].innerText, // Tipo
                            cells[3].innerText, // Motivo
                            cells[4].innerText, // Acuerdos
                            cells[5].innerText, // Responsable
                            cells[6].innerText.trim()  // Estado
                        ]);
                    }
                });

                doc.autoTable({
                    startY: 30,
                    head: [['Fecha', 'Estudiante', 'Tipo Intervención', 'Motivo', 'Acuerdos', 'Responsable', 'Estado']],
                    body: tableBody,
                    theme: 'grid',
                    styles: { fontSize: 8, cellPadding: 3 },
                    headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' }
                });

                doc.save('Reporte_Asistente_Social.pdf');
                showToast('✅ PDF exportado correctamente', 'success');
            } catch (err) {
                console.error(err);
                showToast('Error al generar PDF.', 'error');
            }
        }

        function descargarExcelAsistenteSocial() {
            try {
                const table = document.getElementById('tablaAsistenteSocial');
                const clone = table.cloneNode(true);
                const rows = clone.querySelectorAll('tr');
                rows.forEach(row => {
                    if (row.lastElementChild) {
                        row.removeChild(row.lastElementChild);
                    }
                });

                const wb = XLSX.utils.table_to_book(clone, { sheet: "Asistente Social" });
                XLSX.writeFile(wb, 'Reporte_Asistente_Social.xlsx');
                showToast('✅ Excel exportado correctamente', 'success');
            } catch (err) {
                console.error(err);
                showToast('Error al generar Excel.', 'error');
            }
        }

        function generarPdfCompromisoAsistencia(estudiante, apoderado, fecha, tipo, motivo, acuerdos, responsable) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            doc.setFont("helvetica", "bold");
            doc.setFontSize(16);
            doc.text("ACTA DE ENTREVISTA Y COMPROMISO DE ASISTENCIA", 105, 20, { align: "center" });
            
            doc.setFontSize(12);
            doc.setFont("helvetica", "normal");
            doc.text("Establecimiento: Liceo Simón Bolívar", 20, 35);
            // Asegurar que la fecha se procese correctamente. Si viene de input type=date (YYYY-MM-DD), la spliteamos y formateamos a mano para evitar el timezone offset
            let fechaStr = fecha;
            if(fecha.includes('-')){
                const parts = fecha.split('-');
                fechaStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
            doc.text(`Fecha: ${fechaStr}`, 20, 42);
            
            doc.setFont("helvetica", "bold");
            doc.text("1. Antecedentes", 20, 55);
            doc.setFont("helvetica", "normal");
            doc.text(`Estudiante: ${estudiante}`, 20, 62);
            doc.text(`Apoderado/a: ${apoderado}`, 20, 69);
            doc.text(`Tipo de Intervención: ${tipo}`, 20, 76);
            
            doc.setFont("helvetica", "bold");
            doc.text("2. Motivo de Inasistencia Declarado", 20, 89);
            doc.setFont("helvetica", "normal");
            const splitMotivo = doc.splitTextToSize(motivo, 170);
            doc.text(splitMotivo, 20, 96);
            
            let currentY = 96 + (splitMotivo.length * 7) + 5;
            
            doc.setFont("helvetica", "bold");
            doc.text("3. Acuerdos y Compromisos", 20, currentY);
            doc.setFont("helvetica", "normal");
            const splitAcuerdos = doc.splitTextToSize(acuerdos, 170);
            doc.text(splitAcuerdos, 20, currentY + 7);
            
            currentY += (splitAcuerdos.length * 7) + 40;
            
            doc.line(40, currentY, 90, currentY);
            doc.text("Firma Apoderado/a", 45, currentY + 5);
            
            doc.line(120, currentY, 170, currentY);
            doc.text("Firma Profesional", 125, currentY + 5);
            doc.text(responsable, 125, currentY + 12);
            
            doc.save(`Compromiso_Asistencia_${estudiante.replace(/\s+/g, '_')}.pdf`);
        }

        // ==========================================
        // PANEL: INFORMES ASISTENTE SOCIAL
        // ==========================================
        function cargarCursosInformeAsist() {
            const select = document.getElementById('filtroInformeAsistCurso');
            if (!select) return;
            let html = '<option value="">Seleccione un curso...</option>';
            cursos.forEach(c => {
                html += `<option value="${c.id}">${c.nombre}</option>`;
            });
            select.innerHTML = html;

            const datalist = document.getElementById('listaEstudiantesInformeAsist');
            if (datalist) {
                let htmlAlu = '';
                alumnos.forEach(a => {
                    htmlAlu += `<option value="${a.nombre}">${a.nombre}</option>`;
                });
                datalist.innerHTML = htmlAlu;
            }
        }

        function cambiarFiltroInformeAsist() {
            const tipo = document.getElementById('filtroTipoInformeAsist').value;
            
            // Filtro Curso: visible siempre que se seleccione un tipo de informe
            document.getElementById('filtroInformeAsistCurso').style.display = (tipo) ? 'block' : 'none';
            
            // Filtro Alumno: visible para todos excepto para 'Consolidado por Curso'
            document.getElementById('filtroInformeAsistAlumnoWrapper').style.display = (tipo && tipo !== 'curso') ? 'flex' : 'none';
            
            // Limpiar datos de búsqueda al cambiar de informe
            document.getElementById('filtroInformeAsistCurso').value = '';
            document.getElementById('filtroInformeAsistAlumno').value = '';
            actualizarDatalistAsist();
            
            document.getElementById('informeAsistContainer').innerHTML = `
                <div class="empty-state"><i class="fas fa-file-alt"></i>
                    <p>Seleccione los filtros y presione "Generar"</p>
                </div>
            `;
        }

        function actualizarDatalistAsist() {
            const datalist = document.getElementById('listaEstudiantesInformeAsist');
            const cursoId = document.getElementById('filtroInformeAsistCurso').value;
            
            if (datalist) {
                let htmlAlu = '';
                let alumnosFiltrados = alumnos;
                if (cursoId) {
                    alumnosFiltrados = alumnos.filter(a => a.cursoId == cursoId);
                }
                alumnosFiltrados.forEach(a => {
                    htmlAlu += `<option value="${a.nombre}">${removeAccents(a.nombre)}</option>`;
                });
                datalist.innerHTML = htmlAlu;
            }
        }

        function visualizarInformeAsist() {
            const tipo = document.getElementById('filtroTipoInformeAsist').value;
            const container = document.getElementById('informeAsistContainer');

            if (!tipo) {
                showToast('Seleccione un tipo de informe', 'warning');
                return;
            }


            // Para los otros reportes, generamos una tabla HTML de vista previa
            const intervenciones = bitacoraLlamadas.filter(b => b.categoria === 'Intervención Asistente Social' || (b.motivo && b.motivo.includes('Asistencia crítica')));
            intervenciones.sort((a, b) => (parseInt(b.id) || 0) - (parseInt(a.id) || 0));

            let html = '<div class="table-responsive"><table class="table" style="font-size:0.9rem;">';
            let hayDatos = false;

            if (tipo === 'curso') {
                const cursoId = document.getElementById('filtroInformeAsistCurso').value;
                if (!cursoId) {
                    showToast('❌ Seleccione un curso', 'error');
                    return;
                }

                const alumnosCurso = alumnos.filter(a => a.cursoId == cursoId);
                const nombresAlumnosCurso = alumnosCurso.map(a => a.nombre.toLowerCase().trim());
                
                const datos = [];
                intervenciones.forEach(inv => {
                    if (inv.estudiante && nombresAlumnosCurso.includes(inv.estudiante.trim().toLowerCase())) {
                        datos.push(inv);
                    }
                });
                if(datos.length === 0) {
                    container.innerHTML = '<div class="alert alert-info">No hay intervenciones en este curso.</div>';
                    return;
                }
                
                html += '<thead><tr><th>Fecha</th><th>Estudiante</th><th>Motivo</th><th>Acuerdos</th><th>Estado</th></tr></thead><tbody>';
                datos.forEach(inv => {
                    const motivoStr = inv.motivo || '';
                    const partes = motivoStr.split('|');
                    const motivo = partes[1] ? partes[1].trim() : '-';
                    const acuerdos = partes[2] ? partes[2].replace('Acuerdos:', '').trim() : '-';
                    html += `<tr>
                        <td>${inv.fecha ? inv.fecha.split(' ')[0] : '-'}</td>
                        <td>${inv.estudiante || '-'}</td>
                        <td>${motivo}</td>
                        <td>${acuerdos}</td>
                        <td><span class="badge ${inv.resultado && inv.resultado.includes('Cerrado') ? 'badge-success' : 'badge-warning'}">${inv.resultado || '-'}</span></td>
                    </tr>`;
                });
                html += '</tbody>';
                hayDatos = true;

            } else if (tipo === 'acuerdos') {
                const cursoId = document.getElementById('filtroInformeAsistCurso').value;
                const nombreAlu = document.getElementById('filtroInformeAsistAlumno').value.toLowerCase().trim();

                html += '<thead><tr><th>Fecha</th><th>Estudiante</th><th>Curso</th><th>Acuerdos / Compromisos</th><th>Apoderado</th><th>Estado</th></tr></thead><tbody>';
                intervenciones.forEach(inv => {
                    const est = inv.estudiante || '-';
                    const motivoStr = inv.motivo || '';
                    const partes = motivoStr.split('|');
                    const acuerdos = partes[2] ? partes[2].replace('Acuerdos:', '').trim() : '-';
                    
                    if (acuerdos && acuerdos !== '-' && !acuerdos.includes('Pendiente de contactar')) {
                        const alumnoObj = alumnos.find(a => a.nombre === est);
                        
                        if (cursoId && alumnoObj && alumnoObj.cursoId != cursoId) return;
                        const estSearch = normalizeSearchText(est);
                        if (nombreAlu && !estSearch.includes(nombreAlu)) return;

                        hayDatos = true;
                        const cursoNombre = alumnoObj ? getCursoNombre(alumnoObj.cursoId) : '-';
                        html += `<tr>
                            <td>${inv.fecha ? inv.fecha.split(' ')[0] : '-'}</td>
                            <td>${est}</td>
                            <td>${cursoNombre}</td>
                            <td>${acuerdos}</td>
                            <td>${inv.apoderado || (alumnoObj ? alumnoObj.apoderado : '-')}</td>
                            <td>${inv.resultado || '-'}</td>
                        </tr>`;
                    }
                });
                html += '</tbody>';

            } else if (tipo === 'abiertos') {
                const cursoId = document.getElementById('filtroInformeAsistCurso').value;
                const nombreAlu = normalizeSearchText(document.getElementById('filtroInformeAsistAlumno').value);

                // Mostrar todas las intervenciones abiertas sin agrupar por estudiante, para evitar ocultar casos.
                let datos = intervenciones.filter(inv => inv.resultado && inv.resultado.includes('Abierto'));
                datos.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

                let filteredDatos = [];
                datos.forEach(inv => {
                    const estName = normalizeSearchText(inv.estudiante || '');
                    const alumnoObj = alumnos.find(a => a.nombre.trim().toLowerCase() === (inv.estudiante || '').trim().toLowerCase());
                    
                    if (cursoId && alumnoObj && String(alumnoObj.cursoId) !== String(cursoId)) return;
                    if (nombreAlu && !estName.includes(nombreAlu)) return;
                    
                    filteredDatos.push(inv);
                });

                if(filteredDatos.length === 0) {
                    container.innerHTML = '<div class="alert alert-success">No hay casos abiertos o estancados con los filtros seleccionados.</div>';
                    return;
                }

                html += '<thead><tr><th>Fecha Inicio</th><th>Estudiante</th><th>Curso</th><th>Acuerdos (Últimos)</th><th>Responsable</th></tr></thead><tbody>';
                filteredDatos.forEach(inv => {
                    const alumnoObj = alumnos.find(a => a.nombre === inv.estudiante);
                    const curso = alumnoObj ? getCursoNombre(alumnoObj.cursoId) : '-';
                    const motivoStr = inv.motivo || '';
                    const partes = motivoStr.split('|');
                    const acuerdos = partes[2] ? partes[2].replace('Acuerdos:', '').trim() : '-';
                    
                    html += `<tr>
                        <td>${inv.fecha ? inv.fecha.split(' ')[0] : '-'}</td>
                        <td>${inv.estudiante || '-'}</td>
                        <td>${curso}</td>
                        <td>${acuerdos}</td>
                        <td>${inv.responsable || '-'}</td>
                    </tr>`;
                });
                html += '</tbody>';
                hayDatos = true;
            } else if (tipo === 'alumno') {
                const nombre = document.getElementById('filtroInformeAsistAlumno').value.toLowerCase().trim();
                const cursoId = document.getElementById('filtroInformeAsistCurso').value;

                if(!nombre) {
                    showToast('Ingrese un nombre de alumno', 'warning');
                    return;
                }
                const alumno = alumnos.find(a => a.nombre.toLowerCase() === nombre);
                if(!alumno) {
                    showToast('Alumno no encontrado', 'error');
                    return;
                }
                if (cursoId && alumno.cursoId != cursoId) {
                    showToast('El alumno no pertenece al curso seleccionado', 'warning');
                    return;
                }
                
                const registrosAlumno = intervenciones.filter(e => (e.estudiante || '').toLowerCase() === alumno.nombre.toLowerCase());
                if (registrosAlumno.length === 0) {
                    container.innerHTML = '<div class="alert alert-success">Este alumno no tiene intervenciones registradas.</div>';
                    return;
                }

                html += `<thead><tr><th colspan="4" style="text-align:center; background:var(--gray-100);">Intervenciones: ${alumno.nombre}</th></tr><tr><th>Fecha</th><th>Categoría</th><th>Motivo / Detalle</th><th>Responsable</th></tr></thead><tbody>`;
                registrosAlumno.forEach(r => {
                    html += `<tr>
                        <td>${r.fecha ? r.fecha.split(',')[0] : '-'}</td>
                        <td>${r.categoria || 'Registro'}</td>
                        <td>${r.motivo || '-'}</td>
                        <td>${r.responsable || '-'}</td>
                    </tr>`;
                });
                html += '</tbody>';
                hayDatos = true;
            }

            html += '</table></div>';
            
            if(!hayDatos) {
                container.innerHTML = '<div class="alert alert-info">No se encontraron datos para este reporte.</div>';
            } else {
                container.innerHTML = html;
            }
        }

        function generarInformeAsistente(formato) {
            const tipo = document.getElementById('filtroTipoInformeAsist').value;
            if (!tipo) {
                showToast('Seleccione un tipo de informe', 'warning');
                return;
            }

            if (tipo === 'curso') {
                if (formato === 'excel') generarReporteAsistenteCurso('excel');
            } else if (tipo === 'acuerdos') {
                if (formato === 'excel') generarExcelAcuerdos();
            } else if (tipo === 'abiertos') {
                if (formato === 'excel') generarReporteCasosAbiertos('excel');
            } else if (tipo === 'alumno') {
                if (formato === 'excel') generarExcelHojaVidaAsistente();
            }
        }

        function generarExcelHojaVidaAsistente() {
            const nombre = document.getElementById('filtroInformeAsistAlumno').value.toLowerCase().trim();
            if (!nombre) {
                showToast('Ingrese un nombre de alumno para exportar su hoja de vida', 'warning');
                return;
            }
            const alumno = alumnos.find(a => a.nombre.toLowerCase() === nombre);
            if (!alumno) {
                showToast('Alumno no encontrado', 'error');
                return;
            }

            const registrosAlumno = bitacoraLlamadas.filter(e => (e.estudiante || '').toLowerCase() === alumno.nombre.toLowerCase());
            if (registrosAlumno.length === 0) {
                showToast('❌ El alumno no tiene registros para exportar', 'error');
                return;
            }

            const wsData = [
                ['Hoja de Vida', alumno.nombre, 'Curso:', getCursoNombre(alumno.cursoId)],
                [],
                ['Fecha', 'Categoría', 'Motivo / Detalle', 'Responsable']
            ];

            registrosAlumno.forEach(r => {
                wsData.push([
                    r.fecha ? r.fecha.split(',')[0] : '-',
                    r.categoria || 'Registro',
                    r.motivo || '-',
                    r.responsable || '-'
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Hoja de Vida");
            XLSX.writeFile(wb, `HojaVida_${alumno.nombre.replace(/ /g, '_')}_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
            showToast('✅ Excel de Hoja de Vida generado', 'success');
        }

        function imprimirInformeAsistente() {
            const content = document.getElementById('informeAsistContainer');
            if (content.querySelector('.empty-state') || content.querySelector('.alert')) {
                showToast('Primero debes hacer clic en "Generar" y asegurar que haya datos.', 'warning');
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
                    <title>Informe Oficial Asistente Social</title>
                    ${document.head.innerHTML}
                    <style>
                        body { background: white !important; padding: 2rem !important; margin: 0 !important; }
                        .table { width: 100%; border-collapse: collapse; }
                        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        .table th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; }
                        .report-document { border: none !important; box-shadow: none !important; padding: 0 !important; }
                    </style>
                </head>
                <body>
                    <h2 style="margin-top:0; padding-top:0;">Reporte de Asistente Social</h2>
                    <p style="color:#666; font-size:12px; margin-bottom: 20px;">Generado el ${new Date().toLocaleDateString()}</p>
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

        function generarReporteAsistenteCurso(tipo) {
            const cursoSeleccionado = document.getElementById('filtroInformeAsistCurso').value;
            if (!cursoSeleccionado) {
                showToast('❌ Por favor seleccione un curso', 'error');
                return;
            }

            const cursoObj = cursos.find(c => c.id == cursoSeleccionado);
            const nombreCurso = cursoObj ? cursoObj.nombre : 'Curso';

            const alumnosCurso = alumnos.filter(a => a.cursoId == cursoSeleccionado);
            const nombresAlumnosCurso = alumnosCurso.map(a => a.nombre.toLowerCase().trim());

            const intervenciones = bitacoraLlamadas.filter(b => b.categoria === 'Intervención Asistente Social' || (b.motivo && b.motivo.includes('Asistencia crítica')));
            
            intervenciones.sort((a, b) => b.id - a.id);
            const casos = {};
            intervenciones.forEach(inv => {
                if (inv.estudiante && nombresAlumnosCurso.includes(inv.estudiante.trim().toLowerCase())) {
                    const est = inv.estudiante;
                    if (!casos[est]) {
                        casos[est] = inv;
                    }
                }
            });

            const datos = Object.values(casos);
            if (datos.length === 0) {
                showToast('❌ No hay intervenciones en este curso', 'error');
                return;
            }

            if (tipo === 'pdf') {
                // Generación PDF eliminada, ahora se usa imprimirInformeAsistente()
            } else if (tipo === 'excel') {
                const wsData = [
                    ['Fecha', 'Estudiante', 'Tipo Intervención', 'Motivo Declarado', 'Acuerdos / Compromisos', 'Estado Actual', 'Responsable']
                ];
                
                datos.forEach(inv => {
                    const motivoStr = inv.motivo || '';
                    const partes = motivoStr.split('|');
                    const tipoInt = partes[0] ? partes[0].trim() : '-';
                    const motivo = partes[1] ? partes[1].trim() : '-';
                    const acuerdos = partes[2] ? partes[2].replace('Acuerdos:', '').trim() : '-';
                    
                    wsData.push([
                        inv.fecha ? inv.fecha.split(' ')[0] : '-',
                        inv.estudiante || '-',
                        tipoInt,
                        motivo,
                        acuerdos,
                        inv.resultado || '-',
                        inv.responsable || '-'
                    ]);
                });

                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Consolidado Curso");
                XLSX.writeFile(wb, `Consolidado_${nombreCurso.replace(/\s+/g, '_')}.xlsx`);
                showToast('✅ Excel generado correctamente', 'success');
            }
        }

        // Removido buscarAlumnoInformeAsist y verFichaAlumnoDesdeAsist ya que ahora se usa visualizarInformeAsist

        function generarExcelAcuerdos() {
            const cursoId = document.getElementById('filtroInformeAsistCurso').value;
            const nombreAlu = normalizeSearchText(document.getElementById('filtroInformeAsistAlumno').value);

            const intervenciones = bitacoraLlamadas.filter(b => b.categoria === 'Intervención Asistente Social' || (b.motivo && b.motivo.includes('Asistencia crítica')));
            intervenciones.sort((a, b) => b.id - a.id);
            
            const wsData = [
                ['Fecha', 'Estudiante', 'Curso', 'Acuerdos / Compromisos', 'Apoderado Contactado', 'Teléfono', 'Estado Actual', 'Responsable']
            ];
            
            intervenciones.forEach(inv => {
                const est = inv.estudiante || '-';
                const motivoStr = inv.motivo || '';
                const partes = motivoStr.split('|');
                const acuerdos = partes[2] ? partes[2].replace('Acuerdos:', '').trim() : '-';
                
                if (acuerdos && acuerdos !== '-' && !acuerdos.includes('Pendiente de contactar')) {
                    const alumnoObj = alumnos.find(a => a.nombre === est);

                    if (cursoId && alumnoObj && alumnoObj.cursoId != cursoId) return;
                    const estSearch = normalizeSearchText(est);
                    if (nombreAlu && !estSearch.includes(nombreAlu)) return;

                    const cursoNombre = alumnoObj ? getCursoNombre(alumnoObj.cursoId) : '-';
                    const telefono = alumnoObj ? (alumnoObj.telefonoApoderado || alumnoObj.telefono) : '-';
                    
                    wsData.push([
                        inv.fecha ? inv.fecha.split(' ')[0] : '-',
                        est,
                        cursoNombre,
                        acuerdos,
                        inv.apoderado || (alumnoObj ? alumnoObj.apoderado : '-'),
                        telefono,
                        inv.resultado || '-',
                        inv.responsable || '-'
                    ]);
                }
            });

            if (wsData.length === 1) {
                showToast('❌ No hay acuerdos registrados', 'error');
                return;
            }

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Acuerdos y Compromisos");
            XLSX.writeFile(wb, `Acuerdos_Asistente_Social_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
            showToast('✅ Excel generado correctamente', 'success');
        }

        function generarReporteCasosAbiertos(tipo) {
            const cursoId = document.getElementById('filtroInformeAsistCurso').value;
            const nombreAlu = normalizeSearchText(document.getElementById('filtroInformeAsistAlumno').value);

            const intervenciones = bitacoraLlamadas.filter(b => b.categoria === 'Intervención Asistente Social' || (b.motivo && b.motivo.includes('Asistencia crítica')));
            
            intervenciones.sort((a, b) => b.id - a.id);
            const casos = {};
            intervenciones.forEach(inv => {
                if (inv.estudiante) {
                    const est = inv.estudiante;
                    if (!casos[est]) {
                        casos[est] = inv;
                    }
                }
            });

            let datos = Object.values(casos).filter(inv => inv.resultado && inv.resultado.includes('Abierto'));
            datos.sort((a, b) => (a.id || 0) - (b.id || 0));

            datos = datos.filter(inv => {
                const alumnoObj = alumnos.find(a => a.nombre === inv.estudiante);
                if (cursoId && alumnoObj && alumnoObj.cursoId != cursoId) return false;
                if (nombreAlu && !normalizeSearchText(inv.estudiante || '').includes(nombreAlu)) return false;
                return true;
            });

            if (datos.length === 0) {
                showToast('❌ No hay casos estancados con los filtros seleccionados', 'error');
                return;
            }

            if (tipo === 'excel') {
                const wsData = [
                    ['Fecha Inicio', 'Estudiante', 'Curso', '% Asistencia', 'Motivo', 'Acuerdos / Compromisos', 'Apoderado Contactado', 'Teléfono', 'Responsable']
                ];
                
                datos.forEach(inv => {
                    const alumnoObj = alumnos.find(a => a.nombre === inv.estudiante);
                    const curso = alumnoObj ? getCursoNombre(alumnoObj.cursoId) : '-';
                    const asistencia = alumnoObj ? alumnoObj.asistencia + '%' : '-';
                    const telefono = alumnoObj ? (alumnoObj.telefonoApoderado || alumnoObj.telefono) : '-';
                    
                    const motivoStr = inv.motivo || '';
                    const partes = motivoStr.split('|');
                    const motivo = partes[1] ? partes[1].trim() : '-';
                    const acuerdos = partes[2] ? partes[2].replace('Acuerdos:', '').trim() : '-';
                    
                    wsData.push([
                        inv.fecha ? inv.fecha.split(' ')[0] : '-',
                        inv.estudiante || '-',
                        curso,
                        asistencia,
                        motivo,
                        acuerdos,
                        inv.apoderado || (alumnoObj ? alumnoObj.apoderado : '-'),
                        telefono,
                        inv.responsable || '-'
                    ]);
                });

                const ws = XLSX.utils.aoa_to_sheet(wsData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Casos Abiertos");
                XLSX.writeFile(wb, `Casos_Estancados_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
                showToast('✅ Excel generado correctamente', 'success');
            }
        }

        // ==========================================
        // SUBIDA DE DOCUMENTOS A GOOGLE DRIVE
        // ==========================================
        const URL_SCRIPT_GOOGLE_DRIVE = 'https://script.google.com/macros/s/AKfycbwXfNuAH2K5IZqrZwHI196-y4PS5i7XitUuY_Afb2rSFA3v995b-_dGwF3J5UV2YLEONQ/exec';

        function cargarPanelSubirEvidencias() {
            cargarExploradorArchivos();
            
            const filtroCurso = document.getElementById('filtroCursoDrive');
            if (filtroCurso && filtroCurso.options.length <= 1 && typeof cursos !== 'undefined') {
                let htmlFiltro = '<option value="">Todos los cursos</option>';
                cursos.forEach(c => {
                    htmlFiltro += `<option value="${c.nombre}">${c.nombre}</option>`;
                });
                filtroCurso.innerHTML = htmlFiltro;
            }
        }

        function abrirModalSubirEvidencia() {
            document.getElementById('formSubidaDocumentos').reset();
            
            // Cargar datalist de estudiantes si existe
            const datalist = document.getElementById('listaEstudiantesDrive');
            if (datalist && typeof alumnos !== 'undefined') {
                let htmlAlu = '';
                alumnos.filter(a => a.estado !== 'retirado').forEach(a => {
                    htmlAlu += `<option value="${a.nombre}">${removeAccents(a.nombre)}</option>`;
                });
                datalist.innerHTML = htmlAlu;
            }
            
            // Cargar select de cursos
            const selectCurso = document.getElementById('driveCurso');
            if (selectCurso && typeof cursos !== 'undefined') {
                let htmlCursos = '<option value="">Seleccione un curso...</option>';
                cursos.forEach(c => {
                    htmlCursos += `<option value="${c.nombre}">${c.nombre}</option>`;
                });
                selectCurso.innerHTML = htmlCursos;
            }

            document.getElementById('modalSubirEvidencia').classList.add('active');
        }

        function cargarExploradorArchivos() {
            const contenedor = document.getElementById('contenedorCarpetas');
            if (!contenedor) return;

            contenedor.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-spinner fa-spin text-primary" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>Conectando con la Base de Datos...</p>
                </div>
            `;

            fetch(URL_SCRIPT_GOOGLE_DRIVE)
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        contenedor.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle text-danger"></i><p>Error: ${data.error}</p></div>`;
                        return;
                    }

                    if ((!data.folders || data.folders.length === 0) && (!data.files || data.files.length === 0)) {
                        contenedor.innerHTML = `
                            <div class="empty-state">
                                <i class="fas fa-folder-open text-muted" style="font-size: 3rem; margin-bottom: 1rem; color: #ccc;"></i>
                                <p>No hay archivos subidos todavía.</p>
                            </div>
                        `;
                        return;
                    }

                    let html = '<div class="drive-explorer" style="display: flex; flex-direction: column; gap: 1rem;">';

                    // Renderizar carpetas (Alumnos)
                    if (data.folders) {
                        data.folders.forEach(folder => {
                            if (folder.files && folder.files.length > 0) {
                                let cursoEtiqueta = '';
                                if (typeof alumnos !== 'undefined' && typeof cursos !== 'undefined') {
                                    const alumnoInfo = alumnos.find(a => a.nombre === folder.name);
                                    if (alumnoInfo) {
                                        // Ocultar visualmente la carpeta si el estudiante está retirado
                                        if (alumnoInfo.estado === 'retirado') return;
                                        
                                        const cursoObj = cursos.find(c => c.id == alumnoInfo.cursoId);
                                        if (cursoObj) {
                                            cursoEtiqueta = `<span style="background: #e0e7ff; color: #4338ca; border-radius: 4px; padding: 2px 6px; font-size: 0.75rem; font-weight: 500; border: 1px solid #c7d2fe;">${cursoObj.nombre}</span>`;
                                        }
                                    }
                                }

                                html += `
                                    <div class="drive-folder" style="background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                                        <div class="folder-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; const icon = this.querySelector('.fa-chevron-down'); if(icon) icon.style.transform = this.nextElementSibling.style.display === 'none' ? 'rotate(-90deg)' : 'rotate(0deg)';" style="background: #f1f5f9; padding: 10px 15px; font-weight: bold; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <i class="fas fa-folder text-warning" style="color: #fbbf24;"></i>
                                            <span>${folder.name}</span>
                                            ${cursoEtiqueta}
                                            <span class="badge" style="background: #e2e8f0; color: #475569; border-radius: 12px; padding: 2px 8px; font-size: 0.8rem; margin-left: auto;">${folder.files.length}</span>
                                            <button onclick="eliminarCarpetaDrive('${folder.id}', event)" class="btn btn-sm btn-danger" style="padding: 2px 6px; font-size: 0.8rem; background: #fee2e2; color: #dc2626; border: none; margin-left: 10px;" title="Eliminar Carpeta Completa"><i class="fas fa-trash"></i></button>
                                            <i class="fas fa-chevron-down" style="color: #94a3b8; transition: transform 0.2s; transform: rotate(-90deg); margin-left: 10px;"></i>
                                        </div>
                                        <div class="folder-files" style="padding: 10px; display: none;">
                                            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                                `;
                                folder.files.forEach(f => {
                                    const fechaFormat = new Date(f.date).toLocaleDateString();
                                    const nombreLimpio = f.name.replace(/_/g, ' ');
                                    html += `
                                                <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                                                    <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                        <i class="fas fa-file-alt text-primary" style="color: #3b82f6;"></i>
                                                        <span title="${f.name}" style="font-size: 0.9rem; font-weight: 500;">${nombreLimpio}</span>
                                                    </div>
                                                    <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                                                        <span style="font-size: 0.8rem; color: #64748b; margin-right: 10px;">${fechaFormat}</span>
                                                        <a href="${f.url}" target="_blank" class="btn btn-sm btn-info" style="padding: 4px 8px; font-size: 0.8rem; background: #e0f2fe; color: #0284c7; border: none;" title="Ver"><i class="fas fa-eye"></i></a>
                                                        <a href="${f.downloadUrl}" class="btn btn-sm btn-success" style="padding: 4px 8px; font-size: 0.8rem; background: #dcfce7; color: #16a34a; border: none;" title="Descargar"><i class="fas fa-download"></i></a>
                                                        <button onclick="eliminarArchivoDrive('${f.id}')" class="btn btn-sm btn-danger" style="padding: 4px 8px; font-size: 0.8rem; background: #fee2e2; color: #dc2626; border: none;" title="Eliminar"><i class="fas fa-trash"></i></button>
                                                    </div>
                                                </li>
                                    `;
                                });
                                html += `
                                            </ul>
                                        </div>
                                    </div>
                                `;
                            }
                        });
                    }

                    // Renderizar archivos sueltos
                    if (data.files && data.files.length > 0) {
                        html += `
                                    <div class="drive-folder" style="background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                                        <div class="folder-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; const icon = this.querySelector('.fa-chevron-down'); if(icon) icon.style.transform = this.nextElementSibling.style.display === 'none' ? 'rotate(-90deg)' : 'rotate(0deg)';" style="background: #f1f5f9; padding: 10px 15px; font-weight: bold; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                            <i class="fas fa-folder text-warning" style="color: #fbbf24;"></i>
                                            Archivos Generales
                                            <span class="badge" style="background: #e2e8f0; color: #475569; border-radius: 12px; padding: 2px 8px; font-size: 0.8rem; margin-left: auto;">${data.files.length}</span>
                                            <i class="fas fa-chevron-down" style="color: #94a3b8; transition: transform 0.2s; transform: rotate(-90deg);"></i>
                                        </div>
                                        <div class="folder-files" style="padding: 10px; display: none;">
                                            <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
                                `;
                                data.files.forEach(f => {
                                    const fechaFormat = new Date(f.date).toLocaleDateString();
                                    const nombreLimpio = f.name.replace(/_/g, ' ');
                                    html += `
                                                <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                                                    <div style="display: flex; align-items: center; gap: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                                        <i class="fas fa-file-alt text-primary" style="color: #3b82f6;"></i>
                                                        <span title="${f.name}" style="font-size: 0.9rem; font-weight: 500;">${nombreLimpio}</span>
                                                    </div>
                                                    <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                                                        <span style="font-size: 0.8rem; color: #64748b; margin-right: 10px;">${fechaFormat}</span>
                                                        <a href="${f.url}" target="_blank" class="btn btn-sm btn-info" style="padding: 4px 8px; font-size: 0.8rem; background: #e0f2fe; color: #0284c7; border: none;" title="Ver"><i class="fas fa-eye"></i></a>
                                                        <a href="${f.downloadUrl}" class="btn btn-sm btn-success" style="padding: 4px 8px; font-size: 0.8rem; background: #dcfce7; color: #16a34a; border: none;" title="Descargar"><i class="fas fa-download"></i></a>
                                                        <button onclick="eliminarArchivoDrive('${f.id}')" class="btn btn-sm btn-danger" style="padding: 4px 8px; font-size: 0.8rem; background: #fee2e2; color: #dc2626; border: none;" title="Eliminar"><i class="fas fa-trash"></i></button>
                                                    </div>
                                                </li>
                                    `;
                                });
                                html += `
                                            </ul>
                                        </div>
                                    </div>
                                `;
                    }

                    html += '</div>';
                    contenedor.innerHTML = html;
                })
                .catch(error => {
                    console.error('Error fetching drive data:', error);
                    contenedor.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle text-danger"></i><p>Error de conexión al cargar los archivos.</p></div>`;
                });
        }

        function eliminarArchivoDrive(fileId) {
            if (confirm('¿Estás seguro de que deseas eliminar este archivo? Esta acción enviará el archivo a la papelera.')) {
                showToast('Eliminando archivo...', 'info');
                
                fetch(URL_SCRIPT_GOOGLE_DRIVE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `action=delete&fileId=${fileId}`
                })
                .then(res => res.text())
                .then(mensaje => {
                    if (mensaje.includes('Éxito')) {
                        showToast('✅ Archivo eliminado correctamente', 'success');
                        cargarExploradorArchivos();
                    } else {
                        showToast('❌ Error al eliminar: ' + mensaje, 'error');
                    }
                })
                .catch(err => {
                    console.error('Error al eliminar:', err);
                    showToast('❌ Error de conexión al intentar eliminar', 'error');
                });
            }
        }

        function eliminarCarpetaDrive(folderId, event) {
            if (event) event.stopPropagation(); // Evitar que se abra/cierre el acordeón
            
            if (confirm('⚠️ ¡ADVERTENCIA! ¿Estás seguro de que deseas eliminar ESTA CARPETA y TODOS los archivos en su interior? Esta acción enviará la carpeta a la papelera y no se puede deshacer.')) {
                showToast('Eliminando carpeta...', 'info');
                
                fetch(URL_SCRIPT_GOOGLE_DRIVE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `action=deleteFolder&folderId=${folderId}`
                })
                .then(res => res.text())
                .then(mensaje => {
                    if (mensaje.includes('Éxito')) {
                        showToast('✅ Carpeta eliminada correctamente', 'success');
                        cargarExploradorArchivos();
                    } else {
                        showToast('❌ Error al eliminar carpeta: ' + mensaje, 'error');
                    }
                })
                .catch(err => {
                    console.error('Error al eliminar carpeta:', err);
                    showToast('❌ Error de conexión al intentar eliminar carpeta', 'error');
                });
            }
        }

        window.mantencionEliminarCarpetasDrive = function() {
            if (confirm('⚠️ ¡PELIGRO DE BORRADO MASIVO! ¿Estás absolutamente seguro de que deseas ELIMINAR TODAS LAS CARPETAS y ARCHIVOS de evidencias en Google Drive? Esta acción enviará todo a la papelera y se usa generalmente a final de año.')) {
                
                if (prompt('Para confirmar el borrado masivo de Google Drive, escribe exactamente "BORRAR TODO" (sin comillas):') !== 'BORRAR TODO') {
                    showToast('Operación cancelada por seguridad.', 'info');
                    return;
                }

                showToast('Eliminando todo en Google Drive. Esto puede tardar unos segundos...', 'warning');
                
                fetch(URL_SCRIPT_GOOGLE_DRIVE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: `action=deleteAllFolders`
                })
                .then(res => res.text())
                .then(mensaje => {
                    if (mensaje.includes('Éxito')) {
                        showToast('✅ Google Drive vaciado correctamente', 'success');
                        if (typeof cargarExploradorArchivos === 'function') {
                            cargarExploradorArchivos();
                        }
                    } else {
                        showToast('❌ Error al vaciar Drive: ' + mensaje, 'error');
                    }
                })
                .catch(err => {
                    console.error('Error al vaciar Drive:', err);
                    showToast('❌ Error de conexión al intentar vaciar Drive', 'error');
                });
            }
        };

        function limpiarFiltrosDrive() {
            const searchInput = document.getElementById('buscadorArchivosDrive');
            const selectCurso = document.getElementById('filtroCursoDrive');
            
            if (searchInput) searchInput.value = '';
            if (selectCurso) selectCurso.value = '';
            
            filtrarArchivosDrive();
        }

        function quitarTildes(str) {
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        }

        function filtrarArchivosDrive() {
            const queryOriginal = document.getElementById('buscadorArchivosDrive').value.toLowerCase().trim();
            const query = quitarTildes(queryOriginal);
            const cursoSeleccionado = document.getElementById('filtroCursoDrive').value;
            const folders = document.querySelectorAll('.drive-folder');
            
            folders.forEach(folder => {
                const folderNameOriginal = folder.querySelector('.folder-header').textContent.toLowerCase();
                const folderName = quitarTildes(folderNameOriginal);
                const folderHeader = folder.querySelector('.folder-header');
                
                const cumpleNombre = folderName.includes(query);
                
                let cumpleCurso = true;
                if (cursoSeleccionado) {
                    const cursoBadge = folderHeader.querySelector('span[style*="background: #e0e7ff"]');
                    if (cursoBadge) {
                        cumpleCurso = (cursoBadge.textContent === cursoSeleccionado);
                    } else {
                        cumpleCurso = false;
                    }
                }
                
                if (cumpleNombre && cumpleCurso) {
                    folder.style.display = 'block';
                    const folderFilesContainer = folder.querySelector('.folder-files');
                    const icon = folder.querySelector('.fa-chevron-down');
                    
                    if (query !== '' || cursoSeleccionado !== '') {
                        if (folderFilesContainer) folderFilesContainer.style.display = 'block';
                        if (icon) icon.style.transform = 'rotate(0deg)';
                    } else {
                        if (folderFilesContainer) folderFilesContainer.style.display = 'none';
                        if (icon) icon.style.transform = 'rotate(-90deg)';
                    }
                } else {
                    folder.style.display = 'none';
                }
            });
        }

        document.getElementById('driveNombreAlumno').addEventListener('change', function() {
            const nombre = this.value;
            if (!nombre || typeof alumnos === 'undefined' || typeof cursos === 'undefined') return;
            
            const alumno = alumnos.find(a => a.nombre === nombre);
            if (alumno) {
                const cursoObj = cursos.find(c => c.id == alumno.cursoId);
                if (cursoObj) {
                    document.getElementById('driveCurso').value = cursoObj.nombre;
                }
                if (alumno.apoderado) {
                    document.getElementById('driveNombreApoderado').value = alumno.apoderado;
                }
            }
        });

        window.toggleDriveTipoDocumentoOtro = function() {
            const select = document.getElementById('driveTipoDocumento');
            const inputOtro = document.getElementById('driveTipoDocumentoOtro');
            if (select.value === 'Otro') {
                inputOtro.style.display = 'block';
                inputOtro.required = true;
            } else {
                inputOtro.style.display = 'none';
                inputOtro.required = false;
            }
        };

        document.getElementById('formSubidaDocumentos').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const btn = document.getElementById('btnSubirDrive');
            const archivoInput = document.getElementById('driveArchivo');
            const alumnoNombre = document.getElementById('driveNombreAlumno').value;
            const cursoNombre = document.getElementById('driveCurso').value;
            const apoderadoNombre = document.getElementById('driveNombreApoderado').value;
            let tipoDoc = document.getElementById('driveTipoDocumento').value;
            
            if (tipoDoc === 'Otro') {
                const otroValor = document.getElementById('driveTipoDocumentoOtro').value.trim();
                if (otroValor) {
                    tipoDoc = otroValor;
                }
            }
            
            if (!archivoInput.files || archivoInput.files.length === 0) {
                showToast('Por favor seleccione un archivo', 'warning');
                return;
            }
            
            const archivo = archivoInput.files[0];
            
            // Validar tamaño (ejemplo max 5MB = 5 * 1024 * 1024 bytes)
            if (archivo.size > 5242880) {
                showToast('El archivo es demasiado grande. Máximo 5MB.', 'error');
                return;
            }
            
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo archivo...';
            
            const lector = new FileReader();
            
            lector.onload = function() {
                // Crear un nombre de archivo descriptivo
                const fecha = new Date().toLocaleDateString('es-CL').replace(/\//g, '-');
                const apoderadoSeguro = apoderadoNombre.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚñÑ]/g, '').trim();
                const extension = archivo.name.split('.').pop();
                const nuevoNombreArchivo = `${tipoDoc} - Apoderado ${apoderadoSeguro} - ${fecha}.${extension}`;
                
                const datos = {
                    fileName: nuevoNombreArchivo,
                    mimeType: archivo.type,
                    fileData: lector.result.split(',')[1], // Obtener solo base64 sin prefijo
                    studentName: alumnoNombre || 'Sin_Asignar' // Enviar el nombre del alumno para crear la carpeta
                };
                
                fetch(URL_SCRIPT_GOOGLE_DRIVE, {
                    method: 'POST',
                    body: new URLSearchParams(datos)
                })
                .then(respuesta => respuesta.text())
                .then(mensaje => {
                    if (mensaje.includes('Éxito')) {
                        showToast('✅ Archivo subido a la Base de Datos correctamente', 'success');
                        document.getElementById('formSubidaDocumentos').reset();
                        cerrarModal('modalSubirEvidencia');
                        cargarExploradorArchivos();
                    } else {
                        showToast('❌ Error al subir: ' + mensaje, 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    showToast('❌ Error de conexión al intentar subir', 'error');
                })
                .finally(() => {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-upload"></i> Subir Archivo';
                });
            };
            
            lector.readAsDataURL(archivo);
        });

        // ==========================================
        // MÓDULO: LICENCIAS Y JUSTIFICACIONES (GRILLA)
        // ==========================================
        window.limpiarFiltrosGrillaLicencias = function() {
            document.getElementById('cursoLicencias').value = '';
            document.getElementById('mesLicencias').value = ''; // Let renderizarGrillaLicencias figure out default
            renderizarGrillaLicencias();
        };

        window.renderizarGrillaLicencias = function() {
            const container = document.getElementById('contenedorGrillaLicencias');
            if (!container) return;

            const inputMes = document.getElementById('mesLicencias');
            const currentYear = new Date().getFullYear();
            
            // Restringir el calendario nativo a Marzo - Diciembre
            inputMes.min = `${currentYear}-03`;
            inputMes.max = `${currentYear}-12`;

            let mesVal = inputMes.value; // format: "YYYY-MM"
            if (!mesVal) {
                const now = new Date();
                let m = now.getMonth() + 1;
                if (m < 3) m = 3; // Si es enero o febrero, saltar a marzo
                const mStr = String(m).padStart(2, '0');
                mesVal = `${currentYear}-${mStr}`;
                inputMes.value = mesVal;
            } else {
                // Si el usuario por algún motivo selecciona Enero o Febrero
                const [y, m] = mesVal.split('-');
                if (parseInt(m) < 3) {
                    mesVal = `${y}-03`;
                    inputMes.value = mesVal;
                    showToast('El año escolar comienza en Marzo.', 'warning');
                }
            }

            // Populate course select if not done
            const selectCurso = document.getElementById('cursoLicencias');
            if (selectCurso && selectCurso.options.length <= 1 && typeof cursos !== 'undefined') {
                let htmlCursos = '<option value="">Todos los cursos</option>';
                cursos.forEach(c => {
                    htmlCursos += `<option value="${c.id}">${c.nombre}</option>`;
                });
                selectCurso.innerHTML = htmlCursos;
            }

            const cursoSeleccionado = document.getElementById('cursoLicencias').value;
            const [year, month] = mesVal.split('-');
            const diasEnMes = new Date(year, month, 0).getDate();

            let cursosAMostrar = cursoSeleccionado ? cursos.filter(c => c.id == cursoSeleccionado) : cursos;
            if (cursosAMostrar.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>No hay cursos disponibles.</p></div>';
                return;
            }

            let html = '<table class="table table-striped table-bordered" style="width:100%; font-size:11px; text-align:center; border-collapse: collapse;">';
            
            // Thead
            html += '<thead style="position: sticky; top: 0; background: #f8fafc; z-index: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"><tr>';
            html += '<th style="text-align:left; min-width: 60px; padding: 4px;">Curso</th>';
            html += '<th style="text-align:left; min-width: 200px; padding: 4px;">Nombre</th>';
            for (let d = 1; d <= diasEnMes; d++) {
                const isWeekend = [0, 6].includes(new Date(year, month - 1, d).getDay());
                const bgHeader = isWeekend ? 'background-color: #e2e8f0;' : '';
                html += `<th style="min-width: 25px; padding: 4px; border: 1px solid #e2e8f0; width: 25px; max-width: 25px; ${bgHeader}">${d}</th>`;
            }
            html += '</tr></thead><tbody>';

            cursosAMostrar.forEach((curso, cursoIdx) => {
                const alumnosCurso = alumnos.filter(a => a.cursoId == curso.id);
                if (alumnosCurso.length === 0) return;

                // Agregar fila separadora si no es el primer curso
                if (cursoIdx > 0) {
                    html += `<tr style="height: 12px; background-color: #cbd5e1; border-top: 2px solid #94a3b8; border-bottom: 2px solid #94a3b8;"><td colspan="${diasEnMes + 2}" style="border: none; padding: 0;"></td></tr>`;
                }

                alumnosCurso.sort((a, b) => a.nombre.localeCompare(b.nombre));

                alumnosCurso.forEach((alumno, idx) => {
                    html += `<tr>`;
                    
                    if (idx === 0) {
                        // The course cell spans all students in this course
                        html += `<td rowspan="${alumnosCurso.length}" style="vertical-align: middle; font-weight: bold; background-color: #f1f5f9; border: 1px solid #e2e8f0;">
                                    <div style="writing-mode: vertical-rl; transform: rotate(180deg); display: inline-block; white-space: nowrap;">${curso.nombre}</div>
                                 </td>`;
                    }

                    html += `<td style="text-align:left; white-space:nowrap; padding: 2px 5px; border: 1px solid #e2e8f0;">${alumno.nombre}</td>`;
                    
                    for (let d = 1; d <= diasEnMes; d++) {
                        const dayStr = String(d).padStart(2, '0');
                        const fechaStr = `${year}-${month}-${dayStr}`;
                        const isWeekend = [0, 6].includes(new Date(year, month - 1, d).getDay());
                        
                        let estado = '';
                        let colorCelda = '';
                        let textoCelda = '';

                        const regCurso = asistenciaRegistros.find(r => r.cursoId === curso.id && r.fecha === fechaStr);
                        if (regCurso) {
                            const regAlumno = regCurso.registros.find(r => r.alumno.toLowerCase() === alumno.nombre.toLowerCase());
                            if (regAlumno) {
                                estado = regAlumno.estado;
                            }
                        }

                        if (estado === 'L') {
                            colorCelda = '#4ade80'; // Verde
                            textoCelda = 'L';
                        } else if (estado === 'J') {
                            colorCelda = '#fde047'; // Amarillo
                            textoCelda = 'J';
                        } else if (estado === 'S') {
                            colorCelda = '#ef4444'; // Rojo
                            textoCelda = 'S';
                        } else if (estado === 'CP') {
                            colorCelda = '#f97316'; // Naranjo
                            textoCelda = 'CP';
                        }
                        
                        if (isWeekend) {
                            colorCelda = '#f1f5f9'; // Gris para fines de semana
                        }

                        const cursorStyle = isWeekend ? 'not-allowed' : 'pointer';
                        const clickEvent = isWeekend ? '' : `onclick="abrirMenuCeldaLicencia(this, ${curso.id}, '${alumno.nombre}', '${fechaStr}')"`;

                        html += `<td style="background-color: ${colorCelda || '#ffffff'}; cursor: ${cursorStyle}; padding:0; position: relative; border: 1px solid #e2e8f0; border-radius: 0;" ${clickEvent}>
                                    <div style="width: 100%; height: 100%; min-height: 20px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: ${colorCelda && !isWeekend ? '#000' : 'transparent'};">
                                        ${textoCelda || '&nbsp;'}
                                    </div>
                                 </td>`;
                    }
                    html += `</tr>`;
                });
            });

            html += '</tbody></table>';
            container.innerHTML = html;
        };

        window.abrirMenuCeldaLicencia = function(tdElement, cursoId, alumnoNombre, fechaStr) {
            const menuPrevio = document.getElementById('menuCeldaLicencia');
            if (menuPrevio) menuPrevio.remove();

            const menu = document.createElement('div');
            menu.id = 'menuCeldaLicencia';
            menu.style.position = 'absolute';
            menu.style.backgroundColor = 'white';
            menu.style.border = '1px solid #ccc';
            menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            menu.style.zIndex = '1000';
            menu.style.display = 'flex';
            menu.style.flexDirection = 'column';
            menu.style.padding = '5px';
            menu.style.borderRadius = '4px';
            
            // Adjust menu position if it goes off screen
            menu.style.top = '100%';
            menu.style.left = '50%';
            menu.style.transform = 'translateX(-50%)';

            const opciones = [
                { label: 'L - Licencia', value: 'L', color: '#4ade80' },
                { label: 'J - Justificación', value: 'J', color: '#fde047' },
                { label: 'S - Suspensión', value: 'S', color: '#ef4444' },
                { label: 'CP - Carpeta Ped.', value: 'CP', color: '#f97316' },
                { label: 'Borrar/Ninguno', value: 'borrar', color: '#f1f5f9' }
            ];

            opciones.forEach(op => {
                const btn = document.createElement('button');
                btn.textContent = op.label;
                btn.style.margin = '2px 0';
                btn.style.padding = '4px 8px';
                btn.style.border = 'none';
                btn.style.backgroundColor = op.color;
                btn.style.cursor = 'pointer';
                btn.style.textAlign = 'left';
                btn.style.fontSize = '11px';
                btn.style.borderRadius = '3px';
                if (op.value !== 'borrar') btn.style.fontWeight = 'bold';
                else btn.style.border = '1px solid #cbd5e1';
                
                btn.onclick = (e) => {
                    e.stopPropagation();
                    guardarEstadoLicenciaCelda(cursoId, alumnoNombre, fechaStr, op.value, tdElement, op.color);
                    menu.remove();
                };
                menu.appendChild(btn);
            });

            tdElement.appendChild(menu);

            setTimeout(() => {
                const closeMenu = (e) => {
                    if (!menu.contains(e.target)) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu);
                    }
                };
                document.addEventListener('click', closeMenu);
            }, 0);
        };

        window.guardarEstadoLicenciaCelda = async function(cursoId, alumnoNombre, fechaStr, nuevoEstado, tdElement, color) {
            let estadoParaGuardar = nuevoEstado === 'borrar' ? '' : nuevoEstado;
            
            // Optimistic UI update
            tdElement.style.backgroundColor = estadoParaGuardar ? color : '#ffffff';
            const innerDiv = tdElement.querySelector('div');
            if (innerDiv) {
                innerDiv.textContent = estadoParaGuardar || '\u00A0';
                innerDiv.style.color = estadoParaGuardar ? '#000' : 'transparent';
            }

            // Save to memory
            const indexReg = asistenciaRegistros.findIndex(r => r.cursoId === cursoId && r.fecha === fechaStr);
            if (indexReg > -1) {
                const regAlumnoIdx = asistenciaRegistros[indexReg].registros.findIndex(r => r.alumno.toLowerCase() === alumnoNombre.toLowerCase());
                if (regAlumnoIdx > -1) {
                    if (estadoParaGuardar) {
                        asistenciaRegistros[indexReg].registros[regAlumnoIdx].estado = estadoParaGuardar;
                    } else {
                        asistenciaRegistros[indexReg].registros.splice(regAlumnoIdx, 1);
                    }
                } else if (estadoParaGuardar) {
                    asistenciaRegistros[indexReg].registros.push({ alumno: alumnoNombre, estado: estadoParaGuardar, fecha: fechaStr });
                }
            } else if (estadoParaGuardar) {
                asistenciaRegistros.push({ cursoId: cursoId, fecha: fechaStr, registros: [{ alumno: alumnoNombre, estado: estadoParaGuardar, fecha: fechaStr }] });
            }

            // Update local backup immediately
            if (typeof saveToLocalBackup === 'function') {
                saveToLocalBackup();
            }

            // Sync with backend (silent)
            const payloadArray = [{ cursoId: cursoId, fecha: fechaStr, alumno: alumnoNombre, estado: estadoParaGuardar || '' }];
            
            try {
                if (typeof apiCall === 'function') {
                    await apiCall('bulk_insert', 'Asistencia', payloadArray);
                } else if (typeof dbQuery === 'function') {
                    // Si no está expuesto apiCall, pero dbQuery sí
                    await dbQuery('bulk_insert', 'Asistencia', payloadArray);
                } else {
                    console.warn("No apiCall or dbQuery found to save data to backend.");
                }
            } catch (error) {
                console.error("Error guardando estado de licencia:", error);
                showToast("❌ Error al guardar estado en el servidor", "error");
            }
            
            if (typeof actualizarBadgeInasistencias === 'function') {
                actualizarBadgeInasistencias();
            }
            if (document.getElementById('panel-inasistencia-injustificada').classList.contains('active')) {
                if (typeof renderizarInasistenciasInjustificadas === 'function') {
                    renderizarInasistenciasInjustificadas();
                }
            }
        };

        // ==========================================
        // MÓDULO: INASISTENCIA SIN JUSTIFICACIÓN
        // ==========================================
        window.actualizarBadgeInasistencias = function() {
            let count = 0;
            if (typeof asistenciaRegistros !== 'undefined') {
                const diasSinClases = asistenciaRegistros.filter(r => r.cursoId === 0 && r.registros.some(reg => reg.estado === 'suspendido')).map(r => r.fecha);
                asistenciaRegistros.forEach(regDia => {
                    if (diasSinClases.includes(regDia.fecha)) return;
                    if (regDia && regDia.registros) {
                        regDia.registros.forEach(r => {
                            if (r.estado === 'ausente') {
                                count++;
                            }
                        });
                    }
                });
            }
            
            const badge = document.getElementById('badgeInasistencias');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        };

        window.renderizarInasistenciasInjustificadas = function() {
            const tbody = document.querySelector('#tablaInasistenciasInjustificadas tbody');
            if (!tbody) return;

            // Popular selector de cursos si está vacío
            const selectCurso = document.getElementById('filtroInasistenciaCurso');
            if (selectCurso && selectCurso.options.length <= 1 && typeof cursos !== 'undefined') {
                let htmlCursos = '<option value="">Todos los cursos</option>';
                cursos.forEach(c => {
                    htmlCursos += `<option value="${c.id}">${c.nombre}</option>`;
                });
                selectCurso.innerHTML = htmlCursos;
            }

            const filtroFecha = document.getElementById('filtroInasistenciaFecha') ? document.getElementById('filtroInasistenciaFecha').value : '';
            const filtroCursoId = selectCurso ? selectCurso.value : '';
            const filtroEstudianteInput = document.getElementById('filtroInasistenciaEstudiante') ? document.getElementById('filtroInasistenciaEstudiante').value.toLowerCase().trim() : '';
            const filtroEstudiante = normalizeSearchText(filtroEstudianteInput);

            let inasistencias = [];

            if (typeof asistenciaRegistros !== 'undefined' && typeof cursos !== 'undefined') {
                const diasSinClases = asistenciaRegistros.filter(r => r.cursoId === 0 && r.registros.some(reg => reg.estado === 'suspendido')).map(r => r.fecha);
                asistenciaRegistros.forEach(regDia => {
                    if (diasSinClases.includes(regDia.fecha)) return;
                    if (filtroFecha && regDia.fecha !== filtroFecha) return;
                    if (filtroCursoId && regDia.cursoId != filtroCursoId) return;

                    const cursoObj = cursos.find(c => c.id == regDia.cursoId);
                    const nombreCurso = cursoObj ? cursoObj.nombre : 'Desconocido';
                    
                    if (regDia && regDia.registros) {
                        regDia.registros.forEach(r => {
                            if (r.estado === 'ausente') {
                                const alumnoNorm = normalizeSearchText(r.alumno);
                                if (filtroEstudiante && !alumnoNorm.includes(filtroEstudiante)) return;

                                inasistencias.push({
                                    fecha: regDia.fecha,
                                    curso: nombreCurso,
                                    alumno: r.alumno,
                                    cursoId: regDia.cursoId
                                });
                            }
                        });
                    }
                });
            }

            inasistencias.sort((a, b) => {
                if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha);
                if (a.curso !== b.curso) return a.curso.localeCompare(b.curso);
                return a.alumno.localeCompare(b.alumno);
            });

            if (inasistencias.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #6b7280; padding: 20px;">No hay inasistencias sin justificar registradas.</td></tr>';
                return;
            }

            let html = '';
            inasistencias.forEach(ina => {
                let fechaFormateada = ina.fecha;
                try {
                    const [y, m, d] = ina.fecha.split('-');
                    fechaFormateada = `${d}-${m}-${y}`;
                } catch(e) {}

                html += `
                    <tr>
                        <td>${fechaFormateada}</td>
                        <td>${ina.curso}</td>
                        <td>${ina.alumno}</td>
                        <td style="text-align: center;">
                            <button class="btn btn-sm btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="abrirModalJustificacionRapida(${ina.cursoId}, '${ina.alumno.replace(/'/g, "\\'")}', '${ina.fecha}', '${ina.curso.replace(/'/g, "\\'")}')" title="Justificar directamente">
                                <i class="fas fa-edit"></i> Justificar
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
        };

        window.abrirModalJustificacionRapida = function(cursoId, alumno, fecha, cursoTxt) {
            document.getElementById('jrCursoId').value = cursoId;
            document.getElementById('jrAlumno').value = alumno;
            document.getElementById('jrFechaHidden').value = fecha;
            
            document.getElementById('jrAlumnoTxt').textContent = alumno;
            document.getElementById('jrCursoTxt').textContent = cursoTxt;
            
            let fechaFormateada = fecha;
            try {
                const [y, m, d] = fecha.split('-');
                fechaFormateada = `${d}-${m}-${y}`;
            } catch(e) {}
            document.getElementById('jrFechaTxt').textContent = fechaFormateada;
            
            document.getElementById('jrTipo').value = "";
            document.getElementById('modalJustificacionRapida').classList.add('active');
        };

        window.procesarJustificacionRapida = function(e) {
            e.preventDefault();
            
            const cursoId = parseInt(document.getElementById('jrCursoId').value);
            const alumno = document.getElementById('jrAlumno').value;
            const fecha = document.getElementById('jrFechaHidden').value;
            const tipo = document.getElementById('jrTipo').value;
            
            if (!tipo) {
                if (typeof showToast === 'function') showToast("Por favor seleccione un tipo de justificación", "warning");
                return;
            }
            
            // Dummy element para evitar errores en la funcion de la grilla
            const dummyTd = document.createElement('td');
            dummyTd.innerHTML = "<div></div>";
            
            if (typeof guardarEstadoLicenciaCelda === 'function') {
                guardarEstadoLicenciaCelda(cursoId, alumno, fecha, tipo, dummyTd, '');
            }
            
            if (typeof cerrarModal === 'function') cerrarModal('modalJustificacionRapida');
            if (typeof showToast === 'function') showToast("✅ Justificación guardada correctamente", "success");
            
            if (typeof renderizarInasistenciasInjustificadas === 'function') {
                renderizarInasistenciasInjustificadas();
            }
        };

        window.exportarInasistenciasExcel = function() {
            const tabla = document.getElementById('tablaInasistenciasInjustificadas');
            if (!tabla) return;
            
            let csv = [];
            const filas = tabla.querySelectorAll('tr');
            
            for (let i = 0; i < filas.length; i++) {
                let fila = [], cols = filas[i].querySelectorAll('td, th');
                
                // Skip the "Acciones" column which is the last one
                for (let j = 0; j < cols.length - 1; j++) {
                    let text = cols[j].innerText.replace(/"/g, '""');
                    fila.push('"' + text + '"');
                }
                csv.push(fila.join(','));
            }
            
            const csvData = new Blob(['\uFEFF' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(csvData);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'Inasistencias_Injustificadas.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        window.imprimirInasistenciasInjustificadas = function() {
            const tabla = document.getElementById('tablaInasistenciasInjustificadas').outerHTML;
            const titulo = '<h2>Inasistencias sin Justificación</h2>';
            const subtitulo = '<p>Generado el: ' + new Date().toLocaleDateString() + '</p>';
            
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            document.body.appendChild(iframe);
            
            const doc = iframe.contentWindow.document;
            doc.write(`
                <html>
                <head>
                    <title>Imprimir Inasistencias</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        .text-center { text-align: center; }
                        /* Hide the Acciones column */
                        th:last-child, td:last-child { display: none; }
                    </style>
                </head>
                <body>
                    ${titulo}
                    ${subtitulo}
                    ${tabla}
                </body>
                </html>
            `);
            doc.close();
            
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            
            setTimeout(() => {
                document.body.removeChild(iframe);
            }, 1000);
        };

        // ==========================================
        // MÓDULO: INFORMES DE LICENCIAS Y JUSTIFICACIONES
        // ==========================================
        window.cambiarFiltroInformeLic = function() {
            const tipo = document.getElementById('filtroTipoInformeLic').value;
            const selectCurso = document.getElementById('filtroInformeLicCurso');
            const wrapperAlumno = document.getElementById('filtroInformeLicAlumnoWrapper');
            const inputAlumno = document.getElementById('filtroInformeLicAlumno');
            
            // Ocultar todos
            selectCurso.classList.add('d-none');
            wrapperAlumno.classList.add('d-none');
            wrapperAlumno.style.display = 'none';
            inputAlumno.value = '';

            const isTiposEspecificos = ['licencia', 'justificacion', 'suspension', 'carpeta'].includes(tipo);

            // Mostrar según selección
            if (tipo === 'curso' || isTiposEspecificos) {
                selectCurso.classList.remove('d-none');
                
                let htmlCursos = tipo === 'curso' ? '<option value="">Seleccione curso...</option>' : '<option value="">Todo el colegio (General)</option>';
                
                if (typeof cursos !== 'undefined') {
                    cursos.forEach(c => {
                        htmlCursos += `<option value="${c.id}">${c.nombre}</option>`;
                    });
                }
                selectCurso.innerHTML = htmlCursos;

            } else if (tipo === 'alumno') {
                wrapperAlumno.classList.remove('d-none');
                wrapperAlumno.style.display = 'flex';
                
                const datalist = document.getElementById('listaEstudiantesInformeLic');
                if (datalist && datalist.options.length === 0 && typeof alumnos !== 'undefined') {
                    let htmlAlumnos = '';
                    alumnos.forEach(a => {
                        htmlAlumnos += `<option value="${a.nombre}">${removeAccents(a.nombre)}</option>`;
                    });
                    datalist.innerHTML = htmlAlumnos;
                }
            }
        };

        window.generarInformeLicencias = function() {
            const tipo = document.getElementById('filtroTipoInformeLic').value;
            if (!tipo) {
                showToast('Debe seleccionar un tipo de informe', 'warning');
                return;
            }

            const cursoFiltro = document.getElementById('filtroInformeLicCurso').value;
            const nombreFiltro = normalizeSearchText(document.getElementById('filtroInformeLicAlumno').value);

            if (tipo === 'curso' && !cursoFiltro) {
                showToast('Debe seleccionar un curso', 'warning');
                return;
            }
            if (tipo === 'alumno' && !nombreFiltro) {
                showToast('Debe escribir el nombre de un alumno', 'warning');
                return;
            }

            const emptyState = document.getElementById('informeLicEmptyState');
            const container = document.getElementById('informeLicContainer');
            const btnImprimir = document.getElementById('btnImprimirLic');
            const tbody = document.querySelector('#tablaInformesLicencias tbody');
            const subtitle = document.getElementById('printSubtitleLicencias');
            const title = document.getElementById('printTitleLicencias');

            if (!tbody) return;

            const tiposValidos = ['L', 'J', 'S', 'CP'];
            const labelsTipos = {
                'L': '<span style="color: #16a34a; font-weight: 600;">Licencia Médica (L)</span>',
                'J': '<span style="color: #ca8a04; font-weight: 600;">Justificación (J)</span>',
                'S': '<span style="color: #dc2626; font-weight: 600;">Suspensión (S)</span>',
                'CP': '<span style="color: #ea580c; font-weight: 600;">Carpeta Pedagógica (CP)</span>'
            };

            let resultados = [];

            if (typeof asistenciaRegistros !== 'undefined') {
                asistenciaRegistros.forEach(regDia => {
                    const cursoId = regDia.cursoId;
                    const fecha = regDia.fecha; 

                    const isTiposEspecificos = ['licencia', 'justificacion', 'suspension', 'carpeta'].includes(tipo);

                    if (tipo === 'curso' && cursoId != cursoFiltro) return;
                    if (isTiposEspecificos && cursoFiltro && cursoId != cursoFiltro) return;

                    const cursoObj = cursos.find(c => c.id == cursoId);
                    const cursoNombre = cursoObj ? cursoObj.nombre : 'Desconocido';

                    regDia.registros.forEach(r => {
                        const alumnoNombre = r.alumno;
                        const estado = r.estado;

                        if (tiposValidos.includes(estado)) {
                            // Filtros por tipo
                            if (tipo === 'licencia' && estado !== 'L') return;
                            if (tipo === 'justificacion' && estado !== 'J') return;
                            if (tipo === 'suspension' && estado !== 'S') return;
                            if (tipo === 'carpeta' && estado !== 'CP') return;
                            const alumnoNombreNorm = normalizeSearchText(alumnoNombre);
                            if (tipo === 'alumno' && !alumnoNombreNorm.includes(nombreFiltro)) return;

                            resultados.push({
                                fecha: fecha,
                                cursoNombre: cursoNombre,
                                alumnoNombre: alumnoNombre,
                                tipo: estado,
                                timestamp: new Date(fecha + "T00:00:00").getTime()
                            });
                        }
                    });
                });
            }

            // Ordenar: primero fecha (más reciente a más antigua), luego curso, luego alumno
            resultados.sort((a, b) => {
                if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
                if (a.cursoNombre !== b.cursoNombre) return a.cursoNombre.localeCompare(b.cursoNombre);
                return a.alumnoNombre.localeCompare(b.alumnoNombre);
            });

            // Set Titles
            const isTiposEspecificosTitle = ['licencia', 'justificacion', 'suspension', 'carpeta'].includes(tipo);
            if (tipo === 'curso') {
                const select = document.getElementById('filtroInformeLicCurso');
                const text = select.options[select.selectedIndex].text;
                title.textContent = "Dashboard Consolidado de Asistencia y Licencias";
                subtitle.innerHTML = `Generado el: <span class="fecha-hoy-print"></span><br>Curso: ${text}`;
                
                // Hide table & student dashboard, show course dashboard
                document.getElementById('contenedorTablaLicencias').style.display = 'none';
                document.getElementById('dashboardLicenciasCurso').style.display = 'block';
                if (document.getElementById('dashboardLicenciasAlumno')) document.getElementById('dashboardLicenciasAlumno').style.display = 'none';
                
                // Generate dashboard HTML
                generarDashboardLicenciasCurso(cursoFiltro, text);
            } else if (tipo === 'alumno') {
                const nombreAlumnoInput = document.getElementById('filtroInformeLicAlumno').value.trim();
                title.textContent = "Dashboard e Historial Individual de Asistencia";
                subtitle.innerHTML = `Generado el: <span class="fecha-hoy-print"></span><br>Estudiante: ${nombreAlumnoInput}`;

                // Show student dashboard ONLY (Hide detail table)
                document.getElementById('contenedorTablaLicencias').style.display = 'none';
                document.getElementById('dashboardLicenciasCurso').style.display = 'none';
                if (document.getElementById('dashboardLicenciasAlumno')) document.getElementById('dashboardLicenciasAlumno').style.display = 'block';

                generarDashboardLicenciasAlumno(nombreAlumnoInput);
            } else if (isTiposEspecificosTitle) {
                let tituloBase = "";
                if (tipo === 'licencia') tituloBase = "Reporte de Licencias Médicas (L)";
                if (tipo === 'justificacion') tituloBase = "Reporte de Justificaciones (J)";
                if (tipo === 'suspension') tituloBase = "Reporte de Suspensiones (S)";
                if (tipo === 'carpeta') tituloBase = "Reporte de Carpetas Pedagógicas (CP)";
                
                title.textContent = tituloBase;
                if (cursoFiltro) {
                    const select = document.getElementById('filtroInformeLicCurso');
                    const text = select.options[select.selectedIndex].text;
                    subtitle.innerHTML = `Generado el: <span class="fecha-hoy-print"></span><br>Filtro: Curso ${text}`;
                } else {
                    subtitle.innerHTML = `Generado el: <span class="fecha-hoy-print"></span><br>Filtro: Todo el colegio (General)`;
                }

                document.getElementById('contenedorTablaLicencias').style.display = 'block';
                document.getElementById('dashboardLicenciasCurso').style.display = 'none';
                if (document.getElementById('dashboardLicenciasAlumno')) document.getElementById('dashboardLicenciasAlumno').style.display = 'none';
            }

            if (tipo !== 'curso') {
                if (resultados.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #666; padding: 20px;">No se encontraron registros para los filtros seleccionados.</td></tr>';
                } else {
                    let html = '';
                    resultados.forEach(res => {
                        const [y, m, d] = res.fecha.split('-');
                        const fechaFormat = `${d}/${m}/${y}`;
                        
                        html += `<tr>
                            <td>${fechaFormat}</td>
                            <td>${res.cursoNombre}</td>
                            <td>${res.alumnoNombre}</td>
                            <td>${labelsTipos[res.tipo]}</td>
                        </tr>`;
                    });
                    tbody.innerHTML = html;
                }
            }

            emptyState.style.display = 'none';
            container.style.display = 'block';
            btnImprimir.style.display = 'inline-block';
        };

        function generarDashboardLicenciasCurso(cursoId, cursoNombre) {
            if (!asistenciaRegistros) return;

            let statsMensual = {};
            let statsAlumnos = {};

            // Inicializar alumnos del curso
            const alumnosCurso = alumnos.filter(a => a.cursoId === parseInt(cursoId));
            alumnosCurso.forEach(a => {
                statsAlumnos[a.nombre] = { presente: 0, inasistencias: 0, L: 0, J: 0, S: 0, CP: 0, ausente: 0 };
            });

            asistenciaRegistros.forEach(regDia => {
                if (regDia.cursoId != cursoId) return;
                
                // Ignorar dias sin clases (cursoId === 0) 
                const isDiaSinClases = typeof window.esDiaSinClases === 'function' ? window.esDiaSinClases(regDia.fecha) : false;
                if (regDia.cursoId === 0 || isDiaSinClases) return;

                const [year, month] = regDia.fecha.split('-');
                const mesClave = `${month}/${year}`;
                
                if (!statsMensual[mesClave]) {
                    statsMensual[mesClave] = { presente: 0, inasistencias: 0 };
                }

                regDia.registros.forEach(r => {
                    const est = r.estado;
                    const nombre = r.alumno;
                    
                    if (!statsAlumnos[nombre]) {
                        statsAlumnos[nombre] = { presente: 0, inasistencias: 0, L: 0, J: 0, S: 0, CP: 0, ausente: 0 };
                    }

                    if (est === 'presente' || est === 'atraso') {
                        statsMensual[mesClave].presente++;
                        statsAlumnos[nombre].presente++;
                    } else if (['ausente', 'L', 'J', 'S', 'CP'].includes(est)) {
                        statsMensual[mesClave].inasistencias++;
                        statsAlumnos[nombre].inasistencias++;
                        if (['L', 'J', 'S', 'CP', 'ausente'].includes(est)) {
                            statsAlumnos[nombre][est]++;
                        }
                    }
                });
            });

            // 1. Mes con más inasistencias y mayor asistencia
            let maxInasistenciasMes = { mes: '-', count: 0 };
            let maxAsistenciasMes = { mes: '-', count: -1 };
            
            const mesesMap = {
                '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
                '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
                '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
            };

            Object.entries(statsMensual).forEach(([mesStr, stats]) => {
                if (stats.inasistencias > maxInasistenciasMes.count) {
                    maxInasistenciasMes = { mes: mesStr, count: stats.inasistencias };
                }
                if (stats.presente > maxAsistenciasMes.count) {
                    maxAsistenciasMes = { mes: mesStr, count: stats.presente };
                }
            });

            const formatMes = (mesKey) => {
                if (!mesKey || mesKey === '-') return '-';
                const [m, y] = mesKey.split('/');
                return `${mesesMap[m]} ${y}`;
            };

            // Estadísticas diarias para el Gráfico de Tendencia (últimos 5 días)
            let statsDiarios = {};
            asistenciaRegistros.forEach(regDia => {
                if (regDia.cursoId != cursoId) return;
                const isDiaSinClases = typeof window.esDiaSinClases === 'function' ? window.esDiaSinClases(regDia.fecha) : false;
                if (regDia.cursoId === 0 || isDiaSinClases) return;
                
                if (!statsDiarios[regDia.fecha]) {
                    statsDiarios[regDia.fecha] = { presente: 0, inasistencias: 0 };
                }

                regDia.registros.forEach(r => {
                    const est = r.estado;
                    if (est === 'presente' || est === 'atraso') {
                        statsDiarios[regDia.fecha].presente++;
                    } else if (['ausente', 'L', 'J', 'S', 'CP'].includes(est)) {
                        statsDiarios[regDia.fecha].inasistencias++;
                    }
                });
            });

            const ultimos5Dias = Object.keys(statsDiarios).sort().slice(-5);
            const dataTendenciaAsistencia = ultimos5Dias.map(fecha => {
                const s = statsDiarios[fecha];
                const total = s.presente + s.inasistencias;
                return total > 0 ? Math.round((s.presente / total) * 100) : 0;
            });
            const labelsTendencia = ultimos5Dias.map(fecha => {
                const [y, m, d] = fecha.split('-');
                return `${d}/${m}`;
            });

            // Preparar data para Distribución de Faltas (Doughnut)
            let totalL = 0, totalJ = 0, totalS = 0, totalCP = 0;
            Object.values(statsAlumnos).forEach(stats => {
                totalL += stats.L;
                totalJ += stats.J;
                totalS += stats.S;
                totalCP += stats.CP;
            });

            // Preparar data para Semáforo Mensual (Barras)
            const mesesOrdenados = Object.keys(statsMensual).sort((a, b) => {
                const [m1, y1] = a.split('/');
                const [m2, y2] = b.split('/');
                return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
            });
            const dataSemaforo = mesesOrdenados.map(mesKey => {
                const s = statsMensual[mesKey];
                const total = s.presente + s.inasistencias;
                return total > 0 ? Math.round((s.presente / total) * 100) : 0;
            });
            const labelsSemaforo = mesesOrdenados.map(formatMes);

            // 2. Ranking de Alumnos
            const listaAlumnos = Object.entries(statsAlumnos).map(([nombre, stats]) => {
                const totalDias = stats.presente + stats.inasistencias;
                const pctAsistencia = totalDias > 0 ? Math.round((stats.presente / totalDias) * 100) : 0;
                return { nombre, ...stats, pctAsistencia };
            });

            // Ordenar para mejores asistencias (mayor %)
            const mejores = [...listaAlumnos].sort((a, b) => b.pctAsistencia - a.pctAsistencia || b.presente - a.presente).slice(0, 10);
            // Ordenar para peores asistencias (mayor inasistencia)
            const peores = [...listaAlumnos].filter(a => a.inasistencias > 0).sort((a, b) => b.inasistencias - a.inasistencias || a.pctAsistencia - b.pctAsistencia).slice(0, 10);

            // 3. Totales y Tops
            const totalAlumnosConInasistencia = listaAlumnos.filter(a => a.inasistencias > 0).length;
            
            const topL = [...listaAlumnos].sort((a, b) => b.L - a.L).filter(a => a.L > 0).slice(0, 10);
            const topJ = [...listaAlumnos].sort((a, b) => b.J - a.J).filter(a => a.J > 0).slice(0, 10);
            const topS = [...listaAlumnos].sort((a, b) => b.S - a.S).filter(a => a.S > 0).slice(0, 10);
            const topCP = [...listaAlumnos].sort((a, b) => b.CP - a.CP).filter(a => a.CP > 0).slice(0, 10);

            // Generar HTML
            const renderList = (arr, valKey, suffix = '') => {
                if (arr.length === 0) return '<li style="color:#888;">Sin registros</li>';
                return arr.map(a => `<li><span>${a.nombre}</span> <span class="badge badge-outline">${a[valKey]}${suffix}</span></li>`).join('');
            };
            const promAsistPct = dataSemaforo.length > 0 ? Math.round(dataSemaforo.reduce((a,b)=>a+b,0)/dataSemaforo.length) : 0;
            
            const tiposNombres = { L: 'Licencias Médicas', J: 'Justificaciones', S: 'Suspensiones', CP: 'Carpetas Pedagógicas' };
            const arrTipos = [
                { tipo: 'L', count: totalL }, { tipo: 'J', count: totalJ },
                { tipo: 'S', count: totalS }, { tipo: 'CP', count: totalCP }
            ].sort((a,b)=>b.count-a.count);
            const tipoMasComun = arrTipos[0].count > 0 ? tiposNombres[arrTipos[0].tipo] : 'N/A';

            // Lógica Narrativa dinámica sin incongruencias
            let textoSemaforoDetalle = "";
            if (maxInasistenciasMes.count <= 0) {
                textoSemaforoDetalle = `No se registran inasistencias en los meses evaluados. El mes con mayor asistencia activa fue <strong>${formatMes(maxAsistenciasMes.mes)}</strong> con ${maxAsistenciasMes.count > 0 ? maxAsistenciasMes.count : 0} asistencias acumuladas.`;
            } else if (mesesOrdenados.length === 1) {
                textoSemaforoDetalle = `En el mes registrado de <strong>${formatMes(mesesOrdenados[0])}</strong>, el curso acumula ${maxAsistenciasMes.count > 0 ? maxAsistenciasMes.count : 0} asistencias y ${maxInasistenciasMes.count} inasistencias en total.`;
            } else if (maxInasistenciasMes.mes === maxAsistenciasMes.mes) {
                textoSemaforoDetalle = `El mes con mayor actividad fue <strong>${formatMes(maxAsistenciasMes.mes)}</strong> con ${maxAsistenciasMes.count} asistencias y un acumulado de ${maxInasistenciasMes.count} inasistencias.`;
            } else {
                textoSemaforoDetalle = `El mes con mayor concentración de inasistencias fue <strong>${formatMes(maxInasistenciasMes.mes)}</strong> con ${maxInasistenciasMes.count} inasistencias acumuladas. En contraste, el mes con mejor asistencia fue <strong>${formatMes(maxAsistenciasMes.mes)}</strong> con ${maxAsistenciasMes.count} asistencias.`;
            }

            const htmlDashboard = `
                <div class="dashboard-grid">
                    <!-- KPIs Principales -->
                    <div class="dash-kpi-card" style="border-left: 4px solid var(--danger);">
                        <h4>Mes con más inasistencias</h4>
                        <div class="kpi-value">${maxInasistenciasMes.count > 0 ? formatMes(maxInasistenciasMes.mes) : 'Ninguno'}</div>
                        <div class="kpi-sub">${maxInasistenciasMes.count > 0 ? maxInasistenciasMes.count + ' inasistencias totales' : '0 inasistencias registradas'}</div>
                    </div>
                    <div class="dash-kpi-card" style="border-left: 4px solid var(--success);">
                        <h4>Mes con más asistencia</h4>
                        <div class="kpi-value">${maxAsistenciasMes.count > 0 ? formatMes(maxAsistenciasMes.mes) : '-'}</div>
                        <div class="kpi-sub">${maxAsistenciasMes.count > 0 ? maxAsistenciasMes.count + ' asistencias totales' : 'Sin registros'}</div>
                    </div>
                    <div class="dash-kpi-card" style="border-left: 4px solid var(--primary);">
                        <h4>Alumnos con Inasistencias</h4>
                        <div class="kpi-value">${totalAlumnosConInasistencia} <span style="font-size:1rem;color:var(--gray-500);font-weight:normal;">/ ${listaAlumnos.length}</span></div>
                        <div class="kpi-sub">Han faltado al menos una vez</div>
                    </div>
                </div>

                <div class="dashboard-section row-layout">
                    <div class="dashboard-section-narrative">
                        <h3>Tendencia Anual de Asistencia</h3>
                        <p>A lo largo del año, el curso ha registrado una asistencia promedio del <strong>${promAsistPct}%</strong>.</p>
                        <p>Esta visión global permite identificar patrones estacionales y los meses donde se concentran las mayores ausencias.</p>
                    </div>
                    <div class="dashboard-section-content">
                        <div class="dashboard-chart-container">
                            <canvas id="chartTendenciaLic"></canvas>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-section row-layout">
                    <div class="dashboard-section-content">
                        <div class="dashboard-chart-container">
                            <canvas id="chartSemaforoLic"></canvas>
                        </div>
                    </div>
                    <div class="dashboard-section-narrative">
                        <h3>Semáforo de Asistencia Mensual</h3>
                        <p>El objetivo institucional es mantener cada curso en <strong>zona verde (sobre 90%)</strong>. De los ${mesesOrdenados.length} meses registrados, <strong>${dataSemaforo.filter(v => v >= 90).length}</strong> están en zona verde, <strong>${dataSemaforo.filter(v => v >= 80 && v < 90).length}</strong> en zona amarilla y <strong>${dataSemaforo.filter(v => v < 80).length}</strong> en zona roja.</p>
                        <p>${textoSemaforoDetalle}</p>
                    </div>
                </div>

                <div class="dashboard-section row-layout">
                    <div class="dashboard-section-narrative">
                        <h3>Desglose de Justificaciones</h3>
                        <p>${(totalL + totalJ + totalS + totalCP) > 0 ? `Del total de ausencias justificadas o excusadas, el motivo más recurrente es: <strong>${tipoMasComun}</strong>.` : 'A la fecha no se registran ausencias justificadas ni licencias médicas en este curso.'}</p>
                        <p>Este nivel de desglose ayuda al equipo psicosocial a entender si el curso está siendo afectado por problemas de salud (Licencias), temas familiares (Justificaciones) o conductuales (Suspensiones).</p>
                    </div>
                    <div class="dashboard-section-content">
                        ${(totalL + totalJ + totalS + totalCP) > 0 ? `
                            <div class="dashboard-chart-container">
                                <canvas id="chartDistribucionLic"></canvas>
                            </div>
                        ` : `
                            <div style="padding: 20px; text-align: center; color: var(--gray-500); font-style: italic;">
                                <i class="fas fa-check-circle" style="font-size: 2rem; color: #16a34a; margin-bottom: 8px; display: block;"></i>
                                Sin licencias ni justificaciones registradas
                            </div>
                        `}
                    </div>
                </div>

                <div class="print-block-together" style="margin-top: 30px; margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;">
                    <h3 style="margin: 0 0 12px 0; color: var(--dark); font-size: 1.3rem;">Rankings de Asistencia del Curso</h3>
                    <div class="dashboard-grid">
                        <!-- Rankings -->
                        <div class="dash-kpi-card" style="border-top: none; overflow: hidden; padding: 0;">
                            <div style="background: #16a34a; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; font-size: 0.95rem;">🏆 Mejor Asistencia (Top 10)</span>
                                <span style="background: rgba(255,255,255,0.25); padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;">Destacados</span>
                            </div>
                            <div style="padding: 15px 20px;">
                                <ul class="dash-ranking-list">
                                    ${renderList(mejores, 'pctAsistencia', '%')}
                                </ul>
                            </div>
                        </div>
                        <div class="dash-kpi-card" style="border-top: none; overflow: hidden; padding: 0;">
                            <div style="background: #dc2626; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; font-size: 0.95rem;">⚠️ Peor Asistencia (Top 10)</span>
                                <span style="background: rgba(255,255,255,0.25); padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;">Atención requerida</span>
                            </div>
                            <div style="padding: 15px 20px;">
                                <ul class="dash-ranking-list">
                                    ${renderList(peores, 'inasistencias', ' faltas')}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="print-block-together" style="margin-top: 30px; margin-bottom: 20px; page-break-inside: avoid; break-inside: avoid;">
                    <div style="margin-bottom: 12px;">
                        <h3 style="margin: 0 0 8px 0; color: var(--dark); font-size: 1.3rem;">Análisis por Tipo de Justificación</h3>
                        <div style="display: flex; gap: 20px; flex-wrap: wrap; font-size: 0.85rem; color: var(--gray-500);">
                            <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#16a34a;margin-right:5px;vertical-align:middle;"></span>Licencia Médica (L)</span>
                            <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#2563eb;margin-right:5px;vertical-align:middle;"></span>Justificación (J)</span>
                            <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#dc2626;margin-right:5px;vertical-align:middle;"></span>Suspensión (S)</span>
                            <span><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#ea580c;margin-right:5px;vertical-align:middle;"></span>Carpeta Pedagógica (CP)</span>
                        </div>
                    </div>
                    <div class="dashboard-grid">
                        <div class="dash-kpi-card" style="border-top: none; overflow: hidden; padding: 0;">
                            <div style="background: #16a34a; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; font-size: 0.95rem;">🩺 Licencias Médicas (L)</span>
                                <span style="background: rgba(255,255,255,0.25); padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;">${totalL} total</span>
                            </div>
                            <div style="padding: 15px 20px;">
                                <ul class="dash-ranking-list">
                                    ${renderList(topL, 'L')}
                                </ul>
                            </div>
                        </div>
                        <div class="dash-kpi-card" style="border-top: none; overflow: hidden; padding: 0;">
                            <div style="background: #2563eb; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; font-size: 0.95rem;">📋 Justificaciones (J)</span>
                                <span style="background: rgba(255,255,255,0.25); padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;">${totalJ} total</span>
                            </div>
                            <div style="padding: 15px 20px;">
                                <ul class="dash-ranking-list">
                                    ${renderList(topJ, 'J')}
                                </ul>
                            </div>
                        </div>
                        <div class="dash-kpi-card" style="border-top: none; overflow: hidden; padding: 0;">
                            <div style="background: #dc2626; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; font-size: 0.95rem;">🚫 Suspensiones (S)</span>
                                <span style="background: rgba(255,255,255,0.25); padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;">${totalS} total</span>
                            </div>
                            <div style="padding: 15px 20px;">
                                <ul class="dash-ranking-list">
                                    ${renderList(topS, 'S')}
                                </ul>
                            </div>
                        </div>
                        <div class="dash-kpi-card" style="border-top: none; overflow: hidden; padding: 0;">
                            <div style="background: #ea580c; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight: 600; font-size: 0.95rem;">📂 Carpetas Pedagógicas (CP)</span>
                                <span style="background: rgba(255,255,255,0.25); padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;">${totalCP} total</span>
                            </div>
                            <div style="padding: 15px 20px;">
                                <ul class="dash-ranking-list">
                                    ${renderList(topCP, 'CP')}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('dashboardLicenciasCurso').innerHTML = htmlDashboard;

            // Inicializar Gráficos Chart.js
            window.dashboardLicenciasCharts = window.dashboardLicenciasCharts || [];
            window.dashboardLicenciasCharts.forEach(c => c.destroy());
            window.dashboardLicenciasCharts = [];

            setTimeout(() => {
                const ctxTendencia = document.getElementById('chartTendenciaLic');
                const ctxSemaforo = document.getElementById('chartSemaforoLic');
                const ctxDist = document.getElementById('chartDistribucionLic');
                
                if (ctxTendencia && dataSemaforo.length > 0) {
                    window.dashboardLicenciasCharts.push(new Chart(ctxTendencia, {
                        type: 'line',
                        data: {
                            labels: labelsSemaforo,
                            datasets: [{
                                label: '% Asistencia',
                                data: dataSemaforo,
                                borderColor: '#2563eb',
                                backgroundColor: 'rgba(37, 99, 235, 0.15)',
                                tension: 0.4,
                                fill: true,
                                pointBackgroundColor: '#2563eb',
                                pointRadius: 5,
                                pointHoverRadius: 7
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
                            plugins: { 
                                legend: { display: false },
                                tooltip: { callbacks: { label: ctx => ctx.parsed.y + '% asistencia' } },
                                datalabels: { display: false }
                            }
                        }
                    }));
                }

                if (ctxSemaforo && dataSemaforo.length > 0) {
                    window.dashboardLicenciasCharts.push(new Chart(ctxSemaforo, {
                        type: 'bar',
                        data: {
                            labels: labelsSemaforo,
                            datasets: [{
                                label: '% Asistencia',
                                data: dataSemaforo,
                                backgroundColor: dataSemaforo.map(v => v >= 90 ? '#16a34a' : (v >= 80 ? '#ca8a04' : '#dc2626')),
                                borderRadius: 4
                            }]
                        },
                        plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean),
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } },
                            plugins: { 
                                legend: { display: false },
                                datalabels: {
                                    anchor: 'end',
                                    align: 'top',
                                    color: '#334155',
                                    font: { weight: 'bold', size: 12 },
                                    formatter: v => v + '%'
                                }
                            }
                        }
                    }));
                }

                if (ctxDist && (totalL + totalJ + totalS + totalCP) > 0) {
                    const totalJustif = totalL + totalJ + totalS + totalCP;
                    window.dashboardLicenciasCharts.push(new Chart(ctxDist, {
                        type: 'doughnut',
                        data: {
                            labels: ['Licencias (L)', 'Justificaciones (J)', 'Suspensiones (S)', 'Carpetas (CP)'],
                            datasets: [{
                                data: [totalL, totalJ, totalS, totalCP],
                                backgroundColor: ['#16a34a', '#2563eb', '#dc2626', '#ea580c'],
                                borderWidth: 3,
                                borderColor: '#ffffff'
                            }]
                        },
                        plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean),
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15, font: { size: 12 } } },
                                datalabels: {
                                    color: '#fff',
                                    font: { weight: 'bold', size: 13 },
                                    formatter: (value) => {
                                        if (value === 0) return '';
                                        const pct = ((value / totalJustif) * 100).toFixed(0);
                                        return `${value} (${pct}%)`;
                                    }
                                }
                            }
                        }
                    }));
                }
            }, 50);
        }

        function generarDashboardLicenciasAlumno(nombreAlumnoInput) {
            const containerEl = document.getElementById('dashboardLicenciasAlumno');
            if (!containerEl) return;

            const normBuscado = normalizeSearchText(nombreAlumnoInput);
            if (!normBuscado) {
                containerEl.innerHTML = '<div class="empty-state"><p>Ingrese el nombre de un alumno.</p></div>';
                return;
            }

            let alumnoObj = null;
            let cursoNombre = 'Desconocido';
            if (typeof alumnos !== 'undefined') {
                alumnoObj = alumnos.find(a => {
                    const normA = normalizeSearchText(a.nombre);
                    return normA.includes(normBuscado) || normBuscado.includes(normA);
                });
                if (alumnoObj && typeof cursos !== 'undefined') {
                    const c = cursos.find(cur => cur.id == alumnoObj.cursoId);
                    if (c) cursoNombre = c.nombre;
                }
            }

            let totalDiasClases = 0;
            let presenteCount = 0;
            let inasistenciaCount = 0;
            let countL = 0, countJ = 0, countS = 0, countCP = 0, countAusente = 0;

            let statsMensualAlumno = {};
            let diasSemanaFaltas = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            const nombresDias = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };

            if (typeof asistenciaRegistros !== 'undefined') {
                asistenciaRegistros.forEach(regDia => {
                    const isDiaSinClases = typeof window.esDiaSinClases === 'function' ? window.esDiaSinClases(regDia.fecha) : false;
                    if (regDia.cursoId === 0 || isDiaSinClases) return;

                    const [year, month, day] = regDia.fecha.split('-').map(Number);
                    const fechaObj = new Date(year, month - 1, day);
                    const mesClave = `${String(month).padStart(2, '0')}/${year}`;

                    regDia.registros.forEach(r => {
                        const normReg = normalizeSearchText(r.alumno);
                        if (normReg.includes(normBuscado) || normBuscado.includes(normReg)) {
                            totalDiasClases++;
                            const est = r.estado;

                            if (!statsMensualAlumno[mesClave]) {
                                statsMensualAlumno[mesClave] = { presente: 0, inasistencias: 0 };
                            }

                            if (est === 'presente' || est === 'atraso') {
                                presenteCount++;
                                statsMensualAlumno[mesClave].presente++;
                            } else if (['ausente', 'L', 'J', 'S', 'CP'].includes(est)) {
                                inasistenciaCount++;
                                statsMensualAlumno[mesClave].inasistencias++;

                                if (est === 'L') countL++;
                                else if (est === 'J') countJ++;
                                else if (est === 'S') countS++;
                                else if (est === 'CP') countCP++;
                                else if (est === 'ausente') countAusente++;

                                const dayOfWeek = fechaObj.getDay();
                                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                                    diasSemanaFaltas[dayOfWeek]++;
                                }
                            }
                        }
                    });
                });
            }

            const pctAsist = totalDiasClases > 0 ? Math.round((presenteCount / totalDiasClases) * 100) : 0;
            const difAsistInasist = presenteCount - inasistenciaCount;
            const difTexto = difAsistInasist > 0 ? `+${difAsistInasist} días a favor` : `${difAsistInasist} días`;

            let maxDiaKey = null;
            let maxDiaFaltas = 0;
            for (let d = 1; d <= 5; d++) {
                if (diasSemanaFaltas[d] > maxDiaFaltas) {
                    maxDiaFaltas = diasSemanaFaltas[d];
                    maxDiaKey = d;
                }
            }
            const diaCriticoTexto = maxDiaKey && maxDiaFaltas > 0 
                ? `${nombresDias[maxDiaKey]} (${maxDiaFaltas} ${maxDiaFaltas === 1 ? 'falta' : 'faltas'})`
                : 'Sin patrón crítico';

            const totalJustificados = countL + countJ + countS + countCP;

            const mesesOrdenados = Object.keys(statsMensualAlumno).sort((a, b) => {
                const [m1, y1] = a.split('/');
                const [m2, y2] = b.split('/');
                return new Date(y1, m1 - 1) - new Date(y2, m2 - 1);
            });
            const dataInasistenciasMes = mesesOrdenados.map(mesKey => statsMensualAlumno[mesKey].inasistencias);
            
            const mesesMapLocal = {
                '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
                '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
                '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
            };
            const formatMesLocal = (mesKey) => {
                if (!mesKey || mesKey === '-') return '-';
                const [m, y] = mesKey.split('/');
                return `${mesesMapLocal[m] || m} ${y || ''}`;
            };
            const labelsMeses = mesesOrdenados.map(formatMesLocal);

            const labelsDiasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
            const dataDiasSemana = [diasSemanaFaltas[1], diasSemanaFaltas[2], diasSemanaFaltas[3], diasSemanaFaltas[4], diasSemanaFaltas[5]];

            // Resumen de tendencia mensual
            let totalInasistenciasMensual = 0;
            let maxInasistenciasMes = 0;
            let mesMasFaltas = '-';
            dataInasistenciasMes.forEach((val, index) => {
                totalInasistenciasMensual += val;
                if (val > maxInasistenciasMes) {
                    maxInasistenciasMes = val;
                    mesMasFaltas = labelsMeses[index];
                }
            });
            const promedioMensual = dataInasistenciasMes.length > 0 ? (totalInasistenciasMensual / dataInasistenciasMes.length).toFixed(1) : 0;

            let textoTendencia = '';
            if (maxInasistenciasMes === 0) {
                textoTendencia = 'No se registran inasistencias en el período evaluado.';
            } else if (maxInasistenciasMes <= 2) {
                textoTendencia = 'La tendencia mensual se ha mantenido en niveles relativamente moderados.';
            } else if (maxInasistenciasMes <= 4) {
                textoTendencia = 'Se observa un incremento de inasistencias en el mes más crítico que requiere atención.';
            } else {
                textoTendencia = 'Se observa un importante incremento critico en el mes, requiere seguimiento continuo.';
            }

            const resumenMensualHtml = `
                <div style="flex: 1; min-width: 250px; background: #f8fafc; border-radius: 8px; padding: 15px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 10px;">
                    <h5 style="margin: 0; color: #334155; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;"><i class="fas fa-clipboard-list" style="color: #4f46e5;"></i> Resumen de Faltas</h5>
                    <div style="font-size: 0.9rem; color: #475569;">
                        <strong>Total del período:</strong> <span style="color: #1e293b;">${totalInasistenciasMensual} inasistencias</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #475569;">
                        <strong>Promedio:</strong> <span style="color: #1e293b;">${promedioMensual} faltas / mes</span>
                    </div>
                    <div style="font-size: 0.9rem; color: #475569;">
                        <strong>Mes más crítico:</strong> <span style="color: #dc2626; font-weight: 600;">${mesMasFaltas} (${maxInasistenciasMes})</span>
                    </div>
                    <p style="margin: 5px 0 0 0; font-size: 0.85rem; color: #64748b; font-style: italic; border-top: 1px solid #e2e8f0; padding-top: 10px; line-height: 1.5;">
                        Este gráfico muestra la evolución mensual. ${textoTendencia}
                    </p>
                </div>
            `;

            const htmlAlumnoDashboard = `
                <div class="print-block-together" style="margin-bottom: 25px; page-break-inside: avoid; break-inside: avoid;">
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                            <div>
                                <h2 style="margin: 0; color: #1e293b; font-size: 1.5rem; display: flex; align-items: center; gap: 10px;">
                                    <i class="fas fa-user-graduate" style="color: #4f46e5;"></i>
                                    <span>${nombreAlumnoInput.toUpperCase()}</span>
                                </h2>
                                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.95rem;">
                                    Curso: <strong>${cursoNombre}</strong> | Total días evaluados: <strong>${totalDiasClases} días</strong>
                                </p>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
                                <span style="background: ${pctAsist >= 85 ? '#dcfce7' : (pctAsist >= 75 ? '#fef9c3' : '#fee2e2')}; color: ${pctAsist >= 85 ? '#15803d' : (pctAsist >= 75 ? '#a16207' : '#b91c1c')}; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 1rem; border: 1px solid ${pctAsist >= 85 ? '#86efac' : (pctAsist >= 75 ? '#fde047' : '#fca5a5')};">
                                    ${pctAsist}% Asistencia Global
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Gráficos KPI del Alumno -->
                    <div class="dashboard-kpi-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 25px;">
                        <div class="dash-kpi-card" style="border-top-color: #2563eb; display: flex; flex-direction: column; align-items: center; padding: 15px;">
                            <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 0.95rem;">Asistencia vs. Ausencia</h4>
                            <div style="position: relative; height: 160px; width: 100%;">
                                <canvas id="chartKPIAsistencia"></canvas>
                            </div>
                        </div>
                        <div class="dash-kpi-card" style="border-top-color: #dc2626; display: flex; flex-direction: column; align-items: center; padding: 15px;">
                            <h4 style="margin: 0 0 2px 0; color: #1e293b; font-size: 0.95rem;">Faltas por Día de la Semana</h4>
                            <p style="margin: 0 0 10px 0; font-size: 0.75rem; color: #64748b; text-align: center; line-height: 1.2;">Indica qué días de la semana ocurren las inasistencias</p>
                            <div style="position: relative; height: 140px; width: 100%;">
                                <canvas id="chartKPIDias"></canvas>
                            </div>
                        </div>
                        <div class="dash-kpi-card" style="border-top-color: #16a34a; display: flex; flex-direction: column; align-items: center; padding: 15px;">
                            <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 0.95rem;">Motivos de Inasistencia</h4>
                            <div style="position: relative; height: 160px; width: 100%;">
                                <canvas id="chartKPIJustificaciones"></canvas>
                            </div>
                        </div>
                        <div class="dash-kpi-card" style="border-top-color: #8b5cf6; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 20px;">
                            <i class="fas fa-folder" style="color: #8b5cf6; font-size: 1.5rem; margin-bottom: 12px;"></i>
                            <h4 style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.1rem; font-weight: 500;">Expediente de Evidencias</h4>
                            <div id="badgeDriveAlumnoStatus" style="line-height: 1.6;">
                                <span style="color:#64748b; font-size: 0.9rem;"><i class="fas fa-spinner fa-spin"></i> Consultando...</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Desglose por Tipo de Justificación -->
                <div class="print-block-together" style="margin-bottom: 25px; page-break-inside: avoid; break-inside: avoid;">
                    <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-list-check" style="color: #2563eb;"></i>
                        <span>Desglose Detallado por Tipo de Justificación</span>
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 15px;">
                            <div style="font-size: 0.8rem; color: #166534; font-weight: 600;">🩺 Licencias Médicas (L)</div>
                            <div style="font-size: 1.4rem; font-weight: 800; color: #15803d; margin-top: 2px;">${countL} días</div>
                        </div>
                        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 15px;">
                            <div style="font-size: 0.8rem; color: #1e40af; font-weight: 600;">📋 Justificaciones (J)</div>
                            <div style="font-size: 1.4rem; font-weight: 800; color: #1d4ed8; margin-top: 2px;">${countJ} días</div>
                        </div>
                        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 15px;">
                            <div style="font-size: 0.8rem; color: #991b1b; font-weight: 600;">🚫 Suspensiones (S)</div>
                            <div style="font-size: 1.4rem; font-weight: 800; color: #b91c1c; margin-top: 2px;">${countS} días</div>
                        </div>
                        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 15px;">
                            <div style="font-size: 0.8rem; color: #9a3412; font-weight: 600;">📂 Carpetas Pedagógicas (CP)</div>
                            <div style="font-size: 1.4rem; font-weight: 800; color: #c2410c; margin-top: 2px;">${countCP} días</div>
                        </div>
                        <div style="background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 15px;">
                            <div style="font-size: 0.8rem; color: #525252; font-weight: 600;">⚠️ Injustificadas (Ausente)</div>
                            <div style="font-size: 1.4rem; font-weight: 800; color: #404040; margin-top: 2px;">${countAusente} días</div>
                        </div>
                    </div>
                </div>

                <!-- Gráficos de Tendencias del Alumno -->
                <div class="print-block-together" style="margin-bottom: 25px; page-break-inside: avoid; break-inside: avoid;">
                    <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-chart-column" style="color: #4f46e5;"></i>
                        <span>Análisis Gráfico de Tendencias del Estudiante</span>
                    </h3>
                    <div class="dash-kpi-card" style="margin: 0; width: 100%;">
                        <h4>📅 Tendencia Mensual de Inasistencias</h4>
                        <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 15px;">
                            <div class="chart-container" style="flex: 2; min-width: 300px; position: relative; height: 240px;">
                                <canvas id="chartLicenciasAlumnoMensual"></canvas>
                            </div>
                            ${resumenMensualHtml}
                        </div>
                    </div>
                </div>
            `;

            containerEl.innerHTML = htmlAlumnoDashboard;

            // Renderizar Gráficos Chart.js para Alumno
            window.dashboardLicenciasAlumnoCharts = window.dashboardLicenciasAlumnoCharts || [];
            window.dashboardLicenciasAlumnoCharts.forEach(c => c.destroy());
            window.dashboardLicenciasAlumnoCharts = [];

            setTimeout(() => {
                const ctxAsistencia = document.getElementById('chartKPIAsistencia');
                if (ctxAsistencia && totalDiasClases > 0) {
                    window.dashboardLicenciasAlumnoCharts.push(new Chart(ctxAsistencia, {
                        type: 'doughnut',
                        data: {
                            labels: ['Presentes', 'Ausentes'],
                            datasets: [{
                                data: [presenteCount, inasistenciaCount],
                                backgroundColor: ['#3b82f6', '#ef4444'],
                                borderWidth: 0
                            }]
                        },
                        plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean),
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { 
                                legend: { position: 'right', labels: { boxWidth: 12, font: {size: 13} } },
                                datalabels: {
                                    color: '#1e293b',
                                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                                    borderRadius: 4,
                                    padding: 4,
                                    font: { weight: 'bold', size: 13 },
                                    formatter: (value, context) => {
                                        const total = context.chart._metasets[context.datasetIndex].total;
                                        if (!total || value === 0) return '';
                                        const pct = Math.round((value / total) * 100);
                                        return pct > 5 ? value + ' (' + pct + '%)' : value;
                                    }
                                }
                            },
                            cutout: '65%'
                        }
                    }));
                }

                const ctxDiasKpi = document.getElementById('chartKPIDias');
                if (ctxDiasKpi) {
                    const backgroundColors = dataDiasSemana.map((v, i) => i + 1 === maxDiaKey && v > 0 ? '#dc2626' : '#93c5fd');
                    window.dashboardLicenciasAlumnoCharts.push(new Chart(ctxDiasKpi, {
                        type: 'bar',
                        data: {
                            labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'],
                            datasets: [{
                                label: 'Faltas',
                                data: dataDiasSemana,
                                backgroundColor: backgroundColors,
                                borderRadius: 4
                            }]
                        },
                        plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean),
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            layout: { padding: { top: 30 } },
                            plugins: { 
                                legend: { display: false },
                                datalabels: {
                                    anchor: 'end',
                                    align: 'top',
                                    color: '#1e293b',
                                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                                    borderRadius: 4,
                                    padding: 4,
                                    font: { weight: 'bold', size: 13 },
                                    formatter: v => v > 0 ? v : ''
                                }
                            },
                            scales: {
                                y: { beginAtZero: true, display: false },
                                x: { grid: { display: false }, ticks: { font: {size: 10} } }
                            }
                        }
                    }));
                }

                const ctxJustificaciones = document.getElementById('chartKPIJustificaciones');
                if (ctxJustificaciones) {
                    const dataJust = [countL, countJ, countS, countCP];
                    const labelsJust = ['Licencias Médicas', 'Justificaciones', 'Suspensiones', 'Carpeta Pedag.'];
                    const colorsJust = ['#22c55e', '#eab308', '#ef4444', '#f97316'];
                    window.dashboardLicenciasAlumnoCharts.push(new Chart(ctxJustificaciones, {
                        type: 'doughnut',
                        data: {
                            labels: labelsJust.filter((_, i) => dataJust[i] > 0),
                            datasets: [{
                                data: dataJust.filter(v => v > 0),
                                backgroundColor: colorsJust.filter((_, i) => dataJust[i] > 0),
                                borderWidth: 0
                            }]
                        },
                        plugins: [typeof ChartDataLabels !== 'undefined' ? ChartDataLabels : null].filter(Boolean),
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { 
                                legend: { position: 'right', labels: { boxWidth: 12, font: {size: 13} } },
                                datalabels: {
                                    color: '#1e293b',
                                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                                    borderRadius: 4,
                                    padding: 4,
                                    font: { weight: 'bold', size: 13 },
                                    formatter: (value, context) => {
                                        const total = context.chart._metasets[context.datasetIndex].total;
                                        if (!total || value === 0) return '';
                                        const pct = Math.round((value / total) * 100);
                                        return pct > 5 ? value + ' (' + pct + '%)' : value;
                                    }
                                }
                            },
                            cutout: '65%'
                        }
                    }));
                }

                const ctxMensual = document.getElementById('chartLicenciasAlumnoMensual');
                if (ctxMensual && dataInasistenciasMes.length > 0) {
                    window.dashboardLicenciasAlumnoCharts.push(new Chart(ctxMensual, {
                        type: 'bar',
                        data: {
                            labels: labelsMeses,
                            datasets: [{
                                label: 'Inasistencias',
                                data: dataInasistenciasMes,
                                backgroundColor: '#4f46e5',
                                borderRadius: 6
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } }
                            }
                        }
                    }));
                }
            }, 50);

            verificarExpedienteDriveAlumno(nombreAlumnoInput);
        }

        function verificarExpedienteDriveAlumno(nombreAlumno) {
            const el = document.getElementById('badgeDriveAlumnoStatus');
            if (!el) return;

            const norm = normalizeSearchText(nombreAlumno);

            const aplicarFolderData = (folders) => {
                const folder = (folders || []).find(f => normalizeSearchText(f.name) === norm);
                if (folder && folder.files && folder.files.length > 0) {
                    el.innerHTML = `<span style="color:#16a34a; font-weight:700;"><i class="fas fa-check-circle"></i> Carpeta Activa</span><br><span style="color:#475569; font-size:0.85rem; display:block; margin-bottom:8px;">${folder.files.length} documento(s) adjunto(s)</span>
                    <button onclick="mostrarPanel('subir-evidencias'); setTimeout(() => { const b = document.getElementById('buscadorArchivosDrive'); if(b) { b.value = '${nombreAlumno}'; if(typeof filtrarArchivosDrive === 'function') filtrarArchivosDrive(); } }, 50);" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:#8b5cf6; color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:600; box-shadow:0 2px 4px rgba(139,92,246,0.3);"><i class="fas fa-folder-open"></i> Ir a carpeta de evidencias</button>`;
                } else if (folder) {
                    el.innerHTML = `<span style="color:#ca8a04; font-weight:700;"><i class="fas fa-folder"></i> Carpeta Creada</span><br><span style="color:#475569; font-size:0.85rem; display:block; margin-bottom:8px;">Sin archivos adjuntos</span>
                    <button onclick="mostrarPanel('subir-evidencias'); setTimeout(() => { const b = document.getElementById('buscadorArchivosDrive'); if(b) { b.value = '${nombreAlumno}'; if(typeof filtrarArchivosDrive === 'function') filtrarArchivosDrive(); } }, 50);" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:#8b5cf6; color:white; border:none; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:600; box-shadow:0 2px 4px rgba(139,92,246,0.3);"><i class="fas fa-folder-open"></i> Ir a carpeta de evidencias</button>`;
                } else {
                    el.innerHTML = `<span style="color:#64748b;"><i class="fas fa-info-circle"></i> Sin carpeta en Base de Evidencias</span>`;
                }
            };

            if (window.cacheDriveFolders) {
                aplicarFolderData(window.cacheDriveFolders);
            } else {
                fetch(URL_SCRIPT_GOOGLE_DRIVE)
                    .then(res => res.json())
                    .then(data => {
                        if (data.folders) {
                            window.cacheDriveFolders = data.folders;
                            aplicarFolderData(data.folders);
                        } else {
                            aplicarFolderData([]);
                        }
                    })
                    .catch(() => {
                        aplicarFolderData([]);
                    });
            }
        }

        window.limpiarFiltrosInformesLicencias = function() {
            const select = document.getElementById('filtroTipoInformeLic');
            if (select) {
                select.value = '';
                cambiarFiltroInformeLic();
            }
            
            const emptyState = document.getElementById('informeLicEmptyState');
            if (emptyState) emptyState.style.display = 'flex';
            
            const container = document.getElementById('informeLicContainer');
            if (container) container.style.display = 'none';
            
            const btnImprimir = document.getElementById('btnImprimirLic');
            if (btnImprimir) btnImprimir.style.display = 'none';
        };

        window.imprimirInformeLicencias = function() {
            const container = document.getElementById('informeLicContainer');
            if (!container || container.style.display === 'none') {
                showToast('Primero debes hacer clic en "Generar" y asegurar que haya datos.', 'warning');
                return;
            }

            const tbody = document.querySelector('#tablaInformesLicencias tbody');
            if (!tbody) return;

            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);

            let subtitulo = '';
            const subTitleEl = document.getElementById('printSubtitleLicencias');
            const titleEl = document.getElementById('printTitleLicencias');
            if (subTitleEl) subtitulo = subTitleEl.innerHTML.replace('<span class="fecha-hoy-print"></span>', new Date().toLocaleDateString('es-CL'));
            let titulo = titleEl ? titleEl.textContent : 'Reporte de Licencias';

            const isDashboardCurso = document.getElementById('dashboardLicenciasCurso').style.display === 'block';
            const isDashboardAlumno = document.getElementById('dashboardLicenciasAlumno') && document.getElementById('dashboardLicenciasAlumno').style.display === 'block';
            let printContent = '';

            if (isDashboardCurso || isDashboardAlumno) {
                const targetId = isDashboardCurso ? 'dashboardLicenciasCurso' : 'dashboardLicenciasAlumno';
                const dashEl = document.getElementById(targetId).cloneNode(true);
                const originalCanvases = document.getElementById(targetId).querySelectorAll('canvas');
                const clonedCanvases = Array.from(dashEl.querySelectorAll('canvas'));
                
                clonedCanvases.forEach((clonedCanvas, i) => {
                    try {
                        const img = document.createElement('img');
                        img.src = originalCanvases[i].toDataURL('image/png');
                        img.style.width = '100%';
                        img.style.height = 'auto';
                        img.style.maxHeight = '250px';
                        img.style.objectFit = 'contain';
                        clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
                    } catch(e) {
                        console.warn('No se pudo convertir canvas a imagen:', e);
                    }
                });

                printContent = dashEl.innerHTML;
            } else {
                printContent = `
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Curso</th>
                                <th>Estudiante</th>
                                <th>Tipo de Registro</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tbody.innerHTML}
                        </tbody>
                    </table>
                `;
            }

            const doc = iframe.contentWindow.document || iframe.contentDocument;
            doc.open();
            doc.write(`
                <html>
                <head>
                    <title>${titulo}</title>
                    <style>
                        @page { size: A4 portrait; margin: 1.2cm 1.5cm; }
                        * { box-sizing: border-box; }
                        body { 
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                            padding: 0; margin: 0; color: #1e293b; font-size: 10.5pt; line-height: 1.4;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        h2 { text-align: center; margin: 0 0 4px 0; color: #0f172a; font-size: 15pt; }
                        .subtitle { text-align: center; color: #64748b; font-size: 9.5pt; margin-bottom: 15px; line-height: 1.4; }
                        
                        /* Tablas */
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9.5pt; }
                        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
                        th { background-color: #f1f5f9; color: #334155; font-weight: bold; }
                        tr:nth-child(even) { background-color: #f8fafc; }
                        
                        /* KPI Cards Grid */
                        .dashboard-grid { 
                            display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; 
                            margin-bottom: 15px; 
                            page-break-inside: avoid !important; break-inside: avoid !important;
                        }
                        .dash-kpi-card { 
                            background: white; border-radius: 6px; padding: 12px; 
                            border: 1px solid #d1d5db; 
                            page-break-inside: avoid !important; break-inside: avoid !important;
                        }
                        .dash-kpi-card h4 { margin: 0 0 6px 0; color: #64748b; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3px; }
                        .dash-kpi-card .kpi-value { font-size: 13pt; font-weight: 700; color: #0f172a; margin-bottom: 3px; }
                        .dash-kpi-card .kpi-sub { font-size: 8pt; color: #64748b; }
                        
                        /* Rankings */
                        .dash-ranking-list { list-style: none; padding: 0; margin: 0; }
                        .dash-ranking-list li { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0; font-size: 8.5pt; }
                        .dash-ranking-list li:last-child { border-bottom: none; }
                        .badge, .badge-outline { padding: 2px 5px; border-radius: 3px; font-size: 8pt; border: 1px solid #ccc; }
                        
                        /* Secciones Narrativas - VERTICAL para impresión */
                        .dashboard-section { 
                            border: 1px solid #d1d5db; border-radius: 6px; 
                            margin-bottom: 15px; overflow: hidden;
                            page-break-inside: avoid !important; break-inside: avoid !important;
                        }
                        .dashboard-section-narrative { 
                            padding: 10px 14px; background-color: #f8fafc; 
                            border-bottom: 1px solid #d1d5db;
                        }
                        .dashboard-section-narrative h3 { margin: 0 0 4px 0; color: #0f172a; font-size: 11pt; page-break-after: avoid !important; break-after: avoid !important; }
                        .dashboard-section-narrative p { color: #334155; font-size: 9pt; line-height: 1.35; margin: 0 0 4px 0; }
                        .dashboard-section-narrative p:last-child { margin-bottom: 0; }
                        .dashboard-section-content { 
                            padding: 8px 12px; text-align: center;
                        }
                        .dashboard-chart-container { width: 100%; }
                        .dashboard-chart-container img { 
                            max-width: 100%; height: auto; max-height: 180px; 
                        }
                        
                        .print-block-together {
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                        }
                        
                        /* Encabezados */
                        h3 { font-size: 11.5pt; color: #0f172a; margin: 12px 0 6px 0; page-break-after: avoid !important; break-after: avoid !important; }
                    </style>
                </head>
                <body>
                    <h2>${titulo}</h2>
                    <div class="subtitle">${subtitulo}</div>
                    ${printContent}
                </body>
                </html>
            `);
            doc.close();

            setTimeout(() => {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch(e) {
                    console.error('Error al imprimir:', e);
                }
                setTimeout(() => {
                    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
                }, 1000);
            }, 300);
        };

        window.limpiarFiltrosInformesAsistente = function() {
            const select = document.getElementById('filtroTipoInformeAsist');
            if (select) {
                select.value = '';
                cambiarFiltroInformeAsist();
            }
            
            const container = document.getElementById('informeAsistContainer');
            if (container) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-file-alt"></i><p>Seleccione los filtros y presione "Generar"</p></div>';
            }
        };
