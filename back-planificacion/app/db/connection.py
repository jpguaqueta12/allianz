from __future__ import annotations

import asyncio
import queue as _queue
import re
import struct
import subprocess
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Iterable

import pyodbc

from app.config import get_settings

SQL_COPT_SS_ACCESS_TOKEN = 1256


class DbRow(dict):
    """Small asyncpg.Record-compatible row for existing handlers."""

    def __getattr__(self, name: str) -> Any:
        try:
            return self[name]
        except KeyError as exc:
            raise AttributeError(name) from exc


def _strip_authentication_keywords(conn_str: str) -> str:
    parts = [part for part in conn_str.split(";") if part.strip()]
    kept = [
        part
        for part in parts
        if not part.strip().lower().startswith(
            ("authentication=", "uid=", "user id=", "pwd=", "password=")
        )
    ]
    return ";".join(kept) + ";"


def _get_access_token() -> bytes:
    errors: list[str] = []
    try:
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
            timeout=15,
        )
        raw = result.stdout.strip()
        if raw:
            encoded = raw.encode("utf-16-le")
            return struct.pack(f"<I{len(encoded)}s", len(encoded), encoded)
        errors.append("Azure CLI no devolvio un token.")
    except Exception as exc:
        if isinstance(exc, subprocess.CalledProcessError):
            detail = (exc.stderr or exc.stdout or str(exc)).strip()
            errors.append(f"Azure CLI: {detail}")
        else:
            errors.append(f"Azure CLI: {exc}")

    try:
        from azure.identity import DefaultAzureCredential

        token = DefaultAzureCredential(exclude_interactive_browser_credential=True).get_token(
            "https://database.windows.net/.default"
        )
        raw = token.token
    except Exception as exc:
        errors.append(f"DefaultAzureCredential: {exc}")
        detail = " | ".join(error for error in errors if error)
        raise RuntimeError(
            "No se pudo obtener token para Azure SQL. Ejecuta 'az login' con una "
            "cuenta autorizada en la base de datos o configura credenciales de "
            f"entorno para Azure Identity. Detalle: {detail}"
        ) from exc

    encoded = raw.encode("utf-16-le")
    return struct.pack(f"<I{len(encoded)}s", len(encoded), encoded)


def _base_connection_string() -> str:
    s = get_settings()
    conn_str = getattr(s, "azure_sql_connection_string", None)
    if not conn_str:
        conn_str = (
            "Driver={ODBC Driver 18 for SQL Server};"
            f"Server=tcp:{s.db_host},{s.db_port};"
            f"Database={s.db_name};"
            f"UID={s.db_user};PWD={s.db_password};"
            "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
        )
    if "driver=" not in conn_str.lower():
        conn_str = "Driver={ODBC Driver 18 for SQL Server};" + conn_str
    conn_str = re.sub(r"\bInitial Catalog=", "Database=", conn_str, flags=re.IGNORECASE)
    conn_str = re.sub(r"\bEncrypt=True\b", "Encrypt=yes", conn_str, flags=re.IGNORECASE)
    conn_str = re.sub(
        r"\bTrustServerCertificate=False\b",
        "TrustServerCertificate=no",
        conn_str,
        flags=re.IGNORECASE,
    )
    return conn_str


def _connect_sync() -> pyodbc.Connection:
    conn_str = _base_connection_string()
    if "authentication=activedirectorydefault" in conn_str.lower():
        token = _get_access_token()
        return pyodbc.connect(
            _strip_authentication_keywords(conn_str),
            attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token},
            timeout=30,
            autocommit=False,
        )
    return pyodbc.connect(conn_str, timeout=30, autocommit=False)


def _replace_placeholders(sql: str, params: tuple[Any, ...]) -> tuple[str, list[Any]]:
    order: list[int] = []

    def repl(match: re.Match[str]) -> str:
        order.append(int(match.group(1)) - 1)
        return "?"

    converted = re.sub(r"\$(\d+)", repl, sql)
    if not order:
        return converted, list(params)
    return converted, [params[i] for i in order]


def _translate_sql(sql: str) -> str:
    converted = sql
    converted = re.sub(r"::\s*(jsonb|json|text|float|int|integer|date|varchar|numeric|tecnologia_dev|alerta_proyecto|ibl_status)", "", converted, flags=re.IGNORECASE)
    converted = re.sub(r"\bTRUE\b", "1", converted, flags=re.IGNORECASE)
    converted = re.sub(r"\bFALSE\b", "0", converted, flags=re.IGNORECASE)
    converted = re.sub(r"\bNOW\(\)", "SYSUTCDATETIME()", converted, flags=re.IGNORECASE)
    converted = re.sub(r"\bCURRENT_DATE\b", "CAST(GETDATE() AS date)", converted, flags=re.IGNORECASE)
    converted = re.sub(r"\s+NULLS\s+LAST", "", converted, flags=re.IGNORECASE)
    converted = re.sub(
        r"to_char\(([^,]+),\s*'YYYY-MM-DD HH24:MI'\)",
        r"CONVERT(varchar(16), \1, 120)",
        converted,
        flags=re.IGNORECASE,
    )
    converted = re.sub(
        r"to_char\(([^,]+),\s*'YYYY-MM-DD'\)",
        r"CONVERT(varchar(10), \1, 23)",
        converted,
        flags=re.IGNORECASE,
    )
    converted = _translate_limit(converted)
    return converted


def _translate_limit(sql: str) -> str:
    match = re.search(r"\s+LIMIT\s+(\d+)\s*;?\s*$", sql, flags=re.IGNORECASE)
    if not match:
        return sql
    limit = match.group(1)
    without_limit = sql[: match.start()] + sql[match.end() :]
    return re.sub(r"\bSELECT\b", f"SELECT TOP ({limit})", without_limit, count=1, flags=re.IGNORECASE)


def _execute_sync(conn: pyodbc.Connection, sql: str, params: tuple[Any, ...]) -> tuple[int, list[DbRow]]:
    converted, ordered_params = _replace_placeholders(_translate_sql(sql), params)
    cursor = conn.cursor()
    cursor.execute(converted, ordered_params)
    # Capture rowcount immediately — calling nextset() may reset it to -1
    raw_rowcount = cursor.rowcount
    rows: list[DbRow] = []
    while True:
        if cursor.description:
            columns = [col[0] for col in cursor.description]
            rows = [DbRow(zip(columns, row)) for row in cursor.fetchall()]
            break
        if not cursor.nextset():
            break
    rowcount = raw_rowcount if raw_rowcount != -1 else len(rows)
    command = converted.strip().split(maxsplit=1)[0].upper() if converted.strip() else ""
    if command in {"INSERT", "UPDATE", "DELETE", "MERGE", "IF"}:
        conn.commit()
    return rowcount, rows


@dataclass
class SqlServerConnection:
    _conn: pyodbc.Connection
    _owns_connection: bool = True

    async def fetch(self, sql: str, *params: Any) -> list[DbRow]:
        _, rows = await asyncio.to_thread(_execute_sync, self._conn, sql, params)
        return rows

    async def fetchrow(self, sql: str, *params: Any) -> DbRow | None:
        rows = await self.fetch(sql, *params)
        return rows[0] if rows else None

    async def fetchval(self, sql: str, *params: Any) -> Any:
        row = await self.fetchrow(sql, *params)
        if not row:
            return None
        return next(iter(row.values()))

    async def execute(self, sql: str, *params: Any) -> str:
        rowcount, _ = await asyncio.to_thread(_execute_sync, self._conn, sql, params)
        command = (sql.strip().split(maxsplit=1)[0] or "EXECUTE").upper()
        if command == "INSERT":
            return f"INSERT {max(rowcount, 0)}"
        if command == "DELETE":
            return f"DELETE {max(rowcount, 0)}"
        if command == "UPDATE":
            return f"UPDATE {max(rowcount, 0)}"
        return command

    async def executemany(self, sql: str, params: Iterable[Iterable[Any]]) -> str:
        converted = re.sub(r"\$\d+", "?", _translate_sql(sql))
        rows = [tuple(p) for p in params]

        def run() -> int:
            cursor = self._conn.cursor()
            cursor.fast_executemany = True
            cursor.executemany(converted, rows)
            self._conn.commit()
            return cursor.rowcount if cursor.rowcount != -1 else len(rows)

        rowcount = await asyncio.to_thread(run)
        return f"EXECUTE {max(rowcount, 0)}"

    @asynccontextmanager
    async def transaction(self):
        try:
            yield self
            await asyncio.to_thread(self._conn.commit)
        except Exception:
            await asyncio.to_thread(self._conn.rollback)
            raise

    async def close(self) -> None:
        if self._owns_connection:
            await asyncio.to_thread(self._conn.close)

    async def __aenter__(self) -> "SqlServerConnection":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()


class _PoolCtx:
    """Async context manager that borrows one connection from the pool."""

    __slots__ = ("_pool", "_raw")

    def __init__(self, pool: "SqlServerPool") -> None:
        self._pool = pool
        self._raw: pyodbc.Connection | None = None

    async def __aenter__(self) -> SqlServerConnection:
        self._raw = await asyncio.to_thread(self._pool._get)
        return SqlServerConnection(self._raw, _owns_connection=False)

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._raw is None:
            return
        # Discard on any connection-level error (OperationalError = timeout/reset,
        # InterfaceError = driver-level disconnect). Keep connection for data/SQL errors.
        if exc_type is not None and issubclass(exc_type, (pyodbc.OperationalError, pyodbc.InterfaceError)):
            try:
                self._raw.close()
            except Exception:
                pass
        else:
            self._pool._put(self._raw)
        self._raw = None


class SqlServerPool:
    def __init__(self, size: int = 5) -> None:
        self._size = size
        self._q: _queue.Queue[pyodbc.Connection] = _queue.Queue(maxsize=size)

    def _get(self) -> pyodbc.Connection:
        """Pull a connection from the queue, or open a new one."""
        try:
            return self._q.get_nowait()
        except _queue.Empty:
            return _connect_sync()

    def _put(self, conn: pyodbc.Connection) -> None:
        try:
            self._q.put_nowait(conn)
        except _queue.Full:
            try:
                conn.close()
            except Exception:
                pass

    def acquire(self) -> _PoolCtx:
        return _PoolCtx(self)

    _CONN_ERRORS = (pyodbc.OperationalError, pyodbc.InterfaceError)

    async def fetch(self, sql: str, *params: Any) -> list[DbRow]:
        for attempt in range(2):
            try:
                async with self.acquire() as conn:
                    return await conn.fetch(sql, *params)
            except self._CONN_ERRORS:
                if attempt == 0:
                    continue
                raise

    async def fetchrow(self, sql: str, *params: Any) -> DbRow | None:
        for attempt in range(2):
            try:
                async with self.acquire() as conn:
                    return await conn.fetchrow(sql, *params)
            except self._CONN_ERRORS:
                if attempt == 0:
                    continue
                raise

    async def fetchval(self, sql: str, *params: Any) -> Any:
        for attempt in range(2):
            try:
                async with self.acquire() as conn:
                    return await conn.fetchval(sql, *params)
            except self._CONN_ERRORS:
                if attempt == 0:
                    continue
                raise

    async def execute(self, sql: str, *params: Any) -> str:
        for attempt in range(2):
            try:
                async with self.acquire() as conn:
                    return await conn.execute(sql, *params)
            except self._CONN_ERRORS:
                if attempt == 0:
                    continue
                raise

    async def close(self) -> None:
        while True:
            try:
                conn = self._q.get_nowait()
                try:
                    conn.close()
                except Exception:
                    pass
            except _queue.Empty:
                break


_pool: SqlServerPool | None = None


async def _warm_pool(pool: SqlServerPool, n: int) -> None:
    """Pre-create n extra connections in background to fill the pool."""
    for _ in range(n):
        try:
            conn = await asyncio.to_thread(_connect_sync)
            pool._put(conn)
        except Exception:
            break


async def init_pool(size: int = 5) -> None:
    global _pool
    _pool = SqlServerPool(size=size)
    # Verify connectivity; this also pre-warms 1 connection into the pool
    await _pool.fetchval("SELECT 1")
    # Fill the rest of the pool in background (don't block startup)
    asyncio.create_task(_warm_pool(_pool, size - 1))


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> SqlServerPool:
    if _pool is None:
        raise RuntimeError("Pool no inicializado")
    return _pool
