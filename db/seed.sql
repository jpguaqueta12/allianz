-- =============================================================
-- SEED PI3-2026 — datos reales del Planificador_PI3_2026_FINAL.xlsx
-- =============================================================

-- ---------------------------------------------------------------
-- PI
-- ---------------------------------------------------------------
INSERT INTO pi (nombre, fecha_inicio, fecha_fin, dias_laborables, horas_por_dia, activo, estado, modulo, descripcion)
VALUES ('PI3-2026', '2026-03-25', '2026-05-05', 27, 8, TRUE, 'ACTIVO', 'MEJORA_CONTINUA',
        'Planificador PI3-2026 | Fábrica Software Allianz Technology | FIFO | Nueva Célula: Menor Demand (MD)');

-- ---------------------------------------------------------------
-- FESTIVOS Colombia PI3
-- ---------------------------------------------------------------
INSERT INTO festivos (pi_id, fecha, nombre) VALUES
    (1, '2026-03-23', 'San José (puente)'),
    (1, '2026-04-02', 'Jueves Santo'),
    (1, '2026-04-03', 'Viernes Santo'),
    (1, '2026-05-01', 'Día del Trabajo');

-- ---------------------------------------------------------------
-- PROYECTOS
-- ---------------------------------------------------------------
INSERT INTO proyectos (identi, nombre, squad) VALUES
    ('MD',           'Menor Demand - Nueva Célula',    'TODOS'),
    ('FAST',         'Fast Project',                   'COMMERCIAL'),
    ('PVI',          'PVI Fase 2',                     'RETAIL/P&C'),
    ('MIPYME',       'Mipyme Fase 2',                  'RETAIL/P&C'),
    ('MD.5',         'Canal Directo Autos',             'COMMERCIAL'),
    ('AGRO',         'Agro',                           'RETAIL/P&C'),
    ('UNITLINK',     'Unit Link',                      'LIFE&HEALTH'),
    ('FRISS',        'Fraude FRISS',                   'RETAIL/P&C'),
    ('PHMP',         'Gestión Riesgo PHMP',            'LIFE&HEALTH'),
    ('NIIF',         'NIIF 9 y 17',                    'LIFE&HEALTH'),
    ('LEO',          'Leonardo Framework',              'TODOS'),
    ('HERMES',       'Hermes',                         'COMMERCIAL'),
    ('CLAIMS',       'Claims Salud',                   'LIFE&HEALTH'),
    ('VIDA G',       'Vida Grupo Fase 3',              'LIFE&HEALTH'),
    ('REASEGURO',    'Reaseguro Implementación',       'RETAIL/P&C'),
    ('AUTORIZACIONES','Autorizaciones',                'LIFE&HEALTH');

-- ---------------------------------------------------------------
-- PERSONAS
-- ---------------------------------------------------------------
-- COBOL
INSERT INTO personas (nombre, tecnologia, rol) VALUES
    ('Sergio Alejandro Panche',           'COBOL', 'Lider Tec.'),     -- 1
    ('Roger Armando Lozada Ortiz',        'COBOL', 'Desarrollador'),  -- 2
    ('Angie Lizeth Cordoba Lesmes',       'COBOL', 'Desarrollador'),  -- 3
    ('Maria Fernanda Alvarado',           'COBOL', 'Desarrollador'),  -- 4
    ('Fredy Fernando Patiño Rave',        'COBOL', 'Desarrollador'),  -- 5
    ('Jeisson Andres Cutiva Cardenas',    'COBOL', 'Desarrollador'),  -- 6
    ('Juan Carlos Villarreal Carrera',    'COBOL', 'Desarrollador'),  -- 7
    ('Sandra Lorena Martinez Merchan',    'COBOL', 'Desarrollador'),  -- 8
    ('Heidy Vanessa Sanchez Pulido',      'COBOL', 'Desarrollador'),  -- 9
    ('Juan David Caceres Aponte',         'COBOL', 'Desarrollador'),  -- 10
    ('Kevin Alejandro Correa Hurtado',    'COBOL', 'Desarrollador');  -- 11

-- JAVA
INSERT INTO personas (nombre, tecnologia, rol) VALUES
    ('Laura Marietta Corredor Saenz',     'JAVA', 'Lider Tec.'),      -- 12
    ('Alvaro Alfonso Lasso Lopez',        'JAVA', 'Desarrollador'),   -- 13
    ('Andres Felipe Novoa Garcia',        'JAVA', 'Desarrollador'),   -- 14
    ('Camilo Lobo Guerrero Nova',         'JAVA', 'Desarrollador'),   -- 15
    ('David Alexander Vasquez Vivas',     'JAVA', 'Desarrollador'),   -- 16
    ('Deivis David Sanchez Mestra',       'JAVA', 'Desarrollador'),   -- 17
    ('Diego Alejandro Rodriguez Martinez','JAVA', 'Desarrollador'),   -- 18
    ('Dilan Camilo Martinez Zapata',      'JAVA', 'Desarrollador'),   -- 19
    ('Erik Steven Alegria Mina',          'JAVA', 'Desarrollador'),   -- 20
    ('Jeison Stiven Rojas Montoya',       'JAVA', 'Desarrollador'),   -- 21
    ('John Jairo Robledo Quintero',       'JAVA', 'Desarrollador'),   -- 22
    ('Jorge Enrique Castillo Gonzalez',   'JAVA', 'Desarrollador'),   -- 23
    ('Nicolas Andres Menaca Trujillo',    'JAVA', 'Desarrollador'),   -- 24
    ('Johan David Garzon Uricoechea',     'JAVA', 'Desarrollador'),   -- 25
    ('Carlos Andres Pavajeau Max',        'JAVA', 'Desarrollador'),   -- 26
    ('Nicolas Cardenas Rodriguez',        'JAVA', 'Desarrollador'),   -- 27
    ('Johnny Agudelo Rios',               'JAVA', 'Desarrollador'),   -- 28
    ('Jhon Carlos Colorado Angulo',       'JAVA', 'Desarrollador'),   -- 29
    -- Recursos adicionales mencionados en IBLs
    ('Jeisson Andres Cutiva Cardenas',    'JAVA', 'Desarrollador'),   -- 30  (distinto del COBOL id=6)
    ('Andres Sebastian Cubillos',         'JAVA', 'Desarrollador'),   -- 31
    ('Santiago Nicolas Briñez Garcia',    'JAVA', 'Desarrollador'),   -- 32
    ('Jhonny Agudelo Rios',               'JAVA', 'Desarrollador');   -- 33 (alias Jhonny)

-- Calidad
INSERT INTO personas (nombre, tecnologia, rol) VALUES
    ('Carlos Villadiego',                 'CALIDAD', 'Desarrollador'),
    ('Rafael Alvarado',                   'CALIDAD', 'Desarrollador'),
    ('Laura Fernanda Pardo',              'CALIDAD', 'Desarrollador'),
    ('Maryerin Hernandez',                'CALIDAD', 'Desarrollador');

-- ---------------------------------------------------------------
-- CAPACIDAD POR PERSONA - PI3
-- ---------------------------------------------------------------
-- COBOL (proyecto_principal referencia por nombre de identi)
INSERT INTO capacidad_persona_pi (pi_id, persona_id, proyecto_principal, capacidad_horas)
SELECT 1, p.id,
    (SELECT id FROM proyectos WHERE identi = proj.identi),
    proj.cap
FROM (VALUES
    ('Sergio Alejandro Panche',           'LT',     NULL),   -- Líder, sin cap numérica
    ('Roger Armando Lozada Ortiz',        'CLAIMS',  108),   -- medio tiempo
    ('Angie Lizeth Cordoba Lesmes',       'PHMP',    216),
    ('Maria Fernanda Alvarado',           'AGRO',    216),
    ('Fredy Fernando Patiño Rave',        'PVI',     216),
    ('Jeisson Andres Cutiva Cardenas',    'MD',      216),
    ('Juan Carlos Villarreal Carrera',    'FAST',    216),
    ('Sandra Lorena Martinez Merchan',    'MD',      216),
    ('Heidy Vanessa Sanchez Pulido',      'MD',      216),   -- reaseguro en sheet pero asignada a MD
    ('Juan David Caceres Aponte',         'MD',      216),
    ('Kevin Alejandro Correa Hurtado',    'NIIF',    216)
) AS proj(nombre, identi, cap)
JOIN personas p ON p.nombre = proj.nombre AND p.tecnologia = 'COBOL';

-- JAVA
INSERT INTO capacidad_persona_pi (pi_id, persona_id, proyecto_principal, capacidad_horas)
SELECT 1, p.id,
    (SELECT id FROM proyectos WHERE identi = proj.identi),
    proj.cap
FROM (VALUES
    ('Laura Marietta Corredor Saenz',      'LT',              NULL),
    ('Alvaro Alfonso Lasso Lopez',         'MD',               216),
    ('Andres Felipe Novoa Garcia',         'MIPYME',           216),
    ('Camilo Lobo Guerrero Nova',          'FRISS',            216),
    ('David Alexander Vasquez Vivas',      'MD',               216),
    ('Deivis David Sanchez Mestra',        'FAST',             108),   -- medio tiempo
    ('Diego Alejandro Rodriguez Martinez', 'PHMP',             216),
    ('Dilan Camilo Martinez Zapata',       'MD',               216),
    ('Erik Steven Alegria Mina',           'MD',               216),
    ('Jeison Stiven Rojas Montoya',        'PVI',              216),
    ('John Jairo Robledo Quintero',        'MD',               216),
    ('Jorge Enrique Castillo Gonzalez',    'HERMES',           216),
    ('Nicolas Andres Menaca Trujillo',     'LEO',              216),
    ('Johan David Garzon Uricoechea',      'FRISS',            216),
    ('Carlos Andres Pavajeau Max',         'UNITLINK',         216),
    ('Nicolas Cardenas Rodriguez',         'PVI',              216),
    ('Johnny Agudelo Rios',                'VIDA G',           216),
    ('Jhon Carlos Colorado Angulo',        'AGRO',             108)    -- medio tiempo
) AS proj(nombre, identi, cap)
JOIN personas p ON p.nombre = proj.nombre AND p.tecnologia = 'JAVA';

-- Calidad
INSERT INTO capacidad_persona_pi (pi_id, persona_id, proyecto_principal, capacidad_horas)
SELECT 1, p.id, NULL, 216
FROM personas p
WHERE p.tecnologia = 'CALIDAD';

-- ---------------------------------------------------------------
-- CAPACIDAD PROYECTO PI3
-- ---------------------------------------------------------------
INSERT INTO capacidad_proyecto_pi (pi_id, proyecto_id, cap_java_horas, cap_cobol_horas, alerta)
SELECT 1, p.id, d.cap_java, d.cap_cobol, d.alerta::alerta_proyecto
FROM (VALUES
    ('MD',            972,   648,  'NUEVA CELULA MD'),
    ('FAST',          216,   216,  'SIN DEMANDA'),
    ('PVI',           306,   108,  'SIN DEMANDA'),
    ('MIPYME',        108,   108,  'SIN DEMANDA'),
    ('MD.5',          108,     0,  'SIN DEMANDA'),
    ('AGRO',          108,   108,  'OK'),
    ('UNITLINK',      108,     0,  'SIN DEMANDA'),
    ('FRISS',         306,     0,  'EXCEDE CAPACIDAD'),
    ('PHMP',          216,   216,  'SIN DEMANDA'),
    ('NIIF',            0,   108,  'SIN DEMANDA'),
    ('LEO',           216,     0,  'SIN DEMANDA'),
    ('HERMES',        216,     0,  'OK'),
    ('CLAIMS',        108,   108,  'EXCEDE CAPACIDAD'),
    ('VIDA G',        324,   108,  'SIN DEMANDA'),
    ('REASEGURO',     216,   216,  'SIN DEMANDA'),
    ('AUTORIZACIONES',108,   108,  'EXCEDE CAPACIDAD')
) AS d(identi, cap_java, cap_cobol, alerta)
JOIN proyectos p ON p.identi = d.identi;

-- ---------------------------------------------------------------
-- IBLs — Backlog PI3 (67 items)
-- ---------------------------------------------------------------
-- Referencia de IDs de proyecto:
--   MD=1, FAST=2, PVI=3, MIPYME=4, MD.5=5, AGRO=6, UNITLINK=7,
--   FRISS=8, PHMP=9, NIIF=10, LEO=11, HERMES=12, CLAIMS=13,
--   VIDA G=14, REASEGURO=15, AUTORIZACIONES=16

INSERT INTO ibl (pi_id, numero, key, tipo, proyecto_id, fecha_inicio, fin_desarrollo, entrega_pruebas, entrega_final_pi, etc_horas, pnr_fecha, hrs_java, hrs_cobol, hrs_qa, observaciones)
VALUES
-- IN PROGRESS
(1,  1, 'IBLCDM-20513', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25', 614,  '2026-05-05', NULL,NULL,NULL, NULL),
(1,  2, 'IBLCDM-21589', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25', 402,  '2026-05-05', NULL,NULL,NULL, 'ASIGNAR'),
(1,  3, 'IBLCDM-19698', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25', 299,  '2026-05-05', NULL,NULL,NULL, 'Se desplaza la fecha de entrega para el 7 de Abril por prioridad sobre el IBL 21'),
(1,  4, 'IBLCDM-18640', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-04-20', '2026-04-28', '2026-04-28', 235,  '2026-03-30', NULL, 133,  45, 'se entrega hoy a pruebas 26/02 - Se termina el 18450 y se adelanta el 640'),
(1,  5, 'IBLCDM-18096', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='FRISS'),         '2026-03-25','2026-04-30', '2026-05-05', '2026-05-05', 176,  '2026-03-16', 200, NULL,  56, 'Se revisaron Comentarios de Rafael y aun continúan temas escalado'),
(1,  6, 'IBLCDM-18450', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25', 173,  '2026-05-05', NULL,NULL,NULL, 'Se envió correo, el servicio de colserautos está fallando, se escalan'),
(1,  7, 'IBLCDM-19232', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-04-21', '2026-04-23', '2026-04-23', 166,  '2026-04-06',  144,  12,  10, 'Se dio respuesta al IBLCDM-18450 pero del IBLCDM-19232 aún no se ha tenido respuesta'),
(1,  8, 'IBLCDM-20313', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='CLAIMS'),        '2026-03-25','2026-04-16', '2026-04-21', '2026-04-21', 136,  '2026-04-08',  120, NULL,  24, NULL),
(1,  9, 'IBLCDM-18401', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='FRISS'),         '2026-03-25','2026-04-13', '2026-04-17', '2026-04-17', 131,  '2026-04-10',   95, NULL,  30, 'Se entrega para pruebas paralizadas debido a la dependencia con otros IBLs'),
(1, 10, 'IBLCDM-19764', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='CLAIMS'),        '2026-03-25','2026-04-24', '2026-05-05', '2026-05-05', 130,  '2026-03-20',  162,  94,  51, 'Entrega se mueve para el 10 de abril, debido al escalamiento del 03/03'),
(1, 11, 'IBLCDM-18403', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='FRISS'),         '2026-03-25','2026-04-08', '2026-04-15', '2026-04-15',  87,  '2026-04-14',   70, NULL,  36, NULL),
(1, 12, 'IBLCDM-20537', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='FRISS'),         '2026-03-25','2026-04-16', '2026-04-21', '2026-04-21',  82,  '2026-04-08',  120, NULL,  24, 'REPROGRAMAR - Fue desescalado 19/03/2026 - pendiente reprogramar'),
(1, 13, 'IBLCDM-19646', 'Devolucion',     (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  56,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 14, 'IBLCDM-21719', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  36,  '2026-05-05', NULL,NULL,NULL, 'ASIGNAR'),
(1, 15, 'IBLCDM-18579', 'Est-Alcance',    (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  32,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 16, 'IBLCDM-19451', 'Soporte',        (SELECT id FROM proyectos WHERE identi='AGRO'),          '2026-03-25','2026-03-26', '2026-03-30', '2026-03-30',  32,  '2026-04-28', NULL,  16,  16, NULL),
(1, 17, 'IBLCDM-18220', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='FRISS'),         '2026-03-25','2026-04-06', '2026-04-09', '2026-04-09',  30,  '2026-04-20',   52, NULL,  22, 'se entrega con la premisa de que falta el servicio y campos'),
(1, 18, 'IBLCDM-21336', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  25,  '2026-05-05', NULL,NULL,NULL, 'Se desplaza la fecha de entrega para el 8 de Abril por prioridad sobre el IBL 21'),
(1, 19, 'IBLCDM-21157', 'Estabilizacion', (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, 'REVISAR'),
(1, 20, 'IBLCDM-20722', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 21, 'IBLCDM-21726', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 22, 'IBLCDM-17201', 'Versionamiento', (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, 'David Roa informa que si necesita algo buscará a Camilo, queda pendiente'),
(1, 23, 'IBLCDM-19033', 'Devolucion',     (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 24, 'IBLCDM-21728', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 25, 'IBLCDM-21501', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 26, 'IBLCDM-19152', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 27, 'IBLCDM-21537', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, 'revisar, ya que Andres no realizó entrega formal por correo'),
(1, 28, 'IBLCDM-21998', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 29, 'IBLCDM-21894', 'Alcance',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 30, 'IBLCDM-21985', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 31, 'IBLCDM-21369', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, 'pendiente asignación 3 de febrero'),
(1, 32, 'IBLCDM-17826', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, 'Petición realizada el 18 de noviembre'),
(1, 33, 'IBLCDM-21875', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 34, 'IBLCDM-20042', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 35, 'IBLCDM-19654', 'Devolucion',     (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 36, 'IBLCDM-19035', 'Devolucion',     (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 37, 'IBLCDM-16088', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 38, 'IBLCDM-21872', 'Soporte Hermes', (SELECT id FROM proyectos WHERE identi='HERMES'),        '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, 'jira'),
(1, 39, 'IBLCDM-21445', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, 'Jira'),
(1, 40, 'IBLCDM-21504', 'Devolucion',     (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 41, 'IBLCDM-21848', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 42, 'IBLCDM-21281', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  22,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 43, 'IBLCDM-21338', 'Estimacion',     (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  20,  '2026-05-05', NULL,NULL,NULL, 'ASIGNAR'),
(1, 44, 'IBLCDM-21809', 'Estimacion',     (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  20,  '2026-05-05', NULL,NULL,NULL, 'ASIGNAR'),
(1, 45, 'IBLCDM-19873', 'Estandar Change',(SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  16,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 46, 'IBLCDM-19597', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='AUTORIZACIONES'),'2026-03-25','2026-05-05', NULL,         '2026-05-05', NULL,  '2026-03-17',  243, NULL, NULL, NULL),
(1, 47, 'IBLCDM-18231', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='HERMES'),        '2026-03-25','2026-04-21', NULL,         '2026-04-21', NULL,  '2026-04-08',  138, NULL, NULL, NULL),
-- BLOCKED
(1, 48, 'IBLCDM-18088', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  54,  '2026-05-05', NULL,NULL,NULL, 'Se realizará reunión el día 17 de Marzo a las 4:00 pm'),
(1, 49, 'IBLCDM-18221', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-04-07', '2026-04-13', '2026-04-13',  47,  '2026-04-16',   57,  12,  30, NULL),
(1, 50, 'IBLCDM-16619', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='FRISS'),         '2026-03-25','2026-03-30', NULL,         '2026-03-30',  41,  '2026-04-28',   26, NULL, NULL, '17/03/2026 - Se solicitó realizar unas pruebas en local para verificar que la integración funciona'),
(1, 51, 'IBLCDM-18668', 'Estabilizacion', (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  40,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 52, 'IBLCDM-21443', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-27', NULL,         '2026-03-27',  32,  '2026-04-29',   24, NULL, NULL, NULL),
(1, 53, 'IBLCDM-19552', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='HERMES'),        '2026-03-25','2026-03-30', '2026-04-08', '2026-04-08',  26,  '2026-04-21',   26, NULL,  39, 'Esta escalado bajo el IBLRDM-728189 - 16/03/2026 - Se revisó con Región'),
(1, 54, 'IBLCDM-20803', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-26', NULL,         '2026-03-26',  24,  '2026-04-30', NULL,  16, NULL, NULL),
(1, 55, 'IBLCDM-20888', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-26', NULL,         '2026-03-26',  24,  '2026-04-30', NULL,  16, NULL, 'Debido a que el día 31 era sábado, no se pudo validar completamente la funcionalidad'),
(1, 56, 'IBLCDM-20735', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-26', NULL,         '2026-03-26',  24,  '2026-04-30',   16, NULL, NULL, NULL),
(1, 57, 'IBLCDM-20203', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-26', NULL,         '2026-03-26',  24,  '2026-04-30',   16, NULL, NULL, NULL),
(1, 58, 'IBLCDM-15677', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 59, 'IBLCDM-19581', 'Soporte',        (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  24,  '2026-05-05', NULL,NULL,NULL, 'Esta pendiente el paso a producción por parte de Cobol, y está escalado la parte'),
(1, 60, 'IBLCDM-21315', 'Versionamiento', (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  16,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 61, 'IBLCDM-19063', 'Versionamiento', (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  16,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 62, 'IBLCDM-21200', 'Versionamiento', (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  16,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 63, 'IBLCDM-18187', 'Versionamiento', (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  16,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 64, 'IBLCDM-20476', 'Estimacion',     (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25',  14,  '2026-05-05', NULL,NULL,NULL, NULL),
(1, 65, 'IBLCDM-19877', 'Estimacion',     (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-27', NULL,         '2026-03-27',   8,  '2026-04-29', NULL,  24, NULL, NULL),
(1, 66, 'IBLCDM-18448', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='CLAIMS'),        '2026-03-25','2026-03-30', '2026-04-01', '2026-04-01',   8,  '2026-04-24',   26, NULL,  11, 'ASIGNAR'),
(1, 67, 'IBLCDM-16023', 'Evolutivo',      (SELECT id FROM proyectos WHERE identi='MD'),            '2026-03-25','2026-03-25', NULL,         '2026-03-25', NULL,  '2026-05-05', NULL,NULL,NULL, NULL);

-- ---------------------------------------------------------------
-- TRACKING inicial (estado del Excel al momento de carga)
-- In Progress: IBLs 1-47 | Blocked: IBLs 48-67
-- ---------------------------------------------------------------
INSERT INTO ibl_tracking (ibl_id, fecha_registro, status_real, etc_real_horas, pnr_actualizado)
SELECT i.id, '2026-03-25'::DATE, 'In Progress'::ibl_status, i.etc_horas, i.pnr_fecha
FROM ibl i WHERE i.numero BETWEEN 1 AND 47 AND i.pi_id = 1;

INSERT INTO ibl_tracking (ibl_id, fecha_registro, status_real, etc_real_horas, pnr_actualizado)
SELECT i.id, '2026-03-25'::DATE, 'Blocked'::ibl_status, i.etc_horas, i.pnr_fecha
FROM ibl i WHERE i.numero BETWEEN 48 AND 67 AND i.pi_id = 1;

-- ---------------------------------------------------------------
-- ESCALAMIENTOS iniciales (todos los Blocked al inicio del PI)
-- ---------------------------------------------------------------
INSERT INTO escalamientos (ibl_id, fecha_bloqueo, resuelto)
SELECT i.id, '2026-03-25'::DATE, FALSE
FROM ibl i WHERE i.numero BETWEEN 48 AND 67 AND i.pi_id = 1;

-- ---------------------------------------------------------------
-- ASIGNACIÓN DE RECURSOS (ibl_recursos)
-- Solo los IBLs que tienen dev nombrado en el Excel
-- ---------------------------------------------------------------
-- Helpers: subquery por nombre para buscar persona_id
-- IBL 3: COBOL = Juan Carlos Villarreal / Fredy Patiño | JAVA = Erik Alegria
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19698' AND p.nombre = 'Juan Carlos Villarreal Carrera' AND p.tecnologia = 'COBOL';

INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia, notas)
SELECT i.id, p.id, 'COBOL', 'co-asignado'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19698' AND p.nombre = 'Fredy Fernando Patiño Rave' AND p.tecnologia = 'COBOL';

INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19698' AND p.nombre = 'Erik Steven Alegria Mina' AND p.tecnologia = 'JAVA';

-- IBL 4: COBOL = Angie Cordoba | JAVA = Camilo Lobo
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, t.tech::tecnologia_dev
FROM ibl i
JOIN (VALUES
    ('Angie Lizeth Cordoba Lesmes', 'COBOL'),
    ('Camilo Lobo Guerrero Nova',   'JAVA')
) AS t(nombre, tech) ON TRUE
JOIN personas p ON p.nombre = t.nombre
WHERE i.key = 'IBLCDM-18640';

-- IBL 5: JAVA = Diego Rodriguez
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-18096' AND p.nombre = 'Diego Alejandro Rodriguez Martinez' AND p.tecnologia = 'JAVA';

-- IBL 6: JAVA = Camilo Lobo
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-18450' AND p.nombre = 'Camilo Lobo Guerrero Nova' AND p.tecnologia = 'JAVA';

-- IBL 7: COBOL = (12h) | JAVA = Alvaro Lasso (144h)
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19232' AND p.nombre = 'Alvaro Alfonso Lasso Lopez' AND p.tecnologia = 'JAVA';

-- IBL 8: COBOL = Maria Fernanda Alvarado | JAVA = Andres Novoa
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, t.tech::tecnologia_dev
FROM ibl i
JOIN (VALUES
    ('Maria Fernanda Alvarado',    'COBOL'),
    ('Andres Felipe Novoa Garcia', 'JAVA')
) AS t(nombre, tech) ON TRUE
JOIN personas p ON p.nombre = t.nombre
WHERE i.key = 'IBLCDM-20313';

-- IBL 9: COBOL = Sandra Martinez | JAVA = Alvaro Lasso
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, t.tech::tecnologia_dev
FROM ibl i
JOIN (VALUES
    ('Sandra Lorena Martinez Merchan', 'COBOL'),
    ('Alvaro Alfonso Lasso Lopez',     'JAVA')
) AS t(nombre, tech) ON TRUE
JOIN personas p ON p.nombre = t.nombre
WHERE i.key = 'IBLCDM-18401';

-- IBL 10: COBOL = Sandra Martinez | JAVA = David Vasquez
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, t.tech::tecnologia_dev
FROM ibl i
JOIN (VALUES
    ('Sandra Lorena Martinez Merchan', 'COBOL'),
    ('David Alexander Vasquez Vivas',  'JAVA')
) AS t(nombre, tech) ON TRUE
JOIN personas p ON p.nombre = t.nombre
WHERE i.key = 'IBLCDM-19764';

-- IBL 11: JAVA = Dilan Martinez
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-18403' AND p.nombre = 'Dilan Camilo Martinez Zapata' AND p.tecnologia = 'JAVA';

-- IBL 12: JAVA = Diego Rodriguez
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-20537' AND p.nombre = 'Diego Alejandro Rodriguez Martinez' AND p.tecnologia = 'JAVA';

-- IBL 13: COBOL = Maria Fernanda | JAVA = Erik Alegria
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, t.tech::tecnologia_dev
FROM ibl i
JOIN (VALUES
    ('Maria Fernanda Alvarado',  'COBOL'),
    ('Erik Steven Alegria Mina', 'JAVA')
) AS t(nombre, tech) ON TRUE
JOIN personas p ON p.nombre = t.nombre
WHERE i.key = 'IBLCDM-19646';

-- IBL 16: COBOL = Maria Fernanda (soporte AGRO)
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19451' AND p.nombre = 'Maria Fernanda Alvarado' AND p.tecnologia = 'COBOL';

-- IBL 17: JAVA = Diego Rodriguez
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-18220' AND p.nombre = 'Diego Alejandro Rodriguez Martinez' AND p.tecnologia = 'JAVA';

-- IBL 20: COBOL = Maria Fernanda
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-20722' AND p.nombre = 'Maria Fernanda Alvarado' AND p.tecnologia = 'COBOL';

-- IBL 21: COBOL = Fredy Patiño
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21726' AND p.nombre = 'Fredy Fernando Patiño Rave' AND p.tecnologia = 'COBOL';

-- IBL 22: JAVA = Camilo Lobo
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-17201' AND p.nombre = 'Camilo Lobo Guerrero Nova' AND p.tecnologia = 'JAVA';

-- IBL 23: JAVA = Jeison Rojas
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19033' AND p.nombre = 'Jeison Stiven Rojas Montoya' AND p.tecnologia = 'JAVA';

-- IBL 24: JAVA = Andres Novoa
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21728' AND p.nombre = 'Andres Felipe Novoa Garcia' AND p.tecnologia = 'JAVA';

-- IBL 25: JAVA = Camilo Lobo
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21501' AND p.nombre = 'Camilo Lobo Guerrero Nova' AND p.tecnologia = 'JAVA';

-- IBL 26: JAVA = John Robledo
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19152' AND p.nombre = 'John Jairo Robledo Quintero' AND p.tecnologia = 'JAVA';

-- IBL 27: JAVA = Andres Sebastian Cubillos
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21537' AND p.nombre = 'Andres Sebastian Cubillos' AND p.tecnologia = 'JAVA';

-- IBL 28: COBOL = Angie Cordoba
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21998' AND p.nombre = 'Angie Lizeth Cordoba Lesmes' AND p.tecnologia = 'COBOL';

-- IBL 29: COBOL = Maria Fernanda / Jeisson Cutiva
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21894' AND p.nombre = 'Maria Fernanda Alvarado' AND p.tecnologia = 'COBOL';

-- IBL 30: COBOL = Juan David Caceres
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21985' AND p.nombre = 'Juan David Caceres Aponte' AND p.tecnologia = 'COBOL';

-- IBL 31: COBOL = Angie Cordoba
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21369' AND p.nombre = 'Angie Lizeth Cordoba Lesmes' AND p.tecnologia = 'COBOL';

-- IBL 32: COBOL = Jeisson Cutiva
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-17826' AND p.nombre = 'Jeisson Andres Cutiva Cardenas' AND p.tecnologia = 'COBOL';

-- IBL 33: COBOL = Juan David Caceres
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21875' AND p.nombre = 'Juan David Caceres Aponte' AND p.tecnologia = 'COBOL';

-- IBL 34: JAVA = Jorge Castillo
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-20042' AND p.nombre = 'Jorge Enrique Castillo Gonzalez' AND p.tecnologia = 'JAVA';

-- IBL 35: COBOL = Angie Cordoba
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19654' AND p.nombre = 'Angie Lizeth Cordoba Lesmes' AND p.tecnologia = 'COBOL';

-- IBL 36: COBOL = Fredy Patiño
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19035' AND p.nombre = 'Fredy Fernando Patiño Rave' AND p.tecnologia = 'COBOL';

-- IBL 38: JAVA = John Robledo (Soporte Hermes)
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21872' AND p.nombre = 'John Jairo Robledo Quintero' AND p.tecnologia = 'JAVA';

-- IBL 39: COBOL = Jeisson Cutiva
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21445' AND p.nombre = 'Jeisson Andres Cutiva Cardenas' AND p.tecnologia = 'COBOL';

-- IBL 40: COBOL = Juan David Caceres
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21504' AND p.nombre = 'Juan David Caceres Aponte' AND p.tecnologia = 'COBOL';

-- IBL 45: JAVA = Camilo Lobo
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19873' AND p.nombre = 'Camilo Lobo Guerrero Nova' AND p.tecnologia = 'JAVA';

-- IBL 47: JAVA = Jorge Castillo / John Robledo
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-18231' AND p.nombre = 'Jorge Enrique Castillo Gonzalez' AND p.tecnologia = 'JAVA';

INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia, notas)
SELECT i.id, p.id, 'JAVA', 'co-asignado'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-18231' AND p.nombre = 'John Jairo Robledo Quintero' AND p.tecnologia = 'JAVA';

-- IBL 48 (Blocked): COBOL = Heidy Sanchez
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-18088' AND p.nombre = 'Heidy Vanessa Sanchez Pulido' AND p.tecnologia = 'COBOL';

-- IBL 49: COBOL = Sandra Martinez | JAVA = David Vasquez
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, t.tech::tecnologia_dev
FROM ibl i
JOIN (VALUES
    ('Sandra Lorena Martinez Merchan', 'COBOL'),
    ('David Alexander Vasquez Vivas',  'JAVA')
) AS t(nombre, tech) ON TRUE
JOIN personas p ON p.nombre = t.nombre
WHERE i.key = 'IBLCDM-18221';

-- IBL 50: JAVA = Jeison Rojas
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-16619' AND p.nombre = 'Jeison Stiven Rojas Montoya' AND p.tecnologia = 'JAVA';

-- IBL 52: JAVA = Alvaro Lasso
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21443' AND p.nombre = 'Alvaro Alfonso Lasso Lopez' AND p.tecnologia = 'JAVA';

-- IBL 53: JAVA = Andres Novoa
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19552' AND p.nombre = 'Andres Felipe Novoa Garcia' AND p.tecnologia = 'JAVA';

-- IBL 54: COBOL = Maria Fernanda
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-20803' AND p.nombre = 'Maria Fernanda Alvarado' AND p.tecnologia = 'COBOL';

-- IBL 55: COBOL = Jeisson Cutiva
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-20888' AND p.nombre = 'Jeisson Andres Cutiva Cardenas' AND p.tecnologia = 'COBOL';

-- IBL 56: JAVA = Dilan Martinez
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-20735' AND p.nombre = 'Dilan Camilo Martinez Zapata' AND p.tecnologia = 'JAVA';

-- IBL 57: JAVA = Santiago Briñez
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-20203' AND p.nombre = 'Santiago Nicolas Briñez Garcia' AND p.tecnologia = 'JAVA';

-- IBL 58: JAVA = Jeison Rojas
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-15677' AND p.nombre = 'Jeison Stiven Rojas Montoya' AND p.tecnologia = 'JAVA';

-- IBL 59: COBOL = Maria Fernanda | JAVA = Alvaro Lasso
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, t.tech::tecnologia_dev
FROM ibl i
JOIN (VALUES
    ('Maria Fernanda Alvarado',  'COBOL'),
    ('Alvaro Alfonso Lasso Lopez','JAVA')
) AS t(nombre, tech) ON TRUE
JOIN personas p ON p.nombre = t.nombre
WHERE i.key = 'IBLCDM-19581';

-- IBL 60: COBOL = Roger Lozada
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21315' AND p.nombre = 'Roger Armando Lozada Ortiz' AND p.tecnologia = 'COBOL';

-- IBL 61: JAVA = Alvaro Lasso
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19063' AND p.nombre = 'Alvaro Alfonso Lasso Lopez' AND p.tecnologia = 'JAVA';

-- IBL 62: JAVA = David Vasquez
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-21200' AND p.nombre = 'David Alexander Vasquez Vivas' AND p.tecnologia = 'JAVA';

-- IBL 63: JAVA = John Robledo
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-18187' AND p.nombre = 'John Jairo Robledo Quintero' AND p.tecnologia = 'JAVA';

-- IBL 64: COBOL = Sergio Panche | JAVA = Laura Corredor (estimacion)
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, t.tech::tecnologia_dev
FROM ibl i
JOIN (VALUES
    ('Sergio Alejandro Panche',      'COBOL'),
    ('Laura Marietta Corredor Saenz','JAVA')
) AS t(nombre, tech) ON TRUE
JOIN personas p ON p.nombre = t.nombre
WHERE i.key = 'IBLCDM-20476';

-- IBL 65: COBOL = Juan David Caceres
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-19877' AND p.nombre = 'Juan David Caceres Aponte' AND p.tecnologia = 'COBOL';

-- IBL 66: JAVA = Erik Alegria
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'JAVA'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-18448' AND p.nombre = 'Erik Steven Alegria Mina' AND p.tecnologia = 'JAVA';

-- IBL 67: COBOL = Juan Carlos Villarreal
INSERT INTO ibl_recursos (ibl_id, persona_id, tecnologia)
SELECT i.id, p.id, 'COBOL'
FROM ibl i, personas p
WHERE i.key = 'IBLCDM-16023' AND p.nombre = 'Juan Carlos Villarreal Carrera' AND p.tecnologia = 'COBOL';
