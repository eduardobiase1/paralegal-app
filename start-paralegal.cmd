@echo off
SET PATH=C:\Program Files\nodejs;%PATH%
cd /d "C:\Users\eduar\Downloads\CLAUDE\paralegal-app"
node --localstorage-file="%TEMP%\paralegal-localstorage.json" node_modules\next\dist\bin\next dev
