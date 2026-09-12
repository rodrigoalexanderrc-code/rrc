function cargarConfiguracion() {
    if (!window.configuracionGlobal) {
        window.configuracionGlobal = {
            riesgo_medio: 85,
            riesgo_critico: 75,
            semaforo_excelente: 95,
            semaforo_precaucion: 90,
            alerta_ausencias_consecutivas: 3,
            dias_grafico_tendencia: 5,
            anio_lectivo: "",
            fecha_inicio_uso: ""
        };
    }
    
    document.getElementById('configRiesgoCritico').value = window.configuracionGlobal.riesgo_critico;
    document.getElementById('configRiesgoMedio').value = window.configuracionGlobal.riesgo_medio;
    document.getElementById('configSemaforoExcelente').value = window.configuracionGlobal.semaforo_excelente;
    document.getElementById('configSemaforoPrecaucion').value = window.configuracionGlobal.semaforo_precaucion;
    document.getElementById('configAusenciasConsecutivas').value = window.configuracionGlobal.alerta_ausencias_consecutivas || 3;
    document.getElementById('configDiasTendencia').value = window.configuracionGlobal.dias_grafico_tendencia || 5;
    document.getElementById('configAnioLectivo').value = window.configuracionGlobal.anio_lectivo || "";
    
    const inputFechaInicio = document.getElementById('configFechaInicioUso');
    if(inputFechaInicio) {
        inputFechaInicio.value = window.configuracionGlobal.fecha_inicio_uso || "";
    }
}

async function guardarConfiguracion(event) {
    event.preventDefault();
    
    const riesgo_critico = parseInt(document.getElementById('configRiesgoCritico').value) || 75;
    const riesgo_medio = parseInt(document.getElementById('configRiesgoMedio').value) || 85;
    const semaforo_excelente = parseInt(document.getElementById('configSemaforoExcelente').value) || 95;
    const semaforo_precaucion = parseInt(document.getElementById('configSemaforoPrecaucion').value) || 90;
    const alerta_ausencias_consecutivas = parseInt(document.getElementById('configAusenciasConsecutivas').value) || 3;
    const dias_grafico_tendencia = parseInt(document.getElementById('configDiasTendencia').value) || 5;
    const anio_lectivo = document.getElementById('configAnioLectivo').value.trim();
    
    const inputFechaInicio = document.getElementById('configFechaInicioUso');
    const fecha_inicio_uso = inputFechaInicio ? inputFechaInicio.value.trim() : "";
    
    window.configuracionGlobal = {
        riesgo_critico,
        riesgo_medio,
        semaforo_excelente,
        semaforo_precaucion,
        alerta_ausencias_consecutivas,
        dias_grafico_tendencia,
        anio_lectivo,
        fecha_inicio_uso
    };
    
    if (typeof saveToLocalBackup === 'function') {
        saveToLocalBackup();
    }
    
    const payloadArray = [
        { id: 'riesgo_critico', valor: riesgo_critico },
        { id: 'riesgo_medio', valor: riesgo_medio },
        { id: 'semaforo_excelente', valor: semaforo_excelente },
        { id: 'semaforo_precaucion', valor: semaforo_precaucion },
        { id: 'alerta_ausencias_consecutivas', valor: alerta_ausencias_consecutivas },
        { id: 'dias_grafico_tendencia', valor: dias_grafico_tendencia },
        { id: 'anio_lectivo', valor: anio_lectivo },
        { id: 'fecha_inicio_uso', valor: fecha_inicio_uso }
    ];
    
    try {
        if (!navigator.onLine) {
            addToOfflineQueue('bulk_insert', 'Configuracion', payloadArray);
            showToast('Guardado localmente (Offline).', 'warning');
        } else {
            await apiCall('bulk_insert', 'Configuracion', payloadArray);
            showToast('Configuración guardada exitosamente.', 'success');
        }
    } catch (e) {
        console.error('Error saving configuracion:', e);
        showToast('Error al guardar configuración.', 'error');
    }
}
