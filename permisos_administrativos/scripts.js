// ====================================================================
//  MODELO DE DATOS (Google Sheets via Apps Script)
// ====================================================================

// URL del Web App (Apps Script) — actualizada a la nueva implementación
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwxJc70Db0Cy4_GHlHlYjQdaQA7-c-rZ1lpjhOuuTJZAfvwu4kAT4B4enENEsiqBCRa/exec';

const SYNC_QUEUE_KEY = 'permisosSyncQueue';
const LOCAL_BACKUP_KEY = 'permisosBackup';
const LAST_SYNC_PAYLOAD_KEY = 'LAST_SYNC_PAYLOAD';
const LAST_SYNC_RESPONSE_KEY = 'LAST_SYNC_RESPONSE';
const LAST_SYNC_ERROR_KEY = 'LAST_SYNC_ERROR';
const LAST_SYNC_DEAD_KEY = 'LAST_SYNC_DEAD';
const MAX_SYNC_RETRIES = 3;
let localCache = { funcionarios: [] };
let isSyncing = false;
let bulkDeleteMode = false;

function getData() {
    return localCache;
}

function updateConnectionStatus(statusStr) {
    const indicator = document.getElementById('status-indicator');
    const textEl = document.getElementById('status-text');
    if(!indicator || !textEl) return;

    indicator.className = 'status-indicator no-print';
    if (statusStr === 'online') {
        indicator.classList.add('status-online');
        textEl.innerText = 'Conectado a la base de datos';
    } else if (statusStr === 'offline') {
        indicator.classList.add('status-offline');
        textEl.innerText = 'Desconectado - Guardando localmente';
    } else if (statusStr === 'syncing') {
        indicator.classList.add('status-syncing');
        textEl.innerText = 'Sincronizando...';
    }
}

// ====================================================================
//  MODAL PERSONALIZADO
// ====================================================================
window.mostrarAlerta = function(mensaje) {
    const overlay = document.getElementById('custom-alert-overlay');
    const msgEl = document.getElementById('custom-alert-mensaje');
    if (overlay && msgEl) {
        msgEl.innerText = mensaje;
        overlay.style.display = 'flex';
    } else {
        alert(mensaje); // Fallback
    }
}

window.cerrarAlerta = function() {
    const overlay = document.getElementById('custom-alert-overlay');
    if (overlay) overlay.style.display = 'none';
}

let confirmCallback = null;

window.mostrarConfirmacion = function(mensaje, callback) {
    const overlay = document.getElementById('custom-confirm-overlay');
    const msgEl = document.getElementById('custom-confirm-mensaje');
    if (overlay && msgEl) {
        msgEl.innerText = mensaje;
        confirmCallback = callback;
        overlay.style.display = 'flex';

        document.getElementById('btn-confirm-aceptar').onclick = function() {
            const cb = confirmCallback;
            cerrarConfirmacion();
            if (cb) cb();
        };
    } else {
        if (confirm(mensaje)) callback();
    }
}

window.cerrarConfirmacion = function() {
    const overlay = document.getElementById('custom-confirm-overlay');
    if (overlay) overlay.style.display = 'none';
    confirmCallback = null;
}

let promptCallback = null;

window.mostrarPromptSeguridad = function(mensaje, callback) {
    const overlay = document.getElementById('custom-prompt-overlay');
    const msgEl = document.getElementById('custom-prompt-mensaje');
    const inputEl = document.getElementById('custom-prompt-input');
    const btnAceptar = document.getElementById('btn-prompt-aceptar');

    if (overlay && msgEl && inputEl && btnAceptar) {
        msgEl.innerText = mensaje;
        inputEl.value = '';
        btnAceptar.disabled = true;
        btnAceptar.style.opacity = '0.5';
        promptCallback = callback;
        overlay.style.display = 'flex';
        inputEl.focus();

        inputEl.oninput = function() {
            if (this.value === 'BORRAR') {
                btnAceptar.disabled = false;
                btnAceptar.style.opacity = '1';
            } else {
                btnAceptar.disabled = true;
                btnAceptar.style.opacity = '0.5';
            }
        };

        btnAceptar.onclick = function() {
            if (inputEl.value === 'BORRAR') {
                const cb = promptCallback;
                cerrarPromptSeguridad();
                if (cb) cb();
            }
        };
    } else {
        const userInput = prompt(mensaje + "\n\nEscriba la palabra BORRAR para confirmar:");
        if (userInput === 'BORRAR') {
            callback();
        }
    }
}

window.cerrarPromptSeguridad = function() {
    const overlay = document.getElementById('custom-prompt-overlay');
    if (overlay) overlay.style.display = 'none';
    promptCallback = null;
}

window.abrirModalImportar = function() {
    const overlay = document.getElementById('modal-importar-overlay');
    if (overlay) overlay.style.display = 'flex';
}

window.cerrarModalImportar = function() {
    const overlay = document.getElementById('modal-importar-overlay');
    if (overlay) overlay.style.display = 'none';
}

async function fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok && (response.status === 429 || response.status >= 500)) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response;
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, backoff * Math.pow(2, i)));
        }
    }
}

function saveLastSyncInfo(payload, response, error) {
    try {
        if (payload !== undefined) localStorage.setItem(LAST_SYNC_PAYLOAD_KEY, JSON.stringify(payload));
        if (response !== undefined) localStorage.setItem(LAST_SYNC_RESPONSE_KEY, JSON.stringify(response));
        if (error !== undefined) localStorage.setItem(LAST_SYNC_ERROR_KEY, JSON.stringify({ message: String(error), time: Date.now() }));
    } catch (e) {
        console.warn('No se pudo guardar LAST_SYNC info', e);
    }
}

// Exponer helper de debugging desde la consola
window.debugShowSyncState = function() {
    try {
        const queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
        const lastPayload = localStorage.getItem(LAST_SYNC_PAYLOAD_KEY);
        const lastResp = localStorage.getItem(LAST_SYNC_RESPONSE_KEY);
        const lastErr = localStorage.getItem(LAST_SYNC_ERROR_KEY);
        const state = {
            queue,
            lastPayload: lastPayload ? JSON.parse(lastPayload) : null,
            lastResponse: lastResp ? JSON.parse(lastResp) : null,
            lastError: lastErr ? JSON.parse(lastErr) : null,
            isSyncing: !!isSyncing
        };
        console.log('debugShowSyncState', state);
        return state;
    } catch (e) {
        console.error('debugShowSyncState error', e);
        return null;
    }
}

// Función para cargar datos desde Google Sheets al iniciar
async function loadDataFromGoogle() {
    if(WEB_APP_URL === 'URL_DE_TU_WEB_APP_AQUI') {
        console.warn("Falta configurar WEB_APP_URL. Usando caché local vacía.");
        return;
    }

    // 1. Optimistic UI: Cargar desde la memoria local inmediatamente
    const backup = localStorage.getItem(LOCAL_BACKUP_KEY);
    if (backup) {
        localCache = JSON.parse(backup);
        // Refrescar la interfaz para que el usuario pueda usarla de inmediato sin esperar a Google
        if (typeof renderizarReporte === 'function') renderizarReporte();
        if (typeof refrescarListadoFuncionarios === 'function') refrescarListadoFuncionarios();
        updateConnectionStatus('syncing'); // Avisar que se están validando datos en segundo plano
    } else {
        mostrarLoading("Sincronizando base de datos por primera vez...");
    }

    // 2. Procesar cola pendiente PRIMERO (evita sobreescribir cambios locales offline con datos viejos de Google)
    let queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    if (queue.length > 0) {
        await syncQueue(); // Enviar pendientes ANTES de descargar
    }

    // 3. Consulta en segundo plano a Google Sheets
    try {
        const lastSync = localStorage.getItem('LAST_FETCH_TIME');
        if (lastSync && (Date.now() - parseInt(lastSync) < 30000) && backup) {
            updateConnectionStatus('online');
            const el = document.getElementById('loading-overlay');
            if (el) el.style.display = 'none';
            return; // Saltar petición de red si pasaron menos de 30s (Caché local)
        }

        const response = await fetchWithRetry(WEB_APP_URL);
        const data = await response.json();
        if(data && data.funcionarios) {
            localCache = data;
            localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(localCache));
            localStorage.setItem('LAST_FETCH_TIME', Date.now().toString());

            // Refrescar vistas silenciosamente con los datos más frescos (si hubo cambios)
            if (typeof renderizarReporte === 'function') renderizarReporte();
            if (typeof refrescarListadoFuncionarios === 'function') refrescarListadoFuncionarios();
        }
        updateConnectionStatus('online');
    } catch (error) {
        console.error("Error al cargar datos:", error);
        updateConnectionStatus('offline');
    } finally {
        const el = document.getElementById('loading-overlay');
        if (el) el.style.display = 'none';
    }
}

function addActionToQueue(actionObj) {
    try {
        // Sanitizar payload: no enviar arrays grandes (permisos) dentro del funcionario
        const sanitized = JSON.parse(JSON.stringify(actionObj));
        if (sanitized.funcionario && sanitized.funcionario.permisos) {
            const f = sanitized.funcionario;
            sanitized.funcionario = { rut: f.rut, nombre: f.nombre, tipoContrato: f.tipoContrato, establecimiento: f.establecimiento };
        }
        // Inicializar contador de reintentos
        if (typeof sanitized._retries === 'undefined') sanitized._retries = 0;

        let queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
        queue.push(sanitized);
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
        console.log('[sync] addActionToQueue - nueva acción añadida:', sanitized, 'colaLong:', queue.length);
        // Guardar último payload visible para depuración
        saveLastSyncInfo(queue, null, null);
    } catch (e) {
        console.error('[sync] addActionToQueue error al actualizar queue', e);
    }
}

async function syncQueue() {
    if (!navigator.onLine) {
        updateConnectionStatus('offline');
        return;
    }

    let queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    if (queue.length === 0) {
        updateConnectionStatus('online');
        return;
    }

    if(isSyncing) return;
    isSyncing = true;
    updateConnectionStatus('syncing');

    let allSuccess = false;

    // Enviar pendientes por lotes (Batching)
    try {
        // Asegurar compatibilidad de acciones
        queue.forEach(item => { if (!item.action) item.action = 'savePermiso'; });

        const payload = { action: 'batchSync', actions: queue };
        console.log('[sync] syncQueue - enviando payload de batchSync, items:', queue.length);
        saveLastSyncInfo(payload, null, null);

        const resp = await fetchWithRetry(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const result = await resp.json();
        console.log('[sync] syncQueue - respuesta:', result);
        saveLastSyncInfo(payload, result, null);

        if (result && result.success) {
            allSuccess = true;
            // Si el servidor indica los índices fallidos, reintentar solo esos
            if (Array.isArray(result.failed) && result.failed.length > 0) {
                const failedIdx = new Set(result.failed);
                const remaining = [];
                const dead = JSON.parse(localStorage.getItem(LAST_SYNC_DEAD_KEY) || '[]');
                queue.forEach((item, idx) => {
                    if (failedIdx.has(idx)) {
                        item._retries = (item._retries || 0) + 1;
                        if (item._retries >= MAX_SYNC_RETRIES) {
                            dead.push({ item, reason: 'max_retries' });
                        } else {
                            remaining.push(item);
                        }
                    }
                });
                localStorage.setItem(LAST_SYNC_DEAD_KEY, JSON.stringify(dead));
                localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
                console.warn('[sync] syncQueue - algunos items fallaron, quedan en cola:', remaining.length, 'muertos:', dead.length);
            } else {
                localStorage.setItem(SYNC_QUEUE_KEY, '[]'); // Vaciar cola completa
                console.log('[sync] syncQueue - todos los items sincronizados, cola vaciada');
            }
            updateConnectionStatus('online');
        } else {
            // No success: no vaciar cola, incrementar reintentos y backoff
            const dead = JSON.parse(localStorage.getItem(LAST_SYNC_DEAD_KEY) || '[]');
            const remaining = queue.map(item => {
                item._retries = (item._retries || 0) + 1;
                if (item._retries >= MAX_SYNC_RETRIES) {
                    dead.push({ item, reason: 'server_failure' });
                    return null;
                }
                return item;
            }).filter(Boolean);
            localStorage.setItem(LAST_SYNC_DEAD_KEY, JSON.stringify(dead));
            localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
            saveLastSyncInfo(payload, result || null, 'Server returned failure');
            console.error('[sync] syncQueue - el servidor devolvió error o formato inesperado', result);
            updateConnectionStatus('offline');
        }
    } catch (e) {
        console.error('Error en syncQueue:', e);
        saveLastSyncInfo({ action: 'batchSync', actions: queue }, null, e);
        updateConnectionStatus('offline');
    }
    isSyncing = false;
}

async function executeActionInGoogle(actionString) {
    if(WEB_APP_URL === 'URL_DE_TU_WEB_APP_AQUI') return;
    try {
        const payload = (typeof actionString === 'string') ? { action: actionString } : actionString;
        saveLastSyncInfo(payload, null, null);
        const resp = await fetchWithRetry(WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        try {
            const json = await resp.json();
            saveLastSyncInfo(payload, json, null);
            return json;
        } catch (err) {
            saveLastSyncInfo(payload, null, err);
            return { success: true };
        }
    } catch(error) {
        console.error("Error al ejecutar accion en google:", error);
        saveLastSyncInfo({ action: actionString }, null, error);
    }
}

// Interfaz simple para loading
function mostrarLoading(mensaje) {
    let el = document.getElementById('loading-overlay');
    if (!el) {
        el = document.createElement('div');
        el.id = 'loading-overlay';
        el.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.8);z-index:9999;display:flex;justify-content:center;align-items:center;font-size:20px;font-weight:bold;color:#2c3e50;';
        document.body.appendChild(el);
    }
    el.innerText = mensaje;
    el.style.display = 'flex';
}
function ocultarLoading() {
    let el = document.getElementById('loading-overlay');
    if (el) el.style.display = 'none';
}

// Util: generar ID único
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

// Util: Formatear fecha para mostrar en UI (maneja ISO strings y YYYY-MM-DD)
function formatearFechaDisplay(dateStr) {
    if (!dateStr) return '';
    let d = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const partes = d.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dateStr;
}

// Calcular días hábiles entre dos fechas (inclusive)
function diasHabiles(fechaInicio, fechaTermino) {
    if (!fechaInicio || !fechaTermino) return 0;
    const [y1, m1, d1] = fechaInicio.split('-');
    const [y2, m2, d2] = fechaTermino.split('-');
    // Usamos new Date(año, mes, dia) para crear la fecha en la zona horaria local y evitar desfases
    const start = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);
    if (isNaN(start) || isNaN(end) || start > end) return 0;
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) count++; // lunes a viernes
        current.setDate(current.getDate() + 1);
    }
    return count;
}

// Obtener funcionario por RUT
function findFuncionario(data, rut) {
    return data.funcionarios.find(f => f.rut === rut);
}

// Calcular días usados por un funcionario (suma de días de todos sus permisos)
function calcularDiasUsados(funcionario) {
    let total = 0;
    if (funcionario && funcionario.permisos) {
        funcionario.permisos.forEach(p => {
            total += p.dias || 0;
        });
    }
    return total;
}

// Calcular el número de orden del permiso (contador que se reinicia el 1 de marzo)
function calcularOrdenPermiso(permisoId) {
    const data = getData();
    let todosLosPermisos = [];
    let targetPermiso = null;

    data.funcionarios.forEach(f => {
        if (f.permisos) {
            f.permisos.forEach(p => {
                todosLosPermisos.push(p);
                if (permisoId && p.id === permisoId) targetPermiso = p;
            });
        }
    });

    let targetDate = targetPermiso ? new Date(targetPermiso.fechaSolicitud || targetPermiso.fechaInicio) : new Date();
    
    // Ciclo escolar empieza el 1 de marzo (mes índice 2)
    const targetCycleYear = targetDate.getMonth() >= 2 ? targetDate.getFullYear() : targetDate.getFullYear() - 1;

    const permisosDelCiclo = todosLosPermisos.filter(p => {
        const d = new Date(p.fechaSolicitud || p.fechaInicio);
        const cycleYear = d.getMonth() >= 2 ? d.getFullYear() : d.getFullYear() - 1;
        return cycleYear === targetCycleYear;
    });

    // Ordenar por fecha de solicitud (o inicio)
    permisosDelCiclo.sort((a, b) => {
        const d1 = new Date(a.fechaSolicitud || a.fechaInicio).getTime();
        const d2 = new Date(b.fechaSolicitud || b.fechaInicio).getTime();
        return d1 - d2;
    });

    if (targetPermiso) {
        const index = permisosDelCiclo.findIndex(p => p.id === targetPermiso.id);
        return index !== -1 ? (index + 1).toString().padStart(3, '0') : '___';
    } else {
        return (permisosDelCiclo.length + 1).toString().padStart(3, '0');
    }
}

// ====================================================================
//  FUNCIONES PARA ACTUALIZAR VISTAS
// ====================================================================

// Actualizar el campo "días calculados" y "días usados" en el formulario
function actualizarVistaFormulario() {
    const rut = document.getElementById('rut').value.trim();
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaTermino = document.getElementById('fechaTermino').value;
    const tipoDia = document.getElementById('tipoDia').value;

    let dias = 0;
    if (fechaInicio && fechaTermino) {
        const habiles = diasHabiles(fechaInicio, fechaTermino);
        const factor = tipoDia === 'completo' ? 1 : 0.5;
        dias = habiles * factor;
    }
    document.getElementById('diasCalculados').value = Number(dias.toFixed(1)) + ' días';

    // Calcular usados del funcionario
    let usados = 0;
    if (rut) {
        const data = getData();
        const func = findFuncionario(data, rut);
        if (func) {
            usados = calcularDiasUsados(func);
        }
    }
    document.getElementById('diasUsados').value = Number(usados.toFixed(1)) + ' días (máx 6)';
}

// Cargar datos de un funcionario al formulario (por RUT)
function cargarFuncionario(rut) {
    const data = getData();
    const func = findFuncionario(data, rut);
    if (func) {
        document.getElementById('nombre').value = func.nombre || '';
        document.getElementById('tipoContrato').value = func.tipoContrato || 'CONTRATO TITULAR';
        document.getElementById('establecimiento').value = func.establecimiento || 'LICEO SIMON BOLIVAR';
        // Actualizar usados
        actualizarVistaFormulario();
        return true;
    }
    return false;
}

// Guardar un nuevo permiso
function guardarPermiso() {
    let rutInput = document.getElementById('rut');
    let rut = rutInput.value.trim();
    if (rut) {
        rut = formatearRut(rut);
        rutInput.value = rut;
    }

    const permisoIdInput = document.getElementById('permisoId');
    const permisoId = permisoIdInput ? permisoIdInput.value : '';

    const nombre = document.getElementById('nombre').value.trim();
    const tipoContrato = document.getElementById('tipoContrato').value;
    const establecimiento = document.getElementById('establecimiento').value.trim();
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaTermino = document.getElementById('fechaTermino').value;
    const tipoDia = document.getElementById('tipoDia').value;
    const motivo = document.getElementById('motivo').value.trim();
    const acoge = document.getElementById('acoge').checked;
    const desestima = document.getElementById('desestima').checked;
    const director = document.getElementById('director').value.trim();

    // Validaciones
    if (!rut || !nombre || !fechaInicio || !fechaTermino || !motivo) {
        document.getElementById('mensaje').innerHTML = '<span style="color:red;">⚠️ Complete todos los campos obligatorios (*).</span>';
        return;
    }
    if (!validarRutChileno(rut)) {
        document.getElementById('mensaje').innerHTML = '<span style="color:red;">⚠️ El RUT ingresado es inválido o tiene un formato incorrecto.</span>';
        return;
    }
    if (fechaInicio > fechaTermino) {
        document.getElementById('mensaje').innerHTML = '<span style="color:red;">⚠️ La fecha de inicio debe ser anterior o igual a la de término.</span>';
        return;
    }
    const habiles = diasHabiles(fechaInicio, fechaTermino);
    if (habiles === 0) {
        document.getElementById('mensaje').innerHTML = '<span style="color:red;">⚠️ No hay días hábiles en el rango seleccionado (considera solo lunes a viernes).</span>';
        return;
    }
    const factor = tipoDia === 'completo' ? 1 : 0.5;
    const diasSolicitados = habiles * factor;

    // Obtener datos actuales
    const data = getData();
    let func = findFuncionario(data, rut);
    if (!func) {
        // Crear nuevo funcionario
        func = {
            rut,
            nombre,
            tipoContrato,
            establecimiento,
            permisos: []
        };
        data.funcionarios.push(func);
    } else {
        // Actualizar datos del funcionario (por si cambiaron)
        func.nombre = nombre;
        func.tipoContrato = tipoContrato;
        func.establecimiento = establecimiento;
    }

    // Verificar superposición de fechas
    if (func.permisos && func.permisos.length > 0) {
        const hasOverlap = func.permisos.some(p => {
            if (p.id === permisoId) return false;
            // Usamos strings YYYY-MM-DD para evitar fallos por zonas horarias
            const pStart = (p.fechaInicio || '').split('T')[0];
            const pEnd = (p.fechaTermino || '').split('T')[0];
            return fechaInicio <= pEnd && pStart <= fechaTermino;
        });
        
        if (hasOverlap) {
            document.getElementById('mensaje').innerHTML = '<span style="color:red;">⚠️ El funcionario ya tiene un permiso registrado en las fechas solicitadas (no se permite más de un permiso por día).</span>';
            return;
        }
    }

    // Verificar límite de 6 días
    let usados = calcularDiasUsados(func);
    if (permisoId) {
        const pEdit = func.permisos.find(p => p.id === permisoId);
        if (pEdit) usados -= pEdit.dias;
    }

    if (usados + diasSolicitados > 6) {
        document.getElementById('mensaje').innerHTML = `<span style="color:red;">⚠️ Límite excedido: con este permiso se alcanzan ${Number((usados + diasSolicitados).toFixed(1))} días. Máximo 6 días.</span>`;
        return;
    }

    // Crear objeto permiso
    const permiso = {
        id: permisoId || genId(),
        fechaInicio,
        fechaTermino,
        tipoDia,
        motivo,
        acoge,
        desestima,
        director,
        dias: diasSolicitados,
        fechaSolicitud: new Date().toISOString()
    };
    
    if (permisoId) {
        const index = func.permisos.findIndex(p => p.id === permisoId);
        if (index !== -1) func.permisos[index] = permiso;
        else func.permisos.push(permiso);
    } else {
        func.permisos.push(permiso);
    }

    // Backup local
    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(localCache));

    // Cola de sincronización (offline/online)
    addActionToQueue({ action: 'savePermiso', funcionario: func, permiso: permiso });

    const successMsg = `<span style="color:green;">✅ Permiso guardado. Días: ${Number(diasSolicitados.toFixed(1))}. Total usado: ${Number((usados + diasSolicitados).toFixed(1))} / 6.</span>`;

    window.lastSavedPermiso = { rut: func.rut, id: permiso.id };

    // Limpiar formulario automáticamente para un nuevo ingreso
    document.getElementById('btnLimpiarForm').click();
    // Restaurar mensaje de éxito porque el limpiado lo borra
    document.getElementById('mensaje').innerHTML = successMsg;

    renderizarReporte();
    refrescarListadoFuncionarios();

    // Intentar sincronizar en segundo plano
    syncQueue();
}

// ====================================================================
//  RENDERIZAR REPORTE
// ====================================================================

function refrescarReporte() {
    loadDataFromGoogle().then(() => {
        renderizarReporte();
    });
}

function renderizarReporte() {
    const data = getData();
    const container = document.getElementById('reporteContenido');
    const filtroInput = document.getElementById('filtroReporte');
    const textoFiltro = filtroInput ? filtroInput.value.toLowerCase().trim() : '';

    if (data.funcionarios.length === 0) {
        container.innerHTML = '<p class="text-center" style="color:#7f8c8d;">No hay funcionarios registrados.</p>';
        return;
    }

    let funcionariosFiltrados = data.funcionarios;
    if (textoFiltro) {
        funcionariosFiltrados = funcionariosFiltrados.filter(f =>
            (f.rut && f.rut.toLowerCase().includes(textoFiltro)) ||
            (f.nombre && f.nombre.toLowerCase().includes(textoFiltro))
        );
    }

    if (funcionariosFiltrados.length === 0) {
        container.innerHTML = '<p class="text-center" style="color:#7f8c8d;">No se encontraron resultados para la búsqueda.</p>';
        return;
    }

    let html = '';
    funcionariosFiltrados.forEach(f => {
        const usados = calcularDiasUsados(f);
        const restante = Math.max(0, 6 - usados);
        const porcentaje = Math.min(100, (usados / 6) * 100);
        let barClass = 'fill';
        if (porcentaje > 80) barClass += ' danger';
        else if (porcentaje > 60) barClass += ' warning';

        html += `<div class="resumen-funcionario">
            <div class="item"><strong>${f.rut}</strong></div>
            <div class="item"><strong>${f.nombre}</strong></div>
            <div class="item">Días usados: <strong>${Number(usados.toFixed(1))}</strong> / 6</div>
            <div class="item">Restantes: <strong>${Number(restante.toFixed(1))}</strong></div>
            <div class="progreso">
                <div class="progreso-bar"><div class="${barClass}" style="width:${porcentaje}%;"></div></div>
            </div>
            <button class="btn btn-sm btn-primary ver-permiso no-print" data-rut="${f.rut}" style="padding:4px 12px; font-size:13px;">Ver permisos</button>
        </div>`;

        // Tabla de permisos de este funcionario
        if (f.permisos && f.permisos.length > 0) {
            html += `<div class="table-wrap" id="tabla-permisos-${f.rut}" style="margin:0 0 20px 0; display:none;">
                <table>
                    <thead><tr><th>Desde</th><th>Hasta</th><th>Tipo</th><th>Días</th><th>Motivo</th><th>Estado</th><th class="no-print">Acción</th></tr></thead>
                    <tbody>`;
            f.permisos.forEach(p => {
                const estado = p.acoge ? 'Acogido' : (p.desestima ? 'Desestimado' : 'Pendiente');
                const badge = p.acoge ? 'badge-success' : (p.desestima ? 'badge-danger' : 'badge-warning');
                html += `<tr>
                    <td>${formatearFechaDisplay(p.fechaInicio)}</td>
                    <td>${formatearFechaDisplay(p.fechaTermino)}</td>
                    <td>${p.tipoDia === 'completo' ? 'Completo' : (p.tipoDia === 'medio_manana' ? 'Medio Dia 0.5 Mañana' : (p.tipoDia === 'medio_tarde' ? 'Medio Dia 0.5 Tarde' : '0.5'))}</td>
                    <td>${Number(p.dias.toFixed(1))}</td>
                    <td>${p.motivo.substring(0, 30)}${p.motivo.length>30?'…':''}</td>
                    <td><span class="badge ${badge}">${estado}</span></td>
                    <td class="no-print" style="display:flex; gap:5px;">
                        <button class="btn btn-sm ver-documento" data-rut="${f.rut}" data-id="${p.id}" style="background-color: #3b82f6; color: white; padding:4px 8px; font-size:12px; border:none; box-shadow: 0 2px 4px rgba(59,130,246,0.3);">📄 Ver</button>
                        <button class="btn btn-sm editar-permiso" data-rut="${f.rut}" data-id="${p.id}" style="background-color: #f59e0b; color: white; padding:4px 8px; font-size:12px; border:none; box-shadow: 0 2px 4px rgba(245,158,11,0.3);">✏️ Editar</button>
                        <button class="btn btn-sm eliminar-permiso" data-rut="${f.rut}" data-id="${p.id}" style="background-color: #ef4444; color: white; padding:4px 8px; font-size:12px; border:none; box-shadow: 0 2px 4px rgba(239,68,68,0.3);">🗑️ Eliminar</button>
                    </td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        } else {
            html += `<p id="tabla-permisos-${f.rut}" style="margin-left:20px; color:#7f8c8d; display:none;">Sin permisos registrados.</p>`;
        }
    });

    container.innerHTML = html;

    // Event listeners para botones "Ver permisos" y "Ver Doc"
    container.querySelectorAll('.ver-permiso').forEach(btn => {
        btn.addEventListener('click', function() {
            const rut = this.dataset.rut;
            const tabla = document.getElementById(`tabla-permisos-${rut}`);
            if (tabla) {
                if (tabla.style.display === 'none') {
                    tabla.style.display = 'block';
                    this.innerText = 'Ocultar permisos';
                    this.classList.remove('btn-primary');
                    this.classList.add('btn-secondary');
                } else {
                    tabla.style.display = 'none';
                    this.innerText = 'Ver permisos';
                    this.classList.remove('btn-secondary');
                    this.classList.add('btn-primary');
                }
            }
        });
    });

    container.querySelectorAll('.ver-documento').forEach(btn => {
        btn.addEventListener('click', function() {
            const rut = this.dataset.rut;
            const id = this.dataset.id;
            mostrarDocumento(rut, id);
        });
    });

    container.querySelectorAll('.editar-permiso').forEach(btn => {
        btn.addEventListener('click', function() {
            const rut = this.dataset.rut;
            const id = this.dataset.id;
            editarPermiso(rut, id);
        });
    });

    container.querySelectorAll('.eliminar-permiso').forEach(btn => {
        btn.addEventListener('click', function() {
            const rut = this.dataset.rut;
            const id = this.dataset.id;
            eliminarPermiso(rut, id);
        });
    });
}

window.editarPermiso = function(rut, id) {
    const data = getData();
    const func = findFuncionario(data, rut);
    if (func && func.permisos) {
        const p = func.permisos.find(x => x.id === id);
        if (p) {
            document.getElementById('rut').value = func.rut;
            document.getElementById('nombre').value = func.nombre;
            document.getElementById('tipoContrato').value = func.tipoContrato || 'CONTRATO TITULAR';
            document.getElementById('establecimiento').value = func.establecimiento || 'LICEO SIMON BOLIVAR';
            
            document.getElementById('fechaInicio').value = p.fechaInicio.split('T')[0];
            document.getElementById('fechaTermino').value = p.fechaTermino.split('T')[0];
            document.getElementById('tipoDia').value = p.tipoDia || 'completo';
            document.getElementById('motivo').value = p.motivo || '';
            document.getElementById('acoge').checked = !!p.acoge;
            document.getElementById('desestima').checked = !!p.desestima;
            
            if (p.director) document.getElementById('director').value = p.director;
            
            const permisoIdInput = document.getElementById('permisoId');
            if (permisoIdInput) permisoIdInput.value = p.id;
            
            actualizarVistaFormulario();
            
            // Switch to tab 1
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="tab-ingreso"]').classList.add('active');
            document.getElementById('tab-ingreso').classList.add('active');
            window.scrollTo(0, 0);
            
            document.getElementById('mensaje').innerHTML = '<span style="color:blue;">ℹ️ Editando permiso. Al guardar, se actualizará el registro.</span>';
        }
    }
}

window.eliminarPermiso = function(rut, id) {
    mostrarConfirmacion(`¿Estás seguro de eliminar este permiso?`, () => {
        const data = getData();
        let func = findFuncionario(data, rut);
        if (func && func.permisos) {
            func.permisos = func.permisos.filter(p => p.id !== id);
            localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(localCache));
            
            // Send action to server
            addActionToQueue({ action: 'deletePermiso', rut: rut, id: id });
            // Fallback: also re-save func in case server just replaces it entirely
            addActionToQueue({ action: 'saveFuncionario', funcionario: func });
            
            renderizarReporte();
            refrescarListadoFuncionarios();
            syncQueue();
            
            mostrarAlerta("✅ Permiso eliminado correctamente.");
        }
    });
}

// ====================================================================
//  MOSTRAR DOCUMENTO (vista previa)
// ====================================================================

function generarHtmlDocumento(datos) {
    const acogeVal = datos.acoge ? '   X   ' : '';
    const desestimaVal = datos.desestima ? '   X   ' : '';
    const diasStr = datos.dias;

    return `
    <div style="font-family: Arial, sans-serif; font-size: 15px; max-width: 800px; margin: 0 auto; color: #000; padding: 10px 30px; background: #fff; box-sizing: border-box;">

        <!-- Header text -->
        <div style="font-weight: bold; font-size: 13px; line-height: 1.2;">
            CORPORACIÓN MUNICIPAL DE SERVICIOS<br>
            PUBLICOS TRASPASADOS DE RANCAGUA<br>
            DEPARTAMENTO DE RECURSOS HUMANOS<br>
            <div style="padding-left: 40px; font-weight: normal; font-size: 12px; margin-top: 2px;">www.cormun.cl</div>
        </div>

        <!-- Title -->
        <div style="text-align: center; font-weight: bold; font-size: 18px; margin-top: 15px; margin-bottom: 15px;">
            SOLICITUD DE PERMISO ADMINISTRATIVO
        </div>

        <!-- Right side info -->
        <div style="margin-left: 40%; margin-bottom: 15px; font-size: 15px;">
            <table style="border-collapse: collapse; line-height: 1.8; margin-bottom: 5px;">
                <tr>
                    <td style="text-align: right; font-weight: bold; padding-right: 10px; white-space: nowrap;">Orden N° :</td>
                    <td style="white-space: nowrap;">${datos.orden}</td>
                </tr>
                <tr>
                    <td style="text-align: right; font-weight: bold; padding-right: 10px; white-space: nowrap;">Materia :</td>
                    <td style="white-space: nowrap;">${datos.materia}</td>
                </tr>
            </table>
            <div style="margin-left: 20px;">RANCAGUA, ${datos.fechaEmisionStr}</div>
        </div>

        <!-- DE / A -->
        <div style="margin-bottom: 20px; font-size: 15px; line-height: 1.8;">
            <div><span style="font-weight: bold; display: inline-block; width: 40px; text-align: right; margin-right: 10px;">DE :</span> ${datos.de.toUpperCase()}</div>
            <div><span style="font-weight: bold; display: inline-block; width: 40px; text-align: right; margin-right: 10px;">A :</span> ${datos.a.toUpperCase()}</div>
        </div>

        <!-- Intro text -->
        <div style="text-align: right; margin-bottom: 15px; font-size: 15px;">
            Adjunto remito a Usted, Permiso Goce de Remuneraciones
        </div>

        <!-- Details -->
        <div style="margin-bottom: 25px; font-size: 15px; line-height: 1.6;">
            <div>De Don (ña) <strong style="margin-left: 10px;">${datos.nombre.toUpperCase()}</strong></div>
            <div>Por el período del <strong>${datos.fechaInicioFmt}</strong> al <strong>${datos.fechaTerminoFmt}</strong> por <strong>${diasStr}</strong> días ( <strong>${datos.tipoDiaStr}</strong> )</div>
            <div>Tipo Contrato: <strong style="margin-left: 10px;">${datos.tipoContrato.toUpperCase()}</strong></div>
            <div>Motivo Permiso: <strong style="margin-left: 10px;">${datos.motivo.toUpperCase()}</strong></div>
        </div>

        <!-- Applicant Signature -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">
            <div style="text-align: center; width: 350px;">
                <div style="border-top: 1px solid #000; padding-top: 5px;">
                    <strong>${datos.nombre === '________________________' || !datos.nombre ? '&nbsp;' : datos.nombre.toUpperCase()}</strong>
                </div>
            </div>
        </div>

        <!-- Bottom section: Informe Jefe and Director -->
        <div style="margin-bottom: 70px; font-size: 15px; line-height: 1.8;">
            <div style="font-weight: bold; text-decoration: underline; margin-bottom: 15px;">INFORME JEFE DIRECTO</div>
            <div style="margin-bottom: 15px; display: flex; align-items: flex-end;">
                <span style="width: 100px;">ACOGE:</span>
                <span style="display: inline-block; width: 180px; border-bottom: 1px solid #000; text-align: center; font-family: cursive; font-size: 18px; line-height: 1;">${acogeVal}</span>
            </div>
            <div style="display: flex; align-items: flex-end; margin-bottom: 25px;">
                <span style="width: 100px;">DESESTIMA:</span>
                <span style="display: inline-block; width: 180px; border-bottom: 1px solid #000; text-align: center; font-family: cursive; font-size: 18px; line-height: 1;">${desestimaVal}</span>
            </div>
            <div>
                Sin otro particular, saluda atentamente a Ud.
            </div>
        </div>

        <!-- Director Signature -->
        <div style="display: flex; justify-content: flex-end; font-size: 15px; margin-bottom: 10px;">
            <div style="width: 50%; text-align: center;">
                <div style="border-top: 1px solid #000; padding-top: 5px;">
                    <strong style="white-space: nowrap;">${datos.director === '________________________' || !datos.director ? '&nbsp;' : datos.director.toUpperCase()}</strong><br>
                    DIRECTOR(A)
                </div>
            </div>
        </div>
    </div>
    `;
}


function generarVistaPreviaFormulario() {
    const nombre = document.getElementById('nombre').value.trim() || '________________________';
    const de = document.getElementById('establecimiento').value.trim() || '________________________';
    const a = 'JEFE DEPARTAMENTO DE PERSONAL, CORPORACION MUNICIPAL.';
    
    const permisoIdInput = document.getElementById('permisoId');
    const orden = calcularOrdenPermiso(permisoIdInput ? permisoIdInput.value : null);
    
    const materia = 'Permiso Con Goce Remuneraciones';
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaTermino = document.getElementById('fechaTermino').value;
    const tipoDia = document.getElementById('tipoDia').value;
    const tipoContrato = document.getElementById('tipoContrato').value || '________________________';
    const motivo = document.getElementById('motivo').value.trim() || '________________________';
    const director = document.getElementById('director').value.trim() || 'HERRERA CONTRERAS MARIBEL MILDRETT';
    const acoge = document.getElementById('acoge').checked;
    const desestima = document.getElementById('desestima').checked;

    let dias = 0;
    if (fechaInicio && fechaTermino) {
        const habiles = diasHabiles(fechaInicio, fechaTermino);
        const factor = tipoDia === 'completo' ? 1 : 0.5;
        dias = habiles * factor;
    }

    function fmtDate(dateStr) {
        return formatearFechaDisplay(dateStr) || '___/___/_____';
    }

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const hoy = new Date();
    const fechaEmisionStr = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

    const tipoDiaStr = tipoDia === 'completo' ? 'DÍA COMPLETO' : (tipoDia === 'medio_manana' ? 'MEDIO DIA 0.5 MAÑANA' : (tipoDia === 'medio_tarde' ? 'MEDIO DIA 0.5 TARDE' : '0.5'));

    const html = generarHtmlDocumento({
        nombre, de, a, orden, materia, fechaInicioFmt: fmtDate(fechaInicio), fechaTerminoFmt: fmtDate(fechaTermino),
        dias, tipoContrato, motivo, director, acoge, desestima, fechaEmisionStr, tipoDiaStr
    });

    document.getElementById('documento-preview').innerHTML = html;
}

function mostrarDocumento(rut, permisoId) {
    const data = getData();
    const func = findFuncionario(data, rut);
    if (!func) return;
    const permiso = func.permisos.find(p => p.id === permisoId);
    if (!permiso) return;

    // Construir el documento igual al adjunto
    const nombre = func.nombre || '________________________';
    const de = func.establecimiento || '________________________';
    const a = 'JEFE DEPARTAMENTO DE PERSONAL, CORPORACION MUNICIPAL.';
    const orden = calcularOrdenPermiso(permisoId);
    const materia = 'Permiso Con Goce Remuneraciones';
    const fechaInicio = permiso.fechaInicio;
    const fechaTermino = permiso.fechaTermino;
    const dias = Number(permiso.dias.toFixed(1));
    const tipoContrato = func.tipoContrato || '________________________';
    const motivo = permiso.motivo || '________________________';
    const director = permiso.director || 'HERRERA CONTRERAS MARIBEL MILDRETT';

    // formatear fechas para mostrar
    function fmtDate(dateStr) {
        return formatearFechaDisplay(dateStr);
    }

    // Formatear fecha actual como "14 de Julio de 2026"
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const hoy = new Date();
    const fechaEmisionStr = `${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`;

    const tipoDiaStr = permiso.tipoDia === 'completo' ? 'DÍA COMPLETO' : (permiso.tipoDia === 'medio_manana' ? 'MEDIO DIA 0.5 MAÑANA' : (permiso.tipoDia === 'medio_tarde' ? 'MEDIO DIA 0.5 TARDE' : '0.5'));

    const html = generarHtmlDocumento({
        nombre, de, a, orden, materia, fechaInicioFmt: fmtDate(fechaInicio), fechaTerminoFmt: fmtDate(fechaTermino),
        dias, tipoContrato, motivo, director, acoge: permiso.acoge, desestima: permiso.desestima, fechaEmisionStr, tipoDiaStr
    });

    const preview = document.getElementById('documento-preview');
    preview.innerHTML = html;
    // Cambiar a la pestaña de documento
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-tab="tab-documento"]').classList.add('active');
    document.getElementById('tab-documento').classList.add('active');
    // Hacer scroll al documento
    preview.scrollIntoView({ behavior: 'smooth' });
}

// ====================================================================
//  LISTADO DE FUNCIONARIOS
// ====================================================================

function refrescarListadoFuncionarios() {
    const data = getData();
    const container = document.getElementById('listadoFuncionarios');
    const filtroInput = document.getElementById('filtroFuncionarios');
    const textoFiltro = filtroInput ? filtroInput.value.toLowerCase().trim() : '';

    if (data.funcionarios.length === 0) {
        container.innerHTML = '<p class="text-center" style="color:#7f8c8d;">No hay funcionarios registrados.</p>';
        return;
    }

    let funcionariosFiltrados = data.funcionarios;
    if (textoFiltro) {
        funcionariosFiltrados = funcionariosFiltrados.filter(f =>
            (f.rut && f.rut.toLowerCase().includes(textoFiltro)) ||
            (f.nombre && f.nombre.toLowerCase().includes(textoFiltro))
        );
    }

    if (funcionariosFiltrados.length === 0) {
        container.innerHTML = '<p class="text-center" style="color:#7f8c8d;">No se encontraron resultados para la búsqueda.</p>';
        return;
    }

    let html = `<div class="table-wrap"><table id="tablaFuncionarios" class="${bulkDeleteMode ? 'bulk-delete-mode' : ''}">
        <thead><tr><th class="checkbox-cell"><input type="checkbox" id="chkAllBulk" onchange="toggleAllBulk(this)"></th><th>RUT</th><th>Nombre</th><th>Contrato</th><th>Establecimiento</th><th>Permisos</th><th>Días usados</th><th>Acciones</th></tr></thead><tbody>`;
    funcionariosFiltrados.forEach(f => {
        const count = f.permisos ? f.permisos.length : 0;
        const usados = calcularDiasUsados(f);
        html += `<tr>
            <td class="checkbox-cell"><input type="checkbox" class="chk-bulk chk-func" value="${f.rut}"></td>
            <td>${f.rut}</td>
            <td>${f.nombre}</td>
            <td>${f.tipoContrato}</td>
            <td>${f.establecimiento || '-'}</td>
            <td>${count}</td>
            <td>${Number(usados.toFixed(1))} / 6</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editarFuncionarioMantenedor('${f.rut}')" style="padding:4px 8px; font-size:12px; margin-right:4px;" ${bulkDeleteMode ? 'disabled' : ''}>✏️</button>
                <button class="btn btn-sm btn-danger" onclick="eliminarFuncionarioMantenedor('${f.rut}')" style="padding:4px 8px; font-size:12px;" ${bulkDeleteMode ? 'disabled' : ''}>🗑️</button>
            </td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;

    const contador = document.getElementById('contadorFuncionarios');
    if (contador) {
        if (textoFiltro) {
            contador.innerText = `Mostrando ${funcionariosFiltrados.length} de ${data.funcionarios.length} funcionarios.`;
        } else {
            contador.innerText = `Total de funcionarios en el sistema: ${data.funcionarios.length}`;
        }
    }
}

window.toggleAllBulk = function(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.chk-func');
    checkboxes.forEach(chk => chk.checked = masterCheckbox.checked);
}

// ====================================================================
//  ELIMINAR TODOS LOS DATOS
// ====================================================================

window.solicitarBorrado = function(tipo) {
    let mensaje = "";
    const textoPalabraClave = "\n\nPara confirmar, escriba la palabra clave BORRAR en mayúsculas en el recuadro de abajo.";

    if (tipo === 'funcionarios') {
        mensaje = "¿Está seguro de eliminar TODOS los funcionarios? Esta acción borrará el listado localmente y en el servidor. Los registros de permisos históricos se mantendrán en el servidor de base de datos como respaldo." + textoPalabraClave;
    } else if (tipo === 'permisos') {
        mensaje = "¿Está seguro de reiniciar a cero TODOS los permisos? Esto limpiará el historial de todos los funcionarios tanto en la web como en la base de datos (hoja 'datos')." + textoPalabraClave;
    } else if (tipo === 'todo') {
        mensaje = "¡ADVERTENCIA CRÍTICA! Está a punto de destruir toda la base de datos (funcionarios y permisos) de forma permanente." + textoPalabraClave;
    }

    mostrarPromptSeguridad(mensaje, () => {
        ejecutarBorrado(tipo);
    });
}

function ejecutarBorrado(tipo) {
    mostrarLoading("Procesando borrado en la base de datos...");

    let actionString = "";
    if (tipo === 'funcionarios') {
        actionString = "deleteAllFuncionariosOnly";
    } else if (tipo === 'permisos') {
        actionString = "deleteAllPermisosOnly";
    } else if (tipo === 'todo') {
        actionString = "deleteAll";
    }

    executeActionInGoogle(actionString).then(() => {
        if (tipo === 'funcionarios' || tipo === 'todo') {
            localCache = { funcionarios: [] };
        } else if (tipo === 'permisos') {
            localCache.funcionarios.forEach(f => f.permisos = []);
        }

        localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(localCache));
        renderizarReporte();
        refrescarListadoFuncionarios();
        document.getElementById('mensaje').innerHTML = '<span style="color:green;">✅ Proceso de borrado completado.</span>';
        actualizarVistaFormulario();
        ocultarLoading();
        mostrarAlerta("✅ La base de datos ha sido actualizada exitosamente.");
    });
}

// ====================================================================
//  MANTENEDOR DE FUNCIONARIOS
// ====================================================================

function validarRutChileno(rutCompleto) {
    if (!/^[0-9]+-[0-9kK]{1}$/.test(rutCompleto)) return false;
    let tmp = rutCompleto.split('-');
    let digv = tmp[1].toUpperCase();
    let rut = tmp[0];
    if (digv == 'K') digv = 'k';
    let M = 0, S = 1;
    for (; rut; rut = Math.floor(rut / 10))
        S = (S + rut % 10 * (9 - M++ % 6)) % 11;
    return (S ? S - 1 : 'k').toString().toUpperCase() === digv.toUpperCase();
}

function formatearRut(rut) {
    let valor = rut.replace(/[^0-9kK]/ig, '').toUpperCase();
    if (valor.length <= 1) return valor;
    let cuerpo = valor.slice(0, -1);
    let dv = valor.slice(-1);
    return `${cuerpo}-${dv}`;
}

function guardarFuncionarioMantenedor() {
    let rutInput = document.getElementById('mantRut');
    let rut = rutInput.value.trim();

    // Auto-formatear y limpiar
    rut = formatearRut(rut);
    rutInput.value = rut;

    const nombre = document.getElementById('mantNombre').value.trim();
    const tipoContrato = document.getElementById('mantContrato').value;
    const establecimiento = document.getElementById('mantEstablecimiento').value.trim();

    if (!rut || !nombre) {
        mostrarAlerta("El RUT y Nombre son obligatorios.");
        return;
    }

    if (!validarRutChileno(rut)) {
        mostrarAlerta("El RUT ingresado es inválido o tiene un formato incorrecto.\nDebe escribirse sin puntos y con guion (Ej: 12345678-9).");
        return;
    }

    const isNew = !rutInput.disabled;
    const data = getData();

    if (isNew) {
        if (findFuncionario(data, rut)) {
            mostrarAlerta("Este RUT ya se encuentra registrado en el sistema. No puede estar duplicado.");
            return;
        }
    }

    let func = findFuncionario(data, rut);
    if (!func) {
        func = { rut, nombre, tipoContrato, establecimiento, permisos: [] };
        data.funcionarios.push(func);
    } else {
        func.nombre = nombre;
        func.tipoContrato = tipoContrato;
        func.establecimiento = establecimiento;
    }

    localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(localCache));
    addActionToQueue({ action: 'saveFuncionario', funcionario: func });

    document.getElementById('mantRut').value = '';
    document.getElementById('mantNombre').value = '';
    document.getElementById('form-funcionario-container').style.display = 'none';

    refrescarListadoFuncionarios();
    syncQueue();
}

window.editarFuncionarioMantenedor = function(rut) {
    const data = getData();
    const func = findFuncionario(data, rut);
    if(func) {
        document.getElementById('mantRut').value = func.rut;
        document.getElementById('mantRut').disabled = true; // No permitir cambiar RUT en edición
        document.getElementById('mantNombre').value = func.nombre;
        document.getElementById('mantContrato').value = func.tipoContrato || 'CONTRATO TITULAR';
        document.getElementById('mantEstablecimiento').value = func.establecimiento || 'LICEO SIMON BOLIVAR';
        document.getElementById('form-funcionario-container').style.display = 'grid';
        document.getElementById('mantNombre').scrollIntoView({ behavior: 'smooth' });
        document.getElementById('mantNombre').focus();
    }
}

window.eliminarFuncionarioMantenedor = function(rut) {
    mostrarConfirmacion(`¿Estás seguro de eliminar el funcionario con RUT ${rut}? Esta acción borrará también todos sus permisos (cascada).`, () => {
        const data = getData();
        const index = data.funcionarios.findIndex(f => f.rut === rut);
        if (index > -1) {
            data.funcionarios.splice(index, 1);
            localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(localCache));
            addActionToQueue({ action: 'deleteFuncionario', rut: rut });
            refrescarListadoFuncionarios();
            renderizarReporte();
            syncQueue();
        }
    });
}

// ====================================================================
//  IMPORTACIÓN EXCEL Y BORRADO MASIVO
// ====================================================================

function descargarPlantillaExcel() {
    const ws_data = [
        ["RUT", "Nombre", "Tipo Contrato", "Establecimiento"],
        ["12345678-9", "Juan Perez", "CONTRATO TITULAR", "LICEO SIMON BOLIVAR"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Funcionarios");
    XLSX.writeFile(wb, "Plantilla_Importar_Funcionarios.xlsx");
}

function manejarArchivoExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        const data = evt.target.result;
        let workbook;
        try {
            workbook = XLSX.read(data, {type: 'binary'});
        } catch(err) {
            mostrarAlerta("Error al leer el archivo. Asegúrate de que sea un archivo Excel o CSV válido.");
            return;
        }

        const first_sheet_name = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[first_sheet_name];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
            mostrarAlerta("El archivo está vacío.");
            return;
        }

        const dataDb = getData();
        let errores = [];
        let nuevosFuncionarios = [];
        let rutsExcel = new Set();

        for (let i = 0; i < json.length; i++) {
            const row = json[i];
            const filaReal = i + 2; // Fila 1 es cabecera
            let rut = String(row["RUT"] || '').trim();
            const nombre = String(row["Nombre"] || '').trim();
            const contrato = String(row["Tipo Contrato"] || 'CONTRATO TITULAR').trim();
            const estab = String(row["Establecimiento"] || 'LICEO SIMON BOLIVAR').trim();

            if (!rut || !nombre) {
                errores.push(`Fila ${filaReal}: Falta RUT o Nombre.`);
                continue;
            }

            rut = formatearRut(rut);

            if (!validarRutChileno(rut)) {
                errores.push(`Fila ${filaReal}: El RUT ${rut} es inválido o su formato es incorrecto.`);
                continue;
            }

            if (rutsExcel.has(rut)) {
                errores.push(`Fila ${filaReal}: El RUT ${rut} está duplicado dentro de este mismo Excel.`);
                continue;
            }
            rutsExcel.add(rut);

            if (findFuncionario(dataDb, rut)) {
                errores.push(`Fila ${filaReal}: El RUT ${rut} ya existe en el sistema actual.`);
                continue;
            }

            nuevosFuncionarios.push({
                rut: rut,
                nombre: nombre,
                tipoContrato: contrato,
                establecimiento: estab,
                permisos: []
            });
        }

        if (errores.length > 0) {
            mostrarAlerta("Importación cancelada. Se encontraron los siguientes errores en tu archivo:\n\n" + errores.slice(0, 10).join("\n") + (errores.length > 10 ? "\n...y más errores." : ""));
            document.getElementById('inputExcel').value = '';
            return;
        }

        // Si todo está correcto
        nuevosFuncionarios.forEach(f => {
            dataDb.funcionarios.push(f);
            addActionToQueue({ action: 'saveFuncionario', funcionario: f });
        });

        localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(localCache));
        refrescarListadoFuncionarios();
        syncQueue();

        cerrarModalImportar();
        mostrarAlerta(`✅ Se han importado correctamente ${nuevosFuncionarios.length} funcionarios nuevos.`);
        document.getElementById('inputExcel').value = '';
    };
    reader.readAsBinaryString(file);
}

function toggleModoBorradoMasivo() {
    bulkDeleteMode = !bulkDeleteMode;
    const btnBorrar = document.getElementById('btnSeleccionarBorrar');
    const btnNuevo = document.getElementById('btnNuevoFuncionario');
    const btnImportar = document.getElementById('btnImportarExcelBtn');
    const btnCancelar = document.getElementById('btnCancelarBorrarMasivo');

    if (bulkDeleteMode) {
        btnBorrar.innerHTML = '🗑️ Confirmar Eliminación';
        btnBorrar.style.background = '#b91c1c'; // darker red
        if(btnNuevo) btnNuevo.style.display = 'none';
        if(btnImportar) btnImportar.style.display = 'none';
        if(btnCancelar) btnCancelar.style.display = 'inline-flex';
        mostrarAlerta("ℹ️ Modo Eliminación Activado.\nSelecciona las casillas de los funcionarios que deseas eliminar de la tabla y luego haz clic en 'Confirmar Eliminación'.");
    } else {
        btnBorrar.innerHTML = '🗑️ Seleccionar para Eliminar';
        btnBorrar.style.background = 'var(--danger)';
        if(btnNuevo) btnNuevo.style.display = 'inline-flex';
        if(btnImportar) btnImportar.style.display = 'inline-flex';
        if(btnCancelar) btnCancelar.style.display = 'none';
    }
    refrescarListadoFuncionarios();
}

function ejecutarBorradoMasivo() {
    const checkboxes = document.querySelectorAll('.chk-func:checked');
    if (checkboxes.length === 0) {
        toggleModoBorradoMasivo(); // Cancelar modo
        return;
    }

    mostrarConfirmacion(`¿Estás TOTALMENTE seguro de eliminar los ${checkboxes.length} funcionarios seleccionados?\nEsta acción eliminará todos sus permisos asociados y NO se puede deshacer.`, () => {
        const data = getData();
        let eliminadosCount = 0;

        checkboxes.forEach(chk => {
            const rut = chk.value;
            const index = data.funcionarios.findIndex(f => f.rut === rut);
            if (index > -1) {
                data.funcionarios.splice(index, 1);
                addActionToQueue({ action: 'deleteFuncionario', rut: rut });
                eliminadosCount++;
            }
        });

        localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(localCache));
        refrescarListadoFuncionarios();
        renderizarReporte();
        syncQueue();

        bulkDeleteMode = false;
        toggleModoBorradoMasivo(); // Restaurar botones
        toggleModoBorradoMasivo(); // Hack para apagarlo correctamente
        bulkDeleteMode = false;
        const btnBorrar = document.getElementById('btnSeleccionarBorrar');
        btnBorrar.innerHTML = '🗑️ Seleccionar para Eliminar';
        btnBorrar.style.background = 'var(--danger)';
        if(document.getElementById('btnNuevoFuncionario')) document.getElementById('btnNuevoFuncionario').style.display = 'inline-flex';
        if(document.getElementById('btnImportarExcelBtn')) document.getElementById('btnImportarExcelBtn').style.display = 'inline-flex';
        if(document.getElementById('btnCancelarBorrarMasivo')) document.getElementById('btnCancelarBorrarMasivo').style.display = 'none';
        refrescarListadoFuncionarios();

        mostrarAlerta(`✅ Se han eliminado ${eliminadosCount} funcionarios correctamente.`);
    });
}

// ====================================================================
//  EVENTOS Y INICIALIZACIÓN
// ====================================================================

document.addEventListener('DOMContentLoaded', function() {
    // Pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            this.classList.add('active');
            const tabId = this.dataset.tab;
            document.getElementById(tabId).classList.add('active');

            if (tabId === 'tab-documento') {
                const rutVal = document.getElementById('rut').value.trim();
                const nombreVal = document.getElementById('nombre').value.trim();
                if (rutVal || nombreVal) {
                    generarVistaPreviaFormulario();
                } else if (window.lastSavedPermiso) {
                    mostrarDocumento(window.lastSavedPermiso.rut, window.lastSavedPermiso.id);
                }
            }
        });
    });

    // Cargar funcionario
    document.getElementById('btnCargarFuncionario').addEventListener('click', function() {
        let rutInput = document.getElementById('rut');
        let rut = rutInput.value.trim();
        if (!rut) { mostrarAlerta('Ingrese un RUT por favor.'); return; }
        
        rut = formatearRut(rut);
        rutInput.value = rut;

        if (!validarRutChileno(rut)) {
            mostrarAlerta("El RUT ingresado es inválido o tiene un formato incorrecto.\nDebe escribirse sin puntos y con guion (Ej: 12345678-9).");
            return;
        }

        const ok = cargarFuncionario(rut);
        if (!ok) {
            mostrarAlerta('RUT no encontrado. Puede ingresar los datos manualmente en el formulario.');
        }
        actualizarVistaFormulario();
    });

    // Calcular días
    document.getElementById('btnCalcularDias').addEventListener('click', actualizarVistaFormulario);

    // Al cambiar fechas o tipo día, recalcular automáticamente
    document.getElementById('fechaInicio').addEventListener('change', actualizarVistaFormulario);
    document.getElementById('fechaTermino').addEventListener('change', actualizarVistaFormulario);
    document.getElementById('tipoDia').addEventListener('change', actualizarVistaFormulario);

    // Guardar permiso
    document.getElementById('btnGuardarPermiso').addEventListener('click', guardarPermiso);

    // Limpiar formulario
    document.getElementById('btnLimpiarForm').addEventListener('click', function() {
        document.getElementById('rut').value = '';
        document.getElementById('nombre').value = '';
        document.getElementById('tipoContrato').selectedIndex = 0;
        document.getElementById('establecimiento').value = 'LICEO SIMON BOLIVAR';
        document.getElementById('fechaInicio').value = '';
        document.getElementById('fechaTermino').value = '';
        document.getElementById('tipoDia').value = 'completo';
        document.getElementById('motivo').value = '';
        document.getElementById('acoge').checked = false;
        document.getElementById('desestima').checked = false;
        document.getElementById('director').value = 'HERRERA CONTRERAS MARIBEL MILDRETT';
        document.getElementById('diasCalculados').value = '';
        document.getElementById('diasUsados').value = '';
        document.getElementById('mensaje').innerHTML = '';
        const pid = document.getElementById('permisoId');
        if (pid) pid.value = '';
    });

    // Refrescar reporte
    document.getElementById('btnRefrescarReporte').addEventListener('click', refrescarReporte);

    // Imprimir reporte
    document.getElementById('btnImprimirReporte').addEventListener('click', function() {
        window.print();
    });

    // Imprimir documento
    document.getElementById('btnImprimirDocumento').addEventListener('click', function() {
        window.print();
    });

    // Exportar Reporte a PDF
    const btnExportarPdfReporte = document.getElementById('btnExportarPdfReporte');
    if (btnExportarPdfReporte) {
        btnExportarPdfReporte.addEventListener('click', function() {
            const elemento = document.getElementById('tab-reporte');
            window.scrollTo(0, 0); // Evitar bug de corte en html2canvas
            elemento.classList.add('exporting-pdf');
            
            // Ocultar temporalmente los elementos no-print y barras de progreso
            const noPrintElements = elemento.querySelectorAll('.no-print, .progreso, .progress-bar-container');
            noPrintElements.forEach(el => el.style.display = 'none');
            
            // Mostrar temporalmente los elementos print-only
            const printOnlyElements = elemento.querySelectorAll('.print-only');
            printOnlyElements.forEach(el => el.style.setProperty('display', 'flex', 'important'));

            const opciones = {
                margin:       10,
                filename:     'Reporte_Permisos_Funcionarios.pdf',
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opciones).from(elemento).save().then(() => {
                restaurarVista();
            }).catch(err => {
                console.error('Error al exportar PDF:', err);
                alert('Hubo un error al generar el PDF. Verifica la consola.');
                restaurarVista();
            });
            
            function restaurarVista() {
                elemento.classList.remove('exporting-pdf');
                noPrintElements.forEach(el => el.style.display = '');
                printOnlyElements.forEach(el => el.style.display = '');
            }
        });
    }

    // Exportar a PDF
    document.getElementById('btnExportarPdf').addEventListener('click', function() {
        const elemento = document.getElementById('documento-preview');
        const opciones = {
            margin:       10,
            filename:     'Permiso_Administrativo.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opciones).from(elemento).save();
    });

    // Cerrar documento (volver a pestaña de ingreso)
    document.getElementById('btnCerrarDocumento').addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-tab="tab-ingreso"]').classList.add('active');
        document.getElementById('tab-ingreso').classList.add('active');
    });

    // Mantenedor de Funcionarios UI
    const btnNuevo = document.getElementById('btnNuevoFuncionario');
    if(btnNuevo) {
        btnNuevo.addEventListener('click', function() {
            document.getElementById('mantRut').value = '';
            document.getElementById('mantRut').disabled = false; // Habilitar para nuevo
            document.getElementById('mantNombre').value = '';
            document.getElementById('mantContrato').selectedIndex = 0;
            document.getElementById('mantEstablecimiento').value = 'LICEO SIMON BOLIVAR';
            document.getElementById('form-funcionario-container').style.display = 'grid';
            document.getElementById('mantRut').focus();
        });
    }

    const btnCancelar = document.getElementById('btnCancelarMant');
    if(btnCancelar) {
        btnCancelar.addEventListener('click', function() {
            document.getElementById('form-funcionario-container').style.display = 'none';
        });
    }

    const btnGuardarMant = document.getElementById('btnGuardarMant');
    if(btnGuardarMant) {
        btnGuardarMant.addEventListener('click', guardarFuncionarioMantenedor);
    }

    // Botones de Excel y Borrado Masivo
    const btnDescargarPlantillaModal = document.getElementById('btnDescargarPlantillaModal');
    if (btnDescargarPlantillaModal) btnDescargarPlantillaModal.addEventListener('click', descargarPlantillaExcel);

    const btnImportarExcel = document.getElementById('btnImportarExcelBtn');
    const inputExcel = document.getElementById('inputExcel');
    if (btnImportarExcel) {
        btnImportarExcel.addEventListener('click', abrirModalImportar);
    }
    if (inputExcel) {
        inputExcel.addEventListener('change', manejarArchivoExcel);
    }

    // Drag and Drop para el Modal
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                inputExcel.files = e.dataTransfer.files;
                const event = new Event('change');
                inputExcel.dispatchEvent(event);
            }
        });
    }

    const btnSeleccionarBorrar = document.getElementById('btnSeleccionarBorrar');
    if (btnSeleccionarBorrar) {
        btnSeleccionarBorrar.addEventListener('click', function() {
            if (!bulkDeleteMode) {
                toggleModoBorradoMasivo();
            } else {
                ejecutarBorradoMasivo();
            }
        });
    }

    const btnCancelarBorrarMasivo = document.getElementById('btnCancelarBorrarMasivo');
    if (btnCancelarBorrarMasivo) {
        btnCancelarBorrarMasivo.addEventListener('click', function() {
            if (bulkDeleteMode) {
                toggleModoBorradoMasivo(); // Apaga el modo
            }
        });
    }

    // Función genérica para buscadores con botón limpiar
    function configurarBuscador(inputId, btnLimpiarId, callback) {
        const input = document.getElementById(inputId);
        const btnLimpiar = document.getElementById(btnLimpiarId);
        
        if (input && btnLimpiar) {
            input.addEventListener('input', () => {
                btnLimpiar.style.display = input.value.length > 0 ? 'inline-block' : 'none';
                callback();
            });
            
            btnLimpiar.addEventListener('click', () => {
                input.value = '';
                btnLimpiar.style.display = 'none';
                callback();
                input.focus();
            });
        }
    }

    // Buscador de funcionarios
    configurarBuscador('filtroFuncionarios', 'btnLimpiarFiltroFuncionarios', refrescarListadoFuncionarios);

    // Buscador de reporte
    configurarBuscador('filtroReporte', 'btnLimpiarFiltroReporte', renderizarReporte);

    // Checkboxes excluyentes para informe jefe directo
    document.getElementById('acoge').addEventListener('change', function() {
        if(this.checked) document.getElementById('desestima').checked = false;
    });
    document.getElementById('desestima').addEventListener('change', function() {
        if(this.checked) document.getElementById('acoge').checked = false;
    });

    // Eventos de conexión
    window.addEventListener('online', syncQueue);
    window.addEventListener('offline', () => updateConnectionStatus('offline'));

    // Inicializar vistas
    loadDataFromGoogle().then(() => {
        refrescarReporte();
        refrescarListadoFuncionarios();
        actualizarVistaFormulario();
    });

    // Mostrar endpoint configurado en el panel de DB
    const dbDisplay = document.getElementById('db-endpoint-display');
    if (dbDisplay) dbDisplay.innerText = WEB_APP_URL;

    // Wiring: Forzar sincronización desde la UI
    const btnForzar = document.getElementById('btnForzarSync');
    if (btnForzar) {
        btnForzar.addEventListener('click', async () => {
            mostrarLoading('Forzando sincronización...');
            try {
                await syncQueue();
                mostrarAlerta('✅ Sincronización forzada completada.');
            } catch (err) {
                console.error('Forzar sync error', err);
                mostrarAlerta('❌ Error al sincronizar: ' + (err && err.message ? err.message : String(err)));
            } finally {
                ocultarLoading();
            }
        });
    }

    // Ejemplo de precarga con datos de muestra (opcional)
    // Si no hay datos, agregar un ejemplo
    const data = getData();
    if (data.funcionarios.length === 0) {
        // Opcional: agregar un funcionario de ejemplo para demostración
        // Pero no lo hago para mantener limpio.
    }
});
