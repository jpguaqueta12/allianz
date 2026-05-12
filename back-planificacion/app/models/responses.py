from pydantic import BaseModel


class SessionResponse(BaseModel):
    session_id: str
    message: str = "Sesión iniciada"


class ChatStartResponse(BaseModel):
    stream_url: str
    session_id: str
