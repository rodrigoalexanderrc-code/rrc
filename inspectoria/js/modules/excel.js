        // ==========================================
        // 7. EXCEL
        // ==========================================
        function abrirModalExcel() {
            document.getElementById('modalExcel').classList.add('active');
            const select = document.getElementById('excelCurso');
            select.innerHTML = '<option value="">Seleccione...</option>' +
                cursos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
            document.getElementById('fileInfo').textContent = '';
            document.getElementById('excelPreview').style.display = 'none';
            document.getElementById('btnImportarExcel').disabled = true;
            document.getElementById('fileInput').value = '';
            excelData = [];
        }

        function handleFile(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (event) {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                    let startRow = 0;
                    const headers = ['RUT', 'Nombre', 'Apoderado', 'Teléfono'];
                    if (jsonData.length > 0 && jsonData[0].some(cell =>
                        headers.some(h => String(cell).toLowerCase().includes(h.toLowerCase())))) {
                        startRow = 1;
                    }

                    let ignoradosVacio = 0;
                    let ignoradosFormato = 0;
                    let ignoradosRepetidos = 0;
                    excelData = [];
                    for (let i = startRow; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        const rawRut = String(row[0] || '').trim();
                        const rutVal = rawRut.replace(/\./g, ''); // Remover puntos automáticamente
                        let nombreVal = String(row[1] || '').trim();
                        if (window.formatearNombreApellidos) nombreVal = window.formatearNombreApellidos(nombreVal);

                        if (rutVal && nombreVal) {
                            if (validarRut(rutVal)) {
                                if (alumnos.some(a => a.rut === rutVal) || excelData.some(e => e.rut === rutVal)) {
                                    ignoradosRepetidos++;
                                } else {
                                    excelData.push({
                                        rut: rutVal,
                                        nombre: nombreVal,
                                        apoderado: String(row[2] || '').trim() || 'Sin apoderado',
                                        telefono: String(row[3] || '').trim() || 'Sin teléfono',
                                        correo: String(row[4] || '').trim() || 'Sin correo'
                                    });
                                }
                            } else {
                                ignoradosFormato++;
                            }
                        } else if (row.length > 0 && (row[0] || row[1] || row[2] || row[3])) {
                            ignoradosVacio++;
                        }
                    }

                    if (ignoradosVacio > 0 || ignoradosFormato > 0 || ignoradosRepetidos > 0) {
                        let msgs = [];
                        if (ignoradosVacio > 0) msgs.push(`${ignoradosVacio} filas sin RUT/Nombre`);
                        if (ignoradosFormato > 0) msgs.push(`${ignoradosFormato} filas con RUT inválido`);
                        if (ignoradosRepetidos > 0) msgs.push(`${ignoradosRepetidos} filas con RUT repetido`);

                        showToast(`Carga bloqueada. Corrige el Excel: ${msgs.join(' y ')}`, 'error');
                        document.getElementById('fileInfo').innerHTML = '<span style="color:var(--danger);"><i class="fas fa-times-circle"></i> Archivo rechazado por errores</span>';
                        document.getElementById('excelPreview').style.display = 'none';
                        document.getElementById('btnImportarExcel').disabled = true;
                        document.getElementById('fileInput').value = ''; // Resetear input
                        excelData = []; // Vaciar memoria
                        return; // Abortar carga
                    }

                    if (excelData.length > 0) {
                        document.getElementById('fileInfo').textContent = `✅ ${excelData.length} alumnos cargados`;
                        document.getElementById('excelPreview').style.display = 'block';
                        document.getElementById('excelCount').textContent = excelData.length;
                        document.getElementById('btnImportarExcel').disabled = false;

                        const tbody = document.getElementById('excelPreviewBody');
                        tbody.innerHTML = excelData.slice(0, 10).map(row =>
                            `<tr><td>${row.rut}</td><td>${row.nombre}</td><td>${row.apoderado}</td><td>${row.telefono}</td><td>${row.correo}</td></tr>`
                        ).join('');
                        if (excelData.length > 10) {
                            tbody.innerHTML +=
                                `<tr><td colspan="5" class="text-center text-muted">... y ${excelData.length - 10} más</td></tr>`;
                        }
                    } else {
                        showToast('No se encontraron datos válidos', 'error');
                    }
                } catch (err) {
                    showToast('Error al leer el archivo', 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        }

        // Drag and drop
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) {
                    document.getElementById('fileInput').files = e.dataTransfer.files;
                    handleFile({ target: { files: [file] } });
                }
            });
        }

        function descargarPlanillaEjemplo() {
            const data = [
                ['RUT', 'Nombre', 'Apoderado', 'Teléfono', 'Correo'],
                ['12345678-5', 'Juan Pérez', 'María Gómez', '+56 9 1234 5678', 'maria@ejemplo.com'],
                ['100234456-7', 'Ana Silva', 'Carlos Silva', '+56 9 8765 4321', 'carlos@ejemplo.com']
            ];
            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Alumnos");
            XLSX.writeFile(wb, "Ejemplo_Importacion_Alumnos.xlsx");
        }

        async function importarExcel() {
            const cursoId = parseInt(document.getElementById('excelCurso').value);
            if (!cursoId) { showToast('Seleccione un curso', 'error'); return; }
            if (excelData.length === 0) { showToast('No hay datos', 'error'); return; }

            document.getElementById('btnImportarExcel').disabled = true;
            document.getElementById('btnImportarExcel').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...';

            let importados = 0,
                duplicados = 0;

            // Ordenar datos del excel alfabéticamente
            excelData.sort((a, b) => a.nombre.localeCompare(b.nombre));
            
            // Obtener el número máximo actual del curso
            const alumnosActuales = alumnos.filter(a => a.cursoId === cursoId);
            let maxNum = 0;
            alumnosActuales.forEach(a => {
                const n = parseInt(a.numeroLista);
                if (!isNaN(n) && n > maxNum) maxNum = n;
            });

            for (const row of excelData) {
                const existe = alumnos.some(a => a.rut === row.rut && a.cursoId === cursoId);
                if (!existe) {
                    maxNum++;
                    const nuevoAlumno = { 
                        id: nextAlumnoId++, 
                        rut: row.rut, 
                        nombre: row.nombre, 
                        cursoId, 
                        apoderado: row.apoderado, 
                        telefono: row.telefono, 
                        correo: row.correo,
                        numeroLista: maxNum
                    };
                    alumnos.push(nuevoAlumno);
                    await apiCall('insert', 'Alumnos', nuevoAlumno);
                    importados++;
                } else {
                    duplicados++;
                }
            }

            document.getElementById('btnImportarExcel').innerHTML = '<i class="fas fa-upload"></i> Importar';
            document.getElementById('btnImportarExcel').disabled = false;

            showToast(`✅ ${importados} importados a la BD. ${duplicados} duplicados omitidos.`, 'success');
            cerrarModal('modalExcel');
            cargarAlumnos();
            actualizarDashboard();
            cargarSelectsAsistencia();
            cargarSelectsAlumnos();
        }
        // --- IMPORTACIÓN MASIVA ---
        let excelDataMasivo = { cursos: [], alumnos: [] };

        function abrirModalExcelMasivo() {
            document.getElementById('modalExcelMasivo').classList.add('active');
            document.getElementById('fileInfoMasivo').textContent = '';
            document.getElementById('excelPreviewMasivo').style.display = 'none';
            document.getElementById('btnImportarExcelMasivo').disabled = true;
            document.getElementById('fileInputMasivo').value = '';
            document.getElementById('excelErrorsMasivo').style.display = 'none';
            excelDataMasivo = { cursos: [], alumnos: [], errores: [] };
        }

        function handleFileMasivo(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (event) {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                    // Buscar fila de encabezados
                    let startRow = -1;
                    const requiredHeaders = ['Nombre grado', 'Nombre curso', 'Tipo enseñanza', 'Run', 'Nombre'];
                    
                    for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
                        const rowStr = JSON.stringify(jsonData[i] || []).toLowerCase();
                        if (requiredHeaders.every(h => rowStr.includes(h.toLowerCase()))) {
                            startRow = i + 1;
                            break;
                        }
                    }

                    if (startRow === -1) {
                        showToast('El Excel no tiene el formato correcto (faltan columnas principales).', 'error');
                        document.getElementById('fileInfoMasivo').innerHTML = '<span style="color:var(--danger);">Formato incorrecto</span>';
                        return;
                    }

                    excelDataMasivo = { cursos: [], alumnos: [], errores: [] };

                    let ignoradosRepetidos = 0;
                    let ignoradosFormato = 0;

                    for (let i = startRow; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || row.length < 5) continue;

                        const rawGrado = String(row[0] || '').trim();
                        const rawCurso = String(row[1] || '').trim();
                        const rawTipo = String(row[2] || '').trim();
                        const rawRut = String(row[3] || '').trim().replace(/\./g, '');
                        
                        const nombreEstudiante = String(row[4] || '').trim();
                        const apellidoP = String(row[5] || '').trim();
                        const apellidoM = String(row[6] || '').trim();
                        let nombreCompleto = `${nombreEstudiante} ${apellidoP} ${apellidoM}`.trim();
                        if (window.formatearNombreApellidos) nombreCompleto = window.formatearNombreApellidos(nombreCompleto);

                        const nombreApo = String(row[7] || '').trim();
                        const apellidoApoP = String(row[8] || '').trim();
                        const apellidoApoM = String(row[9] || '').trim();
                        const apoderadoCompleto = `${nombreApo} ${apellidoApoP} ${apellidoApoM}`.trim() || 'Sin apoderado';
                        
                        const telefono = String(row[10] || '').trim() || 'Sin teléfono';
                        const correo = String(row[11] || '').trim() || 'Sin correo';

                        if (!rawRut || !nombreEstudiante || !rawGrado || !rawCurso) {
                            excelDataMasivo.errores.push({ fila: i + 1, alumno: rawRut || nombreEstudiante || 'Desconocido', motivo: 'Faltan datos obligatorios (RUT, Nombre, Grado o Curso)' });
                            continue;
                        }

                        if (!validarRut(rawRut)) {
                            excelDataMasivo.errores.push({ fila: i + 1, alumno: rawRut + ' ' + nombreEstudiante, motivo: 'RUT con formato inválido' });
                            continue;
                        }

                        if (excelDataMasivo.alumnos.some(a => a.rut === rawRut)) {
                            excelDataMasivo.errores.push({ fila: i + 1, alumno: rawRut + ' ' + nombreEstudiante, motivo: 'RUT duplicado dentro del mismo archivo Excel' });
                            continue;
                        }

                        const existingAlumno = alumnos.find(a => a.rut === rawRut);
                        const isUpdate = !!existingAlumno;
                        const existingId = existingAlumno ? existingAlumno.id : null;

                        // Determinar el nivel exacto
                        let nivelFinal = rawGrado;
                        const tipoStr = rawTipo.toLowerCase();
                        
                        if (tipoStr.includes('parvularia')) {
                            if (rawGrado.includes('1')) nivelFinal = 'Pre-Kinder';
                            else if (rawGrado.includes('2')) nivelFinal = 'Kinder';
                        } else if (tipoStr.includes('básica') || tipoStr.includes('basica')) {
                            nivelFinal = `${rawGrado} Básico`;
                        } else if (tipoStr.includes('media')) {
                            nivelFinal = `${rawGrado} Medio`;
                        }

                        // Formamos el nombre del curso como "1° Básico A" o "Pre-Kinder A"
                        const cursoNombre = `${nivelFinal} ${rawCurso}`;

                        // Verificar si ya agregamos este curso en el parseo actual
                        let cursoTemp = excelDataMasivo.cursos.find(c => c.nombre === cursoNombre);
                        if (!cursoTemp) {
                            cursoTemp = { nombre: cursoNombre, nivel: nivelFinal, tempId: 'temp_' + excelDataMasivo.cursos.length };
                            excelDataMasivo.cursos.push(cursoTemp);
                        }

                        excelDataMasivo.alumnos.push({
                            id: existingId,
                            rut: rawRut,
                            nombre: nombreCompleto,
                            apoderado: apoderadoCompleto,
                            telefono: telefono,
                            correo: correo,
                            cursoTempId: cursoTemp.tempId,
                            cursoNombre: cursoNombre,
                            cursoNivel: nivelFinal,
                            isUpdate: isUpdate
                        });
                    }

                    if (excelDataMasivo.alumnos.length > 0) {
                        document.getElementById('fileInfoMasivo').textContent = `✅ ${excelDataMasivo.cursos.length} cursos y ${excelDataMasivo.alumnos.length} alumnos detectados`;
                        document.getElementById('excelPreviewMasivo').style.display = 'block';
                        document.getElementById('excelCountCursos').textContent = excelDataMasivo.cursos.length;
                        document.getElementById('excelCountAlumnos').textContent = excelDataMasivo.alumnos.length;
                        document.getElementById('btnImportarExcelMasivo').disabled = false;

                        const tbody = document.getElementById('excelPreviewBodyMasivo');
                        tbody.innerHTML = excelDataMasivo.alumnos.slice(0, 10).map(row =>
                            `<tr><td>${row.cursoNivel}</td><td>${row.cursoNombre}</td><td>${row.rut}</td><td>${row.nombre} ${row.isUpdate ? '<span class="badge" style="background:var(--warning);font-size:0.7em;">Actualizar</span>' : '<span class="badge" style="background:var(--success);font-size:0.7em;">Nuevo</span>'}</td><td>${row.apoderado}</td></tr>`
                        ).join('');
                        if (excelDataMasivo.alumnos.length > 10) {
                            tbody.innerHTML += `<tr><td colspan="5" class="text-center text-muted">... y ${excelDataMasivo.alumnos.length - 10} alumnos más</td></tr>`;
                        }

                        if (excelDataMasivo.errores.length > 0) {
                            document.getElementById('excelErrorsMasivo').style.display = 'block';
                            document.getElementById('excelCountErrores').textContent = excelDataMasivo.errores.length;
                            document.getElementById('btnImportarExcelMasivo').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Continuar ignorando errores';
                            document.getElementById('btnImportarExcelMasivo').classList.replace('btn-success', 'btn-warning');

                            const tbodyErr = document.getElementById('excelErrorsBodyMasivo');
                            tbodyErr.innerHTML = excelDataMasivo.errores.map(err =>
                                `<tr><td>${err.fila}</td><td>${err.alumno}</td><td>${err.motivo}</td></tr>`
                            ).join('');
                        } else {
                            document.getElementById('excelErrorsMasivo').style.display = 'none';
                            document.getElementById('btnImportarExcelMasivo').innerHTML = '<i class="fas fa-upload"></i> Importar Datos';
                            document.getElementById('btnImportarExcelMasivo').classList.replace('btn-warning', 'btn-success');
                        }
                    } else {
                        showToast('No se encontraron alumnos válidos para importar', 'error');
                        if (excelDataMasivo.errores.length > 0) {
                            document.getElementById('excelErrorsMasivo').style.display = 'block';
                            document.getElementById('excelCountErrores').textContent = excelDataMasivo.errores.length;
                            document.getElementById('excelErrorsBodyMasivo').innerHTML = excelDataMasivo.errores.map(err =>
                                `<tr><td>${err.fila}</td><td>${err.alumno}</td><td>${err.motivo}</td></tr>`
                            ).join('');
                        }
                    }
                } catch (err) {
                    showToast('Error al leer el archivo masivo', 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        }

        async function importarExcelMasivo() {
            if (excelDataMasivo.alumnos.length === 0) return;
            document.getElementById('btnImportarExcelMasivo').disabled = true;
            document.getElementById('btnImportarExcelMasivo').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando en Base de Datos...';

            let cursosNuevosCount = 0;
            let alumnosNuevosCount = 0;
            let alumnosActualizadosCount = 0;

            try {
                // 1. Crear Cursos faltantes y mapear IDs
                let idMapping = {}; // tempId -> real ID
                for (const cTemp of excelDataMasivo.cursos) {
                    // Buscar si existe en la plataforma (ignorando mayúsculas y espacios extra)
                    let cursoExistente = cursos.find(c => c.nombre.trim().toLowerCase() === cTemp.nombre.trim().toLowerCase());
                    if (cursoExistente) {
                        idMapping[cTemp.tempId] = cursoExistente.id;
                    } else {
                        const nuevoCurso = { id: nextCursoId++, nombre: cTemp.nombre, nivel: cTemp.nivel };
                        cursos.push(nuevoCurso);
                        await apiCall('insert', 'Cursos', nuevoCurso); // Si hay bulk en el backend, esto se podría optimizar
                        idMapping[cTemp.tempId] = nuevoCurso.id;
                        cursosNuevosCount++;
                    }
                }

                // 2. Preparar Alumnos
                let alumnosParaGuardar = [];
                let alumnosParaActualizar = [];
                for (const aTemp of excelDataMasivo.alumnos) {
                    const realCursoId = idMapping[aTemp.cursoTempId];
                    if (aTemp.isUpdate) {
                        const existingAlumno = alumnos.find(a => a.id === aTemp.id);
                        if (existingAlumno) {
                            existingAlumno.nombre = aTemp.nombre;
                            existingAlumno.cursoId = realCursoId;
                            existingAlumno.apoderado = aTemp.apoderado;
                            existingAlumno.telefono = aTemp.telefono;
                            existingAlumno.correo = aTemp.correo;
                            alumnosParaActualizar.push(existingAlumno);
                        }
                    } else {
                        const nuevoAlumno = { 
                            id: nextAlumnoId++, 
                            rut: aTemp.rut, 
                            nombre: aTemp.nombre, 
                            cursoId: realCursoId, 
                            apoderado: aTemp.apoderado, 
                            telefono: aTemp.telefono, 
                            correo: aTemp.correo 
                        };
                        alumnosParaGuardar.push(nuevoAlumno);
                    }
                }

                // Asignar N° de Lista automático a los alumnos nuevos
                // Agrupamos por curso
                const alumnosPorCurso = {};
                alumnosParaGuardar.forEach(a => {
                    if (!alumnosPorCurso[a.cursoId]) alumnosPorCurso[a.cursoId] = [];
                    alumnosPorCurso[a.cursoId].push(a);
                });

                for (const cursoId in alumnosPorCurso) {
                    // Ordenar alfabéticamente
                    alumnosPorCurso[cursoId].sort((a, b) => a.nombre.localeCompare(b.nombre));
                    
                    // Obtener N° máximo actual para el curso
                    const alumnosActuales = alumnos.filter(a => a.cursoId === parseInt(cursoId));
                    let maxNum = 0;
                    alumnosActuales.forEach(a => {
                        const n = parseInt(a.numeroLista);
                        if (!isNaN(n) && n > maxNum) maxNum = n;
                    });
                    
                    // Asignar números
                    alumnosPorCurso[cursoId].forEach(a => {
                        maxNum++;
                        a.numeroLista = maxNum;
                        alumnos.push(a); // Agregamos a la lista global ahora que está listo
                    });
                }


                // 3. Guardar Alumnos Nuevos
                if (alumnosParaGuardar.length > 0) {
                    try {
                        const bulkBody = { action: 'bulk_insert', sheet: 'Alumnos', data: alumnosParaGuardar };
                        const response = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(bulkBody) });
                        const result = await response.json();
                        if (result.status !== 'success' && !result.success) throw new Error(result.error || "Error en bulk_insert");
                        alumnosNuevosCount = alumnosParaGuardar.length;
                    } catch (bulkError) {
                        console.warn("bulk_insert falló o no existe, usando insert secuencial", bulkError);
                        let secuencialCount = 0;
                        for(const alu of alumnosParaGuardar) {
                            try {
                                await apiCall('insert', 'Alumnos', alu);
                                secuencialCount++;
                            } catch (e) {
                                console.error("Error en insert secuencial", e);
                            }
                        }
                        alumnosNuevosCount = secuencialCount;
                    }
                }

                // 4. Actualizar Alumnos Existentes (Bulk Update)
                if (alumnosParaActualizar.length > 0) {
                    try {
                        const bulkUpdateBody = { action: 'bulk_update', sheet: 'Alumnos', data: alumnosParaActualizar };
                        const response = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(bulkUpdateBody) });
                        const result = await response.json();
                        if (result.status !== 'success' && !result.success) throw new Error(result.error || "Error en bulk_update");
                        alumnosActualizadosCount = alumnosParaActualizar.length;
                    } catch (err) {
                        console.error("Error bulk_update", err);
                        showToast("Error al actualizar algunos alumnos existentes.", "error");
                    }
                }

                showToast(`✅ Importación exitosa: ${alumnosNuevosCount} nuevos, ${alumnosActualizadosCount} actualizados.`, 'success');
                cerrarModal('modalExcelMasivo');
                cargarCursos();
                cargarAlumnos();
                actualizarDashboard();
                cargarSelectsAsistencia();
                cargarSelectsAlumnos();
                cargarSelectsPlanilla();

            } catch (err) {
                showToast(`Hubo un error durante la importación: ${err.message}`, 'error');
                document.getElementById('btnImportarExcelMasivo').innerHTML = '<i class="fas fa-upload"></i> Importar Datos';
                document.getElementById('btnImportarExcelMasivo').disabled = false;
            }
        }

        // Drop zone Masivo
        const dropZoneMasivo = document.getElementById('dropZoneMasivo');
        if (dropZoneMasivo) {
            dropZoneMasivo.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZoneMasivo.classList.add('dragover');
            });
            dropZoneMasivo.addEventListener('dragleave', () => { dropZoneMasivo.classList.remove('dragover'); });
            dropZoneMasivo.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZoneMasivo.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) {
                    document.getElementById('fileInputMasivo').files = e.dataTransfer.files;
                    handleFileMasivo({ target: { files: [file] } });
                }
            });
        }


