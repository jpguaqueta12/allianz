from __future__ import annotations
from typing import Annotated
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage
from typing_extensions import TypedDict


class PlannerState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    session_id: str
