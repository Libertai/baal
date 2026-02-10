"""LibertAI inference client for agent VMs."""

import asyncio

from openai import AsyncOpenAI


class InferenceClient:
    """Thin wrapper around AsyncOpenAI pointed at LibertAI."""

    def __init__(self, api_key: str, base_url: str = "https://api.libertai.io/v1"):
        self.client = AsyncOpenAI(base_url=base_url, api_key=api_key)

    async def chat(
        self,
        messages: list[dict],
        model: str,
        tools: list[dict] | None = None,
    ):
        """Send a chat completion request. Returns the full message object."""
        kwargs = {"model": model, "messages": messages}
        if tools:
            kwargs["tools"] = tools
        try:
            response = await self.client.chat.completions.create(**kwargs)
        except Exception:
            await asyncio.sleep(2)
            response = await self.client.chat.completions.create(**kwargs)
        return response.choices[0].message
