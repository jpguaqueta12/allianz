-- =============================================================
-- MIGRACIÓN 003 — Agregar fecha_finalizacion a tablas de backlog
-- Ejecutar sobre la BD allianz_planificador existente
-- =============================================================

ALTER TABLE backlog_mejora_continua
    ADD COLUMN IF NOT EXISTS fecha_finalizacion DATE;

ALTER TABLE backlog_fabrica
    ADD COLUMN IF NOT EXISTS fecha_finalizacion DATE;

CREATE INDEX IF NOT EXISTS idx_bmc_fecha_finalizacion  ON backlog_mejora_continua (fecha_finalizacion);
CREATE INDEX IF NOT EXISTS idx_bfab_fecha_finalizacion ON backlog_fabrica (fecha_finalizacion);

COMMENT ON COLUMN backlog_mejora_continua.fecha_finalizacion IS 'Fecha estimada de finalización: max(java,cobol)+qa horas ×1.15 en días laborables desde fecha_asignacion';
COMMENT ON COLUMN backlog_fabrica.fecha_finalizacion         IS 'Fecha estimada de finalización: max(java,cobol)+qa horas ×1.15 en días laborables desde fecha_asignacion';
