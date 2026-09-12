        // ==========================================
        // 14. COMPROBANTES
        // ==========================================
        function cargarComprobantes() {
            const container = document.getElementById('comprobantesContainer');
            const filtroTexto = normalizeSearchText(document.getElementById('comprobantesFiltroTexto')?.value);
            const filtroEstado = document.getElementById('comprobantesFiltroEstado')?.value || '';

            let filtrados = comprobantes;
            if (filtroTexto) {
                filtrados = filtrados.filter(c =>
                    (c.asunto && normalizeSearchText(c.asunto).includes(filtroTexto)) ||
                    (c.destinatario && normalizeSearchText(c.destinatario).includes(filtroTexto)) ||
                    (c.estudiante && normalizeSearchText(c.estudiante).includes(filtroTexto))
                );
            }
            if (filtroEstado) {
                filtrados = filtrados.filter(c => c.estado === filtroEstado);
            }

            if (filtrados.length === 0) {
                container.innerHTML = `<div class="empty-state"><i class="fas fa-receipt"></i><p>No hay comprobantes que coincidan con la búsqueda</p></div>`;
                return;
            }

            container.innerHTML = filtrados.map(c => {
                let badgeEstado = '';
                if (c.estado === 'Entregado') badgeEstado = '<span class="badge-status" style="background:#dcfce7;color:#166534;">✅ Entregado</span>';
                else if (c.estado === 'Pendiente de firma') badgeEstado = '<span class="badge-status" style="background:#fef3c7;color:#92400e;">⏳ Pendiente</span>';
                else if (c.estado === 'Devuelto firmado') badgeEstado = '<span class="badge-status" style="background:#ede9fe;color:#5b21b6;">📝 Firmado</span>';

                return `
    <div style="background:white;border:1px solid var(--gray-200);border-radius:8px;padding:1rem;margin-bottom:0.8rem;border-left:4px solid var(--success);">
        <div class="flex-between" style="flex-wrap:wrap;gap:5px;">
            <div>
                <span style="font-weight:700;">📄 ${c.asunto}</span>
                <span style="font-size:0.85rem;color:var(--gray-500);margin-left:10px;">${c.fecha}</span>
            </div>
            <div class="flex gap-2">
                ${badgeEstado}
                <span class="badge-status" style="background:#dbeafe;color:#1e40af;">${c.medio}</span>
                <button class="btn btn-outline btn-sm" onclick="imprimirCertificado(${c.id})" title="Imprimir Comprobante"><i class="fas fa-print"></i></button>
            </div>
        </div>
        <div style="font-size:0.9rem;margin-top:0.3rem;">👤 ${c.destinatario} ${c.estudiante ? `<span style="color:var(--gray-500);font-size:0.8rem;">(Alumno: ${c.estudiante})</span>` : ''}</div>
        <div style="font-size:0.85rem;color:var(--gray-700);margin-top:0.3rem;background:var(--gray-50);padding:0.5rem;border-radius:4px;">
            ${c.contenido}
        </div>
        ${c.adjuntos ? `<div style="font-size:0.8rem;color:var(--gray-500);margin-top:0.3rem;">📎 ${c.adjuntos}</div>` : ''}
        <div style="font-size:0.75rem;color:var(--gray-500);margin-top:0.3rem;text-align:right;">
            <i class="far fa-clock"></i> ${c.fechaRegistro}
        </div>
    </div>
`}).join('');
        }

        function generarComprobante() {
            document.getElementById('modalComprobante').classList.add('active');
            document.getElementById('comprobanteFecha').value = today();

            // Cargar estudiantes en datalist
            const datalist = document.getElementById('listaEstudiantesComprobante');
            if (datalist) {
                datalist.innerHTML = alumnos.map(a => {
                    const suffix = a.rut ? ` - ${a.rut}` : '';
                    return `<option value="${a.nombre}${suffix}">${removeAccents(a.nombre)}${suffix}</option>`;
                }).join('');
            }
            const inputEstudiante = document.getElementById('comprobanteEstudianteInput');
            if (inputEstudiante) inputEstudiante.value = '';
            document.getElementById('comprobanteEstado').value = 'Entregado';
        }

        async function guardarComprobante(e) {
            e.preventDefault();
            const fecha = document.getElementById('comprobanteFecha').value;
            const medio = document.getElementById('comprobanteMedio').value;
            const destinatario = document.getElementById('comprobanteDestinatario').value.trim();
            const asunto = document.getElementById('comprobanteAsunto').value.trim();
            const contenido = document.getElementById('comprobanteContenido').value.trim();
            const adjuntos = document.getElementById('comprobanteAdjuntos').value.trim();
            const estado = document.getElementById('comprobanteEstado').value;

            let estudianteNombre = '';
            const inputVal = document.getElementById('comprobanteEstudianteInput').value.trim();
            if (inputVal) {
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

                if (alumno) estudianteNombre = alumno.nombre;
                else {
                    showToast('Estudiante no válido, deje en blanco o seleccione uno de la lista', 'warning');
                    return;
                }
            }

            const nuevoComprobante = {
                id: nextComprobanteId++,
                fecha: new Date(fecha).toLocaleDateString(),
                medio: medio,
                destinatario: destinatario,
                asunto: asunto,
                contenido: contenido,
                adjuntos: adjuntos || 'N/A',
                estado: estado,
                estudiante: estudianteNombre,
                fechaRegistro: new Date().toLocaleString()
            };
            comprobantes.unshift(nuevoComprobante);
            await apiCall('insert', 'Comprobantes', nuevoComprobante);

            showToast('✅ Comprobante guardado exitosamente', 'success');
            cerrarModal('modalComprobante');
            cargarComprobantes();
        }

        function imprimirCertificado(id) {
            const c = comprobantes.find(x => x.id === id);
            if (!c) return;

            let html = `
                <html><head><title>Certificado de Entrega</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
                    .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { margin: 0; color: #1e40af; font-size: 24px; text-transform: uppercase; }
                    .header h3 { margin: 5px 0 0; color: #666; font-size: 16px; font-weight: normal; }
                    .content { margin-bottom: 40px; }
                    .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    .table th, .table td { padding: 12px; border: 1px solid #ddd; text-align: left; }
                    .table th { background: #f8fafc; color: #1e293b; width: 30%; }
                    .message-box { padding: 15px; border: 1px solid #ddd; background: #f8fafc; margin-top: 20px; min-height: 80px; }
                    .signature-area { margin-top: 80px; display: flex; justify-content: space-around; text-align: center; }
                    .signature-line { border-top: 1px solid #000; width: 250px; padding-top: 10px; margin-bottom: 5px; }
                    @media print { 
                        body { padding: 0; }
                    }
                </style>
                </head><body>
                    <div class="header">
                        <h1>Liceo Bicentenario Simón Bolívar</h1>
                        <h3>CERTIFICADO DE ENTREGA Y COMUNICACIÓN</h3>
                    </div>
                    <div class="content">
                        <p>Mediante el presente documento, se certifica el envío y/o entrega de la siguiente documentación/comunicación oficial:</p>
                        <table class="table">
                            <tr><th>Fecha de Registro:</th><td>${c.fechaRegistro}</td></tr>
                            <tr><th>Medio de Envío:</th><td>${c.medio}</td></tr>
                            <tr><th>Asunto:</th><td><strong>${c.asunto}</strong></td></tr>
                            <tr><th>Destinatario:</th><td>${c.destinatario}</td></tr>
                            ${c.estudiante ? `<tr><th>Estudiante Referencia:</th><td>${c.estudiante}</td></tr>` : ''}
                            <tr><th>Observaciones:</th><td>${c.adjuntos}</td></tr>
                            <tr><th>Estado en Sistema:</th><td>${c.estado}</td></tr>
                        </table>
                        
                        <h4 style="margin-top:25px; margin-bottom:5px;">Detalle / Contenido:</h4>
                        <div class="message-box">
                            ${c.contenido.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                    
                    <div class="signature-area">
                        <div>
                            <div class="signature-line"></div>
                            <strong>Timbre y Firma Inspectoría</strong><br>
                            Liceo Simón Bolívar
                        </div>
                        <div>
                            <div class="signature-line"></div>
                            <strong>Firma de Recepción (Apoderado/Destinatario)</strong><br>
                            RUT: ____________________
                        </div>
                    </div>
                </body></html>
            `;
            const win = window.open('', '_blank');
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => { win.print(); }, 250);
        }


