#!/bin/bash
cd "$(dirname "$0")"
echo "=========================================================="
echo "  KEANO ROMEO: LORD OF THE LIGHT — LOKALER TEST-SERVER"
echo "  Alle 23 Charaktere sind im Local-Modus freigeschaltet!"
echo "  Öffne im Browser: http://localhost:8081"
echo "=========================================================="
(sleep 1.2 && open "http://localhost:8081/?v=2.28") &
python3 server.py
