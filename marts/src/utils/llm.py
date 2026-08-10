"""
FinAi LLM Router — backward-compatibility shim.
All logic now lives in src.utils.keymodel.
Import from keymodel directly for new code.
"""
from src.utils.keymodel import (
    _PROVIDERS,
    available_providers as _available_providers,
    get_llm,
    get_active_provider,
    list_providers,
    call_ai,
    get_best_api_key,
)

__all__ = [
    "_PROVIDERS",
    "_available_providers",
    "get_llm",
    "get_active_provider",
    "list_providers",
    "call_ai",
    "get_best_api_key",
]
