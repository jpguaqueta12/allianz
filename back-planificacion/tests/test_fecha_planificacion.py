from __future__ import annotations

import json
import unittest
from datetime import date

from app.db.queries import (
    _add_calendar_days,
    _calendar_days_between,
    _calcular_fecha_fin,
    _horas_por_perfil_de_data,
)


class FechaPlanificacionTests(unittest.TestCase):
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
                    {"responsable": "QA", "perfil": "qa", "fase": "af", "horas": 8},
                ]
            }),
        }

        self.assertEqual(_horas_por_perfil_de_data(data), (16, 8, 8))

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


if __name__ == "__main__":
    unittest.main()
