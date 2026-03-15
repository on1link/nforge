# ============================================================
# Neural Forge — tests/test_sm2.py
# Run: uv run pytest tests/ -v
# ============================================================

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import date, timedelta
import pytest
from sm2.engine import SRCard, review_card, initial_schedule


def make_card(node_id="pytorch", ef=2.5, interval=1, reps=0) -> SRCard:
    return SRCard(
        id="test-card",
        user_id="default",
        node_id=node_id,
        path_id="mle",
        ease_factor=ef,
        interval=interval,
        repetitions=reps,
        due_date=date.today(),
    )


# ── Quality constraints ───────────────────────────────────────────────────────
def test_invalid_quality_raises():
    card = make_card()
    with pytest.raises(ValueError):
        review_card(card, 6)
    with pytest.raises(ValueError):
        review_card(card, -1)


# ── Failed recall resets ──────────────────────────────────────────────────────
@pytest.mark.parametrize("quality", [0, 1, 2])
def test_failed_recall_resets_interval(quality):
    card = make_card(interval=30, reps=10)
    result = review_card(card, quality)
    assert result.new_interval == 1
    assert result.again is True
    assert card.repetitions == 0
    assert card.due_date == date.today()


# ── Successful recall advances ────────────────────────────────────────────────
@pytest.mark.parametrize("quality", [3, 4, 5])
def test_successful_recall_advances(quality):
    card = make_card(interval=1, reps=0)
    result = review_card(card, quality)
    assert result.again is False
    assert result.new_interval >= 1
    assert card.due_date > date.today()


def test_first_review_interval_is_1():
    card = make_card(reps=0)
    result = review_card(card, 4)
    # After first successful review, interval should be 1
    assert result.new_interval == 1


def test_second_review_interval_is_6():
    card = make_card(reps=1, interval=1)
    result = review_card(card, 4)
    assert result.new_interval == 6


def test_third_review_uses_ef():
    card = make_card(ef=2.5, interval=6, reps=2)
    result = review_card(card, 4)
    # Expected: round(6 * 2.5) = 15, with ±10% fuzz → 13-17
    assert 12 <= result.new_interval <= 18


# ── EF updates ───────────────────────────────────────────────────────────────
def test_perfect_recall_increases_ef():
    card = make_card(ef=2.5)
    result = review_card(card, 5)
    assert result.new_ef > 2.5


def test_hard_recall_decreases_ef():
    card = make_card(ef=2.5)
    result = review_card(card, 3)
    assert result.new_ef < 2.5


def test_ef_never_below_1_3():
    card = make_card(ef=1.3)
    for _ in range(10):
        result = review_card(card, 0)
    assert card.ease_factor >= 1.3


def test_ef_capped_at_3():
    card = make_card(ef=2.9)
    result = review_card(card, 5)
    assert card.ease_factor <= 3.0


# ── initial_schedule ──────────────────────────────────────────────────────────
def test_initial_schedule():
    card = make_card()
    initial_schedule(card)
    assert card.ease_factor == 2.5
    assert card.interval == 1
    assert card.repetitions == 0
    assert card.due_date == date.today() + timedelta(days=1)


# ── Regression: fuzz doesn't produce 0-day interval ─────────────────────────
def test_fuzz_never_produces_zero_interval():
    for _ in range(50):  # Statistical test
        card = make_card(ef=1.3, interval=1, reps=2)
        result = review_card(card, 4)
        assert result.new_interval >= 1


# ── Review result fields ──────────────────────────────────────────────────────
def test_review_result_has_all_fields():
    card = make_card()
    result = review_card(card, 4)
    assert result.card_id == "test-card"
    assert result.quality == 4
    assert isinstance(result.prev_ef, float)
    assert isinstance(result.new_ef, float)
    assert isinstance(result.new_interval, int)
    assert isinstance(result.due_date, date)
    assert isinstance(result.again, bool)
