@echo off
cd /d "%~dp0"
title Fila de Ordens - Servidor (NAO FECHE esta janela)
echo Pasta atual: %cd%
echo.
echo Iniciando a Fila de Ordens...
echo Se o navegador abrir antes do servidor terminar de ligar,
echo so dar um F5 (atualizar) na pagina depois de alguns segundos.
echo.
start "" http://localhost:3000
npm start
echo.
echo ================================================
echo O servidor parou ou nao conseguiu iniciar.
echo Veja a mensagem de erro acima e mande uma foto.
echo ================================================
pause
