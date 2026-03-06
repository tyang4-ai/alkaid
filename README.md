# Alkaid AI War Room (破軍)

**Ancient Chinese war simulator with AI-powered strategic advisor and RL-trained opponent.**

Built for the [DigitalOcean Gradient AI Hackathon](https://dograduiagent.devpost.com/).

## What is Alkaid?

Alkaid (破軍星, "Army Breaker") is a web-based war simulator set in ancient China. Players command squads of historically accurate unit types across procedurally generated terrain, managing morale, supply lines, fatigue, and weather to achieve victory.

**The AI War Room** adds three AI-powered components:

### Sun Tzu Strategist Agent
A conversational AI advisor with the persona of Sun Tzu, built on **Gradient Agent Platform**. It has a RAG knowledge base of *The Art of War*, the *36 Stratagems*, historical battle analyses, and complete game mechanics. It can:
- Analyze your battles and identify tactical mistakes
- Suggest army compositions for terrain and enemy matchups
- Run headless battle simulations to test strategies
- Quote the Art of War with contextually relevant wisdom

### RL-Trained AI Opponent
A reinforcement learning model trained on **GPU Droplets** (RTX 4000) using MaskablePPO with curriculum learning. The model trains against progressively harder bot types, then exports to ONNX for real-time browser inference via Web Workers (<10ms per decision).

### Training Dashboard
Real-time visualization of RL training progress — reward curves, win rates, curriculum stages, and model performance benchmarks. Includes a chat interface to discuss training with the Sun Tzu agent.

## DigitalOcean Gradient Features Used

| Feature | Usage |
|---------|-------|
| **GPU Droplets** | Train MaskablePPO on RTX 4000 with curriculum learning |
| **Agent Platform** | Sun Tzu persona with RAG knowledge base + function calling |
| **App Platform** | Host game, dashboard, and FastAPI backend |

## Architecture

```
Browser
  +-- Alkaid Game (PixiJS + TypeScript)
  +-- ONNX Web Worker (RL model inference)
  +-- Agent Chat Panel (Sun Tzu sidebar)
  +-- Training Dashboard (metrics + charts)
       |
       | HTTP API
       v
DigitalOcean App Platform
  +-- FastAPI Backend (simulation, agent proxy, metrics)
       |
       v
Gradient AI Platform
  +-- GPU Droplet (RL training, ONNX export)
  +-- Agent Platform (RAG, function calling, LLM)
```

## Tech Stack

- **Frontend:** TypeScript, PixiJS v8, Vite, ONNX Runtime Web
- **Backend:** Python, FastAPI, httpx
- **AI Training:** Stable-Baselines3, MaskablePPO, Gymnasium
- **Agent:** Gradient Agent Platform, RAG (Art of War + game mechanics)
- **Infrastructure:** DigitalOcean GPU Droplets, App Platform

## Game Features

- **13 historically-inspired unit types** with rock-paper-scissors balance
- **Procedurally generated terrain** with elevation, rivers, forests, cities
- **Morale, supply, fatigue, weather** systems affecting combat
- **Command system** with messenger delay (no instant orders)
- **Roguelike campaign** with territory conquest and army progression
- **Fog of war, formations, flanking, siege mechanics**
- **750+ TypeScript tests, 100+ Python tests**

## Quick Start

### Game (Frontend)
```bash
pnpm install
pnpm dev --port 3000
# Open http://localhost:3000
```

### Dashboard
```bash
# Open http://localhost:3000/dashboard/
```

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # Configure Gradient credentials
uvicorn main:app --reload --port 8000
```

### Training (GPU Droplet)
```bash
cd ai-training
pip install -r requirements.txt
python -m training.train --timesteps 2000000 --n-envs 8 --device cuda
```

## Project Structure

```
src/                    # Game source (TypeScript)
  simulation/           # Game logic (units, combat, AI, campaign)
  rendering/            # PixiJS + DOM rendering
  workers/              # Web Workers (pathfinding, ONNX)
  services/             # API clients
ai-training/            # RL training pipeline (Python)
  env/                  # Gymnasium environment
  training/             # MaskablePPO config, curriculum, callbacks
  evaluation/           # Benchmarking
backend/                # FastAPI server
  routes/               # API endpoints (agent, simulation, training)
  services/             # Gradient client, simulation runner
agent/                  # Agent Platform config
  knowledge/            # RAG knowledge base
  system_prompt.md      # Sun Tzu persona instructions
dashboard/              # Training dashboard (separate Vite entry)
shared/                 # Shared constants (TS + Python)
```

## License

MIT
