@echo off
title Actualizador de Informes SIMCE
echo Buscando Python...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro Python instalado en este equipo.
    echo Por favor, instala Python desde https://www.python.org/ o desde la Microsoft Store.
    pause
    exit /b
)

echo Ejecutando script de clasificacion...
python actualizar_informes.py
echo.
echo Proceso terminado.
pause
