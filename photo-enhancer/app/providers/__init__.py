"""Generative provider adapters.

`get_provider()` returns the configured adapter. Every adapter implements the
same small interface (see base.py) so the pipeline never hard-codes a vendor —
swap providers by changing GENERATIVE_PROVIDER in the environment.
"""
from __future__ import annotations

from ..config import get_settings
from .base import GenerativeProvider, GenEdit, GenResult, NullProvider
from .imagen import ImagenProvider
from .replicate import ReplicateProvider
from .fal import FalProvider

__all__ = [
    "GenerativeProvider", "GenEdit", "GenResult", "get_provider",
]


def get_provider() -> GenerativeProvider:
    name = get_settings().generative_provider.lower()
    if name == "imagen":
        return ImagenProvider()
    if name == "replicate":
        return ReplicateProvider()
    if name == "fal":
        return FalProvider()
    return NullProvider()
