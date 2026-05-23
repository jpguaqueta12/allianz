from __future__ import annotations

from typing import Any


def _get_settings_lazy():
    from app.config import get_settings
    return get_settings()


SCHEMA_STATEMENTS = [
    """
    IF OBJECT_ID('dbo.pi', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.pi (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            nombre NVARCHAR(40) NOT NULL UNIQUE,
            fecha_inicio DATE NOT NULL,
            fecha_fin DATE NOT NULL,
            dias_laborables INT NOT NULL,
            horas_por_dia INT NOT NULL CONSTRAINT DF_pi_horas_por_dia DEFAULT 8,
            horas_por_persona AS (dias_laborables * horas_por_dia) PERSISTED,
            activo BIT NOT NULL CONSTRAINT DF_pi_activo DEFAULT 1,
            estado NVARCHAR(20) NOT NULL CONSTRAINT DF_pi_estado DEFAULT 'PLANIFICACION',
            modulo NVARCHAR(30) NOT NULL CONSTRAINT DF_pi_modulo DEFAULT 'MEJORA_CONTINUA',
            descripcion NVARCHAR(MAX) NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_pi_created_at DEFAULT SYSUTCDATETIME()
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.festivos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.festivos (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            pi_id INT NOT NULL,
            fecha DATE NOT NULL,
            nombre NVARCHAR(100) NOT NULL,
            CONSTRAINT FK_festivos_pi FOREIGN KEY (pi_id) REFERENCES dbo.pi(id) ON DELETE CASCADE,
            CONSTRAINT UQ_festivos_pi_fecha UNIQUE (pi_id, fecha)
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.proyectos', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.proyectos (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            identi NVARCHAR(30) NOT NULL UNIQUE,
            nombre NVARCHAR(150) NOT NULL,
            squad NVARCHAR(40) NOT NULL CONSTRAINT DF_proyectos_squad DEFAULT 'TODOS',
            modulo NVARCHAR(30) NOT NULL CONSTRAINT DF_proyectos_modulo DEFAULT 'FABRICA',
            activo BIT NOT NULL CONSTRAINT DF_proyectos_activo DEFAULT 1
        );
    END
    """,
    "IF COL_LENGTH('dbo.proyectos', 'modulo') IS NULL ALTER TABLE dbo.proyectos ADD modulo NVARCHAR(30) NOT NULL CONSTRAINT DF_proyectos_modulo_added DEFAULT 'FABRICA';",
    """
    IF OBJECT_ID('dbo.personas', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.personas (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            nombre NVARCHAR(150) NOT NULL,
            tecnologia NVARCHAR(20) NOT NULL,
            rol NVARCHAR(40) NOT NULL CONSTRAINT DF_personas_rol DEFAULT 'Desarrollador',
            activo BIT NOT NULL CONSTRAINT DF_personas_activo DEFAULT 1,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_personas_created_at DEFAULT SYSUTCDATETIME()
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.capacidad_persona_pi', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.capacidad_persona_pi (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            pi_id INT NOT NULL,
            persona_id INT NOT NULL,
            proyecto_principal INT NULL,
            capacidad_horas INT NULL,
            reserva_estimacion_horas DECIMAL(12,2) NOT NULL CONSTRAINT DF_cpp_reserva_estimacion DEFAULT 0,
            reserva_estimacion_periodo NVARCHAR(20) NOT NULL CONSTRAINT DF_cpp_reserva_periodo DEFAULT 'PI',
            senior BIT NOT NULL CONSTRAINT DF_cpp_senior DEFAULT 0,
            CONSTRAINT FK_cpp_pi FOREIGN KEY (pi_id) REFERENCES dbo.pi(id) ON DELETE CASCADE,
            CONSTRAINT FK_cpp_persona FOREIGN KEY (persona_id) REFERENCES dbo.personas(id) ON DELETE CASCADE,
            CONSTRAINT FK_cpp_proyecto FOREIGN KEY (proyecto_principal) REFERENCES dbo.proyectos(id),
            CONSTRAINT UQ_cpp_pi_persona UNIQUE (pi_id, persona_id)
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.capacidad_proyecto_pi', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.capacidad_proyecto_pi (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            pi_id INT NOT NULL,
            proyecto_id INT NOT NULL,
            cap_java_horas INT NOT NULL CONSTRAINT DF_cppi_java DEFAULT 0,
            cap_cobol_horas INT NOT NULL CONSTRAINT DF_cppi_cobol DEFAULT 0,
            alerta NVARCHAR(40) NULL,
            CONSTRAINT FK_cppi_pi FOREIGN KEY (pi_id) REFERENCES dbo.pi(id) ON DELETE CASCADE,
            CONSTRAINT FK_cppi_proyecto FOREIGN KEY (proyecto_id) REFERENCES dbo.proyectos(id),
            CONSTRAINT UQ_cppi_pi_proyecto UNIQUE (pi_id, proyecto_id)
        );
    END
    """,
    "IF COL_LENGTH('dbo.capacidad_persona_pi', 'reserva_estimacion_horas') IS NULL ALTER TABLE dbo.capacidad_persona_pi ADD reserva_estimacion_horas DECIMAL(12,2) NOT NULL CONSTRAINT DF_cpp_reserva_estimacion_added DEFAULT 0;",
    "IF COL_LENGTH('dbo.capacidad_persona_pi', 'reserva_estimacion_periodo') IS NULL ALTER TABLE dbo.capacidad_persona_pi ADD reserva_estimacion_periodo NVARCHAR(20) NOT NULL CONSTRAINT DF_cpp_reserva_periodo_added DEFAULT 'PI';",
    "IF COL_LENGTH('dbo.capacidad_persona_pi', 'senior') IS NULL ALTER TABLE dbo.capacidad_persona_pi ADD senior BIT NOT NULL CONSTRAINT DF_cpp_senior_added DEFAULT 0;",
    "IF COL_LENGTH('dbo.personas', 'modulo') IS NULL ALTER TABLE dbo.personas ADD modulo NVARCHAR(30) NOT NULL CONSTRAINT DF_personas_modulo DEFAULT 'FABRICA';",
    """
    IF OBJECT_ID('dbo.disponibilidad_novedades', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.disponibilidad_novedades (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            pi_id INT NOT NULL,
            persona_id INT NOT NULL,
            tipo NVARCHAR(40) NOT NULL,
            fecha_inicio DATE NOT NULL,
            fecha_fin DATE NOT NULL,
            horas_por_dia DECIMAL(12,2) NULL,
            descripcion NVARCHAR(MAX) NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_disp_nov_created DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_disp_nov_pi FOREIGN KEY (pi_id) REFERENCES dbo.pi(id) ON DELETE CASCADE,
            CONSTRAINT FK_disp_nov_persona FOREIGN KEY (persona_id) REFERENCES dbo.personas(id) ON DELETE CASCADE
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.backlog_mejora_continua', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.backlog_mejora_continua (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            created DATETIME2 NULL,
            issue_type NVARCHAR(100) NULL,
            ticket_key NVARCHAR(80) NULL,
            project NVARCHAR(120) NULL,
            status NVARCHAR(100) NULL,
            include_release_notes NVARCHAR(120) NULL,
            resolution NVARCHAR(120) NULL,
            summary NVARCHAR(MAX) NOT NULL,
            assigned_team NVARCHAR(150) NULL,
            assignee NVARCHAR(150) NULL,
            reporter NVARCHAR(150) NULL,
            epic_link NVARCHAR(150) NULL,
            priority NVARCHAR(40) NULL,
            updated DATETIME2 NULL,
            story_points DECIMAL(12,2) NULL,
            sprint NVARCHAR(200) NULL,
            labels NVARCHAR(MAX) NULL,
            components NVARCHAR(MAX) NULL,
            fix_version NVARCHAR(MAX) NULL,
            pi_id INT NULL,
            extra NVARCHAR(MAX) NULL,
            responsable_java NVARCHAR(300) NULL,
            responsable_cobol NVARCHAR(300) NULL,
            responsable_dialogue NVARCHAR(300) NULL,
            responsable_parametria NVARCHAR(300) NULL,
            responsable_qa NVARCHAR(300) NULL,
            horas_analisis_java DECIMAL(12,2) NULL,
            horas_analisis_cobol DECIMAL(12,2) NULL,
            horas_analisis_dialogue DECIMAL(12,2) NULL,
            horas_analisis_parametria DECIMAL(12,2) NULL,
            horas_analisis_qa DECIMAL(12,2) NULL,
            horas_desarrollo_java DECIMAL(12,2) NULL,
            horas_desarrollo_cobol DECIMAL(12,2) NULL,
            horas_desarrollo_dialogue DECIMAL(12,2) NULL,
            horas_desarrollo_parametria DECIMAL(12,2) NULL,
            horas_pruebas_java DECIMAL(12,2) NULL,
            horas_pruebas_cobol DECIMAL(12,2) NULL,
            horas_pruebas_dialogue DECIMAL(12,2) NULL,
            horas_pruebas_parametria DECIMAL(12,2) NULL,
            horas_af_java DECIMAL(12,2) NULL,
            horas_af_cobol DECIMAL(12,2) NULL,
            horas_af_dialogue DECIMAL(12,2) NULL,
            horas_af_parametria DECIMAL(12,2) NULL,
            horas_af_qa DECIMAL(12,2) NULL,
            fecha_asignacion DATE NULL,
            fecha_finalizacion DATE NULL,
            fecha_escalado DATE NULL,
            fecha_reinicio DATE NULL,
            fecha_entrega DATE NULL,
            etc INT NOT NULL CONSTRAINT DF_bmc_etc DEFAULT 0,
            status_antes_escalado NVARCHAR(100) NULL,
            CONSTRAINT FK_bmc_pi FOREIGN KEY (pi_id) REFERENCES dbo.pi(id)
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.backlog_fabrica', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.backlog_fabrica (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            created DATETIME2 NULL,
            issue_type NVARCHAR(100) NULL,
            ticket_key NVARCHAR(80) NULL,
            project NVARCHAR(120) NULL,
            status NVARCHAR(100) NULL,
            include_release_notes NVARCHAR(120) NULL,
            resolution NVARCHAR(120) NULL,
            summary NVARCHAR(MAX) NOT NULL,
            assigned_team NVARCHAR(150) NULL,
            assignee NVARCHAR(150) NULL,
            reporter NVARCHAR(150) NULL,
            epic_link NVARCHAR(150) NULL,
            priority NVARCHAR(40) NULL,
            updated DATETIME2 NULL,
            story_points DECIMAL(12,2) NULL,
            sprint NVARCHAR(200) NULL,
            labels NVARCHAR(MAX) NULL,
            components NVARCHAR(MAX) NULL,
            fix_version NVARCHAR(MAX) NULL,
            pi_id INT NULL,
            extra NVARCHAR(MAX) NULL,
            responsable_java NVARCHAR(300) NULL,
            responsable_cobol NVARCHAR(300) NULL,
            responsable_dialogue NVARCHAR(300) NULL,
            responsable_parametria NVARCHAR(300) NULL,
            responsable_qa NVARCHAR(300) NULL,
            horas_analisis_java DECIMAL(12,2) NULL,
            horas_analisis_cobol DECIMAL(12,2) NULL,
            horas_analisis_dialogue DECIMAL(12,2) NULL,
            horas_analisis_parametria DECIMAL(12,2) NULL,
            horas_analisis_qa DECIMAL(12,2) NULL,
            horas_desarrollo_java DECIMAL(12,2) NULL,
            horas_desarrollo_cobol DECIMAL(12,2) NULL,
            horas_desarrollo_dialogue DECIMAL(12,2) NULL,
            horas_desarrollo_parametria DECIMAL(12,2) NULL,
            horas_pruebas_java DECIMAL(12,2) NULL,
            horas_pruebas_cobol DECIMAL(12,2) NULL,
            horas_pruebas_dialogue DECIMAL(12,2) NULL,
            horas_pruebas_parametria DECIMAL(12,2) NULL,
            horas_af_java DECIMAL(12,2) NULL,
            horas_af_cobol DECIMAL(12,2) NULL,
            horas_af_dialogue DECIMAL(12,2) NULL,
            horas_af_parametria DECIMAL(12,2) NULL,
            horas_af_qa DECIMAL(12,2) NULL,
            fecha_asignacion DATE NULL,
            fecha_finalizacion DATE NULL,
            fecha_escalado DATE NULL,
            fecha_reinicio DATE NULL,
            fecha_entrega DATE NULL,
            etc INT NOT NULL CONSTRAINT DF_bfab_etc DEFAULT 0,
            status_antes_escalado NVARCHAR(100) NULL,
            CONSTRAINT FK_bfab_pi FOREIGN KEY (pi_id) REFERENCES dbo.pi(id)
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.sla_policies', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.sla_policies (
            id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            modulo NVARCHAR(30) NOT NULL,
            issue_type NVARCHAR(80) NULL,
            priority NVARCHAR(40) NULL,
            nombre NVARCHAR(120) NOT NULL,
            sla_dias INT NOT NULL,
            alerta_pct DECIMAL(5,2) NOT NULL CONSTRAINT DF_sla_alerta DEFAULT 0.30,
            pausa_escalado BIT NOT NULL CONSTRAINT DF_sla_pausa DEFAULT 1,
            activo BIT NOT NULL CONSTRAINT DF_sla_activo DEFAULT 1,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_sla_created DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2 NOT NULL CONSTRAINT DF_sla_updated DEFAULT SYSUTCDATETIME()
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.sla_daily_snapshots', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.sla_daily_snapshots (
            id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            modulo NVARCHAR(30) NOT NULL,
            pi_id BIGINT NOT NULL,
            snapshot_date DATE NOT NULL,
            summary NVARCHAR(MAX) NOT NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_sla_snap_created DEFAULT SYSUTCDATETIME(),
            updated_at DATETIME2 NOT NULL CONSTRAINT DF_sla_snap_updated DEFAULT SYSUTCDATETIME(),
            CONSTRAINT UQ_sla_daily_snapshot UNIQUE (modulo, pi_id, snapshot_date)
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.excel_import_batches', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.excel_import_batches (
            id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
            filename NVARCHAR(255) NOT NULL,
            file_hash NVARCHAR(64) NOT NULL,
            status NVARCHAR(20) NOT NULL CONSTRAINT DF_excel_status DEFAULT 'PREVIEW',
            summary NVARCHAR(MAX) NOT NULL CONSTRAINT DF_excel_summary DEFAULT '{}',
            created_by NVARCHAR(150) NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_excel_created DEFAULT SYSUTCDATETIME(),
            applied_at DATETIME2 NULL
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.excel_import_rows', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.excel_import_rows (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            batch_id UNIQUEIDENTIFIER NOT NULL,
            row_number INT NULL,
            [key] NVARCHAR(80) NULL,
            action NVARCHAR(30) NOT NULL,
            errors NVARCHAR(MAX) NOT NULL CONSTRAINT DF_excel_rows_errors DEFAULT '[]',
            old_data NVARCHAR(MAX) NULL,
            new_data NVARCHAR(MAX) NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_excel_rows_created DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_excel_rows_batch FOREIGN KEY (batch_id) REFERENCES dbo.excel_import_batches(id) ON DELETE CASCADE
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.ibl_snapshots', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.ibl_snapshots (
            id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            batch_id UNIQUEIDENTIFIER NOT NULL,
            [key] NVARCHAR(80) NOT NULL,
            data NVARCHAR(MAX) NOT NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_ibl_snap_created DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_ibl_snap_batch FOREIGN KEY (batch_id) REFERENCES dbo.excel_import_batches(id) ON DELETE CASCADE,
            CONSTRAINT UQ_ibl_snap_batch_key UNIQUE (batch_id, [key])
        );
    END
    """,
    """
    IF OBJECT_ID('dbo.agent_audit_log', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.agent_audit_log (
            id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            session_id NVARCHAR(100) NULL,
            actor NVARCHAR(150) NOT NULL CONSTRAINT DF_audit_actor DEFAULT 'agent',
            action NVARCHAR(80) NOT NULL,
            entity_type NVARCHAR(40) NOT NULL,
            entity_key NVARCHAR(80) NULL,
            old_data NVARCHAR(MAX) NULL,
            new_data NVARCHAR(MAX) NULL,
            reason NVARCHAR(MAX) NULL,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_audit_created DEFAULT SYSUTCDATETIME()
        );
    END
    """,
    "IF COL_LENGTH('dbo.backlog_mejora_continua', 'escalados') IS NULL ALTER TABLE dbo.backlog_mejora_continua ADD escalados NVARCHAR(MAX) NULL;",
    "IF COL_LENGTH('dbo.backlog_mejora_continua', 'fecha_finalizacion_inicial') IS NULL ALTER TABLE dbo.backlog_mejora_continua ADD fecha_finalizacion_inicial DATE NULL;",
    "IF COL_LENGTH('dbo.backlog_fabrica', 'escalados') IS NULL ALTER TABLE dbo.backlog_fabrica ADD escalados NVARCHAR(MAX) NULL;",
    "IF COL_LENGTH('dbo.backlog_fabrica', 'fecha_finalizacion_inicial') IS NULL ALTER TABLE dbo.backlog_fabrica ADD fecha_finalizacion_inicial DATE NULL;",
    "IF COL_LENGTH('dbo.backlog_mejora_continua', 'estado_critico') IS NULL ALTER TABLE dbo.backlog_mejora_continua ADD estado_critico BIT NOT NULL CONSTRAINT DF_bmc_estado_critico DEFAULT 0;",
    "IF COL_LENGTH('dbo.backlog_fabrica', 'estado_critico') IS NULL ALTER TABLE dbo.backlog_fabrica ADD estado_critico BIT NOT NULL CONSTRAINT DF_bfab_estado_critico DEFAULT 0;",
    """
    IF OBJECT_ID('dbo.usuarios', 'U') IS NULL
    BEGIN
        CREATE TABLE dbo.usuarios (
            id       BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
            username NVARCHAR(80)  NOT NULL UNIQUE,
            nombre   NVARCHAR(120) NOT NULL,
            rol      NVARCHAR(20)  NOT NULL CONSTRAINT DF_usr_rol DEFAULT 'user',
            password_hash NVARCHAR(256) NOT NULL,
            activo   BIT NOT NULL CONSTRAINT DF_usr_activo DEFAULT 1,
            created_at DATETIME2 NOT NULL CONSTRAINT DF_usr_created DEFAULT SYSUTCDATETIME()
        );
    END
    """,
]


INDEX_STATEMENTS = [
    "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_pi_activo_modulo' AND object_id=OBJECT_ID('dbo.pi')) CREATE INDEX idx_pi_activo_modulo ON dbo.pi(modulo, activo, fecha_inicio DESC);",
    "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_cpp_pi_persona' AND object_id=OBJECT_ID('dbo.capacidad_persona_pi')) CREATE INDEX idx_cpp_pi_persona ON dbo.capacidad_persona_pi(pi_id, persona_id);",
    "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_disp_nov_pi_persona' AND object_id=OBJECT_ID('dbo.disponibilidad_novedades')) CREATE INDEX idx_disp_nov_pi_persona ON dbo.disponibilidad_novedades(pi_id, persona_id, fecha_inicio, fecha_fin);",
    "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_cppi_pi_proyecto' AND object_id=OBJECT_ID('dbo.capacidad_proyecto_pi')) CREATE INDEX idx_cppi_pi_proyecto ON dbo.capacidad_proyecto_pi(pi_id, proyecto_id);",
    "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='uq_bmc_ticket_pi' AND object_id=OBJECT_ID('dbo.backlog_mejora_continua')) CREATE UNIQUE INDEX uq_bmc_ticket_pi ON dbo.backlog_mejora_continua(ticket_key, pi_id) WHERE ticket_key IS NOT NULL;",
    "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='uq_bfab_ticket_pi' AND object_id=OBJECT_ID('dbo.backlog_fabrica')) CREATE UNIQUE INDEX uq_bfab_ticket_pi ON dbo.backlog_fabrica(ticket_key, pi_id) WHERE ticket_key IS NOT NULL;",
    "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_audit_entity' AND object_id=OBJECT_ID('dbo.agent_audit_log')) CREATE INDEX idx_audit_entity ON dbo.agent_audit_log(entity_type, entity_key, created_at DESC);",
    "IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_sla_lookup' AND object_id=OBJECT_ID('dbo.sla_policies')) CREATE INDEX idx_sla_lookup ON dbo.sla_policies(modulo, issue_type, priority, activo);",
]


PROJECT_SEED = [
    ("MD", "Menor Demand - Nueva Célula", "TODOS", "MEJORA_CONTINUA"),
    ("FAST", "Fast Project", "COMMERCIAL", "FABRICA"),
    ("PVI", "PVI Fase 2", "RETAIL/P&C", "FABRICA"),
    ("MIPYME", "Mipyme Fase 2", "RETAIL/P&C", "FABRICA"),
    ("MD.5", "Canal Directo Autos", "COMMERCIAL", "FABRICA"),
    ("AGRO", "Agro", "RETAIL/P&C", "FABRICA"),
    ("UNITLINK", "Unit Link", "LIFE&HEALTH", "FABRICA"),
    ("FRISS", "Fraude FRISS", "RETAIL/P&C", "FABRICA"),
    ("PHMP", "Gestión Riesgo PHMP", "LIFE&HEALTH", "FABRICA"),
    ("NIIF", "NIIF 9 y 17", "LIFE&HEALTH", "FABRICA"),
    ("LEO", "Leonardo Framework", "TODOS", "FABRICA"),
    ("HERMES", "Hermes", "COMMERCIAL", "FABRICA"),
    ("CLAIMS", "Claims Salud", "LIFE&HEALTH", "FABRICA"),
    ("VIDA G", "Vida Grupo Fase 3", "LIFE&HEALTH", "FABRICA"),
    ("REASEGURO", "Reaseguro Implementación", "RETAIL/P&C", "FABRICA"),
    ("AUTORIZACIONES", "Autorizaciones", "LIFE&HEALTH", "FABRICA"),
]


PERSONA_SEED = [
    # (nombre, tecnologia, rol, modulo)
    # COBOL — Fábrica
    ("Sergio Alejandro Panche",            "COBOL", "Lider Tec.",   "FABRICA"),
    ("Roger Armando Lozada Ortiz",         "COBOL", "Desarrollador","FABRICA"),
    ("Angie Lizeth Cordoba Lesmes",        "COBOL", "Desarrollador","FABRICA"),
    ("Maria Fernanda Alvarado",            "COBOL", "Desarrollador","FABRICA"),
    ("Fredy Fernando Patiño Rave",         "COBOL", "Desarrollador","FABRICA"),
    ("Juan Carlos Villarreal Carrera",     "COBOL", "Desarrollador","FABRICA"),
    ("Heidy Vanessa Sanchez Pulido",       "COBOL", "Desarrollador","FABRICA"),
    ("Kevin Alejandro Correa Hurtado",     "COBOL", "Desarrollador","FABRICA"),
    # COBOL — Mejora Continua
    ("Jeisson Andres Cutiva Cardenas",     "COBOL", "Desarrollador","MEJORA_CONTINUA"),
    ("Sandra Lorena Martinez Merchan",     "COBOL", "Desarrollador","MEJORA_CONTINUA"),
    ("Juan David Caceres Aponte",          "COBOL", "Desarrollador","MEJORA_CONTINUA"),
    # JAVA — Fábrica
    ("Laura Marietta Corredor Saenz",      "JAVA",  "Lider Tec.",   "FABRICA"),
    ("Andres Felipe Novoa Garcia",         "JAVA",  "Desarrollador","FABRICA"),
    ("Camilo Lobo Guerrero Nova",          "JAVA",  "Desarrollador","FABRICA"),
    ("Deivis David Sanchez Mestra",        "JAVA",  "Desarrollador","FABRICA"),
    ("Diego Alejandro Rodriguez Martinez", "JAVA",  "Desarrollador","FABRICA"),
    ("Erik Steven Alegria Mina",           "JAVA",  "Desarrollador","FABRICA"),
    ("Jeison Stiven Rojas Montoya",        "JAVA",  "Desarrollador","FABRICA"),
    ("Jorge Enrique Castillo Gonzalez",    "JAVA",  "Desarrollador","FABRICA"),
    ("Nicolas Andres Menaca Trujillo",     "JAVA",  "Desarrollador","FABRICA"),
    ("Johan David Garzon Uricoechea",      "JAVA",  "Desarrollador","FABRICA"),
    ("Carlos Andres Pavajeau Max",         "JAVA",  "Desarrollador","FABRICA"),
    ("Nicolas Cardenas Rodriguez",         "JAVA",  "Desarrollador","FABRICA"),
    ("Johnny Agudelo Rios",                "JAVA",  "Desarrollador","FABRICA"),
    ("Jhon Carlos Colorado Angulo",        "JAVA",  "Desarrollador","FABRICA"),
    ("Andres Sebastian Cubillos",          "JAVA",  "Desarrollador","FABRICA"),
    ("Santiago Nicolas Briñez Garcia",     "JAVA",  "Desarrollador","FABRICA"),
    # JAVA — Mejora Continua
    ("Alvaro Alfonso Lasso Lopez",         "JAVA",  "Desarrollador","MEJORA_CONTINUA"),
    ("David Alexander Vasquez Vivas",      "JAVA",  "Desarrollador","MEJORA_CONTINUA"),
    ("Dilan Camilo Martinez Zapata",       "JAVA",  "Desarrollador","MEJORA_CONTINUA"),
    ("John Jairo Robledo Quintero",        "JAVA",  "Desarrollador","MEJORA_CONTINUA"),
    # Calidad (compartida — aparece en ambos módulos)
    ("Carlos Villadiego",                  "CALIDAD", "Desarrollador","FABRICA"),
    ("Rafael Alvarado",                    "CALIDAD", "Desarrollador","FABRICA"),
    ("Laura Fernanda Pardo",               "CALIDAD", "Desarrollador","FABRICA"),
    ("Maryerin Hernandez",                 "CALIDAD", "Desarrollador","FABRICA"),
]


POLICY_SEED = [
    ("MEJORA_CONTINUA", None, None, "SLA estándar Mejora Continua", 10, 0.30, True),
    ("FABRICA", None, None, "SLA estándar Fábrica", 10, 0.30, True),
    ("MEJORA_CONTINUA", None, "Highest", "SLA crítico Mejora Continua", 3, 0.40, True),
    ("MEJORA_CONTINUA", None, "High", "SLA alto Mejora Continua", 5, 0.35, True),
    ("FABRICA", None, "Highest", "SLA crítico Fábrica", 3, 0.40, True),
    ("FABRICA", None, "High", "SLA alto Fábrica", 5, 0.35, True),
]


async def ensure_operational_schema(pool: Any) -> None:
    for statement in SCHEMA_STATEMENTS:
        await pool.execute(statement)
    for statement in INDEX_STATEMENTS:
        await pool.execute(statement)

    await pool.execute("""
        UPDATE dbo.pi SET estado = 'ACTIVO'
        WHERE activo = 1 AND estado = 'PLANIFICACION';
        UPDATE dbo.pi SET estado = 'CERRADO'
        WHERE activo = 0 AND estado = 'PLANIFICACION';
    """)

    for identi, nombre, squad, modulo in PROJECT_SEED:
        await pool.execute("""
            IF NOT EXISTS (SELECT 1 FROM dbo.proyectos WHERE identi = $1)
            INSERT INTO dbo.proyectos (identi, nombre, squad, modulo, activo)
            VALUES ($1, $2, $3, $4, 1)
        """, identi, nombre, squad, modulo)

    await pool.execute("""
        UPDATE dbo.personas
        SET tecnologia = 'CALIDAD'
        WHERE tecnologia = 'QA'
          AND nombre IN (
              'Carlos Villadiego',
              'Rafael Alvarado',
              'Laura Fernanda Pardo',
              'Maryerin Hernandez'
          )
    """)

    for nombre, tecnologia, rol, modulo in PERSONA_SEED:
        await pool.execute("""
            IF NOT EXISTS (SELECT 1 FROM dbo.personas WHERE nombre = $1 AND tecnologia = $2)
            INSERT INTO dbo.personas (nombre, tecnologia, rol, activo, modulo)
            VALUES ($1, $2, $3, 1, $4)
        """, nombre, tecnologia, rol, modulo)

    # Migrar personas existentes al módulo correcto
    mc_names = [
        'Jeisson Andres Cutiva Cardenas',
        'Sandra Lorena Martinez Merchan',
        'Juan David Caceres Aponte',
        'Alvaro Alfonso Lasso Lopez',
        'David Alexander Vasquez Vivas',
        'Dilan Camilo Martinez Zapata',
        'John Jairo Robledo Quintero',
    ]
    for nombre in mc_names:
        await pool.execute(
            "UPDATE dbo.personas SET modulo='MEJORA_CONTINUA' WHERE nombre=$1 AND modulo='FABRICA'",
            nombre,
        )

    for modulo, issue_type, priority, nombre, sla_dias, alerta_pct, pausa in POLICY_SEED:
        await pool.execute("""
            IF NOT EXISTS (
                SELECT 1 FROM dbo.sla_policies
                WHERE modulo = $1
                  AND ISNULL(issue_type, '*') = ISNULL($2, '*')
                  AND ISNULL(priority, '*') = ISNULL($3, '*')
            )
            INSERT INTO dbo.sla_policies (modulo, issue_type, priority, nombre, sla_dias, alerta_pct, pausa_escalado)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, modulo, issue_type, priority, nombre, sla_dias, alerta_pct, pausa)

    await pool.execute("""
        INSERT INTO dbo.capacidad_persona_pi (pi_id, persona_id, capacidad_horas)
        SELECT pi.id, p.id, pi.horas_por_persona
        FROM dbo.pi pi
        CROSS JOIN dbo.personas p
        WHERE p.tecnologia = 'CALIDAD'
          AND pi.estado <> 'CERRADO'
          AND NOT EXISTS (
              SELECT 1
              FROM dbo.capacidad_persona_pi cpp
              WHERE cpp.pi_id = pi.id AND cpp.persona_id = p.id
          )
    """)

    s = _get_settings_lazy()
    for username, nombre, rol, password_hash in [
        (s.super_user,   "Administrador Principal",  "superuser", s.super_password_hash),
        (s.normal_user,  "Planificador",              "user",      s.normal_password_hash),
        ("admin2",       "Administrador 2",           "superuser", "$2b$12$ved5ZgQ97SXzGTkv.hfHZ.8L3JA6/UZwonjBWKUJJYeo05tY12H7S"),
        ("admin3",       "Administrador 3",           "superuser", "$2b$12$uRclEOveQS3qFC.AuZ0N9uoXA9RLUNy14n/GID2BJeHfDa6OZ8nm2"),
    ]:
        await pool.execute("""
            IF NOT EXISTS (SELECT 1 FROM dbo.usuarios WHERE username=$1)
            INSERT INTO dbo.usuarios (username, nombre, rol, password_hash)
            VALUES ($1, $2, $3, $4)
        """, username, nombre, rol, password_hash)
