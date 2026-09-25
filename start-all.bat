@echo off
echo ==============================================
echo   ReachInbox Email Scheduler - Starting All
echo ==============================================

echo [1/3] Starting Redis and PostgreSQL in WSL...
wsl -d Ubuntu -u root service redis-server start
wsl -d Ubuntu -u root service postgresql start

echo [2/3] Launching Backend Server in background...
start "ReachInbox Backend" cmd /k "wsl -d Ubuntu -e bash -c 'cd /mnt/c/projects/nxt_task/backend && npm run build && node dist/index.js'"

echo [3/3] Launching Frontend Dashboard in background...
start "ReachInbox Frontend" cmd /k "wsl -d Ubuntu -e bash -c 'cd /mnt/c/projects/nxt_task/frontend && npm run dev'"

echo ==============================================
echo Services started!
echo Frontend Dashboard: http://localhost:3000
echo Backend API Health: http://localhost:3001/api/health
echo ==============================================
