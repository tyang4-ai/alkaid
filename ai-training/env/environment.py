"""WeatherSystem + TimeOfDaySystem — port of environment systems."""
from __future__ import annotations

from shared.load_constants import weather_cfg, time_of_day_cfg
from env.types import EnvironmentState, WeatherType, TimeOfDay
from env.random import SeededRandom

_wc = weather_cfg()
_tod = time_of_day_cfg()

_WEATHER_SHIFT_INTERVAL = _wc["WEATHER_SHIFT_INTERVAL_TICKS"]
_WEATHER_SHIFT_CHANCE = _wc["WEATHER_SHIFT_CHANCE"]
_WEATHER_PROBS: list[float] = _wc["WEATHER_PROBABILITIES"]
_TIME_PHASE_DURATION = _tod["TIME_PHASE_DURATION_TICKS"]


class WeatherSystem:
    """Random weather shifts at intervals."""

    def __init__(self, rng: SeededRandom) -> None:
        self._rng = rng

    def tick(self, env: EnvironmentState) -> None:
        if env.current_tick % _WEATHER_SHIFT_INTERVAL != 0:
            return
        if env.current_tick == 0:
            return

        if self._rng.next() < _WEATHER_SHIFT_CHANCE:
            env.weather = self._pick_weather()

    def _pick_weather(self) -> int:
        r = self._rng.next()
        cumulative = 0.0
        for i, prob in enumerate(_WEATHER_PROBS):
            cumulative += prob
            if r < cumulative:
                return i
        return WeatherType.CLEAR


class TimeOfDaySystem:
    """Time of day advances every TIME_PHASE_DURATION_TICKS."""

    def tick(self, env: EnvironmentState) -> None:
        if _TIME_PHASE_DURATION <= 0:
            return
        phase_index = env.current_tick // _TIME_PHASE_DURATION
        # Cycle through 6 time phases, offset by battle start time
        env.time_of_day = (env.battle_start_time + phase_index) % 6
