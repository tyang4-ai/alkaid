# Alkaid Game Mechanics Reference

## Damage Formula
```
baseDamage = attacker.damage × (squadSize / maxSize)
typeMultiplier = TYPE_MATCHUP_TABLE[attacker][defender]  (0.3x to 2.5x)
terrainDefense = TERRAIN_DEFENSE[defender_terrain]  (0% to +150%)
armorReduction = max(0, defender.armor - attacker.armorPen) / 20  (0% to ~50%)
fatigueMultiplier = 1 - (attacker.fatigue / 200)  (50-100%)
experienceMultiplier = 1 + (experience - 50) × 0.003  (85-115%)
weatherMultiplier = varies by weather and unit type

finalDamage = baseDamage × typeMultiplier × (1 - terrainDefense) × (1 - armorReduction) × fatigueMultiplier × experienceMultiplier × weatherMultiplier
```

Key modifiers:
- Routing defender: +50% damage taken
- Cavalry charge (first attack): 2.0-2.5x damage
- Dao shield vs ranged: -30% damage
- Night combat: -10 morale to all non-veteran units

## Morale System (0-100, starts at 70)

**Rout thresholds by experience:**
- Conscript (0-19 exp): routs at morale ≤ 25
- Regular (20-59 exp): routs at morale ≤ 15
- Veteran (60-79 exp): routs at morale ≤ 10
- Elite (80-100 exp or Elite Guard): routs at morale ≤ 5

**Major morale hits:**
- Taking casualties: -2 per 1% lost per tick
- Friendly rout nearby (5 tiles): -10 one-time
- General killed: -30 army-wide
- Encircled (no retreat): -5/tick
- No food: -3 to -5/tick

**Morale gains:**
- General nearby: +1/tick
- Winning engagement: +5-10
- Well supplied (>50%): +0.5/tick
- Elite Guard aura (3 tiles): +3 passive
- Idle recovery: +0.5/tick

**Rout cascade:** 30%+ squads routing → -20 morale army-wide. 50%+ → -40 morale (usually causes total collapse).

**Rally:** Routed units can be rallied if morale recovers above threshold + 15, but only with an explicit Rally order from the general.

## Supply System

**Consumption:** squadSize × 0.01 food/tick per squad
**Starvation effects:**
| Food Level | Effects |
|-----------|---------|
| 50-100% | Normal |
| 25-50% | Morale -1/tick, movement -10% |
| 1-25% | Morale -3/tick, combat -20%, movement -20%, desertion 0.5/tick |
| 0% | Morale -5/tick, combat -40%, movement -30%, desertion 1.5/tick |
| 0% for 50+ ticks | Mass surrender/rout |

**Foraging by terrain:** Forest 1.5, River 1.2, Plains 1.0, Hills 0.5, Marsh 0.3, Mountains 0.2

**Supply lines:** Can be cut by enemy units occupying the route for 5 ticks. Light cavalry are primary supply raiders.

## Fatigue System (0-100, starts at 0)

**Gains:** Marching +1/tick, Force march +3/tick, Fighting +3/tick, River crossing +5/tick
**Recovery:** Stationary -2/tick, In camp -4/tick, Well-fed bonus -0.5/tick

**Effects:**
| Fatigue | Movement | Damage | Other |
|---------|----------|--------|-------|
| 0-30% | Normal | Normal | — |
| 30-60% | -15% | -10% | — |
| 60-80% | -30% | -20% | Morale -1/tick |
| 80-100% | -50% | -35% | Morale -2/tick |
| 100% | -70% | -50% | Cannot charge |

## Terrain Effects

| Terrain | Move Cost | Defense Bonus | Cavalry Effect | Forage |
|---------|-----------|--------------|----------------|--------|
| Plains | 1.0 | 0% | 100% | 1.0 |
| Forest | 1.8 | +25% | 25% | 1.5 |
| Hills | 2.0 | +40% | 50% | 0.5 |
| Mountains | 3.0 | +50% | 10% | 0.2 |
| Marsh | 3.0 | -10% | 10% | 0.3 |
| Road | 0.5 | 0% | 100% | 0.0 |
| City | 0.5 | +150% | 0% | 0.0 |

Dao Swordsmen ignore forest/hills movement penalties and get +15% damage there.
Scouts have no terrain penalties except mountains (1.5x instead of 3x).

## Weather Effects

| Weather | Crossbow | Archer | Movement | Special |
|---------|----------|--------|----------|---------|
| Clear | Normal | Normal | Normal | — |
| Rain | -40% | -20% | -20% off-road | Fire -50%, river +50% drowning |
| Fog | Normal | -20% at range | Normal | Visibility halved, ambush doubled |
| Wind | ±10% accuracy | ±10% acc, ±1 range | Normal | Fire ships ±50% |
| Snow | Normal | Normal | -15% | Fatigue +50%, southern troops -10 morale |

## Surrender System

Pressure = morale(30%) + casualties(25%) + supply(20%) + encirclement(15%) + leadership(10%)
When pressure > 80 for 5 consecutive checks (50 ticks) → army surrenders.

## Command System

Orders travel via messenger from general to squad at 4.0 tiles/sec.
- Within command radius: 3x speed
- General dead: 0.5x speed, 15% misinterpretation chance, no Rally orders

## Time of Day

| Phase | Ticks | Visibility | Notes |
|-------|-------|-----------|-------|
| Dawn | 0-200 | 80% | Attacker +10 morale, fog +20% |
| Morning | 200-400 | 100% | Best conditions |
| Midday | 400-600 | 100% | Fatigue +20%, supply 1.3x |
| Afternoon | 600-800 | 100% | Morale -5 both, fatigue +10% |
| Dusk | 800-1000 | 60% | Defender +5, ranged -15% |
| Night | 1000+ | 30% | Morale -10 all, ambush doubled |

## Experience Tiers

| Tier | Exp Range | Damage | Morale Baseline | Rout Threshold |
|------|-----------|--------|----------------|----------------|
| Raw Recruit | 0-19 | -10% | -10 | ≤25 |
| Trained | 20-39 | Normal | Normal | ≤15 |
| Regular | 40-59 | +5% | +5 | ≤15 |
| Veteran | 60-79 | +15% | +10 | ≤10 |
| Elite | 80-100 | +25% | +15 | ≤5 |

## Victory Types
1. **Surrender** — pressure > 80 sustained → full loot + prisoners
2. **Annihilation** — all squads destroyed/routed off map
3. **General killed** — triggers collapse, then surrender
4. **Starvation** — 0% food for 50+ ticks
5. **Campaign:** Player general killed = run ends (roguelike death)
