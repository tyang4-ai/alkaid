"""Mulberry32 PRNG — bit-for-bit port of src/utils/Random.ts.

Uses explicit & 0xFFFFFFFF masking to match JS 32-bit integer behavior.
Python's arbitrary-precision ints require this to produce identical sequences.
"""
from __future__ import annotations


def _imul(a: int, b: int) -> int:
    """Emulate Math.imul: 32-bit integer multiply, return signed 32-bit result."""
    # Mask to 32 bits unsigned, multiply, then convert to signed 32-bit
    a &= 0xFFFFFFFF
    b &= 0xFFFFFFFF
    result = (a * b) & 0xFFFFFFFF
    # Convert to signed 32-bit
    if result >= 0x80000000:
        result -= 0x100000000
    return result


def _to_signed32(n: int) -> int:
    """Convert to signed 32-bit integer."""
    n &= 0xFFFFFFFF
    if n >= 0x80000000:
        n -= 0x100000000
    return n


class SeededRandom:
    """Mulberry32 PRNG — exact port of TS SeededRandom."""

    def __init__(self, seed: int) -> None:
        self._state = _to_signed32(seed)

    def next(self) -> float:
        """Returns float in [0, 1) — matches TS SeededRandom.next()."""
        self._state = _to_signed32(self._state)
        self._state = _to_signed32(self._state + 0x6D2B79F5)
        t = _imul(self._state ^ ((self._state & 0xFFFFFFFF) >> 15), 1 | self._state)
        t = _to_signed32(t + _imul(t ^ ((t & 0xFFFFFFFF) >> 7), 61 | t)) ^ t
        return (((t ^ ((t & 0xFFFFFFFF) >> 14)) & 0xFFFFFFFF) >> 0) / 4294967296

    def next_int(self, min_val: int, max_val: int) -> int:
        """Returns integer in [min_val, max_val] inclusive."""
        return min_val + int(self.next() * (max_val - min_val + 1))

    def next_float(self, min_val: float, max_val: float) -> float:
        """Returns float in [min_val, max_val)."""
        return min_val + self.next() * (max_val - min_val)

    def get_state(self) -> int:
        return self._state

    def set_state(self, s: int) -> None:
        self._state = _to_signed32(s)
