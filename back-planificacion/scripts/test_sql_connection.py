from __future__ import annotations

import os
import re
import struct
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"
SQL_COPT_SS_ACCESS_TOKEN = 1256


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip().strip('"').strip("'")
        values[key.strip()] = value
    return values


def normalize_connection_string(value: str) -> str:
    value = value.strip().strip('"').strip("'").rstrip(";")
    if "Driver=" not in value and "DRIVER=" not in value:
        value = "Driver={ODBC Driver 18 for SQL Server};" + value
    value = re.sub(r"\bInitial Catalog=", "Database=", value, flags=re.IGNORECASE)
    value = re.sub(r"\bEncrypt=True\b", "Encrypt=yes", value, flags=re.IGNORECASE)
    value = re.sub(r"\bTrustServerCertificate=False\b", "TrustServerCertificate=no", value, flags=re.IGNORECASE)
    return value


def without_authentication(value: str) -> str:
    parts = [part for part in value.split(";") if part]
    kept = [part for part in parts if not part.lower().startswith(("authentication=", "uid=", "user id=", "pwd=", "password="))]
    return ";".join(kept) + ";"


def get_entra_token() -> bytes:
    result = subprocess.run(
        [
            "az",
            "account",
            "get-access-token",
            "--resource",
            "https://database.windows.net/",
            "--query",
            "accessToken",
            "-o",
            "tsv",
        ],
        check=True,
        text=True,
        capture_output=True,
    )
    token = result.stdout.strip().encode("utf-16-le")
    return struct.pack(f"<I{len(token)}s", len(token), token)


def main() -> int:
    try:
        import pyodbc
    except ModuleNotFoundError:
        print("Falta instalar pyodbc en el virtualenv: pip install pyodbc", file=sys.stderr)
        return 2

    env = {**load_env(ENV_FILE), **os.environ}
    raw_conn = env.get("AZURE_SQL_CONNECTION_STRING")
    if not raw_conn:
        host = env["DB_HOST"]
        port = env.get("DB_PORT", "1433")
        name = env["DB_NAME"]
        raw_conn = f"Server=tcp:{host},{port};Database={name};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"

    conn_str = normalize_connection_string(raw_conn)
    uses_entra_default = "authentication=activedirectorydefault" in conn_str.lower()

    try:
        if uses_entra_default:
            token_struct = get_entra_token()
            conn_str = without_authentication(conn_str)
            connection = pyodbc.connect(conn_str, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_struct}, timeout=30)
        else:
            connection = pyodbc.connect(conn_str, timeout=30)
    except subprocess.CalledProcessError as exc:
        print("No pude obtener token de Azure CLI. Ejecuta: az login", file=sys.stderr)
        if exc.stderr:
            print(exc.stderr.strip(), file=sys.stderr)
        return 3
    except Exception as exc:
        print(f"No conecto a Azure SQL: {exc}", file=sys.stderr)
        return 4

    with connection:
        cursor = connection.cursor()
        cursor.execute("SELECT 1")
        value = cursor.fetchone()[0]
        print(f"Conexion OK. SELECT 1 = {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
