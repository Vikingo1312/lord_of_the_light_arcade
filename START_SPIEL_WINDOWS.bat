@echo off
cd /d "%~dp0"
echo ==========================================================
echo   KEANO ROMEO: LORD OF THE LIGHT — LOKALER TEST-SERVER
echo   Alle 23 Charaktere sind im Local-Modus freigeschaltet!
echo   Oeffne im Browser: http://localhost:8081
echo ==========================================================
start "" "http://localhost:8081/?v=2.28"
python server.py
pause
