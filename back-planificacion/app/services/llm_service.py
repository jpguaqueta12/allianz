from __future__ import annotations
from langchain_openai import AzureChatOpenAI
from app.config import get_settings


def get_llm() -> AzureChatOpenAI:
    s = get_settings()
    return AzureChatOpenAI(
        azure_endpoint=s.azure_openai_endpoint,
        api_key=s.azure_openai_api_key,
        azure_deployment=s.azure_openai_deployment,
        api_version=s.azure_openai_api_version,
        temperature=s.azure_openai_temperature,
        streaming=True,
    )
