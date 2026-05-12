-- =============================================================
-- MIGRACIÓN 002 — Agregar fecha_asignacion a tablas de backlog
-- Ejecutar sobre la BD allianz_planificador existente
-- =============================================================

ALTER TABLE backlog_mejora_continua
    ADD COLUMN IF NOT EXISTS fecha_asignacion DATE;

ALTER TABLE backlog_fabrica
    ADD COLUMN IF NOT EXISTS fecha_asignacion DATE;

CREATE INDEX IF NOT EXISTS idx_bmc_fecha_asignacion ON backlog_mejora_continua (fecha_asignacion);
CREATE INDEX IF NOT EXISTS idx_bfab_fecha_asignacion ON backlog_fabrica (fecha_asignacion);

COMMENT ON COLUMN backlog_mejora_continua.fecha_asignacion IS 'Fecha de inicio de asignación del desarrollo';
COMMENT ON COLUMN backlog_fabrica.fecha_asignacion         IS 'Fecha de inicio de asignación del desarrollo';
