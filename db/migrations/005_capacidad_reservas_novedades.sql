-- =============================================================
-- MIGRACION 005 - Reservas senior y novedades de disponibilidad
-- Ejecutar sobre la BD allianz_planificador existente
-- =============================================================

ALTER TABLE capacidad_persona_pi
    ADD COLUMN IF NOT EXISTS reserva_estimacion_horas NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE capacidad_persona_pi
    ADD COLUMN IF NOT EXISTS reserva_estimacion_periodo VARCHAR(20) NOT NULL DEFAULT 'PI';

ALTER TABLE capacidad_persona_pi
    ADD COLUMN IF NOT EXISTS senior BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS disponibilidad_novedades (
    id SERIAL PRIMARY KEY,
    pi_id INT NOT NULL REFERENCES pi(id) ON DELETE CASCADE,
    persona_id INT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    horas_por_dia NUMERIC(12,2),
    descripcion TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disp_nov_pi_persona
    ON disponibilidad_novedades(pi_id, persona_id, fecha_inicio, fecha_fin);

COMMENT ON COLUMN capacidad_persona_pi.reserva_estimacion_horas IS 'Horas reservadas para estimaciones o soporte senior. Se interpretan segun reserva_estimacion_periodo.';
COMMENT ON COLUMN capacidad_persona_pi.reserva_estimacion_periodo IS 'PI | SEMANAL | MENSUAL';
COMMENT ON TABLE disponibilidad_novedades IS 'Vacaciones, incapacidades, permisos, calamidades y licencias que descuentan capacidad del PI.';
