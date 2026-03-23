# Alkaid - n8n Asset Generation Workflows

Automated AI-powered asset generation pipelines for the Alkaid war game. Two n8n workflows generate all game sprites and audio using **100% free** AI APIs, then post-process and save them directly into the project's `public/assets/` directory.

## Quick Start

```bash
# 1. Paste your API keys into n8n/.env (see instructions inside the file)

# 2. Start n8n
cd n8n
docker compose up -d

# 3. Open http://localhost:5678 (create account on first visit)

# 4. Import workflows: Workflows -> Import from File
#    - image-workflow.json
#    - audio-workflow.json

# 5. Run each workflow: Open -> Execute Workflow

# 6. Stop when done
docker compose down
```

---

## API Keys Setup

All keys go in `n8n/.env`. See the comments in that file for step-by-step instructions on getting each key.

| Service | Used For | Cost | How to Get |
|---------|----------|------|------------|
| **Gemini** | 64 sprite images | **$0** (500 img/day free) | https://aistudio.google.com/apikey |
| **ElevenLabs** | 8 sound effects | **$0** (10k credits/mo free) | https://elevenlabs.io -> Profile -> API Key |
| **Hugging Face** | 7 music/ambient tracks | **$0** (~100 req/hr free) | https://huggingface.co/settings/tokens |

**Total cost: $0** — all free tiers, no credit card required (except Gemini if you don't already have it).

---

## Workflows Overview

### 1. Image Workflow (`image-workflow.json`)

Generates 64 game sprites using **Gemini API** (gemini-2.0-flash-exp).

**Pipeline:** Manual Trigger -> Set Parameters -> Set Global Style -> Route by Category -> Build Prompts -> Gemini API -> Resize to 32x32 (Sharp) -> Save File

**Categories:**
- `units` - 14 weapon/vehicle icon sprites
- `terrain` - 40 terrain tiles (10 types x 4 variants)
- `ui` - 10 UI icons
- `all` - Generate everything

### 2. Audio Workflow (`audio-workflow.json`)

Generates 15 audio assets using **HuggingFace MusicGen** (music + ambient) and **ElevenLabs** (SFX).

**Pipeline:** Manual Trigger -> Set Parameters -> Set Audio Style -> Route by Category -> Build Prompts -> Route by API -> API Call -> FFmpeg Post-Process -> Save File

**Categories:**
- `music` - 3 music tracks (2 min each) via HuggingFace MusicGen
- `sfx` - 8 sound effects (0.5-3s each) via ElevenLabs
- `ambient` - 4 ambient loops (30s each) via HuggingFace MusicGen
- `all` - Generate everything

---

## Docker Setup

The `docker-compose.yml` is pre-configured:

```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    env_file:
      - .env          # Your API keys
    volumes:
      - n8n_data:/home/node/.n8n
      - ../public/assets:/assets   # Game asset output dir
```

**First-time setup after starting n8n:**

```bash
# Install Sharp (image resize) and FFmpeg (audio processing) inside the container
docker exec -u root $(docker ps -q -f ancestor=n8nio/n8n) apk add --no-cache ffmpeg
docker exec $(docker ps -q -f ancestor=n8nio/n8n) npm install -g sharp
```

---

## Credential Setup

API keys are loaded from environment variables (`n8n/.env` -> Docker Compose -> n8n). The workflow nodes reference `{{ $env.GEMINI_API_KEY }}`, `{{ $env.ELEVENLABS_API_KEY }}`, and `{{ $env.HUGGINGFACE_TOKEN }}` directly — **no manual credential entry needed in the n8n UI**.

If env vars don't work in your n8n version, create credentials manually:

1. **Gemini** — Settings -> Credentials -> Header Auth -> Name: `x-goog-api-key`, Value: your key
2. **ElevenLabs** — Header Auth -> Name: `xi-api-key`, Value: your key
3. **Hugging Face** — Header Auth -> Name: `Authorization`, Value: `Bearer hf_YOUR_TOKEN`

---

## Fine-Tuning Knobs

### Image Workflow

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| `seed_base` | Set Global Style | `42` | Base seed for reproducibility |
| `style_prefix` | Set Global Style | (see workflow) | Global style applied to all prompts |
| `negative_prompt` | Set Global Style | (see workflow) | What to avoid in all generations |

### Audio Workflow

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| `music_duration_s` | Set Audio Style | `120` | Music track length in seconds |
| `sfx_duration_ms` | Set Audio Style | `2000` | Default SFX duration |
| `ambient_duration_s` | Set Audio Style | `30` | Ambient loop length in seconds |
| `music_bitrate` | Set Audio Style | `192k` | Music output bitrate |
| `sfx_bitrate` / `ambient_bitrate` | Set Audio Style | `128k` | SFX/ambient output bitrate |

---

## Troubleshooting

**"Model is loading" (HuggingFace):**
First request may take 30-60s for cold start. Subsequent requests are fast. Just wait and retry.

**"Rate limited":**
HuggingFace free tier: ~100 req/hr. Workflows include 5s delays between requests. Increase `batchInterval` if needed.

**"Sharp not found":**
Run: `docker exec $(docker ps -q -f ancestor=n8nio/n8n) npm install -g sharp`

**"FFmpeg not found":**
Run: `docker exec -u root $(docker ps -q -f ancestor=n8nio/n8n) apk add --no-cache ffmpeg`

**"Port 5678 in use":**
`docker compose down` then `docker compose up -d`

**File permission errors:**
The Docker volume mount handles permissions. If running n8n locally, ensure write access to `public/assets/`.

---

## Output Directory Structure

```
public/assets/
├── sprites/
│   ├── units/          (14 files, 32x32 PNG)
│   ├── terrain/        (40 files, 32x32 PNG)
│   └── ui/             (10 files, 32x32 PNG)
└── audio/
    ├── music/          (3 files, ~192kbps MP3)
    ├── sfx/            (8 files, ~128kbps MP3)
    └── ambient/        (4 files, ~128kbps MP3)
```
