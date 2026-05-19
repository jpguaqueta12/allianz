from __future__ import annotations

import json
import unittest
import asyncio
from datetime import date

from app.db.queries import (
    _add_calendar_days,
    _calendar_days_between,
    _calcular_fecha_fin,
    _calcular_horas_asignadas_por_persona,
    _effective_reserva_estimacion,
    _horas_por_perfil_de_data,
    _planificacion_items_from_extra,
    _row_escalado_activo,
    _working_days_in_range,
)


class FakePool:
    def __init__(self, rows):
        self.rows = rows

    async def fetch(self, query, *args):
        return self.rows


class FechaPlanificacionTests(unittest.TestCase):
    def test_planificacion_items_conserva_status_y_observacion(self):
        items = _planificacion_items_from_extra(json.dumps({
            "planificacion_items": [
                {
                    "responsable": "Ana",
                    "perfil": "java",
                    "fase": "desarrollo",
                    "horas": 8,
                    "tarea": "Task",
                    "subtarea": "Desarrollo",
                    "status": "Blocked",
                    "observacion": "Pendiente de insumo",
                },
            ],
        }))

        self.assertEqual(items[0]["status"], "Blocked")
        self.assertEqual(items[0]["observacion"], "Pendiente de insumo")

    def test_horas_por_perfil_prefiere_items_en_extra(self):
        data = {
            "horas_analisis_java": 1,
            "horas_desarrollo_java": 1,
            "horas_analisis_cobol": 1,
            "horas_desarrollo_cobol": 1,
            "horas_analisis_qa": 1,
            "extra": json.dumps({
                "planificacion_items": [
                    {"responsable": "Ana", "perfil": "java", "fase": "desarrollo", "horas": 16},
                    {"responsable": "Luis", "perfil": "cobol", "fase": "desarrollo", "horas": 8},
                    {"responsable": "Gestion", "perfil": "gestion", "fase": "desarrollo", "horas": 40},
                    {"responsable": "Calidad", "perfil": "calidad", "fase": "desarrollo", "horas": 8},
                ]
            }),
        }

        self.assertEqual(_horas_por_perfil_de_data(data), (16, 8, 8))

    def test_horas_por_perfil_normaliza_qa_como_calidad(self):
        data = {
            "extra": json.dumps({
                "planificacion_items": [
                    {"responsable": "QA", "perfil": "qa", "fase": "af", "horas": 8},
                    {"responsable": "Gestion", "perfil": "dialogue", "fase": "desarrollo", "horas": 40},
                ]
            }),
        }

        self.assertEqual(_horas_por_perfil_de_data(data), (0, 0, 8))

    def test_fecha_fin_aplica_factor_y_dias_laborables(self):
        fecha_fin = _calcular_fecha_fin(
            date(2026, 5, 4),
            java_total=16,
            cobol_total=8,
            qa_total=8,
            horas_por_dia=8,
            festivos=set(),
        )

        self.assertEqual(fecha_fin, date(2026, 5, 8))

    def test_etc_es_tiempo_restante_y_reinicio_suma_dias_calendario(self):
        etc = _calendar_days_between(date(2022, 1, 7), date(2022, 1, 8))
        fecha_fin = _add_calendar_days(date(2022, 1, 15), etc)

        self.assertEqual(etc, 1)
        self.assertEqual(fecha_fin, date(2022, 1, 16))

    def test_escalado_activo_libera_capacidad(self):
        self.assertTrue(_row_escalado_activo({
            "escalados": json.dumps([{"fecha_escalado": "2026-05-15", "fecha_reinicio": None}]),
        }))
        self.assertFalse(_row_escalado_activo({
            "escalados": json.dumps([{"fecha_escalado": "2026-05-15", "fecha_reinicio": "2026-05-20"}]),
        }))

    def test_novedades_cuentan_dias_laborables_sin_festivos(self):
        dias = _working_days_in_range(
            date(2026, 5, 15),
            date(2026, 5, 19),
            {date(2026, 5, 18)},
        )

        self.assertEqual(dias, 2)

    def test_reserva_estimacion_semanal_se_expande_al_pi(self):
        horas = _effective_reserva_estimacion(
            6,
            "SEMANAL",
            date(2026, 5, 15),
            date(2026, 5, 29),
            set(),
        )

        self.assertEqual(horas, 18)

    def test_asignacion_a_usuario_incrementa_capacidad_consumida(self):
        async def run():
            rows = [{
                "extra": json.dumps({
                    "planificacion_items": [
                        {
                            "responsable": "Ana Perez",
                            "perfil": "java",
                            "fase": "desarrollo",
                            "horas": 10,
                            "tarea": "Task",
                            "subtarea": "Soporte",
                        },
                        {
                            "responsable": "Ana Perez",
                            "perfil": "java",
                            "fase": "desarrollo",
                            "horas": 6,
                            "tarea": "Bug",
                            "subtarea": "Estabilización",
                        },
                        {
                            "responsable": "Luis Gomez",
                            "perfil": "cobol",
                            "fase": "desarrollo",
                            "horas": 4,
                        },
                    ]
                }),
                "escalados": "[]",
                "fecha_escalado": None,
                "fecha_reinicio": None,
            }]

            asignadas = await _calcular_horas_asignadas_por_persona(FakePool(rows), 1)

            self.assertEqual(asignadas["Ana Perez"], 16)
            self.assertEqual(asignadas["Luis Gomez"], 4)

        asyncio.run(run())

    def test_eliminar_asignacion_de_usuario_libera_capacidad(self):
        async def run():
            rows = [{
                "extra": json.dumps({"planificacion_items": []}),
                "escalados": "[]",
                "fecha_escalado": None,
                "fecha_reinicio": None,
                "responsable_java": None,
                "responsable_cobol": None,
                "responsable_dialogue": None,
                "responsable_parametria": None,
                "responsable_qa": None,
            }]

            asignadas = await _calcular_horas_asignadas_por_persona(FakePool(rows), 1)

            self.assertEqual(asignadas, {})

        asyncio.run(run())

    def test_ticket_escalado_no_consume_capacidad_del_usuario(self):
        async def run():
            rows = [{
                "extra": json.dumps({
                    "planificacion_items": [
                        {"responsable": "Ana Perez", "perfil": "java", "fase": "desarrollo", "horas": 10},
                    ]
                }),
                "escalados": json.dumps([{"fecha_escalado": "2026-05-15", "fecha_reinicio": None}]),
                "fecha_escalado": "2026-05-15",
                "fecha_reinicio": None,
            }]

            asignadas = await _calcular_horas_asignadas_por_persona(FakePool(rows), 1)

            self.assertEqual(asignadas, {})

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
