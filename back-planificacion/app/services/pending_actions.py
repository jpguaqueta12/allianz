from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.services.cache_service import CacheService


PENDING_ACTION_TTL = 3600


def _key(session_id: str, action_id: str) -> str:
    return f"pending_action:{session_id}:{action_id}"


async def create_pending_action(
    session_id: str,
    action_type: str,
    payload: dict[str, Any],
    description: str,
) -> dict[str, Any]:
    action_id = str(uuid.uuid4())
    action = {
        "id": action_id,
        "type": action_type,
        "payload": payload,
        "description": description,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "PENDING",
    }
    await CacheService.get_instance().set(
        _key(session_id, action_id),
        action,
        ttl=PENDING_ACTION_TTL,
    )
    return action


async def get_pending_action(session_id: str, action_id: str) -> dict[str, Any] | None:
    return await CacheService.get_instance().get(_key(session_id, action_id))


async def mark_pending_action_status(
    session_id: str,
    action_id: str,
    status: str,
    result: dict[str, Any] | None = None,
) -> None:
    action = await get_pending_action(session_id, action_id)
    if not action:
        return
    action["status"] = status
    action["resolved_at"] = datetime.now(timezone.utc).isoformat()
    if result is not None:
        action["result"] = result
    await CacheService.get_instance().set(
        _key(session_id, action_id),
        action,
        ttl=PENDING_ACTION_TTL,
    )
