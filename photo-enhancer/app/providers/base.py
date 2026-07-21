"""Provider-agnostic interface for generative image edits.

The pipeline talks to generative models only through this interface, so the
rest of the app is decoupled from any one vendor's API. Capabilities are
declared per provider so the pipeline can skip (and clearly report) a
requested edit the active provider can't do — rather than failing silently.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

# Canonical edit identifiers used across the app.
EDIT_GRADE = "grade"                    # full non-generative-style grade (Imagen)
EDIT_SKY = "sky_replacement"
EDIT_DECLUTTER = "declutter"
EDIT_OBJECT_REMOVAL = "object_removal"
EDIT_STAGING = "virtual_staging"


@dataclass
class GenEdit:
    filename: str
    image_bytes: bytes
    edit: str                           # one of the EDIT_* constants
    prompt: str = ""                    # model-ready instruction (from Claude)
    params: dict = field(default_factory=dict)


@dataclass
class GenResult:
    filename: str
    image_bytes: bytes | None = None
    error: str | None = None
    provider: str = ""


class GenerativeProvider(ABC):
    name: str = "base"
    capabilities: set[str] = set()

    @abstractmethod
    def available(self) -> bool:
        """True when the provider has the credentials it needs."""

    def supports(self, edit: str) -> bool:
        return edit in self.capabilities

    @abstractmethod
    async def edit(self, job: GenEdit) -> GenResult:
        """Apply one generative edit to one image and return the result."""


class NullProvider(GenerativeProvider):
    """Used when GENERATIVE_PROVIDER=none. Local (deterministic) enhancement
    still runs; any generative edit is reported as skipped."""

    name = "none"
    capabilities: set[str] = set()

    def available(self) -> bool:
        return True

    async def edit(self, job: GenEdit) -> GenResult:
        return GenResult(
            filename=job.filename, image_bytes=None, provider=self.name,
            error="No generative provider configured (GENERATIVE_PROVIDER=none).",
        )
