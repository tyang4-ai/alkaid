# Alkaid - n8n Asset Generation Workflows

Automated AI-powered asset generation pipelines for the Alkaid war game. Two n8n workflows generate all game sprites and audio using external AI APIs, then post-process and save them directly into the project's `public/assets/` directory.

## Workflows Overview

### 1. Image Workflow (`image-workflow.json`)

Generates 64 game sprites across three categories using Stability AI's text-to-image API.

**Pipeline:** Manual Trigger -> Set Parameters -> Set Global Style -> Route by Category -> Build Prompts -> Stability AI API -> Resize to 32x32 (Sharp) -> Save File

**Categories:**
- `units` - 14 weapon/vehicle icon sprites
- `terrain` - 40 terrain tiles (10 types x 4 variants)
- `ui` - 10 UI icons
- `all` - Generate everything

### 2. Audio Workflow (`audio-workflow.json`)

Generates 15 audio assets across three categories using Suno (music), ElevenLabs (SFX), and Stability Audio (ambient).

**Pipeline:** Manual Trigger -> Set Parameters -> Set Audio Style -> Route by Category -> Build Prompts -> Route by API -> API Call -> FFmpeg Post-Process -> Save File

**Categories:**
- `music` - 3 music tracks (2 min each)
- `sfx` - 8 sound effects (0.5-3s each)
- `ambient` - 4 ambient loops (30s each)
- `all` - Generate everything

---

## Required API Keys

| Service | Used For | Pricing Model | Sign Up |
|---------|----------|---------------|---------|
| **Stability AI** | Image generation + ambient audio | Per-image credits | https://platform.stability.ai |
| **Suno** | Music track generation | Subscription + credits | https://suno.com/api |
| **ElevenLabs** | Sound effect generation | Per-character/per-second | https://elevenlabs.io |
| **OpenAI** (alternative) | DALL-E image generation | Per-image | https://platform.openai.com |

### Alternative Providers

If you prefer different providers, swap the HTTP Request nodes:
- **Images:** Replace Stability AI with OpenAI DALL-E 3, Midjourney API, or Leonardo.ai
- **Music:** Replace Suno with Udio or MusicGen (Hugging Face)
- **SFX:** Replace ElevenLabs with AudioCraft (Meta, self-hosted) or Freesound API
- **Ambient:** Replace Stability Audio with AudioLDM (Hugging Face)

---

## Setup Instructions

### 1. Self-Host n8n via Docker

```bash
# Quick start with Docker
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -v "$(pwd)/public/assets:/assets" \
  -e N8N_SECURE_COOKIE=false \
  n8nio/n8n

# Or with docker-compose (recommended)
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'
services:
  n8n:
    image: n8nio/n8n
    ports:
      - "5678:5678"
    volumes:
      - n8n_data:/home/node/.n8n
      - ./public/assets:/assets
    environment:
      - N8N_SECURE_COOKIE=false
      - NODE_FUNCTION_ALLOW_EXTERNAL=sharp,child_process,fs,path,os
    restart: unless-stopped

volumes:
  n8n_data:
COMPOSE

docker-compose up -d
```

**Important Docker notes:**
- The volume mount maps `public/assets` to `/assets` inside the container
- `NODE_FUNCTION_ALLOW_EXTERNAL` is required for Sharp (image resize) and FFmpeg (audio processing)
- Install Sharp inside the container: `docker exec n8n npm install -g sharp`
- Install FFmpeg: `docker exec n8n apk add --no-cache ffmpeg` (Alpine-based image)

### 2. Import Workflows

1. Open n8n at `http://localhost:5678`
2. Go to **Workflows** -> **Import from File**
3. Import `image-workflow.json`
4. Import `audio-workflow.json`

### 3. Add Credentials

For each workflow, create the required credentials:

**Stability AI (images + ambient audio):**
1. Go to **Settings** -> **Credentials** -> **Add Credential**
2. Choose **Header Auth**
3. Name: `Stability AI API Key`
4. Header Name: `Authorization`
5. Header Value: `Bearer sk-YOUR-STABILITY-API-KEY`

**Suno (music):**
1. Add another **Header Auth** credential
2. Name: `Suno API Key`
3. Header Name: `Authorization`
4. Header Value: `Bearer YOUR-SUNO-API-KEY`

**ElevenLabs (SFX):**
1. Add another **Header Auth** credential
2. Name: `ElevenLabs API Key`
3. Header Name: `xi-api-key`
4. Header Value: `YOUR-ELEVENLABS-API-KEY`

Then update each HTTP Request node to use the correct credential (click the node, select the credential from the dropdown).

### 4. Update File Paths

The workflows save files relative to the working directory. If using Docker with the volume mount above, update the output paths in the Code nodes:
- Change `public/assets/sprites/` to `/assets/sprites/`
- Change `public/assets/audio/` to `/assets/audio/`

Or run n8n locally (npm) from the project root and paths will work as-is.

### 5. Run

1. Open the image workflow
2. Set trigger parameters (or leave defaults for `all`)
3. Click **Execute Workflow**
4. Repeat for the audio workflow

---

## Fine-Tuning Knobs

### Image Workflow

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| `cfg_scale` | Set Global Style | `7.5` | How closely to follow the prompt (1-20). Higher = more literal |
| `steps` | Set Global Style | `30` | Diffusion steps. More = higher quality, slower. 20-50 recommended |
| `seed_base` | Set Global Style | `42` | Base seed for reproducibility. Each asset adds an offset |
| `style_prefix` | Set Global Style | (see below) | Global style applied to all prompts |
| `negative_prompt` | Set Global Style | (see below) | What to avoid in all generations |
| `width` / `height` | Set Global Style | `512` | Generation resolution (resized to 32x32 after) |
| `model` | Set Global Style | `stable-diffusion-xl-1024-v1-0` | Stability AI model ID |

**Style Prefix:**
```
32x32 pixel art, ancient Chinese ink wash painting style (水墨画),
muted earth tones, transparent background, top-down view,
crisp edges, game sprite
```

**Negative Prompt:**
```
blurry, photorealistic, 3d render, text, watermark, signature,
human figure, face, body, person, soldier, warrior, photograph,
gradient background, anti-aliasing, soft edges
```

### Audio Workflow

| Parameter | Location | Default | Description |
|-----------|----------|---------|-------------|
| `music_style` | Set Audio Style | (see below) | Base style for all music tracks |
| `sfx_style` | Set Audio Style | (see below) | Base style for all sound effects |
| `ambient_style` | Set Audio Style | (see below) | Base style for all ambient loops |
| `music_duration_s` | Set Audio Style | `120` | Music track length in seconds |
| `sfx_duration_ms` | Set Audio Style | `2000` | Default SFX duration (overridden per-asset) |
| `ambient_duration_s` | Set Audio Style | `30` | Ambient loop length in seconds |
| `music_bitrate` | Set Audio Style | `192k` | Music output bitrate |
| `sfx_bitrate` | Set Audio Style | `128k` | SFX output bitrate |
| `ambient_bitrate` | Set Audio Style | `128k` | Ambient output bitrate |

---

## Complete Asset Lists

### Unit Sprites (14)

| File | Prompt Suffix |
|------|--------------|
| `units/sword.png` | single Chinese jian straight sword, bronze blade with jade handle, ink wash style, weapon icon |
| `units/spear.png` | single Chinese qiang spear, long wooden shaft with steel tip and red tassel, weapon icon |
| `units/halberd.png` | single Chinese ji halberd, crescent blade on pole, bronze and wood, weapon icon |
| `units/bow.png` | single Chinese recurve bow with bamboo arrows, horn and sinew composite bow, weapon icon |
| `units/crossbow.png` | single Chinese nu crossbow, repeating crossbow mechanism, bronze trigger, weapon icon |
| `units/shield.png` | single Chinese round shield, lacquered wood with bronze boss and tiger motif, armor icon |
| `units/horse.png` | single war horse silhouette, armored Chinese cavalry horse, side view, ink wash style |
| `units/chariot.png` | single Chinese war chariot, two-wheeled bronze chariot with canopy, vehicle icon, top-down |
| `units/siege_ram.png` | single battering ram, wooden siege ram with iron head, covered frame, siege weapon icon |
| `units/trebuchet.png` | single Chinese trebuchet, counterweight siege engine, wooden frame, siege weapon icon |
| `units/war_drum.png` | single large Chinese war drum, taiko-style drum on wooden stand with red lacquer, instrument icon |
| `units/banner.png` | single Chinese military banner, red silk flag with golden dragon emblem on bamboo pole, flag icon |
| `units/supply_cart.png` | single Chinese supply wagon, wooden ox-cart loaded with grain sacks and barrels, vehicle icon |
| `units/fire_arrow.png` | single flaming arrow, arrow wrapped in oil-soaked cloth on fire, projectile icon, glowing |

### Terrain Tiles (10 types x 4 variants = 40)

| Type | Prompt Suffix |
|------|--------------|
| `grassland` | flat grassland tile, green grass with small wildflowers, earth tones, seamless texture |
| `forest` | dense forest canopy tile, bamboo and pine trees from above, dark green foliage, seamless |
| `mountain` | rocky mountain tile, jagged grey peaks with snow caps, ink wash mountain style, seamless |
| `water` | river water tile, flowing blue-green water with ripples, ink wash water style, seamless |
| `marsh` | marshy wetland tile, muddy water with reeds and cattails, murky brown-green, seamless |
| `desert` | sandy desert tile, yellow-tan sand dunes with wind patterns, arid earth tones, seamless |
| `farmland` | cultivated rice paddy tile, neat rows of green rice plants in water, agricultural, seamless |
| `road` | dirt road tile, packed brown earth path with wheel ruts, stone-lined edges, seamless |
| `bridge` | wooden bridge tile, Chinese arched bridge planks from above, timber and rope, seamless |
| `fortification` | stone wall tile, Chinese rammed earth fortification from above, grey-brown stone blocks, seamless |

Each type generates 4 variant files: `{type}_v0.png` through `{type}_v3.png`.

### UI Icons (10)

| File | Prompt Suffix |
|------|--------------|
| `ui/icon_attack.png` | attack command icon, crossed Chinese swords, red accent, minimal UI icon |
| `ui/icon_defend.png` | defend command icon, Chinese shield with wall, blue accent, minimal UI icon |
| `ui/icon_move.png` | move command icon, running footprints arrow, green accent, minimal UI icon |
| `ui/icon_retreat.png` | retreat command icon, backward arrow with dust cloud, yellow accent, minimal UI icon |
| `ui/icon_morale.png` | morale indicator icon, Chinese character for courage in circle, gold accent, UI icon |
| `ui/icon_supply.png` | supply indicator icon, grain sack with rice, brown accent, minimal UI icon |
| `ui/icon_fatigue.png` | fatigue indicator icon, tired moon/ZZZ symbol, purple accent, minimal UI icon |
| `ui/icon_weather_clear.png` | clear weather icon, bright sun with rays, warm yellow, minimal UI icon |
| `ui/icon_weather_rain.png` | rain weather icon, dark cloud with raindrops, blue-grey, minimal UI icon |
| `ui/icon_weather_fog.png` | fog weather icon, misty swirls, light grey layers, minimal UI icon |

### Music Tracks (3)

| File | Prompt Suffix |
|------|--------------|
| `audio/music/battle_theme.mp3` | intense battle music, fast tempo war drums and erhu, building tension, heroic brass, dramatic crescendo, 120 BPM, loop-friendly ending |
| `audio/music/deployment_theme.mp3` | strategic planning music, calm guzheng melody, contemplative dizi flute, steady pace, thoughtful and measured, 80 BPM, seamless loop |
| `audio/music/campaign_theme.mp3` | epic journey music, sweeping pipa arpeggios, majestic erhu melody, rising strings, sense of adventure and destiny, 100 BPM, grand orchestral |

### Sound Effects (8)

| File | Duration | Prompt Suffix |
|------|----------|--------------|
| `audio/sfx/sword_clash.mp3` | 1.5s | metal sword clashing against metal, sharp ringing impact, bronze blade contact, single strike |
| `audio/sfx/arrow_volley.mp3` | 2.5s | volley of arrows flying through air, multiple arrow whistle sounds, swarm of projectiles, whooshing |
| `audio/sfx/cavalry_charge.mp3` | 3.0s | thundering horse hooves galloping, multiple horses charging on dirt, growing louder, cavalry stampede |
| `audio/sfx/horn_signal.mp3` | 2.0s | ancient Chinese war horn blast, deep resonant brass horn signal, single sustained note, commanding |
| `audio/sfx/drum_beat.mp3` | 3.0s | Chinese war drum beat pattern, deep taiko-style drum hits, rhythmic military cadence, commanding tempo |
| `audio/sfx/unit_rout.mp3` | 2.5s | soldiers fleeing in panic, distant shouting and scrambling feet, armor clanking while running, disorganized retreat |
| `audio/sfx/victory_gong.mp3` | 3.0s | large Chinese ceremonial gong strike, deep resonant brass gong with long sustain, triumphant single hit |
| `audio/sfx/ui_click.mp3` | 0.5s | soft wooden click, bamboo tap, subtle UI interaction sound, clean and short |

### Ambient Loops (4)

| File | Duration | Prompt Suffix |
|------|----------|--------------|
| `audio/ambient/rain.mp3` | 30s | steady rainfall on ancient Chinese battlefield, rain on armor and tents, puddle splashes, moderate intensity rain |
| `audio/ambient/wind.mp3` | 30s | open field wind blowing across grassland, banner flapping in breeze, gentle whistling through mountain pass |
| `audio/ambient/night_crickets.mp3` | 30s | nighttime crickets chirping in Chinese countryside, occasional frog, distant owl, peaceful evening atmosphere |
| `audio/ambient/battlefield_idle.mp3` | 30s | quiet battlefield before combat, distant murmuring soldiers, occasional metal clink, tense anticipation, wind over open field |

---

## Estimated Costs

### Image Generation (Stability AI)

| Category | Count | Cost per Image | Subtotal |
|----------|-------|---------------|----------|
| Units | 14 | ~$0.002 | ~$0.03 |
| Terrain | 40 | ~$0.002 | ~$0.08 |
| UI | 10 | ~$0.002 | ~$0.02 |
| **Total** | **64** | | **~$0.13** |

*Based on Stability AI SDXL pricing at ~$0.002/image (512x512). Prices vary by model and resolution.*

### Audio Generation

| Category | Service | Count | Cost per Asset | Subtotal |
|----------|---------|-------|---------------|----------|
| Music | Suno | 3 | ~$0.10-0.50 | ~$0.30-1.50 |
| SFX | ElevenLabs | 8 | ~$0.05-0.20 | ~$0.40-1.60 |
| Ambient | Stability Audio | 4 | ~$0.05-0.10 | ~$0.20-0.40 |
| **Total** | | **15** | | **~$0.90-3.50** |

*Audio pricing varies significantly by plan tier and usage. Estimates based on pay-as-you-go rates.*

### Grand Total: ~$1.00-3.65

*For a complete regeneration of all 79 assets. Individual category runs cost proportionally less.*

---

## Output Directory Structure

```
public/assets/
├── sprites/
│   ├── units/
│   │   ├── sword.png          (32x32)
│   │   ├── spear.png          (32x32)
│   │   ├── halberd.png        (32x32)
│   │   ├── bow.png            (32x32)
│   │   ├── crossbow.png       (32x32)
│   │   ├── shield.png         (32x32)
│   │   ├── horse.png          (32x32)
│   │   ├── chariot.png        (32x32)
│   │   ├── siege_ram.png      (32x32)
│   │   ├── trebuchet.png      (32x32)
│   │   ├── war_drum.png       (32x32)
│   │   ├── banner.png         (32x32)
│   │   ├── supply_cart.png    (32x32)
│   │   └── fire_arrow.png     (32x32)
│   ├── terrain/
│   │   ├── grassland_v0.png   (32x32)
│   │   ├── grassland_v1.png   (32x32)
│   │   ├── grassland_v2.png   (32x32)
│   │   ├── grassland_v3.png   (32x32)
│   │   ├── forest_v0.png      (32x32)
│   │   ├── ...                (32x32 each)
│   │   └── fortification_v3.png (32x32)
│   ├── ui/
│   │   ├── icon_attack.png    (32x32)
│   │   ├── icon_defend.png    (32x32)
│   │   ├── icon_move.png      (32x32)
│   │   ├── icon_retreat.png   (32x32)
│   │   ├── icon_morale.png    (32x32)
│   │   ├── icon_supply.png    (32x32)
│   │   ├── icon_fatigue.png   (32x32)
│   │   ├── icon_weather_clear.png  (32x32)
│   │   ├── icon_weather_rain.png   (32x32)
│   │   └── icon_weather_fog.png    (32x32)
│   └── manifest.json
└── audio/
    ├── music/
    │   ├── battle_theme.mp3       (~192kbps, 2min)
    │   ├── deployment_theme.mp3   (~192kbps, 2min)
    │   └── campaign_theme.mp3     (~192kbps, 2min)
    ├── sfx/
    │   ├── sword_clash.mp3        (~128kbps, 1.5s)
    │   ├── arrow_volley.mp3       (~128kbps, 2.5s)
    │   ├── cavalry_charge.mp3     (~128kbps, 3.0s)
    │   ├── horn_signal.mp3        (~128kbps, 2.0s)
    │   ├── drum_beat.mp3          (~128kbps, 3.0s)
    │   ├── unit_rout.mp3          (~128kbps, 2.5s)
    │   ├── victory_gong.mp3       (~128kbps, 3.0s)
    │   └── ui_click.mp3           (~128kbps, 0.5s)
    └── ambient/
        ├── rain.mp3               (~128kbps, 30s loop)
        ├── wind.mp3               (~128kbps, 30s loop)
        ├── night_crickets.mp3     (~128kbps, 30s loop)
        └── battlefield_idle.mp3   (~128kbps, 30s loop)
```

---

## Troubleshooting

**"Sharp not found" in post-processing:**
Install Sharp in the n8n environment: `npm install -g sharp` or `docker exec n8n npm install -g sharp`

**"FFmpeg not found" in audio processing:**
Install FFmpeg: `docker exec n8n apk add --no-cache ffmpeg` (Alpine) or `apt-get install ffmpeg` (Debian)

**Rate limiting errors:**
The workflows include batch intervals (1.5s for images, 3-10s for audio) to avoid rate limits. Increase the `batchInterval` in HTTP Request node options if you still hit limits.

**Reproducibility:**
All image generations use deterministic seeds (seed_base + offset). To regenerate a single asset with different results, change the `seed_base` parameter. Same seed + same prompt = same output.

**File permission errors:**
Ensure the n8n process has write access to the output directories. With Docker, the volume mount handles this. For local installs, check directory ownership.
