from __future__ import annotations

import asyncio
import unittest

from app.agent.tools import ALL_TOOLS
from app.services.cache_service import CacheService
from app.services.pending_actions import create_pending_action, get_pending_action


class AgentSafetyTests(unittest.TestCase):
    def test_direct_mutation_tools_are_not_exposed(self):
        tool_names = {tool.name for tool in ALL_TOOLS}

        self.assertNotIn("actualizar_status", tool_names)
        self.assertNotIn("actualizar_etc", tool_names)
        self.assertNotIn("registrar_entrega", tool_names)
        self.assertNotIn("registrar_escalamiento", tool_names)
        self.assertNotIn("resolver_escalamiento", tool_names)

        self.assertIn("consultar_pi_activo", tool_names)
        self.assertIn("consultar_capacidad", tool_names)
        self.assertIn("consultar_resumen_proyectos", tool_names)
        self.assertIn("consultar_backlog", tool_names)
        self.assertIn("consultar_ticket", tool_names)
        self.assertIn("consultar_alertas", tool_names)
        self.assertIn("consultar_resumen_operativo", tool_names)

    def test_pending_action_roundtrip(self):
        async def run():
            cache = CacheService("unused")
            cache._use_memory = True
            CacheService._instance = cache

            action = await create_pending_action(
                session_id="session-1",
                action_type="actualizar_status",
                payload={"key": "IBLCDM-1", "status": "Blocked"},
                description="Bloquear IBLCDM-1",
            )
            stored = await get_pending_action("session-1", action["id"])

            self.assertIsNotNone(stored)
            self.assertEqual(stored["status"], "PENDING")
            self.assertEqual(stored["payload"]["key"], "IBLCDM-1")

        asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
