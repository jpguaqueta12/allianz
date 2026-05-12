-- =============================================================
-- MIGRACIÓN v2 — Mejoras del Agente Planificador
-- Ejecutar sobre la BD allianz_planificador existente
-- =============================================================

-- ---------------------------------------------------------------
-- MEJORA 5: Dependencias entre IBLs
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ibl_dependencias (
    id              SERIAL PRIMARY KEY,
    ibl_id          INTEGER NOT NULL REFERENCES ibl(id) ON DELETE CASCADE,
    depende_de_id   INTEGER NOT NULL REFERENCES ibl(id) ON DELETE CASCADE,
    tipo            VARCHAR(50) NOT NULL DEFAULT 'BLOQUEADO_POR',
    -- BLOQUEADO_POR: ibl_id no puede avanzar hasta que depende_de_id esté Done
    -- RELACIONADO:   relación informativa sin bloqueo estricto
    notas           TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT no_auto_dependencia CHECK (ibl_id <> depende_de_id),
    UNIQUE (ibl_id, depende_de_id)
);

COMMENT ON TABLE ibl_dependencias IS 'Dependencias entre IBLs: ibl_id depende de depende_de_id';
CREATE INDEX IF NOT EXISTS idx_ibl_dep_ibl     ON ibl_dependencias (ibl_id);
CREATE INDEX IF NOT EXISTS idx_ibl_dep_blocker ON ibl_dependencias (depende_de_id);

-- ---------------------------------------------------------------
-- MEJORA 7: Capacidad semanal dinámica dentro del PI
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capacidad_semanal_persona (
    id              SERIAL PRIMARY KEY,
    pi_id           INTEGER NOT NULL REFERENCES pi(id) ON DELETE CASCADE,
    persona_id      INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    semana_inicio   DATE NOT NULL,   -- lunes de la semana
    semana_fin      DATE NOT NULL,   -- viernes de la semana
    horas_disponibles INTEGER NOT NULL DEFAULT 0,
    motivo_reduccion VARCHAR(200),   -- 'Vacaciones', 'Festivo', 'Capacitación', etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pi_id, persona_id, semana_inicio)
);

COMMENT ON TABLE capacidad_semanal_persona IS 'Capacidad real por semana por persona dentro del PI (vacaciones, festivos, etc.)';
CREATE INDEX IF NOT EXISTS idx_cap_semanal_pi_persona ON capacidad_semanal_persona (pi_id, persona_id);
CREATE INDEX IF NOT EXISTS idx_cap_semanal_semana     ON capacidad_semanal_persona (semana_inicio);

-- ---------------------------------------------------------------
-- MEJORA 6: Métricas históricas de velocidad por PI
-- (se calculan al cerrar un PI y se guardan como snapshot)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pi_velocidad_historica (
    id                  SERIAL PRIMARY KEY,
    pi_id               INTEGER NOT NULL REFERENCES pi(id) ON DELETE CASCADE UNIQUE,
    persona_id          INTEGER REFERENCES personas(id),  -- NULL = métrica global del PI
    proyecto_id         INTEGER REFERENCES proyectos(id), -- NULL = todas las tecnologías
    tecnologia          VARCHAR(10),                       -- COBOL | JAVA | NULL (global)

    -- Throughput
    ibls_planificados   INTEGER NOT NULL DEFAULT 0,
    ibls_completados    INTEGER NOT NULL DEFAULT 0,
    ibls_bloqueados     INTEGER NOT NULL DEFAULT 0,
    ibls_migrados       INTEGER NOT NULL DEFAULT 0,  -- pasados al siguiente PI

    -- ETC accuracy
    etc_estimado_total  INTEGER NOT NULL DEFAULT 0,  -- suma de etc_horas al inicio
    etc_real_total      INTEGER NOT NULL DEFAULT 0,  -- suma de etc_real_horas al cierre
    desviacion_pct      NUMERIC(5,2),                -- (real-estimado)/estimado * 100

    -- Bloqueos
    total_bloqueos      INTEGER NOT NULL DEFAULT 0,
    dias_bloqueado_total INTEGER NOT NULL DEFAULT 0,
    horas_perdidas_total INTEGER NOT NULL DEFAULT 0,

    -- Entregas
    entregas_a_tiempo   INTEGER NOT NULL DEFAULT 0,
    entregas_tardias    INTEGER NOT NULL DEFAULT 0,

    calculado_en        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pi_id, persona_id, proyecto_id, tecnologia)
);

COMMENT ON TABLE pi_velocidad_historica IS 'Snapshot de métricas de velocidad y calidad por PI (calculado al cerrar)';
CREATE INDEX IF NOT EXISTS idx_velocidad_pi       ON pi_velocidad_historica (pi_id);
CREATE INDEX IF NOT EXISTS idx_velocidad_persona  ON pi_velocidad_historica (persona_id);
CREATE INDEX IF NOT EXISTS idx_velocidad_proyecto ON pi_velocidad_historica (proyecto_id);

-- ---------------------------------------------------------------
-- MEJORA 4: Tabla de propuestas de replanificación al fin del PI
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS replanificacion_propuesta (
    id              SERIAL PRIMARY KEY,
    pi_origen_id    INTEGER NOT NULL REFERENCES pi(id) ON DELETE CASCADE,
    pi_destino_id   INTEGER REFERENCES pi(id),  -- NULL si el PI destino aún no existe
    ibl_id          INTEGER NOT NULL REFERENCES ibl(id) ON DELETE CASCADE,
    etc_restante    INTEGER,          -- ETC real al momento de la propuesta
    responsable_sugerido VARCHAR(150),
    motivo          TEXT,             -- por qué se propone migrar
    estado          VARCHAR(20) NOT NULL DEFAULT 'PROPUESTA',
    -- PROPUESTA | ACEPTADA | RECHAZADA
    notas           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pi_origen_id, ibl_id)
);

COMMENT ON TABLE replanificacion_propuesta IS 'Propuestas de migración de IBLs al siguiente PI al cierre del PI actual';
CREATE INDEX IF NOT EXISTS idx_replan_pi_origen  ON replanificacion_propuesta (pi_origen_id);
CREATE INDEX IF NOT EXISTS idx_replan_ibl        ON replanificacion_propuesta (ibl_id);

CREATE TRIGGER trg_replanificacion_updated_at
    BEFORE UPDATE ON replanificacion_propuesta
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
