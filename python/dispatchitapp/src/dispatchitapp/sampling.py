"""Client-side error sampling. Mirrors Reporter#sampled_out?."""

from __future__ import annotations

import random
from typing import Callable


def sampled_out(rate: float, rng: Callable[[], float] = random.random) -> bool:
    if rate >= 1:
        return False
    if rate <= 0:
        return True
    return rng() > rate
