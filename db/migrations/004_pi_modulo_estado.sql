-- =============================================================
-- MIGRACIÓN 004 — Agregar columnas modulo y estado a la tabla pi
-- Ejecutar sobre la BD allianz_planificador existente
-- =============================================================

-- Agregar columna estado si no existe
ALTER TABLE pi
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'PLANIFICACION';

-- Agregar columna modulo si no existe
ALTER TABLE pi
    ADD COLUMN IF NOT EXISTS modulo VARCHAR(30) NOT NULL DEFAULT 'MEJORA_CONTINUA';

-- Backfill: los PIs con activo=TRUE pasan a estado ACTIVO
UPDATE pi SET estado = 'ACTIVO' WHERE activo = TRUE AND estado = 'PLANIFICACION';

-- Backfill: los PIs con activo=FALSE pasan a estado CERRADO
UPDATE pi SET estado = 'CERRADO' WHERE activo = FALSE AND estado = 'PLANIFICACION';

COMMENT ON COLUMN pi.estado  IS 'Estado del PI: PLANIFICACION | ACTIVO | CERRADO';
COMMENT ON COLUMN pi.modulo  IS 'Módulo dueño del PI: MEJORA_CONTINUA | FABRICA | INCIDENTES';
