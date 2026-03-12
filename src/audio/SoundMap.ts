// Alkaid (破军) — Sound ID to AudioPlaceholders method map
// Maps string sound IDs used in EventBus handlers to procedural generator methods.

/** One-shot sounds (fire and forget). Method names correspond to AudioPlaceholders methods. */
export type OneShotSoundMethod = 'swordClash' | 'arrowVolley' | 'cavalryCharge'
  | 'hornSignal' | 'drumBeat' | 'uiClick';

/** Looping/ambient sounds that return a stop handle. */
export type LoopingSoundMethod = 'rain' | 'wind' | 'battleDrums' | 'battleMusic';

/** All sound methods on AudioPlaceholders. */
export type SoundMethod = OneShotSoundMethod | LoopingSoundMethod;

export const ONE_SHOT_SOUNDS: Record<string, OneShotSoundMethod> = {
  'sword_clash': 'swordClash',
  'arrow_volley': 'arrowVolley',
  'cavalry_charge': 'cavalryCharge',
  'horn_signal': 'hornSignal',
  'order_horn': 'hornSignal',
  'rout_horn': 'drumBeat',
  'drum_beat': 'drumBeat',
  'ui_click': 'uiClick',
};

export const LOOPING_SOUNDS: Record<string, LoopingSoundMethod> = {
  'battle_theme': 'battleMusic',
  'rain': 'rain',
  'wind': 'wind',
};

/**
 * Check whether a sound ID is a looping sound.
 */
export function isLoopingSound(soundId: string): boolean {
  return soundId in LOOPING_SOUNDS;
}

/**
 * Get the method name for a one-shot sound.
 */
export function getOneShotMethod(soundId: string): OneShotSoundMethod | null {
  return ONE_SHOT_SOUNDS[soundId] ?? null;
}

/**
 * Get the method name for a looping sound.
 */
export function getLoopingMethod(soundId: string): LoopingSoundMethod | null {
  return LOOPING_SOUNDS[soundId] ?? null;
}
