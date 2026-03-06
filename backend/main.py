"""Alkaid AI War Room — Backend API Server.

Bridges the browser game to DigitalOcean Gradient AI services:
- Agent Platform (Sun Tzu strategist with RAG + function calling)
- Headless game simulations
- Training metrics
"""

import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# Add project root and ai-training to path for imports
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "ai-training"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("Alkaid AI War Room backend starting...")
    yield
    print("Backend shutting down.")


app = FastAPI(
    title="Alkaid AI War Room",
    description="Backend for the Alkaid war game AI platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the game frontend and dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4173",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and mount route modules
from routes.agent import router as agent_router
from routes.simulation import router as simulation_router
from routes.training import router as training_router

app.include_router(agent_router, prefix="/api")
app.include_router(simulation_router, prefix="/api")
app.include_router(training_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "alkaid-war-room"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
