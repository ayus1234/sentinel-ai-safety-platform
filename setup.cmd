@echo off
setlocal
echo Installing SentinelAI workspace dependencies...
call npm.cmd install
if errorlevel 1 exit /b 1
call npm.cmd --prefix frontend install
if errorlevel 1 exit /b 1
python -m venv backend\.venv2
if errorlevel 1 exit /b 1
backend\.venv2\Scripts\python.exe -m pip install uv
if errorlevel 1 exit /b 1
backend\.venv2\Scripts\uv.exe pip install -r backend\requirements.txt -p backend\.venv2\Scripts\python.exe
if errorlevel 1 exit /b 1
echo SentinelAI setup complete.

