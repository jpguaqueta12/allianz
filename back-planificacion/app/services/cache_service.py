from __future__ import annotations
import asyncio
import json
import time
from typing import Any

try:
    from redis.asyncio import Redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class CacheService:
    _instance: "CacheService | None" = None

    def __init__(self, redis_url: str):
        self._url = redis_url
        self._client: Any = None
        self._use_memory = False
        self._memory_store: dict[str, tuple[str, float | None]] = {}
        self._sse_queues: dict[str, list[asyncio.Queue]] = {}

    @classmethod
    def get_instance(cls) -> "CacheService":
        if cls._instance is None:
            raise RuntimeError("CacheService no inicializado")
        return cls._instance

    async def connect(self):
        if not REDIS_AVAILABLE:
            self._use_memory = True
            return
        try:
            self._client = Redis.from_url(self._url, decode_responses=True)
            await self._client.ping()
        except Exception:
            self._use_memory = True

    async def disconnect(self):
        if self._client:
            await self._client.aclose()

    async def set(self, key: str, value: Any, ttl: int = 3600):
        payload = json.dumps(value, default=str)
        if self._use_memory:
            self._memory_store[key] = (payload, time.time() + ttl)
        else:
            await self._client.setex(key, ttl, payload)

    async def get(self, key: str) -> Any | None:
        if self._use_memory:
            entry = self._memory_store.get(key)
            if not entry:
                return None
            payload, expires = entry
            if expires and time.time() > expires:
                del self._memory_store[key]
                return None
            return json.loads(payload)
        value = await self._client.get(key)
        return json.loads(value) if value else None

    async def publish_sse(self, channel: str, event: dict):
        payload = json.dumps(event, default=str)
        if self._use_memory:
            for q in self._sse_queues.get(channel, []):
                await q.put(payload)
        else:
            await self._client.publish(channel, payload)

    async def subscribe_sse(self, channel: str):
        if self._use_memory:
            q: asyncio.Queue = asyncio.Queue()
            self._sse_queues.setdefault(channel, []).append(q)
            return q
        pubsub = self._client.pubsub()
        await pubsub.subscribe(channel)
        return pubsub

    async def unsubscribe_sse(self, channel: str, subscriber: Any):
        if self._use_memory:
            queues = self._sse_queues.get(channel, [])
            if subscriber in queues:
                queues.remove(subscriber)
        else:
            await subscriber.unsubscribe(channel)
