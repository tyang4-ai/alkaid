# Alkaid — Addiction & Engagement Roadmap

> This is a design document for future development, not an immediate implementation plan.

---

## The Core Problem

Alkaid has excellent *systems* (morale, supply, fatigue, command delay, weather, FOW), but lacks *narrative infrastructure* to make the player care about those systems. The systems are the engine; stories are the fuel.

---

## The Real "Why" — These Games Are Thinking Tools, Not Entertainment Products

The addiction in Factorio, Civilization, and Minecraft is NOT from dopamine reward loops, battle passes, or progression bars. It's from **deep flow states** that arise because these games are perfectly designed *thinking tools*. The player isn't consuming content — they're exercising their intelligence in a medium that responds to it perfectly. That's why 8-hour sessions happen: not because the game tricked you, but because you were in the deepest cognitive engagement a human can experience.

### Factorio: Externalized Cognition

The factory IS your brain, made physical. Every belt, splitter, and inserter is a decision you made, persisted in space where you can see it. You're not playing a game — you're building a tangible representation of your own systems-thinking intelligence. When you optimize a production line, you're not optimizing the game — you're refining your own thinking. That's intoxicating.

The key mechanism is **self-generated goals on an infinite optimization horizon**. The game never tells you what to build next. YOU decide. The factory is "working" but it could be more elegant, more compact, more throughput-efficient. There is no optimal solution, just like there's no perfect chess game. You can always improve. And because the goal is self-generated, the motivation is intrinsic — orders of magnitude more sustainable than extrinsic reward chasing.

Why you can't stop: every solved problem reveals 2 new problems. But critically, YOU see the new problems before the game tells you. You look at the factory and your brain says "that throughput is wrong" before any alert fires. The game respects your intelligence enough to let you diagnose.

### Civilization: Compounding Agency Across Time

"One more turn" isn't about a reward arriving. It's about **investment protection**. You've spent 200 turns making decisions that compound on each other — your turn-5 city placement determined your turn-50 tech path which determines your turn-150 military. Stopping means leaving those compounding decisions unresolved, and your brain treats unmade decisions as threats to everything you've already built.

The deeper pull: Civ is a **counterfactual engine**. Every game is an answer to "what if?" What if Rome discovered gunpowder first? What if I had settled on the coast? These questions are unanswerable, which means they persist as itch. The only scratch is another 8-hour game. And because you experience 6000 years in 8 hours, you get a god-like perspective on causality that no other medium provides.

### Minecraft: Pure Agency With No Friction

In real life, building a house takes years. In Minecraft, you think "bridge" and it exists in 30 seconds. The gap between intention and reality is milliseconds. This isn't escapism — it's the experience of **pure will shaping the world without resistance**. Every human craves this. Minecraft delivers it perfectly.

But Creative mode is less addictive than Survival mode — WHY? Because constraints give meaning. A house in Creative is aesthetic. A house in Survival is a fortress you built to NOT DIE. The survival pressure transforms building from entertainment into problem-solving. And your progress is SPATIAL — you can walk through it, stand on the roof of your castle and look at the mine shaft that took 3 hours. Time invested becomes physical architecture you inhabit.

---

## The 5 Properties These Games Share

1. **Millisecond thought-to-result gap**: You think it, the game shows the result. No waiting. No confusion about what happened. In Factorio you place a belt and immediately see throughput change. In Minecraft you place a block and it's there. In Civ you move a unit and immediately see the new tactical picture. The feedback loop is so tight it becomes invisible.

2. **Readable state at a glance**: You can LOOK at the game and immediately understand everything. Factorio: backed-up belts = bottleneck. Minecraft: dark area = danger. Civ: borders touching = tension. No menus needed. The information is spatial, visual, and instant.

3. **Infinite ceiling, no floor**: You literally cannot fail at Factorio. You can only be less efficient. Minecraft survival has death, but you respawn. Civ has defeat, but the journey was the point. The absence of hard failure removes anxiety, and anxiety is flow's mortal enemy. Meanwhile, the skill ceiling is infinite — there is ALWAYS a more elegant solution.

4. **Self-generated goals**: The game presents systems and trusts you to decide what to do with them. It never says "build X by turn Y." YOU author your ambitions. This is respect for player intelligence, and it creates intrinsic motivation that external reward systems can never match.

5. **Compounding decisions**: Every choice echoes. Nothing is throwaway. In Factorio, your ore patch layout at minute 10 constrains your megabase at hour 40. In Civ, your first city determines everything. This makes every moment feel heavy with consequence, which prevents the "nothing matters" boredom that kills engagement.

---

## What Alkaid Is Missing (Deep Diagnosis)

**1. The thought-to-result gap is too large.** You give an order, wait for messenger, watch units move, wait for combat to resolve, infer the outcome from health bars. By the time you see the result of your decision, you've forgotten why you made it. The causal chain between "I ordered a flank" and "the enemy routed" is invisible. You need to SEE the causality: see the morale plummet in real-time, see the flanking bonus trigger, see the cascade propagate.

**2. The battlefield isn't readable at a glance.** You can't look at the screen and immediately know: who's winning, where the pressure is, where the opportunity is. In Factorio, a backed-up belt IS the diagnosis. In Alkaid, you need to mentally aggregate unit health bars, morale values, and position to understand the situation. The game should make battlefield flow visible — think heat maps, pressure arrows, morale gradients baked into the visual layer.

**3. Not enough meaningful decisions per minute during battle.** Once initial orders are given, you mostly watch. The game needs more moments where YOUR intervention changes the outcome: timing a cavalry charge to hit precisely when the enemy formation shows a gap, choosing the exact moment to commit reserves, deciding whether to break off a losing engagement or commit reinforcements and double down.

**4. The campaign doesn't compound decisions.** In Civ, your turn-5 settlement choice echoes at turn-150. In Alkaid, each battle is relatively independent. Your army carries over but there's no "my decision on territory 3 opened up a strategy for territory 12." Need decision chains where early choices constrain and enable later ones.

**5. The player never gets to express creative intelligence.** Factorio lets you express logistics genius. Civ lets you express historical grand strategy. Minecraft lets you express spatial creativity. Alkaid needs to let the player express TACTICAL GENIUS — and then show them, unambiguously, that their tactics were brilliant. Not with a grade. With the visible, undeniable collapse of the enemy formation exactly where you planned it.

**6. No infinite optimization horizon.** Once you beat a battle, it's done. There's no "I could do that better." No replay of the same scenario trying for perfect execution. No sandbox mode where you construct dream matchups just to see what happens.

---

## Features: Making Alkaid a Thinking Tool for Warfare

These aren't "engagement mechanics." They're design changes that make the game a better medium for tactical thinking.

---

### A. Make Causality Visible (Fix the thought-to-result gap)

**1. Battlefield Flow Visualization** — Render real-time "pressure flow" on the terrain: colored gradients showing where your force is pushing vs where the enemy dominates. Like weather fronts on a map. When you order a flank, you WATCH the pressure gradient shift in real-time. When morale breaks, you SEE the color drain from that sector. The player should never need to check a panel — the battlefield itself is the dashboard. Think of it as Factorio's backed-up belts: the visual IS the information.

**2. Causal Chain Replay** — After every major event (rout, general killed, surrender), show a 3-second "instant replay" tooltip that traces the causal chain backwards: "Enemy cavalry routed -> morale dropped below 25 -> triggered by: your halberdiers killed 40% of their squad in 10 ticks -> because: you ordered CHARGE from high ground (+30% damage)." The player sees that THEIR decision 30 seconds ago caused THIS outcome. That's the moment they feel like a genius.

**3. Decision Impact Markers** — When you issue an order, place a subtle timestamp marker on the battlefield. When that order produces a result (engagement, rout, capture), draw a faint line connecting the decision to the consequence. Over the course of a battle, the battlefield accumulates a web of your decision-to-outcome threads. In the after-action report, this becomes a "Decision Map" — a visual proof of your tactical authorship.

---

### B. Create a Readable Battlefield (Fix the glance-understanding problem)

**4. Morale Gradient Rendering** — Instead of tiny health/morale bars over each squad, render morale as the OPACITY of the unit's team color. Full morale = vivid color. Low morale = faded, almost transparent. Routing = flickering. At a glance, you instantly know: vivid side is winning, faded side is crumbling. No bars needed.

**5. Engagement Lines** — Thin lines connecting units in active combat, colored by who's winning the exchange. Red line = you're dealing more damage. Blue line = you're taking more. Thick line = heavy engagement. Thin line = skirmishing. The battlefield becomes a living network diagram of combat relationships.

---

### C. Increase Meaningful Decisions Per Minute (Fix the "watch and wait" problem)

**6. Timing Windows** — Certain tactical actions have "windows" where they're dramatically more effective. Charging cavalry into an enemy formation deals 1.5x damage normally, but 3x if you time it within 5 ticks of when the enemy's front rank breaks formation (they just received an order, they're turning, they're regrouping). The game shows a subtle visual cue when the window opens. Mastering these timing windows is the difference between a competent player and a brilliant one. Like parrying in Dark Souls — the system exists for everyone, but executing it perfectly is a skill that creates endless depth.

**7. Reserve Commitment Dilemma** — Reserve squads generate a passive "Reserve Pressure" that affects enemy AI behavior (they play more cautiously when they know you have uncommitted reserves). Once you commit a reserve, the pressure drops and the enemy becomes more aggressive. This creates a constant decision: do you commit reserves now to win THIS engagement, or hold them to maintain strategic pressure? There's no right answer — it depends on reading the battle flow. This is the kind of decision that makes experienced players sweat.

**8. Terrain Interaction Orders** — Beyond just "terrain provides bonuses," let the player actively use terrain: order archers to the hilltop (obvious), but also: order scouts to set an ambush in the forest (they become invisible until enemy enters), order engineers to destroy a bridge (denies enemy crossing for 60 ticks), order halberdiers to form a shield wall at a chokepoint (blocks movement entirely). The terrain becomes a tool the player manipulates, not just a modifier that exists.

---

### D. Make Decisions Compound Across the Campaign (Fix the "each battle is independent" problem)

**9. Army Identity System** — Your army develops a visible IDENTITY based on how you fight. Win 3 battles using flanking tactics -> your army earns the "Flanking Doctrine" trait (cavalry gets +10% damage on flank attacks in all future battles this run). Win through attrition -> earn "War of Exhaustion" (supply consumption -15%). These doctrines stack and define YOUR army's character. The player stops thinking "what units do I recruit" and starts thinking "what kind of army am I building?" Like character builds in an RPG, but for an entire army.

**10. Named Squads with History** — Squads surviving 3+ battles get procedural Chinese names based on their deeds ("The Storm Bolts of Hefei"). They develop personality traits that affect gameplay: a squad that has survived being outnumbered gets "Stubborn" (+15 morale when outnumbered). A squad with high kills gets "Bloodthirsty" (+10% damage but +5% fatigue rate). Your army becomes a collection of characters, not units. Losing the Storm Bolts at territory 14 feels like losing a character in a novel you're writing.

**11. Strategic Ripple Effects** — Conquering a territory doesn't just add it to your map. It changes the strategic landscape: conquering a port gives access to naval units for coastal battles. Conquering a horse pasture region lets you recruit heavy cavalry. Conquering a mountain fortress gives you siege engineers. Each territory conquered EXPANDS WHAT YOU CAN DO, not just your score. Your campaign path becomes a build order, like choosing a tech path in Civ.

---

### E. Create the Infinite Optimization Horizon (Fix "once you win, it's over")

**12. Battle Sandbox Mode** — After completing any battle in campaign, it becomes available in a Sandbox Mode where you can replay it with any army composition, any weather, any time of day. Players who beat the campaign come back to the sandbox to answer "what if" questions: what if I had used all cavalry? What if it was raining? What if I only used 5 squads? This is Factorio's "blueprint sharing" equivalent — the game after the game.

**13. Ghost Armies** — In sandbox mode, you can fight against a ghost recording of YOUR OWN best performance. Your previous army moves and fights exactly as you commanded it. Now beat yourself. This creates infinite replayability because the opponent is always exactly as good as your best self. Like time trials in racing games, but for tactics.

---

### F. Make It Feel Real — The Weight of Command

The features above make Alkaid a better *thinking tool*. But the game also needs to feel **real** — not simulation-tedious, but real in the way that makes your stomach tighten when your line breaks, real in the way that makes a flanking maneuver feel like outsmarting a living mind. The goal: every system should serve both fun AND immersion simultaneously. If a mechanic is realistic but boring, cut it. If it's fun but feels gamey, ground it.

**The Design Principle: "Amateurs talk tactics. Professionals talk logistics."**
Real ancient Chinese warfare was won and lost on supply lines, intelligence, deception, and the psychological breaking point of men — not on health bars reaching zero. Alkaid already has these systems. The trick is making them FEEL like the real thing without making them tedious.

**14. The Fog as a Living Threat** — Currently fog of war is a visibility mechanic. Make it feel like what real commanders experienced: *dread*. When you can't see beyond the treeline, the game should make you FEEL that. Subtle ambient audio shifts (distant drums? silence that's too quiet?). Occasionally, the AI sends scouts that you glimpse at the fog edge and then vanish — was that a scout or the vanguard of their main force? The player's own imagination becomes the scariest enemy. When you finally commit to advancing into fog and discover what's there, the relief (or panic) is earned. This is the Minecraft cave system effect — darkness IS the content.

**15. Messenger Realism as Drama** — The command system already has messenger delay. Lean into it as a source of tension, not frustration. When you issue a critical order (RETREAT, CHARGE), show the messenger leaving your general as a visible gold dot crossing the battlefield. If the messenger has to cross an enemy-held zone, there's a chance it's intercepted — the order never arrives. The player watches the messenger dodge between enemy squads and holds their breath. This transforms a backend delay mechanic into a *dramatic moment*. And when the order DOES arrive and the retreat executes just in time — that's a story.

If the general is dead, orders still go out but with a visible "confusion" effect — the messenger hesitates, takes a longer path, the order might arrive garbled (wrong target position by 2-3 tiles). This makes protecting your general feel urgent and real, not just "unit with a buff aura."

**16. Exhaustion as a Visible Human Cost** — Fatigue is currently a number. Make it visible: units at high fatigue move visibly slower, their formation becomes ragged (sprites spread out instead of tight), their attack animations become sluggish. At maximum fatigue, units start *refusing orders* for 5-10 ticks (they need to catch their breath). The player sees their army physically deteriorating and has to make the real commander's dilemma: push exhausted troops for one more charge, or pull back and rest while the enemy regroups?

This creates a rhythm to battles that feels real: intense combat, then exhaustion, then a forced pause, then repositioning, then the next engagement. Like real battles that had natural lulls as both sides caught their breath.

**17. The Sound of Breaking** — When a unit's morale crosses a critical threshold, play a distinctive sound: distant shouting, the clatter of dropped weapons, a horn blast. The player learns to HEAR the battle, not just see it. Experienced players will recognize "that's a rout cascade starting on the left" from audio alone, like a real commander reading the battlefield from the sounds carrying on the wind. The ear becomes a tactical instrument.

When YOUR units break, the sound is different — closer, more personal. The psychological asymmetry (enemy breaks feel triumphant, your breaks feel alarming) creates emotional investment without any gamey overlay.

**18. Intelligence and Deception — The Sun Tzu Layer** — Sun Tzu's core philosophy: "All warfare is deception." The game should let the player deceive the AI — and be deceived by it.

*Player deception:*
- **False retreat**: Order a squad to retreat, baiting the enemy to pursue into an ambush zone where your hidden archers wait. The AI should recognize obvious traps but fall for well-disguised ones (retreat must look panicked — only works with low-morale units).
- **Campfire decoy**: During night battles, order scouts to light campfires at a position, making it look like your army is camped there. The AI's scouts report the fires, and the AI diverts forces. Meanwhile your real army flanks.
- **Feigned weakness**: Pull back your strongest units, making your line look weak at a point. The AI pushes through the "gap" and walks into a pocket where you collapse both flanks. This requires the AI to actually read your line strength — which it does, via AIPerception.

*AI deception against the player:*
- The Cunning AI personality sometimes sends a visible force toward your left while its real attack comes from the right. The player must read the fog of war and decide: is this the main attack or a feint? Scouting becomes essential.
- The AI occasionally retreats units that aren't actually broken, baiting the player to overextend in pursuit. If your cavalry chases "fleeing" infantry into a forest, and suddenly halberdiers emerge from the trees — that's a lesson you remember.

This creates a meta-game: reading the AI's intentions, planting false signals, second-guessing what you see. The player starts thinking like Sun Tzu, not like a mouse-clicking gamer.

**19. The Supply Line as a Physical Object** — Currently supply is a number that ticks down. Make it spatial: your supply comes from a supply cart (already a unit type) that must maintain a connection to your deployment zone. The "supply line" is a visible dotted path on the map from the cart to the zone edge. If an enemy cavalry unit crosses that line, supply is CUT — your army stops receiving food and ammunition.

Now the player has a real logistics problem: where do you position your supply cart? Too far forward and it's vulnerable. Too far back and the line is long (more interception surface). Do you assign a guard? That's one less combat squad. The AI should specifically target supply lines (the Cunning personality already has SUPPLY_RAIDER role).

This is the Factorio-ification of warfare: supply becomes a visible flow you can see, optimize, protect, and disrupt. Players will start thinking "I need to secure the supply corridor before advancing" — that's thinking like a real general.

**20. Weather as a Character, Not a Modifier** — Weather currently applies stat modifiers. Make it feel like a force of nature that commanders had to respect. Rain doesn't just reduce ranged accuracy — it turns the grassland near the river into mud (terrain type changes dynamically), slowing all movement through that area. Snow doesn't just increase fatigue — it builds up over time, and after 100 ticks of snow, hills become impassable (too icy) and forests provide shelter (reduced fatigue). Wind doesn't just exist — it has a DIRECTION shown by subtle particle effects, and fire arrows fly further downwind but fizzle upwind.

The player who reads the weather and positions accordingly has a massive advantage. "I'll hold the high ground during the snowstorm because in 100 ticks the enemy won't be able to climb up to reach me" — that's thinking 5 minutes ahead. That's Civ-level compounding decisions within a single battle.

**21. The General's Perspective — Wartime Journal** — Between battles, instead of a menu screen, show a brief "journal entry" written in first person from your general's perspective, reflecting on the last battle and the campaign so far. Generated from BattleEventLogger data:

> *"We took the River Crossing at dawn. The halberdiers held the bridge — the Storm Bolts among them, stubborn as ever. I nearly lost them when cavalry flanked our right. The messenger barely made it through. I must find a way to deal with their horsemen before we push into the mountains. The men are tired. Rations run low. But the pass is close."*

This costs almost nothing to implement (template + data from existing systems) but transforms the campaign from a series of battles into a STORY. The player isn't managing an army — they're BEING a general. The journal creates emotional continuity that pure stats never can.

---

## G. The Synthesis: Why This All Works Together

The features above aren't a feature list — they're a coherent design philosophy:

**The Visible Battlefield** (1-5) makes the game a thinking tool. You see everything, diagnose instantly, and your intelligence is the bottleneck — not the UI.

**The Decision Density** (6-8) makes every second of battle matter. There's always something to do, something to time, something to read. Flow state is maintained because the challenge scales with your attention.

**The Compounding Campaign** (9-11) makes every run unique. Your army is YOUR army — its doctrine, its veterans, its capabilities are shaped by YOUR decisions across 20 territories. No two campaigns play the same.

**The Weight of Command** (14-21) makes it feel real. Not simulation-real, but emotionally real. The messenger you watch cross the battlefield. The exhaustion you see in your formation. The deception you planned for 3 minutes and then executed. The journal entry that makes you care about what happens next.

**The Infinite Horizon** (12-13) means it never ends. Beat the campaign? Sandbox it. Replay it. Fight your own ghost. Try all cavalry. Try no cavalry. The answer to "what if" is always one click away.

The common thread: **the player's own creativity and intelligence is the content**. The game provides the canvas, the physics, and the constraints. The player provides the genius. And the game makes that genius VISIBLE and CONSEQUENTIAL. That's why they can't stop.

---

## Implementation Priority (Revised)

**Phase A — Feel** (makes the game feel alive):
Morale Gradient Rendering (#4), Engagement Lines (#5), The Sound of Breaking (#17), Exhaustion Visibility (#16), Named Squads (#10)

**Phase B — Think** (makes the game a thinking tool):
Battlefield Flow Visualization (#1), Timing Windows (#6), Reserve Commitment Dilemma (#7), Supply Line as Physical Object (#19), Weather as Character (#20)

**Phase C — Outsmart** (makes the player feel like Sun Tzu):
Intelligence & Deception (#18), Messenger Drama (#15), Fog as Living Threat (#14), Terrain Interaction Orders (#8), Causal Chain Replay (#2)

**Phase D — Own** (makes each run YOUR story):
Army Identity System (#9), Strategic Ripple Effects (#11), General's Journal (#21), Decision Impact Markers (#3)

**Phase E — Forever** (makes them come back):
Battle Sandbox (#12), Ghost Armies (#13)
