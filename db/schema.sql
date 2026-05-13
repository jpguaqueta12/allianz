-- =============================================================
-- PLANIFICADOR PI ALLIANZ TECHNOLOGY - Fábrica de Software
-- Schema PostgreSQL
-- =============================================================

-- ---------------------------------------------------------------
-- TIPOS ENUMERADOS
-- ---------------------------------------------------------------

CREATE TYPE tecnologia_dev AS ENUM ('COBOL', 'JAVA', 'CALIDAD', 'GESTION');

CREATE TYPE rol_persona AS ENUM ('Desarrollador', 'Lider Tec.');

CREATE TYPE ibl_status AS ENUM ('In Progress', 'Blocked', 'Done', 'Cancelado');

CREATE TYPE ibl_tipo AS ENUM (
    'Evolutivo',
    'Devolucion',
    'Soporte',
    'Soporte Hermes',
    'Estabilizacion',
    'Versionamiento',
    'Estimacion',
    'Est-Alcance',
    'Alcance',
    'Estandar Change'
);

CREATE TYPE squad_nombre AS ENUM (
    'COMMERCIAL',
    'RETAIL/P&C',
    'LIFE&HEALTH',
    'TODOS'
);

CREATE TYPE alerta_proyecto AS ENUM (
    'OK',
    'SIN DEMANDA',
    'EXCEDE CAPACIDAD',
    'NUEVA CELULA MD'
);

-- ---------------------------------------------------------------
-- TABLA: pi  (Program Increment)
-- ---------------------------------------------------------------
CREATE TABLE pi (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(20)  NOT NULL UNIQUE,           -- 'PI3-2026'
    fecha_inicio    DATE         NOT NULL,
    fecha_fin       DATE         NOT NULL,
    dias_laborables INTEGER      NOT NULL,
    horas_por_dia   INTEGER      NOT NULL DEFAULT 8,
    horas_por_persona INTEGER    GENERATED ALWAYS AS (dias_laborables * horas_por_dia) STORED,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'PLANIFICACION', -- PLANIFICACION | ACTIVO | CERRADO
    modulo          VARCHAR(30)  NOT NULL DEFAULT 'MEJORA_CONTINUA', -- MEJORA_CONTINUA | FABRICA | INCIDENTES
    descripcion     TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  pi IS 'Program Increments de la Fábrica de Software Allianz';
COMMENT ON COLUMN pi.horas_por_persona IS 'Calculado: dias_laborables × horas_por_dia';
COMMENT ON COLUMN pi.estado IS 'Estado del PI: PLANIFICACION | ACTIVO | CERRADO';
COMMENT ON COLUMN pi.modulo IS 'Módulo dueño del PI: MEJORA_CONTINUA | FABRICA | INCIDENTES';

-- ---------------------------------------------------------------
-- TABLA: festivos  (Festivos Colombia por PI)
-- ---------------------------------------------------------------
CREATE TABLE festivos (
    id      SERIAL PRIMARY KEY,
    pi_id   INTEGER NOT NULL REFERENCES pi(id) ON DELETE CASCADE,
    fecha   DATE    NOT NULL,
    nombre  VARCHAR(100) NOT NULL,
    UNIQUE (pi_id, fecha)
);

-- ---------------------------------------------------------------
-- TABLA: proyectos
-- ---------------------------------------------------------------
CREATE TABLE proyectos (
    id      SERIAL PRIMARY KEY,
    identi  VARCHAR(20)   NOT NULL UNIQUE,   -- 'MD', 'FRISS', 'CLAIMS', etc.
    nombre  VARCHAR(150)  NOT NULL,
    squad   squad_nombre  NOT NULL,
    activo  BOOLEAN       NOT NULL DEFAULT TRUE
);

COMMENT ON COLUMN proyectos.identi IS 'Abreviación usada en el planificador (columna IDENTI del backlog)';

-- ---------------------------------------------------------------
-- TABLA: personas  (Equipo NTT / Fábrica)
-- ---------------------------------------------------------------
CREATE TABLE personas (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150)   NOT NULL,
    tecnologia  tecnologia_dev NOT NULL,
    rol         rol_persona    NOT NULL DEFAULT 'Desarrollador',
    activo      BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- TABLA: capacidad_persona_pi
-- Capacidad asignada de cada persona por PI.
-- Una persona puede tener capacidad reducida (ej: 108h en lugar de 216h).
-- ---------------------------------------------------------------
CREATE TABLE capacidad_persona_pi (
    id                  SERIAL PRIMARY KEY,
    pi_id               INTEGER        NOT NULL REFERENCES pi(id) ON DELETE CASCADE,
    persona_id          INTEGER        NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    proyecto_principal  INTEGER        REFERENCES proyectos(id),  -- proyecto asignado como squad
    capacidad_horas     INTEGER,                                   -- NULL si es Líder Técnico
    UNIQUE (pi_id, persona_id)
);

COMMENT ON COLUMN capacidad_persona_pi.capacidad_horas IS 'NULL para Líderes Técnicos. Puede ser menor a horas_por_persona si el dev trabaja a medio tiempo en el PI.';

-- ---------------------------------------------------------------
-- TABLA: ibl  (Item de Backlog — unidad de trabajo planificada)
-- ---------------------------------------------------------------
CREATE TABLE ibl (
    id                  SERIAL PRIMARY KEY,
    pi_id               INTEGER       NOT NULL REFERENCES pi(id) ON DELETE RESTRICT,
    numero              INTEGER       NOT NULL,           -- # secuencial dentro del PI
    key                 VARCHAR(30)   NOT NULL UNIQUE,    -- 'IBLCDM-20513'
    nombre_descripcion  TEXT,
    tipo                ibl_tipo      NOT NULL,
    proyecto_id         INTEGER       NOT NULL REFERENCES proyectos(id),
    epic_link           VARCHAR(150),                     -- Epic de Jira padre

    -- Planificación
    fecha_inicio        DATE,
    fin_desarrollo      DATE,
    entrega_pruebas     DATE,
    entrega_final_pi    DATE,
    etc_horas           INTEGER,        -- ETC estimado inicial (Estimated Time to Complete)
    pnr_fecha           DATE,           -- Punto de No Retorno original

    -- Horas estimadas por tecnología
    hrs_cobol           INTEGER,
    hrs_java            INTEGER,
    hrs_qa              INTEGER,

    -- Gestión
    prioridad_negocio   VARCHAR(50)   NOT NULL DEFAULT 'SIN DEFINIR',
    impacto_ans         VARCHAR(150),
    observaciones       TEXT,

    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT ibl_numero_unico_por_pi UNIQUE (pi_id, numero)
);

COMMENT ON TABLE  ibl IS 'Item de Backlog — unidad de trabajo planificada en el PI';
COMMENT ON COLUMN ibl.key IS 'Identificador Jira, ej: IBLCDM-20513';
COMMENT ON COLUMN ibl.etc_horas IS 'Estimación original de horas restantes al inicio del PI';
COMMENT ON COLUMN ibl.pnr_fecha IS 'Punto de No Retorno: última fecha para iniciar y aún cumplir la entrega';

-- ---------------------------------------------------------------
-- TABLA: ibl_recursos
-- Asignación de desarrolladores a un IBL (1 COBOL + 1 JAVA es lo típico,
-- pero se modela como tabla para soportar reasignaciones y múltiples devs).
-- ---------------------------------------------------------------
CREATE TABLE ibl_recursos (
    id          SERIAL PRIMARY KEY,
    ibl_id      INTEGER        NOT NULL REFERENCES ibl(id) ON DELETE CASCADE,
    persona_id  INTEGER        NOT NULL REFERENCES personas(id),
    tecnologia  tecnologia_dev NOT NULL,
    pendiente   BOOLEAN        NOT NULL DEFAULT FALSE,  -- TRUE si dice 'Asignar/Planificar'
    notas       VARCHAR(200),                           -- ej: 'Reasignar cuando desescalen'
    asignado_en TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    activo      BOOLEAN        NOT NULL DEFAULT TRUE,
    UNIQUE (ibl_id, persona_id)
);

COMMENT ON COLUMN ibl_recursos.pendiente IS 'TRUE cuando el recurso dice Asignar/Planificar — aún sin persona definida';

-- ---------------------------------------------------------------
-- TABLA: ibl_tracking
-- Registro diario del estado del IBL (campos de entrada manual).
-- Mantiene historial completo; el estado actual = registro más reciente.
-- ---------------------------------------------------------------
CREATE TABLE ibl_tracking (
    id              SERIAL PRIMARY KEY,
    ibl_id          INTEGER      NOT NULL REFERENCES ibl(id) ON DELETE CASCADE,
    fecha_registro  DATE         NOT NULL DEFAULT CURRENT_DATE,
    status_real     ibl_status   NOT NULL,
    etc_real_horas  INTEGER,                -- horas reales restantes (post-actualización)
    pnr_actualizado DATE,                   -- PNR recalculado si hubo escalamiento
    horas_perdidas  INTEGER      NOT NULL DEFAULT 0,
    registrado_por  VARCHAR(150),
    notas           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (ibl_id, fecha_registro)        -- un registro por IBL por día
);

COMMENT ON TABLE  ibl_tracking IS 'Historial diario de actualización de estado por IBL (columnas amarillas del Excel)';
COMMENT ON COLUMN ibl_tracking.etc_real_horas IS 'Horas reales restantes — reemplaza el ETC estimado cuando se actualiza manualmente';
COMMENT ON COLUMN ibl_tracking.horas_perdidas IS 'Horas no productivas debido al bloqueo (escalamiento)';

-- ---------------------------------------------------------------
-- TABLA: ibl_entrega
-- Registro formal de entrega (Done) de un IBL.
-- ---------------------------------------------------------------
CREATE TABLE ibl_entrega (
    id                  SERIAL PRIMARY KEY,
    ibl_id              INTEGER      NOT NULL REFERENCES ibl(id) ON DELETE CASCADE UNIQUE,
    fecha_done          DATE         NOT NULL,
    cumplio_fecha       BOOLEAN      GENERATED ALWAYS AS (fecha_done <= fecha_comprometida) STORED,
    fecha_comprometida  DATE         NOT NULL,   -- copia de ibl.entrega_final_pi al momento de entregar
    dias_desviacion     INTEGER      GENERATED ALWAYS AS (fecha_done - fecha_comprometida) STORED,
    registrado_por      VARCHAR(150),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN ibl_entrega.dias_desviacion IS 'Positivo = entrega tardía, negativo = entrega anticipada';
COMMENT ON COLUMN ibl_entrega.cumplio_fecha   IS 'Calculado: fecha_done <= fecha_comprometida';

-- ---------------------------------------------------------------
-- TABLA: escalamientos
-- Registro de bloqueos/escalamientos por IBL.
-- Un IBL puede tener múltiples escalamientos en el mismo PI.
-- ---------------------------------------------------------------
CREATE TABLE escalamientos (
    id                      SERIAL PRIMARY KEY,
    ibl_id                  INTEGER      NOT NULL REFERENCES ibl(id) ON DELETE CASCADE,
    fecha_bloqueo           DATE         NOT NULL,
    fecha_desescalamiento   DATE,
    motivo                  TEXT,
    acciones_tomadas        TEXT,
    resuelto                BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT escalamiento_fechas_validas
        CHECK (fecha_desescalamiento IS NULL OR fecha_desescalamiento >= fecha_bloqueo)
);

COMMENT ON TABLE escalamientos IS 'Historial de bloqueos y escalamientos por IBL';

-- ---------------------------------------------------------------
-- TABLA: capacidad_proyecto_pi
-- Snapshot de capacidad vs demanda por proyecto por PI
-- (equivale a la hoja RESUMEN PROYECTOS, calculada o ingresada).
-- ---------------------------------------------------------------
CREATE TABLE capacidad_proyecto_pi (
    id              SERIAL PRIMARY KEY,
    pi_id           INTEGER         NOT NULL REFERENCES pi(id) ON DELETE CASCADE,
    proyecto_id     INTEGER         NOT NULL REFERENCES proyectos(id),
    cap_java_horas  INTEGER         NOT NULL DEFAULT 0,
    cap_cobol_horas INTEGER         NOT NULL DEFAULT 0,
    alerta          alerta_proyecto,
    UNIQUE (pi_id, proyecto_id)
);

COMMENT ON TABLE capacidad_proyecto_pi IS 'Capacidad asignada por proyecto por PI — base para cálculo de demanda vs capacidad';

-- ---------------------------------------------------------------
-- VISTAS
-- ---------------------------------------------------------------

-- Vista: estado actual de cada IBL (tracking más reciente)
CREATE VIEW v_ibl_estado_actual AS
SELECT
    i.id                        AS ibl_id,
    i.key,
    i.nombre_descripcion,
    i.tipo,
    p.identi                    AS proyecto,
    i.etc_horas                 AS etc_original,
    i.pnr_fecha,
    i.entrega_final_pi,
    t.status_real,
    t.etc_real_horas,
    COALESCE(t.etc_real_horas, i.etc_horas) AS etc_vigente,
    t.pnr_actualizado,
    COALESCE(t.pnr_actualizado, i.pnr_fecha) AS pnr_vigente,
    t.horas_perdidas,
    t.fecha_registro            AS ultima_actualizacion,
    -- PNR vencido: el PNR vigente ya pasó y el IBL no está Done
    CASE
        WHEN t.status_real = 'Done' THEN FALSE
        WHEN COALESCE(t.pnr_actualizado, i.pnr_fecha) < CURRENT_DATE THEN TRUE
        ELSE FALSE
    END                         AS pnr_vencido,
    -- Días al PNR
    COALESCE(t.pnr_actualizado, i.pnr_fecha) - CURRENT_DATE AS dias_al_pnr
FROM ibl i
JOIN proyectos p          ON p.id = i.proyecto_id
LEFT JOIN ibl_tracking t  ON t.ibl_id = i.id
    AND t.fecha_registro = (
        SELECT MAX(t2.fecha_registro)
        FROM ibl_tracking t2
        WHERE t2.ibl_id = i.id
    );

COMMENT ON VIEW v_ibl_estado_actual IS 'Estado vigente de cada IBL: combina datos base con el tracking más reciente';

-- Vista: carga por persona en el PI activo
CREATE VIEW v_carga_persona AS
SELECT
    per.id,
    per.nombre,
    per.tecnologia,
    per.rol,
    cpp.capacidad_horas,
    COALESCE(SUM(
        CASE WHEN per.tecnologia = 'COBOL' THEN i.hrs_cobol
             WHEN per.tecnologia = 'JAVA'  THEN i.hrs_java
        END
    ), 0)                                                          AS carga_estimada,
    cpp.capacidad_horas - COALESCE(SUM(
        CASE WHEN per.tecnologia = 'COBOL' THEN i.hrs_cobol
             WHEN per.tecnologia = 'JAVA'  THEN i.hrs_java
        END
    ), 0)                                                          AS horas_disponibles,
    ROUND(COALESCE(SUM(
        CASE WHEN per.tecnologia = 'COBOL' THEN i.hrs_cobol
             WHEN per.tecnologia = 'JAVA'  THEN i.hrs_java
        END
    ), 0)::NUMERIC / NULLIF(cpp.capacidad_horas, 0) * 100, 1)    AS pct_ocupacion,
    CASE
        WHEN per.rol = 'Lider Tec.'      THEN 'LIDER TECNICO'
        WHEN cpp.capacidad_horas IS NULL THEN 'SIN CAPACIDAD'
        WHEN COALESCE(SUM(
            CASE WHEN per.tecnologia = 'COBOL' THEN i.hrs_cobol
                 WHEN per.tecnologia = 'JAVA'  THEN i.hrs_java
            END
        ), 0) > cpp.capacidad_horas                               THEN 'SOBRECARGADO'
        WHEN COALESCE(SUM(
            CASE WHEN per.tecnologia = 'COBOL' THEN i.hrs_cobol
                 WHEN per.tecnologia = 'JAVA'  THEN i.hrs_java
            END
        ), 0) >= cpp.capacidad_horas * 0.5                        THEN 'OCUPADO'
        ELSE 'DISPONIBLE'
    END                                                            AS estado
FROM personas per
JOIN capacidad_persona_pi cpp ON cpp.persona_id = per.id
JOIN pi ON pi.id = cpp.pi_id AND pi.activo = TRUE
LEFT JOIN ibl_recursos ir  ON ir.persona_id = per.id AND ir.activo = TRUE
LEFT JOIN ibl i            ON i.id = ir.ibl_id AND i.pi_id = pi.id
WHERE per.activo = TRUE
GROUP BY per.id, per.nombre, per.tecnologia, per.rol, cpp.capacidad_horas;

COMMENT ON VIEW v_carga_persona IS 'Carga vs capacidad de cada persona en el PI activo';

-- Vista: items bloqueados activos
CREATE VIEW v_bloqueados AS
SELECT
    i.key,
    i.tipo,
    p.identi         AS proyecto,
    t.etc_real_horas AS etc_vigente,
    e.fecha_bloqueo,
    CURRENT_DATE - e.fecha_bloqueo AS dias_bloqueado,
    COALESCE(t.pnr_actualizado, i.pnr_fecha) AS pnr_vigente,
    i.observaciones
FROM ibl i
JOIN proyectos p          ON p.id = i.proyecto_id
JOIN escalamientos e      ON e.ibl_id = i.id AND e.resuelto = FALSE
LEFT JOIN ibl_tracking t  ON t.ibl_id = i.id
    AND t.fecha_registro = (
        SELECT MAX(t2.fecha_registro) FROM ibl_tracking t2 WHERE t2.ibl_id = i.id
    )
ORDER BY dias_bloqueado DESC;

COMMENT ON VIEW v_bloqueados IS 'IBLs en estado Blocked con escalamiento activo no resuelto';

-- Vista: resumen capacidad vs demanda por proyecto (PI activo)
CREATE VIEW v_resumen_proyectos AS
SELECT
    p.identi,
    p.nombre,
    p.squad,
    cpp.cap_java_horas,
    cpp.cap_cobol_horas,
    COALESCE(SUM(i.hrs_java),  0) AS dem_java,
    COALESCE(SUM(i.hrs_cobol), 0) AS dem_cobol,
    cpp.cap_java_horas  - COALESCE(SUM(i.hrs_java),  0) AS delta_java,
    cpp.cap_cobol_horas - COALESCE(SUM(i.hrs_cobol), 0) AS delta_cobol,
    ROUND(COALESCE(SUM(i.hrs_java),  0)::NUMERIC / NULLIF(cpp.cap_java_horas,  0) * 100, 1) AS pct_java,
    ROUND(COALESCE(SUM(i.hrs_cobol), 0)::NUMERIC / NULLIF(cpp.cap_cobol_horas, 0) * 100, 1) AS pct_cobol,
    cpp.alerta
FROM proyectos p
JOIN capacidad_proyecto_pi cpp ON cpp.proyecto_id = p.id
JOIN pi ON pi.id = cpp.pi_id AND pi.activo = TRUE
LEFT JOIN ibl i ON i.proyecto_id = p.id AND i.pi_id = pi.id
GROUP BY p.identi, p.nombre, p.squad, cpp.cap_java_horas, cpp.cap_cobol_horas, cpp.alerta
ORDER BY dem_java DESC;

COMMENT ON VIEW v_resumen_proyectos IS 'Capacidad vs Demanda por proyecto en el PI activo';

-- ---------------------------------------------------------------
-- FUNCIÓN: trigger para actualizar updated_at automáticamente
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ibl_updated_at
    BEFORE UPDATE ON ibl
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_escalamiento_updated_at
    BEFORE UPDATE ON escalamientos
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ---------------------------------------------------------------
-- ÍNDICES
-- ---------------------------------------------------------------
CREATE INDEX idx_ibl_pi_id          ON ibl (pi_id);
CREATE INDEX idx_ibl_proyecto_id    ON ibl (proyecto_id);
CREATE INDEX idx_ibl_key            ON ibl (key);
CREATE INDEX idx_tracking_ibl_fecha ON ibl_tracking (ibl_id, fecha_registro DESC);
CREATE INDEX idx_escalamientos_ibl  ON escalamientos (ibl_id, resuelto);
CREATE INDEX idx_recursos_ibl       ON ibl_recursos (ibl_id);
CREATE INDEX idx_recursos_persona   ON ibl_recursos (persona_id);
CREATE INDEX idx_cap_persona_pi     ON capacidad_persona_pi (pi_id, persona_id);

-- ---------------------------------------------------------------
-- TABLAS OPERATIVAS: cargas Excel, snapshots y auditoría del agente
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS excel_import_batches (
    id UUID PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PREVIEW',
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS excel_import_rows (
    id SERIAL PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES excel_import_batches(id) ON DELETE CASCADE,
    row_number INTEGER,
    key VARCHAR(30),
    action VARCHAR(30) NOT NULL,
    errors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ibl_snapshots (
    id SERIAL PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES excel_import_batches(id) ON DELETE CASCADE,
    key VARCHAR(30) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_id, key)
);

CREATE TABLE IF NOT EXISTS agent_audit_log (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(100),
    actor VARCHAR(150) NOT NULL DEFAULT 'agent',
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_key VARCHAR(80),
    old_data JSONB,
    new_data JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_excel_batches_status_created
    ON excel_import_batches (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_excel_rows_batch_action
    ON excel_import_rows (batch_id, action);
CREATE INDEX IF NOT EXISTS idx_excel_rows_key
    ON excel_import_rows (key);
CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON agent_audit_log (entity_type, entity_key, created_at DESC);
