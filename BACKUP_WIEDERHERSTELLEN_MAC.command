#!/bin/bash
cd "$(dirname "$0")"
echo "=========================================================="
echo "  🛡️ LORD OF THE LIGHT — GOLD-BACKUP (v2.28) WIEDERHERSTELLEN"
echo "=========================================================="
echo "Setze das Spiel auf den gesicherten Original-Stand (v2.28-gold-backup) zurück..."

git fetch origin --tags
git fetch origin backup-v2.28-original
git checkout main || git checkout -b main
git reset --hard v2.28-gold-backup
git push --force origin main

echo ""
echo "✅ WIEDERHERSTELLUNG ERFOLGREICH!"
echo "Das Spiel ist lokal und in ca. 20 Sekunden auch live auf Vercel"
echo "wieder exakt auf dem fehlerfreien Gold-Stand v2.28!"
read -p "Drücke ENTER zum Schließen..."
