        // ==========================================
        // 3. NAVEGACIÓN
        // ==========================================
        function mostrarPanel(panel) {
            const link = document.querySelector(`.sidebar-menu a[data-panel="${panel}"]`);
            if (link) {
                document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
                link.classList.add('active');
            } else {
                document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
            }

            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            const targetPanel = document.getElementById('panel-' + panel);
            if (targetPanel) targetPanel.classList.add('active');

            const titles = {
                dashboard: ['Dashboard', 'Vista general'],
                cursos: ['Gestión de Cursos', 'Crear, editar y eliminar cursos'],
                alumnos: ['Gestión de Alumnos', 'Administrar alumnos por curso'],
                'alumnos-riesgo': ['Alumnos en Riesgo', `Seguimiento de asistencia crítica (< ${window.configuracionGlobal?.riesgo_medio || 85}%)`],
                asistencia: ['Registro de Asistencia', 'Registrar asistencia diaria'],
                'reporte-diario': ['Reporte Diario de Asistencia', 'Consolidado de inspectoría'],
                informes: ['Informes', 'Generador de Informes por Curso o Alumno'],
                'planilla-alertas': ['Planilla de Alertas', 'Seguimiento por curso'],
                comunicacion: ['Comunicación', 'Contacto con apoderados'],
                bitacora: ['Bitácora de Novedades', 'Registro disciplinario'],
                'asistente-social': ['Módulo Asistente Social', 'Gestión de Inasistencias y Casos'],
                'semanas-mes': ['Semanas por mes', 'Matriz de Seguimiento Semanal'],
                'licencias-justificaciones': ['Licencias y Justificaciones', 'Registro mensual por curso'],
                'inasistencia-injustificada': ['Inasistencias sin Justificar', 'Registro de inasistencias sin licencia o justificación'],
                'informes-licencias': ['Informes Licencias y Justif.', 'Reportes filtrados de asistencia'],
                'subir-evidencias': ['Subir Evidencias', 'Subir documentos a la Base de Datos'],
                comprobantes: ['Comprobantes', 'Mensajería institucional'],
                mantencion: ['Mantención de Datos', 'Limpieza y restauración de la base de datos'],
                configuracion: ['Configuración Global', 'Parámetros del sistema'],
            };
            const [title, sub] = titles[panel] || ['', ''];
            document.getElementById('pageTitle').textContent = title;
            document.getElementById('pageSubtitle').textContent = sub;

            // Cargar datos
            const loaders = {
                dashboard: () => { actualizarDashboard(); actualizarResumenDia(); },
                cursos: cargarCursos,
                alumnos: () => { cargarAlumnos(); cargarSelectsAlumnos(); },
                'alumnos-riesgo': cargarAlumnosRiesgoPanel,
                asistencia: () => { cargarSelectsAsistencia(); cargarListaAsistencia(); },
                'semanas-mes': () => { if(typeof cargarInicialSemanasMes === 'function') cargarInicialSemanasMes(); },
                'reporte-diario': () => {
                    document.getElementById('reporteFecha').value = '';
                    document.getElementById('reporteDiarioContainer').innerHTML = `
                        <div class="empty-state"><i class="fas fa-file-alt"></i>
                            <p>Seleccione una fecha y presione "Generar"</p>
                        </div>
                    `;
                },
                informes: () => { },
                'planilla-alertas': () => { cargarSelectsPlanilla(); cargarPlanillaAlertas(); },
                comunicacion: cargarComunicaciones,
                bitacora: cargarBitacora,
                'asistente-social': cargarAsistenteSocial,
                'licencias-justificaciones': () => { if (typeof renderizarGrillaLicencias === 'function') renderizarGrillaLicencias(); },
                'inasistencia-injustificada': () => { if (typeof renderizarInasistenciasInjustificadas === 'function') renderizarInasistenciasInjustificadas(); },
                'informes-licencias': () => {
                    const select = document.getElementById('filtroTipoInformeLic');
                    if (select) {
                        select.value = '';
                        if (typeof cambiarFiltroInformeLic === 'function') cambiarFiltroInformeLic();
                    }
                    const emptyState = document.getElementById('informeLicEmptyState');
                    const container = document.getElementById('informeLicContainer');
                    const btnImprimir = document.getElementById('btnImprimirLic');
                    if (emptyState) emptyState.style.display = 'flex';
                    if (container) container.style.display = 'none';
                    if (btnImprimir) btnImprimir.style.display = 'none';
                },
                'subir-evidencias': () => {
                    if (typeof cargarPanelSubirEvidencias === 'function') {
                        cargarPanelSubirEvidencias();
                    }
                },
                comprobantes: cargarComprobantes,
                mantencion: cargarMantencionSelects,
                configuracion: () => { if (typeof cargarConfiguracion === 'function') cargarConfiguracion(); },
            };
            if (loaders[panel]) loaders[panel]();

            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('open');
            }
        }

        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                mostrarPanel(this.dataset.panel);
            });
        });

        function parseYearMonth(fechaStr) {
            if (!fechaStr) return { year: -1, month: -1 };
            // Si la fecha contiene hora o sufijos (ej: "09-07-2026, 8:15:48 p. m." o "2026-07-09 08:15:48"), tomar solo la fecha
            let soloFecha = fechaStr.split(',')[0].trim().split(' ')[0].trim();
            let f = soloFecha.replace(/\//g, '-');
            let parts = f.split('-');
            if (parts.length !== 3) return { year: -1, month: -1 };

            let year, month;
            if (parts[0].length === 4) {
                year = parseInt(parts[0]);
                month = parseInt(parts[1]) - 1;
            } else if (parts[2].length === 4) {
                year = parseInt(parts[2]);
                month = parseInt(parts[1]) - 1;
            } else {
                return { year: -1, month: -1 };
            }
            return { year, month };
        }

        function normalizeDate(fechaStr) {
            if (!fechaStr) return '';
            let f = fechaStr.replace(/\//g, '-');
            let parts = f.split('-');
            if (parts.length !== 3) return fechaStr;
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            return fechaStr;
        }

        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('open');
        }

        function today() {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }

        // ==========================================
        // 15. MODALES
        // ==========================================
        function cerrarModal(id) {
            document.getElementById(id).classList.remove('active');
        }

        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', function (e) {
                if (e.target === this) this.classList.remove('active');
            });
        });


