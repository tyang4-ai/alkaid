"""Agent routes — proxy to DigitalOcean Gradient Agent Platform."""

import os
import random
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


class ExplainDecisionRequest(BaseModel):
    order_type: str
    target_description: str
    battle_context: dict
    tendency_features: Optional[list[float]] = None


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


_SUN_TZU_EXPLAIN_SYSTEM = (
    "You are 孫武 (Sun Tzu), the legendary Chinese strategist and author of The Art of War. "
    "You are advising a commander in a real-time ancient Chinese battle. "
    "Explain the tactical reasoning behind the given order in your persona. "
    "Reference historical battles and strategies (Red Cliffs, Guandu, Changping, Maling, Gaixia, etc.) when relevant. "
    "If tendency_features are provided, comment briefly on how you are adapting to the player's patterns. "
    "Mix Chinese (classical/military idioms) and English text naturally. "
    "Keep your response to 2-3 sentences maximum. Be concise and authoritative."
)

# Fallback quotes keyed by order type when API is not configured
_FALLBACK_QUOTES: dict[str, list[str]] = {
    "ATTACK": [
        "攻其不备，出其不意 — Strike where they are unprepared, appear where you are not expected. (The Art of War, Ch. 1)",
        "兵贵神速 — In war, speed is paramount. Press the attack now.",
    ],
    "FLANK": [
        "以正合，以奇胜 — Engage with the orthodox, achieve victory with the unorthodox. (The Art of War, Ch. 5)",
        "声东击西 — Feint east, strike west. The flank reveals their weakness.",
    ],
    "RETREAT": [
        "三十六计，走为上计 — Of the Thirty-Six Stratagems, retreat is the supreme strategy.",
        "知难而退，智者之道 — Knowing when to retreat is the way of the wise.",
    ],
    "CHARGE": [
        "一鼓作气，再而衰，三而竭 — The first drum raises spirits; the second, they wane; the third, they are spent. Charge on the first beat.",
        "势如破竹 — Like splitting bamboo — unstoppable force.",
    ],
    "HOLD": [
        "不动如山 — Immovable as a mountain. (The Art of War, Ch. 7)",
        "以逸待劳 — Rest and await the weary. They will exhaust themselves.",
    ],
    "FORM_UP": [
        "兵者，诡道也 — War is deception, but discipline is its instrument. Reform the lines.",
        "纪律严明，阵法为先 — Strict discipline, formation first.",
    ],
    "RALLY": [
        "集结旗下 — Rally to the banner! The army that holds together prevails.",
        "军心未散，犹可一战 — The spirit holds; we can still fight.",
    ],
    "DISENGAGE": [
        "金蝉脱壳 — Slip away like the golden cicada shedding its shell.",
        "知不可战则勿战 — If you cannot win, do not fight. Break contact.",
    ],
    "MOVE": [
        "善战者，致人而不致于人 — The skilled commander imposes his will, not the other way around. Reposition.",
        "兵马未动，粮草先行 — Before troops move, supply moves first.",
    ],
}


@router.post("/explain-decision")
async def explain_decision(req: ExplainDecisionRequest):
    """Explain an AI tactical decision in character as Sun Tzu."""
    if not GRADIENT_AGENT_ENDPOINT or not GRADIENT_AGENT_KEY:
        # Fallback: return a hardcoded Sun Tzu quote relevant to the order type
        quotes = _FALLBACK_QUOTES.get(req.order_type.upper(), _FALLBACK_QUOTES["MOVE"])
        return {"response": random.choice(quotes), "source": "fallback"}

    try:
        # Build context-enriched prompt
        tendency_info = ""
        if req.tendency_features:
            tendency_info = f"\n[Player tendency features: {req.tendency_features[:6]}...]"

        prompt = (
            f"Order: {req.order_type}\n"
            f"Target: {req.target_description}\n"
            f"Battle context: {_format_context(req.battle_context)}"
            f"{tendency_info}\n\n"
            f"Explain why this tactical decision was made."
        )

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                GRADIENT_AGENT_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {GRADIENT_AGENT_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "message": prompt,
                    "system": _SUN_TZU_EXPLAIN_SYSTEM,
                },
            )
            response.raise_for_status()
            data = response.json()

        return {
            "response": data.get("response", data.get("message", "")),
            "source": "gradient",
        }
    except httpx.HTTPError:
        # On API error, fall back to quotes
        quotes = _FALLBACK_QUOTES.get(req.order_type.upper(), _FALLBACK_QUOTES["MOVE"])
        return {"response": random.choice(quotes), "source": "fallback"}


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
