# ============================================================
# Neural Forge — sm2/engine.py
# SuperMemo 2 (SM-2) spaced repetition engine.
# Pure Python — no external SM-2 dependency needed.
# ============================================================
# SM-2 Algorithm:
#   Given a review with quality q ∈ {0..5}:
#   - q < 3  → reset (interval=1, same day review)
#   - q >= 3 → advance:
#       EF' = EF + (0.1 - (5-q)(0.08 + (5-q)*0.02))
#       interval: 1 → 6 → EF'*prev_interval
#   EF clamped to [1.3, 2.5+] 
# ============================================================

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Optional


@dataclass
class SRCard:
    id:           str
    user_id:      str
    node_id:      str
    path_id:      str
    ease_factor:  float   = 2.5
    interval:     int     = 1     # days until next review
    repetitions:  int     = 0
    due_date:     date    = field(default_factory=date.today)


@dataclass
class ReviewResult:
    card_id:       str
    quality:       int       # 0-5
    prev_ef:       float
    new_ef:        float
    prev_interval: int
    new_interval:  int
    due_date:      date
    again:         bool      # True if quality < 3 (review again today)


def review_card(card: SRCard, quality: int) -> ReviewResult:
    """
    Apply SM-2 algorithm for a single review.
    quality: 0=blackout, 1=wrong, 2=wrong+hint, 3=hard, 4=good, 5=easy
    """
    if not 0 <= quality <= 5:
        raise ValueError(f"quality must be 0-5, got {quality}")

    prev_ef       = card.ease_factor
    prev_interval = card.interval

    if quality < 3:
        # Failed recall — reset
        new_ef       = max(1.3, prev_ef - 0.2)
        new_interval = 1
        new_reps     = 0
        due          = date.today()    # review again today
        again        = True
    else:
        # Successful recall — advance
        new_ef = prev_ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_ef = max(1.3, min(new_ef, 3.0))   # clamp

        new_reps = card.repetitions + 1

        if new_reps == 1:
            new_interval = 1
        elif new_reps == 2:
            new_interval = 6
        else:
            new_interval = round(prev_interval * prev_ef)

        # Fuzz ±10% to avoid review clustering
        import random
        fuzz = random.uniform(0.9, 1.1)
        new_interval = max(1, round(new_interval * fuzz))
        due          = date.today() + timedelta(days=new_interval)
        again        = False

    # Mutate card in place
    card.ease_factor  = new_ef
    card.interval     = new_interval
    card.repetitions  = new_reps if quality >= 3 else 0
    card.due_date     = due

    return ReviewResult(
        card_id        = card.id,
        quality        = quality,
        prev_ef        = prev_ef,
        new_ef         = new_ef,
        prev_interval  = prev_interval,
        new_interval   = new_interval,
        due_date       = due,
        again          = again,
    )


def initial_schedule(card: SRCard) -> SRCard:
    """Set fresh card to first review tomorrow."""
    card.ease_factor  = 2.5
    card.interval     = 1
    card.repetitions  = 0
    card.due_date     = date.today() + timedelta(days=1)
    return card
