"""
Herramienta de migración puntual: inserta personas y proyectos en Azure SQL.
Personas y proyectos son catálogos globales, independientes del PI.
La capacidad por PI se gestiona desde el UI al crear/activar cada PI.

Ejecutar: .venv/bin/python scripts/seed_azure_sql.py
"""
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
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def normalize_conn(value: str) -> str:
    value = value.strip().rstrip(";")
    if "Driver=" not in value:
        value = "Driver={ODBC Driver 18 for SQL Server};" + value
    value = re.sub(r"\bInitial Catalog=", "Database=", value, flags=re.IGNORECASE)
    value = re.sub(r"\bEncrypt=True\b", "Encrypt=yes", value, flags=re.IGNORECASE)
    value = re.sub(r"\bTrustServerCertificate=False\b", "TrustServerCertificate=no", value, flags=re.IGNORECASE)
    return value


def strip_auth(value: str) -> str:
    parts = [p for p in value.split(";") if p.strip()]
    kept = [p for p in parts if not p.strip().lower().startswith(
        ("authentication=", "uid=", "user id=", "pwd=", "password=")
    )]
    return ";".join(kept) + ";"


def get_token() -> bytes:
    r = subprocess.run(
        ["az", "account", "get-access-token", "--resource",
         "https://database.windows.net/", "--query", "accessToken", "-o", "tsv"],
        check=True, text=True, capture_output=True, timeout=20,
    )
    raw = r.stdout.strip().encode("utf-16-le")
    return struct.pack(f"<I{len(raw)}s", len(raw), raw)


def connect():
    import pyodbc
    env = {**load_env(ENV_FILE), **os.environ}
    raw = env.get("AZURE_SQL_CONNECTION_STRING") or (
        f"Server=tcp:{env['DB_HOST']},{env.get('DB_PORT','1433')};"
        f"Database={env['DB_NAME']};Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
    )
    conn_str = normalize_conn(raw)
    if "authentication=activedirectorydefault" in conn_str.lower():
        token = get_token()
        return pyodbc.connect(strip_auth(conn_str),
                              attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token},
                              timeout=30, autocommit=False)
    return pyodbc.connect(conn_str, timeout=30, autocommit=False)


PERSONAS = [
    # (nombre, tecnologia, rol)
    # COBOL
    ("Sergio Alejandro Panche",            "COBOL", "Lider Tec."),
    ("Roger Armando Lozada Ortiz",         "COBOL", "Desarrollador"),
    ("Angie Lizeth Cordoba Lesmes",        "COBOL", "Desarrollador"),
    ("Maria Fernanda Alvarado",            "COBOL", "Desarrollador"),
    ("Fredy Fernando Patiño Rave",         "COBOL", "Desarrollador"),
    ("Jeisson Andres Cutiva Cardenas",     "COBOL", "Desarrollador"),
    ("Juan Carlos Villarreal Carrera",     "COBOL", "Desarrollador"),
    ("Sandra Lorena Martinez Merchan",     "COBOL", "Desarrollador"),
    ("Heidy Vanessa Sanchez Pulido",       "COBOL", "Desarrollador"),
    ("Juan David Caceres Aponte",          "COBOL", "Desarrollador"),
    ("Kevin Alejandro Correa Hurtado",     "COBOL", "Desarrollador"),
    # JAVA
    ("Laura Marietta Corredor Saenz",      "JAVA",  "Lider Tec."),
    ("Alvaro Alfonso Lasso Lopez",         "JAVA",  "Desarrollador"),
    ("Andres Felipe Novoa Garcia",         "JAVA",  "Desarrollador"),
    ("Camilo Lobo Guerrero Nova",          "JAVA",  "Desarrollador"),
    ("David Alexander Vasquez Vivas",      "JAVA",  "Desarrollador"),
    ("Deivis David Sanchez Mestra",        "JAVA",  "Desarrollador"),
    ("Diego Alejandro Rodriguez Martinez", "JAVA",  "Desarrollador"),
    ("Dilan Camilo Martinez Zapata",       "JAVA",  "Desarrollador"),
    ("Erik Steven Alegria Mina",           "JAVA",  "Desarrollador"),
    ("Jeison Stiven Rojas Montoya",        "JAVA",  "Desarrollador"),
    ("John Jairo Robledo Quintero",        "JAVA",  "Desarrollador"),
    ("Jorge Enrique Castillo Gonzalez",    "JAVA",  "Desarrollador"),
    ("Nicolas Andres Menaca Trujillo",     "JAVA",  "Desarrollador"),
    ("Johan David Garzon Uricoechea",      "JAVA",  "Desarrollador"),
    ("Carlos Andres Pavajeau Max",         "JAVA",  "Desarrollador"),
    ("Nicolas Cardenas Rodriguez",         "JAVA",  "Desarrollador"),
    ("Johnny Agudelo Rios",                "JAVA",  "Desarrollador"),
    ("Jhon Carlos Colorado Angulo",        "JAVA",  "Desarrollador"),
    ("Andres Sebastian Cubillos",          "JAVA",  "Desarrollador"),
    ("Santiago Nicolas Briñez Garcia",     "JAVA",  "Desarrollador"),
]

PROYECTOS = [
    # (identi, nombre, squad, modulo)
    ("MD",             "Menor Demand - Nueva Célula",    "TODOS",       "MEJORA_CONTINUA"),
    ("FAST",           "Fast Project",                   "COMMERCIAL",  "FABRICA"),
    ("PVI",            "PVI Fase 2",                     "RETAIL/P&C",  "FABRICA"),
    ("MIPYME",         "Mipyme Fase 2",                  "RETAIL/P&C",  "FABRICA"),
    ("MD.5",           "Canal Directo Autos",            "COMMERCIAL",  "FABRICA"),
    ("AGRO",           "Agro",                           "RETAIL/P&C",  "FABRICA"),
    ("UNITLINK",       "Unit Link",                      "LIFE&HEALTH", "FABRICA"),
    ("FRISS",          "Fraude FRISS",                   "RETAIL/P&C",  "FABRICA"),
    ("PHMP",           "Gestión Riesgo PHMP",            "LIFE&HEALTH", "FABRICA"),
    ("NIIF",           "NIIF 9 y 17",                    "LIFE&HEALTH", "FABRICA"),
    ("LEO",            "Leonardo Framework",             "TODOS",       "FABRICA"),
    ("HERMES",         "Hermes",                         "COMMERCIAL",  "FABRICA"),
    ("CLAIMS",         "Claims Salud",                   "LIFE&HEALTH", "FABRICA"),
    ("VIDA G",         "Vida Grupo Fase 3",              "LIFE&HEALTH", "FABRICA"),
    ("REASEGURO",      "Reaseguro Implementación",       "RETAIL/P&C",  "FABRICA"),
    ("AUTORIZACIONES", "Autorizaciones",                 "LIFE&HEALTH", "FABRICA"),
]


def main() -> int:
    try:
        import pyodbc  # noqa: F401
    except ModuleNotFoundError:
        print("Instala pyodbc: pip install pyodbc", file=sys.stderr)
        return 2

    print("Conectando a Azure SQL...")
    try:
        conn = connect()
    except Exception as exc:
        print(f"Error de conexión: {exc}", file=sys.stderr)
        return 3

    cur = conn.cursor()
    print("Conexión OK\n")

    # ─── PROYECTOS ─────────────────────────────────────────────────────────────
    print("► Proyectos (catálogo global)...")
    ins_p = skip_p = 0
    for identi, nombre, squad, modulo in PROYECTOS:
        cur.execute("SELECT 1 FROM dbo.proyectos WHERE identi=?", (identi,))
        if cur.fetchone():
            skip_p += 1
        else:
            cur.execute(
                "INSERT INTO dbo.proyectos (identi, nombre, squad, modulo, activo) VALUES (?,?,?,?,1)",
                (identi, nombre, squad, modulo),
            )
            ins_p += 1
    conn.commit()
    print(f"  Insertados: {ins_p} | Ya existían: {skip_p}")

    # ─── PERSONAS ──────────────────────────────────────────────────────────────
    print("\n► Personas (catálogo global)...")
    ins_q = skip_q = 0
    for nombre, tecnologia, rol in PERSONAS:
        cur.execute(
            "SELECT 1 FROM dbo.personas WHERE nombre=? AND tecnologia=?",
            (nombre, tecnologia),
        )
        if cur.fetchone():
            skip_q += 1
        else:
            cur.execute(
                "INSERT INTO dbo.personas (nombre, tecnologia, rol, activo) VALUES (?,?,?,1)",
                (nombre, tecnologia, rol),
            )
            ins_q += 1
    conn.commit()
    print(f"  Insertadas: {ins_q} | Ya existían: {skip_q}")

    # ─── RESUMEN ───────────────────────────────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM dbo.proyectos WHERE activo=1")
    total_proy = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM dbo.personas WHERE activo=1")
    total_pers = cur.fetchone()[0]

    print(f"\n✓ Listo")
    print(f"  Proyectos activos : {total_proy}")
    print(f"  Personas activas  : {total_pers}")
    print()
    print("Nota: la capacidad por PI se configura desde el UI al crear/activar cada PI.")

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
