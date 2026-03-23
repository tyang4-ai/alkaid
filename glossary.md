# Alkaid Glossary

Shared naming dictionary for all layers of the Alkaid project: C# simulation, GDScript rendering, Python training environment, and JSON data files. Every name listed here is the single source of truth.

---

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| C# enums, classes, properties | PascalCase | `UnitType.JiHalberdiers`, `MoraleSystem.Tick()` |
| C# enum members | PascalCase | `TerrainType.ShallowFord` |
| GDScript variables, functions, signals | snake_case | `unit_type.JI_HALBERDIERS`, `_on_unit_spawned()` |
| GDScript signals (emitted from C#) | snake_case with past tense | `unit_spawned`, `morale_broke` |
| Python training env enums | UPPER_SNAKE_CASE | `UnitType.JI_HALBERDIERS` |
| JSON data keys | camelCase | `"maxSize"`, `"hpPerSoldier"`, `"attackSpeed"` |
| JSON enum values (int IDs) | Match table below | `0`, `1`, `2`, ... |
| Constants file keys | UPPER_SNAKE_CASE | `FATIGUE_MARCH_PER_TICK` |
| File names (C#) | PascalCase `.cs` | `MoraleSystem.cs`, `UnitManager.cs` |
| File names (GDScript) | snake_case `.gd` | `unit_renderer.gd`, `battle_hud.gd` |
| File names (data) | snake_case `.json` | `constants.json`, `units.json` |

---

## Unit Types (13 + General)

| ID | English Name | Chinese (Traditional) | Chinese (Simplified) | Pinyin | C# Enum | Python Enum | Category |
|----|-------------|----------------------|---------------------|--------|---------|-------------|----------|
| 0 | Ji Halberdiers | 戟兵 | 戟兵 | Ji Bing | `JiHalberdiers` | `JI_HALBERDIERS` | Infantry |
| 1 | Dao Swordsmen | 刀兵 | 刀兵 | Dao Bing | `DaoSwordsmen` | `DAO_SWORDSMEN` | Infantry |
| 2 | Nu Crossbowmen | 弩兵 | 弩兵 | Nu Bing | `NuCrossbowmen` | `NU_CROSSBOWMEN` | Ranged |
| 3 | Gong Archers | 弓兵 | 弓兵 | Gong Bing | `GongArchers` | `GONG_ARCHERS` | Ranged |
| 4 | Light Cavalry | 輕騎 | 轻骑 | Qing Qi | `LightCavalry` | `LIGHT_CAVALRY` | Cavalry |
| 5 | Heavy Cavalry | 重騎 | 重骑 | Zhong Qi | `HeavyCavalry` | `HEAVY_CAVALRY` | Cavalry |
| 6 | Horse Archers | 騎射 | 骑射 | Qi She | `HorseArchers` | `HORSE_ARCHERS` | Cavalry |
| 7 | Siege Engineers | 攻城兵 | 攻城兵 | Gong Cheng Bing | `SiegeEngineers` | `SIEGE_ENGINEERS` | Siege |
| 8 | Elite Guard | 親衛 | 亲卫 | Qin Wei | `EliteGuard` | `ELITE_GUARD` | Infantry |
| 9 | Scouts | 斥候 | 斥候 | Chi Hou | `Scouts` | `SCOUTS` | Infantry |
| 10 | Meng Chong | 蒙沖 | 蒙冲 | Meng Chong | `MengChong` | `MENG_CHONG` | Naval |
| 11 | Lou Chuan (Tower Ship) | 樓船 | 楼船 | Lou Chuan | `LouChuan` | `LOU_CHUAN` | Naval |
| 12 | Fire Ships | 火船 | 火船 | Huo Chuan | `FireShips` | `FIRE_SHIPS` | Naval |
| 13 | General | 將軍 | 将军 | Jiang Jun | `General` | `GENERAL` | Special |

### Unit Categories

| ID | English | C# Enum | Python Enum |
|----|---------|---------|-------------|
| 0 | Infantry | `Infantry` | `INFANTRY` |
| 1 | Ranged | `Ranged` | `RANGED` |
| 2 | Cavalry | `Cavalry` | `CAVALRY` |
| 3 | Siege | `Siege` | `SIEGE` |
| 4 | Naval | `Naval` | `NAVAL` |

---

## Order Types (10)

| ID | English | Chinese (Trad.) | Chinese (Simpl.) | Pinyin | C# Enum | Python Enum | Description |
|----|---------|----------------|-----------------|--------|---------|-------------|-------------|
| 0 | Move | 移動 | 移动 | Yi Dong | `Move` | `MOVE` | Move to target position |
| 1 | Attack Move | 進攻 | 进攻 | Jin Gong | `Attack` | `ATTACK` | Move toward enemy, engage on contact |
| 2 | Hold | 駐守 | 驻守 | Zhu Shou | `Hold` | `HOLD` | Hold position, defensive posture (+10% defense) |
| 3 | Retreat | 撤退 | 撤退 | Che Tui | `Retreat` | `RETREAT` | Fall back toward safe area (50% faster delivery) |
| 4 | Flank | 側擊 | 侧击 | Ce Ji | `Flank` | `FLANK` | Move around enemy front line |
| 5 | Charge | 衝鋒 | 冲锋 | Chong Feng | `Charge` | `CHARGE` | Rush at 1.3x speed, charge bonus on contact |
| 6 | Form Up | 列陣 | 列阵 | Lie Zhen | `FormUp` | `FORM_UP` | Tighten formation (+20% armor, -30% speed) |
| 7 | Disengage | 脫離 | 脱离 | Tuo Li | `Disengage` | `DISENGAGE` | Pull back from melee (-20% speed for 5 ticks) |
| 8 | Rally | 集結 | 集结 | Ji Jie | `Rally` | `RALLY` | Recover routed squad (2x delivery delay) |
| 9 | No-Op | -- | -- | -- | `NoOp` | `NO_OP` | Do nothing (used by AI for "no order change") |

---

## AI Personalities (4)

| ID | English | Chinese (Trad.) | Chinese (Simpl.) | Pinyin | C# Enum | Python Enum | Playstyle |
|----|---------|----------------|-----------------|--------|---------|-------------|-----------|
| 0 | Aggressive | 猛將 | 猛将 | Meng Jiang | `Aggressive` | `AGGRESSIVE` | High attack bias, charges early, pursues routing enemies |
| 1 | Defensive | 守將 | 守将 | Shou Jiang | `Defensive` | `DEFENSIVE` | High defender bias, terrain exploitation, holds ground |
| 2 | Cunning | 謀將 | 谋将 | Mou Jiang | `Cunning` | `CUNNING` | Flanking, ambush, supply raids, adapts to player |
| 3 | Balanced | 良將 | 良将 | Liang Jiang | `Balanced` | `BALANCED` | Moderate all tendencies, reacts to battlefield state |

---

## AI Tactical Roles (7)

| ID | English | C# Enum | Python Enum | Assigned To |
|----|---------|---------|-------------|-------------|
| 0 | Attacker | `Attacker` | `ATTACKER` | Melee infantry, shock cavalry |
| 1 | Defender | `Defender` | `DEFENDER` | Holding line, terrain-anchored squads |
| 2 | Flanker | `Flanker` | `FLANKER` | Light cavalry, swordsmen on the wing |
| 3 | Reserve | `Reserve` | `RESERVE` | Uncommitted squads held behind line |
| 4 | Scout | `Scout` | `SCOUT` | Scout units (always assigned this role) |
| 5 | Supply Raider | `SupplyRaider` | `SUPPLY_RAIDER` | Light cavalry sent behind enemy lines |
| 6 | Guard | `Guard` | `GUARD` | Elite Guard + General (protect general) |

---

## AI Phases (5)

| ID | English | C# Enum | Python Enum | Trigger |
|----|---------|---------|-------------|---------|
| 0 | Opening | `Opening` | `OPENING` | Battle start until engagement tick |
| 1 | Engagement | `Engagement` | `ENGAGEMENT` | Contact with enemy |
| 2 | Pressing | `Pressing` | `PRESSING` | Strength ratio favorable past threshold |
| 3 | Retreating | `Retreating` | `RETREATING` | Strength ratio below retreat threshold |
| 4 | Desperate | `Desperate` | `DESPERATE` | Strength ratio below desperate threshold |

---

## Victory Types (6)

| ID | English | Chinese (Trad.) | Chinese (Simpl.) | Pinyin | C# Enum | Python Enum | Condition |
|----|---------|----------------|-----------------|--------|---------|-------------|-----------|
| 0 | Surrender | 投降 | 投降 | Tou Xiang | `Surrender` | `SURRENDER` | Surrender pressure > 80 for 5 consecutive checks |
| 1 | Annihilation | 殲滅 | 歼灭 | Jian Mie | `Annihilation` | `ANNIHILATION` | All enemy squads routed off map or killed |
| 2 | General Killed | 將亡 | 将亡 | Jiang Wang | `GeneralKilled` | `GENERAL_KILLED` | Enemy general dies, triggers collapse |
| 3 | Starvation | 斷糧 | 断粮 | Duan Liang | `Starvation` | `STARVATION` | Supply at 0% for 50+ ticks |
| 4 | Retreat | 撤退 | 撤退 | Che Tui | `Retreat` | `RETREAT` | Army retreats off map (loss, not victory) |
| 5 | Stalemate | 僵局 | 僵局 | Jiang Ju | `Stalemate` | `STALEMATE` | Time limit reached, no decisive result |

---

## Terrain Types (10)

| ID | English | Chinese | Pinyin | C# Enum | Python Enum | Move Cost | Def Bonus | Cav Effect | Forage |
|----|---------|---------|--------|---------|-------------|-----------|-----------|------------|--------|
| 0 | Deep Water | 深水 | Shen Shui | `Water` | `WATER` | Impassable | +0% | 0% | 0.0 |
| 1 | Shallow Ford | 淺灘 | Qian Tan | `Ford` | `FORD` | 2.5x | -20% | 30% | 0.0 |
| 2 | Plains | 平原 | Ping Yuan | `Plains` | `PLAINS` | 1.0x | +0% | 100% | 1.0 |
| 3 | Forest | 森林 | Sen Lin | `Forest` | `FOREST` | 1.8x | +25% | 25% | 1.5 |
| 4 | Hills | 丘陵 | Qiu Ling | `Hills` | `HILLS` | 2.0x | +40% | 50% | 0.5 |
| 5 | Mountains | 山地 | Shan Di | `Mountains` | `MOUNTAINS` | 3.0x | +50% | 10% | 0.2 |
| 6 | River | 河流 | He Liu | `River` | `RIVER` | Impassable | +30% | 0% | 1.2 |
| 7 | Marsh | 沼澤 | Zhao Ze | `Marsh` | `MARSH` | 3.0x | -10% | 10% | 0.3 |
| 8 | Road | 官道 | Guan Dao | `Road` | `ROAD` | 0.5x | +0% | 100% | 0.0 |
| 9 | City | 城池 | Cheng Chi | `City` | `CITY` | 0.5x | +150% | 0% | 0.0 |

**Move Cost notes:** 1.0x = base speed. Higher = slower. -1 / Impassable = cannot enter. 0.5x = faster than base (roads, cities).

**Cav Effect:** Percentage of cavalry combat effectiveness on this terrain. 0% = cavalry cannot fight here.

---

## Weather Types (5)

| ID | English | Chinese (Trad.) | Chinese (Simpl.) | Pinyin | C# Enum | Python Enum | Probability | Key Effects |
|----|---------|----------------|-----------------|--------|---------|-------------|-------------|-------------|
| 0 | Clear | 晴 | 晴 | Qing | `Clear` | `CLEAR` | 40% | No modifiers |
| 1 | Rain | 雨 | 雨 | Yu | `Rain` | `RAIN` | 20% | Crossbow -40% dmg, archer -20% dmg, move -20%, fire -50% |
| 2 | Fog | 霧 | 雾 | Wu | `Fog` | `FOG` | 15% | Visibility halved, ambush bonus doubled, ranged -20% accuracy |
| 3 | Wind | 風 | 风 | Feng | `Wind` | `WIND` | 15% | Directional: ranged +/-10% accuracy, fire ships +/-50% dmg |
| 4 | Snow | 雪 | 雪 | Xue | `Snow` | `SNOW` | 10% | Fatigue +50%, southern troops -10 morale, move -15% |

**Snow** only appears during winter campaign turns. Weather can shift mid-battle every 200 ticks (20% chance), except snow.

---

## Time of Day (6 Phases)

| ID | English | Chinese (Trad.) | Chinese (Simpl.) | Pinyin | Traditional Name | C# Enum | Python Enum | Tick Range | Visibility |
|----|---------|----------------|-----------------|--------|-----------------|---------|-------------|------------|------------|
| 0 | Dawn | 黎明 | 黎明 | Li Ming | 寅時 (Yin Shi) | `Dawn` | `DAWN` | 0--200 | 80% |
| 1 | Morning | 上午 | 上午 | Shang Wu | 辰時 (Chen Shi) | `Morning` | `MORNING` | 200--400 | 100% |
| 2 | Midday | 正午 | 正午 | Zheng Wu | 午時 (Wu Shi) | `Midday` | `MIDDAY` | 400--600 | 100% |
| 3 | Afternoon | 下午 | 下午 | Xia Wu | 申時 (Shen Shi) | `Afternoon` | `AFTERNOON` | 600--800 | 100% |
| 4 | Dusk | 黃昏 | 黄昏 | Huang Hun | 戌時 (Xu Shi) | `Dusk` | `DUSK` | 800--1000 | 60% |
| 5 | Night | 夜晚 | 夜晚 | Ye Wan | 子時 (Zi Shi) | `Night` | `NIGHT` | 1000+ | 30% |

**Morale modifiers:** Dawn attacker +10; Afternoon -5 both sides; Dusk defender +5; Night -10 all (veterans exp > 60 immune).

**Fatigue modifiers:** Midday +20% gain; Afternoon +10%; Dusk +15%; Night +5%.

---

## Difficulty Levels (4)

| ID | English | Chinese (Trad.) | Chinese (Simpl.) | Pinyin | C# Enum | Python Enum | AI Behavior |
|----|---------|----------------|-----------------|--------|---------|-------------|-------------|
| 0 | Easy | 簡單 | 简单 | Jian Dan | `Easy` | `EASY` | Slow decisions, low aggression, no adaptation |
| 1 | Medium | 中等 | 中等 | Zhong Deng | `Medium` | `MEDIUM` | Normal speed, balanced, no adaptation |
| 2 | Hard | 困難 | 困难 | Kun Nan | `Hard` | `HARD` | Faster decisions, terrain exploitation, RL model, adaptation |
| 3 | Brutal | 殘酷 | 残酷 | Can Ku | `Brutal` | `BRUTAL` | Fastest decisions, all abilities boosted, full adaptation |

---

## Game Concepts

| English | Chinese (Trad.) | Chinese (Simpl.) | Pinyin | C# Property / System | Notes |
|---------|----------------|-----------------|--------|---------------------|-------|
| Morale | 士氣 | 士气 | Shi Qi | `MoraleSystem` / `unit.Morale` | Per-squad, 0--100. Starts 70 (regular) or 85 (elite). |
| Fatigue | 疲勞 | 疲劳 | Pi Lao | `FatigueSystem` / `unit.Fatigue` | Per-squad, 0--100. Starts 0. |
| Supply / Food | 糧草 | 粮草 | Liang Cao | `SupplySystem` / `army.Food` | Army-level resource. Base capacity 100. |
| Experience | 經驗 | 经验 | Jing Yan | `ExperienceSystem` / `unit.Experience` | Per-squad, 0--100. Persists across campaign battles. |
| Command Radius | 號令範圍 | 号令范围 | Hao Ling Fan Wei | `CommandSystem` | ~30% of map width. Orders within radius: 3x delivery speed. |
| Fog of War | 戰場迷霧 | 战场迷雾 | Zhan Chang Mi Wu | `FogOfWarSystem` | Per-team visibility grid. |
| Surrender Pressure | 投降壓力 | 投降压力 | Tou Xiang Ya Li | `SurrenderSystem` | Composite score (morale, casualties, supply, encirclement, leadership). |
| Rout | 潰敗 | 溃败 | Kui Bai | `unit.State == Routing` | Squad flees at 1.5x speed, +50% damage taken. |
| Deployment | 佈陣 | 布阵 | Bu Zhen | Deployment phase | Pre-battle unit placement in deployment zone. |
| Campaign | 征戰 | 征战 | Zheng Zhan | `CampaignManager` | Roguelike territory conquest loop. |
| Recruitment | 募兵 | 募兵 | Mu Bing | `RecruitmentManager` | Between-battle squad hiring. |
| Clemency | 寬赦 | 宽赦 | Kuan She | Post-surrender choice | Accept surrender (+troops) or reject (+destruction bonus). |
| Ambush | 伏擊 | 伏击 | Fu Ji | Surprise attack mechanic | +50% first strike, morale shock to target. |
| Charge Bonus | 衝鋒加成 | 冲锋加成 | Chong Feng Jia Cheng | Combat modifier | First attack on contact: 2x (light cav), 2.5x (heavy cav). |
| General | 將軍 | 将军 | Jiang Jun | `CommandSystem` / special unit | Death = campaign run ends. |
| Messenger | 傳令兵 | 传令兵 | Chuan Ling Bing | `CommandSystem` | Travels at 4.0 tiles/sec to deliver orders. |
| Supply Line | 補給線 | 补给线 | Bu Ji Xian | `SupplySystem` | Path from depot to army. Can be cut by enemy cavalry. |
| Supply Depot | 糧倉 | 粮仓 | Liang Cang | `SupplySystem` | Rear-area structure. HP 500. Destruction = all food lost. |
| Foraging | 就地取糧 | 就地取粮 | Jiu Di Qu Liang | `SupplySystem` | Terrain-dependent food gathering when supply line cut. |
| Formation | 陣型 | 阵型 | Zhen Xing | Deployment templates | Standard Line, Crescent, Echelon, Defensive Square, Ambush. |

---

## Formation Names (5 Presets)

| English | Chinese (Trad.) | Chinese (Simpl.) | Pinyin | C# Enum |
|---------|----------------|-----------------|--------|---------|
| Standard Line | 默認陣型 | 默认阵型 | Mo Ren Zhen Xing | `StandardLine` |
| Crescent | 月牙陣 | 月牙阵 | Yue Ya Zhen | `Crescent` |
| Echelon | 斜行陣 | 斜行阵 | Xie Xing Zhen | `Echelon` |
| Defensive Square | 方陣 | 方阵 | Fang Zhen | `DefensiveSquare` |
| Ambush | 伏兵陣 | 伏兵阵 | Fu Bing Zhen | `Ambush` |

---

## Unit States (5)

| ID | English | C# Enum | Python Enum | Description |
|----|---------|---------|-------------|-------------|
| 0 | Idle | `Idle` | `IDLE` | Stationary, no current order |
| 1 | Moving | `Moving` | `MOVING` | Executing a movement order |
| 2 | Attacking | `Attacking` | `ATTACKING` | Engaged in combat |
| 3 | Defending | `Defending` | `DEFENDING` | Holding position under attack |
| 4 | Routing | `Routing` | `ROUTING` | Fleeing, morale broken |

---

## Experience Tiers (5)

| Tier | Exp Range | English | Chinese | Pinyin | Rout Threshold |
|------|-----------|---------|---------|--------|---------------|
| 0 | 0--19 | Raw Recruit | 新兵 | Xin Bing | Morale <= 25 |
| 1 | 20--39 | Trained | 訓練兵 | Xun Lian Bing | Morale <= 15 |
| 2 | 40--59 | Regular | 正規兵 | Zheng Gui Bing | Morale <= 15 |
| 3 | 60--79 | Veteran | 老兵 | Lao Bing | Morale <= 10 |
| 4 | 80--100 | Elite | 精兵 | Jing Bing | Morale <= 5 |

---

## Map Templates (5)

| English | Chinese | Pinyin | Key Feature |
|---------|---------|--------|-------------|
| River Valley | 河谷 | He Gu | Central river, 2--3 crossing points, naval combat |
| Mountain Pass | 山隘 | Shan Ai | Narrow corridor through mountains, defender advantage |
| Open Plains | 曠野 | Kuang Ye | Flat terrain, cavalry warfare, flanking maneuvers |
| Wetlands | 水澤 | Shui Ze | Rivers, lakes, marsh; naval dominance wins |
| Siege | 攻城 | Gong Cheng | Walled city center, attacker surrounds |

---

## Campaign Resources (5)

| English | Chinese | Pinyin | JSON Key | Primary Source |
|---------|---------|--------|----------|---------------|
| Gold | 金 | Jin | `"gold"` | All territories |
| Food | 糧 | Liang | `"food"` | Farm territories, granaries |
| Horses | 馬 | Ma | `"horses"` | Horse-breeding territories |
| Iron | 鐵 | Tie | `"iron"` | Mountain/mine territories |
| Population | 民 | Min | `"population"` | City territories |

---

## Signal Names (C# -> GDScript)

C# signals are PascalCase delegates. GDScript receives them as snake_case. The mapping:

| C# Signal Delegate | GDScript Connection | Payload |
|--------------------|--------------------|---------|
| `UnitSpawnedEventHandler` | `unit_spawned` | `(int id, int team, int type)` |
| `UnitKilledEventHandler` | `unit_killed` | `(int unitId, int killerId)` |
| `UnitStateChangedEventHandler` | `unit_state_changed` | `(int unitId, int oldState, int newState)` |
| `CombatDamageEventHandler` | `combat_damage` | `(int attackerId, int defenderId, float damage)` |
| `CombatEngagedEventHandler` | `combat_engaged` | `(int unitAId, int unitBId)` |
| `CombatDisengagedEventHandler` | `combat_disengaged` | `(int unitAId, int unitBId)` |
| `MoraleBrokeEventHandler` | `morale_broke` | `(int unitId)` |
| `MoraleRecoveredEventHandler` | `morale_recovered` | `(int unitId)` |
| `MoraleCascadeEventHandler` | `morale_cascade` | `(int team, int count)` |
| `OrderIssuedEventHandler` | `order_issued` | `(int unitId, int orderType)` |
| `OrderDeliveredEventHandler` | `order_delivered` | `(int unitId, int orderType)` |
| `MessengerDispatchedEventHandler` | `messenger_dispatched` | `(int fromX, int fromY, int toX, int toY)` |
| `ExperienceTierUpEventHandler` | `experience_tier_up` | `(int unitId, int newTier)` |
| `SupplyDepletedEventHandler` | `supply_depleted` | `(int team)` |
| `FatigueThresholdEventHandler` | `fatigue_threshold` | `(int unitId, int level)` |
| `WeatherChangedEventHandler` | `weather_changed` | `(int oldWeather, int newWeather)` |
| `TimeOfDayChangedEventHandler` | `time_of_day_changed` | `(int oldPhase, int newPhase)` |
| `BattleStartedEventHandler` | `battle_started` | `()` |
| `BattleEndedEventHandler` | `battle_ended` | `(int victoryType, int winnerTeam)` |
| `DeploymentCompleteEventHandler` | `deployment_complete` | `()` |
| `TerritoryConqueredEventHandler` | `territory_conquered` | `(string territoryId)` |
| `RandomEventTriggeredEventHandler` | `random_event_triggered` | `(string eventId)` |
| `AiDecisionMadeEventHandler` | `ai_decision_made` | `(string primaryOrder, int tick)` |
