"""
FinAi KeyModel — Central AI Provider Hub
=========================================
Single source of truth for all AI model access across the platform.
Every module that needs LLM inference imports from here — never directly
from langchain_openai or via raw os.getenv key lookups.

Provider priority (highest first):
  1. GitHub Models  — gpt-4o-mini  (Azure inference, confirmed working)
  2. Groq Cloud     — llama-3.3-70b-versatile (fast, confirmed working)
  3. NVIDIA NIM     — llama-3.1-8b-instruct
  4. xAI / Grok     — grok-3
  5. Google Gemini  — gemini-2.0-flash
  6. OpenAI         — gpt-4o-mini
  7. DeepSeek       — deepseek-chat
  8. OpenRouter     — openai/gpt-4o-mini
  → Local fallback  — rule-based FinAi Intelligence Engine
"""
from __future__ import annotations

import os
from typing import Any
from loguru import logger

# ── Provider registry ─────────────────────────────────────────────────────────
# (name, env_var, model_id, base_url | None)
_PROVIDERS: list[tuple[str, str, str, str | None]] = [
    (
        "github",
        "GITHUB_API_KEY",
        "gpt-4o-mini",
        "https://models.inference.ai.azure.com",
    ),
    (
        "groq",
        "GROQ_API_KEY",
        "llama-3.3-70b-versatile",
        "https://api.groq.com/openai/v1",
    ),
    (
        "nvidia",
        "NVIDIA_API_KEY",
        "meta/llama-3.1-8b-instruct",
        "https://integrate.api.nvidia.com/v1",
    ),
    (
        "grok",
        "GROK_API_KEY",
        "grok-3",
        "https://api.x.ai/v1",
    ),
    (
        "google",
        "GEMINI_API_KEY",
        "gemini-2.0-flash",
        "https://generativelanguage.googleapis.com/v1beta/openai/",
    ),
    (
        "openai",
        "OPENAI_API_KEY",
        "gpt-4o-mini",
        None,
    ),
    (
        "deepseek",
        "DEEPSEEK_API_KEY",
        "deepseek-chat",
        "https://api.deepseek.com/v1",
    ),
    (
        "openrouter",
        "OPENROUTER_API_KEY",
        "openai/gpt-4o-mini",
        "https://openrouter.ai/api/v1",
    ),
]


def available_providers() -> list[tuple[str, str, str, str | None]]:
    """Return only providers that have an API key configured."""
    return [
        (name, key, model, base_url)
        for name, key, model, base_url in _PROVIDERS
        if os.getenv(key)
    ]


def get_active_provider() -> str:
    """Return the name of the first available provider (for display/logging)."""
    av = available_providers()
    return av[0][0].upper() if av else "LOCAL"


def list_providers() -> list[dict]:
    """Return all providers with availability status (no secrets exposed)."""
    return [
        {
            "name": name,
            "model": model,
            "available": bool(os.getenv(env_key)),
        }
        for name, env_key, model, _ in _PROVIDERS
    ]


def _build_chat_llm(name: str, api_key: str, model_id: str,
                    base_url: str | None, temperature: float,
                    extra: dict) -> Any:
    """Construct a ChatOpenAI instance for any OpenAI-compatible endpoint."""
    from langchain_openai import ChatOpenAI
    logger.debug(f"KeyModel → [{name.upper()}] ({model_id})")
    params: dict[str, Any] = dict(model=model_id, temperature=temperature,
                                  api_key=api_key, **extra)
    if base_url:
        params["base_url"] = base_url
    return ChatOpenAI(**params)


def get_llm(preferred: str | None = None, temperature: float = 0.6,
            **kwargs) -> Any:
    """
    Return the best available LangChain LLM.

    Args:
        preferred: Optional provider name (e.g. 'groq', 'grok', 'github').
                   Falls through the priority chain if unavailable.
        temperature: Sampling temperature.
        **kwargs: Extra parameters forwarded to ChatOpenAI.
    """
    av = available_providers()
    if not av:
        logger.warning("KeyModel — no API keys found → Local Intelligence Engine")
        from src.utils.local_llm import LocalAI
        return LocalAI()

    # Try the preferred provider first if specified
    if preferred:
        for name, env_key, model_id, base_url in _PROVIDERS:
            if name == preferred:
                api_key = os.getenv(env_key)
                if api_key:
                    return _build_chat_llm(name, api_key, model_id, base_url, temperature, kwargs)
                logger.warning(f"KeyModel — preferred '{preferred}' has no key → chain fallback")
                break

    # Walk priority chain
    for name, env_key, model_id, base_url in _PROVIDERS:
        api_key = os.getenv(env_key)
        if api_key:
            return _build_chat_llm(name, api_key, model_id, base_url, temperature, kwargs)

    from src.utils.local_llm import LocalAI
    return LocalAI()


def call_ai(
    messages: list[dict],
    *,
    temperature: float = 0.7,
    max_tokens: int | None = None,
    preferred: str | None = None,
) -> str:
    """
    Send a chat-messages list to the best available provider and return the
    text response.  Tries every configured provider before falling back to
    the local engine.

    Args:
        messages:    OpenAI-format messages list [{"role": ..., "content": ...}]
        temperature: Sampling temperature (default 0.7)
        max_tokens:  Optional token cap
        preferred:   Optional provider name to try first

    Returns:
        Response text string.
    """
    from langchain_openai import ChatOpenAI

    extra: dict[str, Any] = {}
    if max_tokens:
        extra["max_tokens"] = max_tokens

    providers_to_try = list(_PROVIDERS)
    if preferred:
        # Move preferred to front
        reordered = [p for p in providers_to_try if p[0] == preferred]
        reordered += [p for p in providers_to_try if p[0] != preferred]
        providers_to_try = reordered

    last_err = None
    for name, env_key, model_id, base_url in providers_to_try:
        api_key = os.getenv(env_key)
        if not api_key:
            continue
        try:
            params: dict[str, Any] = dict(
                model=model_id, temperature=temperature,
                api_key=api_key, **extra
            )
            if base_url:
                params["base_url"] = base_url
            llm = ChatOpenAI(**params)
            resp = llm.invoke(messages)
            logger.debug(f"KeyModel.call_ai → [{name.upper()}] OK")
            return resp.content
        except Exception as e:
            logger.warning(f"KeyModel.call_ai [{name}] failed: {type(e).__name__}: {str(e)[:80]}")
            last_err = e
            continue

    # All providers failed — local fallback
    logger.warning(f"KeyModel — all cloud providers failed ({last_err}) → Local Engine")
    try:
        from src.utils.local_llm import local_chat
        return local_chat(messages[-1].get("content", ""), None)
    except Exception as fe:
        logger.error(f"KeyModel local fallback failed: {fe}")
        return "⚠️ AI service temporarily unavailable. Please try again."


def get_best_api_key() -> tuple[str, str, str | None]:
    """
    Return (api_key, model_id, base_url) for the first available provider.
    Useful for files that construct ChatOpenAI themselves.
    Returns ('placeholder', 'gpt-4o-mini', None) if nothing is configured.
    """
    for _, env_key, model_id, base_url in _PROVIDERS:
        api_key = os.getenv(env_key)
        if api_key:
            return api_key, model_id, base_url
    return "placeholder", "gpt-4o-mini", None
