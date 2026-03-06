"""Simulation routes — run headless game simulations."""

from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["simulation"])


class SimulateRequest(BaseModel):
    army_a: list[dict]  # [{type: 0, count: 2}, ...]
    army_b: list[dict]
    terrain_template: str = "open_plains"
    iterations: int = 10
    seed: Optional[int] = None


class ExplainRequest(BaseModel):
    game_state: dict
    action: dict


@router.post("/simulate")
async def run_simulation(req: SimulateRequest):
    """Run N headless battles and return aggregate results."""
    from services.simulation_runner import run_batch_simulation

    results = run_batch_simulation(
        army_a=req.army_a,
        army_b=req.army_b,
        terrain_template=req.terrain_template,
        iterations=min(req.iterations, 50),  # Cap at 50
        seed=req.seed,
    )
    return results


@router.post("/explain")
async def explain_decision(req: ExplainRequest):
    """Explain why the AI made a specific decision."""
    # Build a human-readable explanation of the game state and action
    explanation = _build_explanation(req.game_state, req.action)
    return {"explanation": explanation}


def _build_explanation(game_state: dict, action: dict) -> str:
    """Build a narrative explanation of an AI decision."""
    parts = []

    # Describe the game state
    if "tick" in game_state:
        parts.append(f"At tick {game_state['tick']} ({game_state['tick'] * 0.05:.1f}s into battle):")

    if "own_morale_avg" in game_state:
        parts.append(f"- Own average morale: {game_state['own_morale_avg']:.0f}/100")
    if "enemy_morale_avg" in game_state:
        parts.append(f"- Enemy average morale: {game_state['enemy_morale_avg']:.0f}/100")

    # Describe the action
    order_names = ["Move", "Attack", "Hold", "Retreat", "Flank", "Charge", "Form Up", "Disengage", "Rally"]
    if "order_type" in action:
        ot = action["order_type"]
        name = order_names[ot] if ot < len(order_names) else f"Order {ot}"
        parts.append(f"\nAction: {name}")
        if "target_x" in action and "target_y" in action:
            parts.append(f"Target position: ({action['target_x']:.0f}, {action['target_y']:.0f})")

    # Strategic reasoning
    if "order_type" in action:
        ot = action["order_type"]
        if ot == 0:  # Move
            parts.append("Reasoning: Repositioning for better tactical advantage.")
        elif ot == 1:  # Attack
            parts.append("Reasoning: Engaging the enemy — conditions favor offensive action.")
        elif ot == 2:  # Hold
            parts.append("Reasoning: Holding position — terrain advantage or awaiting reinforcement.")
        elif ot == 3:  # Retreat
            parts.append("Reasoning: Withdrawing — morale or supply situation unfavorable.")
        elif ot == 5:  # Charge
            parts.append("Reasoning: Charging — attempting to break enemy formation with shock.")

    return "\n".join(parts)
