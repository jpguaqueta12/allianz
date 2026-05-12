#!/bin/bash
ENV_FILE="/Users/juanguaqueta/Desktop/Allianz/back-planificacion/.env"

get_env() {
  grep -E "^$1=" "$ENV_FILE" | head -n 1 | cut -d '=' -f 2-
}

BACKEND_PORT="$(get_env BACKEND_PORT)"
FRONTEND_PORT="$(get_env FRONTEND_PORT)"
APP_HOST="$(get_env APP_HOST)"
BACKEND_URL="http://$APP_HOST:$BACKEND_PORT"
FRONTEND_URL="http://$APP_HOST:$FRONTEND_PORT"

echo "🚀 Iniciando Agente Planificador PI3-2026..."

if [ -z "$BACKEND_PORT" ] || [ -z "$FRONTEND_PORT" ] || [ -z "$APP_HOST" ]; then
  echo "Faltan BACKEND_PORT, FRONTEND_PORT o APP_HOST en back-planificacion/.env"
  exit 1
fi

cleanup() {
  [ -n "$BACK_PID" ] && kill "$BACK_PID" >/dev/null 2>&1
  [ -n "$FRONT_PID" ] && kill "$FRONT_PID" >/dev/null 2>&1
}
trap cleanup EXIT INT TERM

# Backend
cd /Users/juanguaqueta/Desktop/Allianz/back-planificacion
.venv/bin/uvicorn app.main:app --port "$BACKEND_PORT" &
BACK_PID=$!
echo "✓ Backend iniciando en puerto $BACKEND_PORT (PID: $BACK_PID)"

echo "⏳ Esperando conexion a Azure SQL..."
for _ in $(seq 1 60); do
  if ! kill -0 "$BACK_PID" >/dev/null 2>&1; then
    echo "El backend se detuvo antes de quedar listo. Revisa el error anterior."
    exit 1
  fi
  HEALTH="$(curl -fsS "$BACKEND_URL/api/v1/health" 2>/dev/null || true)"
  if echo "$HEALTH" | grep -q '"db":"ok"'; then
    echo "✓ Azure SQL conectado"
    break
  fi
  sleep 1
done

if ! echo "$HEALTH" | grep -q '"db":"ok"'; then
  echo "No se pudo confirmar la conexion a Azure SQL en $BACKEND_URL/api/v1/health"
  echo "Verifica 'az login', permisos Entra ID sobre planner_db y firewall del servidor Azure SQL."
  exit 1
fi

# Frontend
cd /Users/juanguaqueta/Desktop/Allianz/front-planificacion
npm run dev -- --port "$FRONTEND_PORT" &
FRONT_PID=$!
echo "✓ Frontend en puerto $FRONTEND_PORT (PID: $FRONT_PID)"

echo ""
echo "📊 Dashboard: $FRONTEND_URL"
echo "💬 Agente IA: $FRONTEND_URL/chat"
echo "📖 API Docs:  $BACKEND_URL/docs"
echo ""
echo "Presiona Ctrl+C para detener todo"
wait
