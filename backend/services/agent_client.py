"""Gradient Agent Platform SDK client wrapper.

Handles communication with the DigitalOcean Gradient AI Platform agent.
When the Gradient Python SDK is available, this will use it directly.
For now, uses HTTP calls to the agent endpoint.
"""

import os
from typing import Optional

import httpx


class GradientAgentClient:
    """Client for interacting with a Gradient Agent Platform agent."""

    def __init__(self):
        self.endpoint = os.getenv("GRADIENT_AGENT_ENDPOINT", "")
        self.api_key = os.getenv("GRADIENT_AGENT_KEY", "")
        self._client: Optional[httpx.AsyncClient] = None

    @property
    def is_configured(self) -> bool:
        return bool(self.endpoint and self.api_key)

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def send_message(
        self,
        message: str,
        conversation_id: Optional[str] = None,
    ) -> dict:
        """Send a message to the agent and get a response."""
        if not self.is_configured:
            return {
                "response": "Agent not configured. Set GRADIENT_AGENT_ENDPOINT and GRADIENT_AGENT_KEY.",
                "source": "fallback",
            }

        client = await self._get_client()
        response = await client.post(
            self.endpoint,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "message": message,
                "conversation_id": conversation_id,
            },
        )
        response.raise_for_status()
        data = response.json()

        return {
            "response": data.get("response", data.get("message", "")),
            "source": "gradient",
            "conversation_id": data.get("conversation_id"),
        }

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None
