@echo off
cd /d "%~dp0"
echo ==========================================================
echo   KEANO ROMEO: LORD OF THE LIGHT — LIVE-PUSH AUF VERCEL
echo ==========================================================

if not exist ".git" (
    echo Verbinde Ordner mit GitHub (Vikingo1312/lord_of_the_light_arcade)...
    git init -b main
    git remote add origin https://github.com/Vikingo1312/lord_of_the_light_arcade.git
    git fetch --depth 1 origin main
    git reset --soft origin/main
)

git pull --rebase origin main
git add -A
git commit -m "Update von Keano / Jayden"
git push origin main

echo.
echo FERTIG! In ca. 20 Sekunden ist dein Update live auf:
echo https://lord-of-the-light-arcade.vercel.app/
pause
