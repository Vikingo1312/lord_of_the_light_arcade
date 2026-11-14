#!/bin/bash
cd "$(dirname "$0")"
echo "=========================================================="
echo "  KEANO ROMEO: LORD OF THE LIGHT — LIVE-PUSH AUF VERCEL"
echo "=========================================================="

if [ ! -d ".git" ]; then
    echo "Verbinde Ordner mit GitHub (Vikingo1312/lord_of_the_light_arcade)..."
    git init -b main
    git remote add origin https://github.com/Vikingo1312/lord_of_the_light_arcade.git
    git fetch --depth 1 origin main
    git reset --soft origin/main
fi

git pull --rebase origin main || true
git add -A
git commit -m "Update von Keano / Jayden ($(date '+%Y-%m-%d %H:%M'))" || echo "Keine neuen Datei-Änderungen zum Committen."
git push origin main

echo ""
echo "✅ FERTIG! In ca. 20 Sekunden ist dein Update live auf:"
echo "👉 https://lord-of-the-light-arcade.vercel.app/"
read -p "Drücke ENTER zum Schließen..."
