"""Agent routes — proxy to DigitalOcean Gradient Agent Platform."""

import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx

router = APIRouter(tags=["agent"])

GRADIENT_AGENT_ENDPOINT = os.getenv("GRADIENT_AGENT_ENDPOINT", "")
GRADIENT_AGENT_KEY = os.getenv("GRADIENT_AGENT_KEY", "")


class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None
    conversation_id: Optional[str] = None


class AnalyzeRequest(BaseModel):
    replay_data: dict


class SuggestArmyRequest(BaseModel):
    terrain_type: str
    enemy_composition: list[dict]
    budget: int


@router.post("/chat")
async def chat(req: ChatRequest):
    """Send a message to the Sun Tzu strategist agent."""
    if not GRADIENT_AGENT_ENDPOINT or not GRADIENT_AGENT_KEY:
        # Fallback: return a placeholder response for local dev
        return {
            "response": (
                "Greetings, Commander (將軍). I am Sun Tzu. "
                "The Gradient Agent Platform is not configured yet. "
                "Set GRADIENT_AGENT_ENDPOINT and GRADIENT_AGENT_KEY in .env to connect me."
            ),
            "source": "fallback",
        }

    try:
        # Build context-enriched prompt
        prompt = req.message
        if req.context:
            context_str = _format_context(req.context)
            prompt = f"[Battle Context: {context_str}]\n\nCommander asks: {req.message}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                GRADIENT_AGENT_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {GRADIENT_AGENT_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "message": prompt,
                    "conversation_id": req.conversation_id,
                },
            )
            response.raise_for_status()
            data = response.json()

        return {
            "response": data.get("response", data.get("message", "")),
            "source": "gradient",
            "conversation_id": data.get("conversation_id"),
        }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Agent Platform error: {str(e)}")


@router.post("/analyze")
async def analyze_battle(req: AnalyzeRequest):
    """Analyze a battle replay using the Sun Tzu agent."""
    # Extract key moments from replay data
    summary = _extract_battle_summary(req.replay_data)

    chat_req = ChatRequest(
        message=f"Analyze this battle for me:\n{summary}",
        context=req.replay_data.get("context"),
    )
    return await chat(chat_req)


@router.post("/suggest-army")
async def suggest_army(req: SuggestArmyRequest):
    """Get army composition suggestion from the strategist."""
    enemy_desc = ", ".join(
        f"{comp.get('count', 1)}x {comp.get('type', 'unknown')}"
        for comp in req.enemy_composition
    )
    message = (
        f"I'm facing {enemy_desc} on {req.terrain_type} terrain. "
        f"My budget is {req.budget} gold. What army should I build?"
    )
    chat_req = ChatRequest(message=message)
    return await chat(chat_req)


def _format_context(context: dict) -> str:
    """Format battle context for the agent."""
    parts = []
    if "terrain" in context:
        parts.append(f"Terrain: {context['terrain']}")
    if "weather" in context:
        parts.append(f"Weather: {context['weather']}")
    if "own_casualties" in context:
        parts.append(f"Own casualties: {context['own_casualties']}%")
    if "enemy_casualties" in context:
        parts.append(f"Enemy casualties: {context['enemy_casualties']}%")
    if "morale" in context:
        parts.append(f"Average morale: {context['morale']}")
    if "supply" in context:
        parts.append(f"Supply: {context['supply']}%")
    return "; ".join(parts) if parts else "No additional context"


def _extract_battle_summary(replay_data: dict) -> str:
    """Extract a readable summary from replay data for the agent."""
    parts = []

    if "winner" in replay_data:
        parts.append(f"Winner: {'Player' if replay_data['winner'] == 0 else 'AI'}")
    if "victory_type" in replay_data:
        parts.append(f"Victory type: {replay_data['victory_type']}")
    if "total_ticks" in replay_data:
        secs = replay_data["total_ticks"] * 0.05
        parts.append(f"Duration: {secs:.0f}s ({replay_data['total_ticks']} ticks)")
    if "casualties" in replay_data:
        parts.append(f"Casualties: {replay_data['casualties']}")
    if "key_moments" in replay_data:
        for moment in replay_data["key_moments"][:5]:
            parts.append(f"- {moment}")

    return "\n".join(parts) if parts else "No replay data available."
