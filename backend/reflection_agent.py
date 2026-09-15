import time
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel
from backend.schemas import DifficultyLevel

class GroupPerformanceMetrics(BaseModel):
    puzzle_id: str
    start_time: float
    solve_time_seconds: Optional[float] = None
    failed_attempts: int = 0
    hints_used: int = 0

class DifficultyCritique(BaseModel):
    current_difficulty: DifficultyLevel
    recommended_difficulty: DifficultyLevel
    reasoning: str
    time_to_solve: float
    failed_attempts: int

class HintTriggerResult(BaseModel):
    is_stuck: bool
    stuck_signal_reason: Optional[str] = None
    subtle_hint: Optional[str] = None

class ReflectionLoopAgent:
    """
    Day 7 & Day 8 Core Innovation Feature: Explainable Reflection Loop.
    1. Watches group performance metrics and critiques adaptive difficulty.
    2. Detects 'Stuck' signals (Failed attempts >= 2 OR Elapsed time > 45s) and issues progressive, subtle hints without spoiling answers.
    """
    def __init__(self, target_solve_time_sec: float = 45.0, max_allowed_failures: int = 2):
        self.target_solve_time_sec = target_solve_time_sec
        self.max_allowed_failures = max_allowed_failures

    def check_stuck_signal(
        self,
        failed_attempts: int,
        elapsed_seconds: float,
        base_hint: str,
        hint_level: int = 0
    ) -> HintTriggerResult:
        """
        Day 8 Stuck Signal Criteria:
        - Signal 1: Repeated incorrect submissions (failed_attempts >= 2)
        - Signal 2: Time stall threshold (elapsed_seconds >= target_solve_time_sec)

        Generates a non-spoiler, progressive subtle hint.
        """
        is_stuck = False
        reason = None

        if failed_attempts >= self.max_allowed_failures:
            is_stuck = True
            reason = f"Stuck Signal Detected: {failed_attempts} consecutive incorrect attempts."
        elif elapsed_seconds >= self.target_solve_time_sec:
            is_stuck = True
            reason = f"Stuck Signal Detected: Group idle/stalled for {elapsed_seconds:.1f}s without unlocking."

        if not is_stuck:
            return HintTriggerResult(is_stuck=False)

        # Progressive, non-spoiler hint synthesis based on base hint
        if hint_level == 0:
            subtle = f"[HINT NUDGE] Reflection Agent Nudge: {base_hint}"
        elif hint_level == 1:
            subtle = f"[HINT NUDGE] Deeper Guidance: Pay special attention to exact terms in your ingested study notes."
        else:
            subtle = f"[HINT NUDGE] Focused Hint: Break down the problem statement step-by-step. Think about key definitions."

        return HintTriggerResult(
            is_stuck=True,
            stuck_signal_reason=reason,
            subtle_hint=subtle
        )

    def critique_group_performance(
        self,
        current_difficulty: DifficultyLevel,
        solve_time_seconds: float,
        failed_attempts: int
    ) -> DifficultyCritique:
        """
        Deterministic, explainable rule engine that critiques group performance.
        """
        if failed_attempts >= self.max_allowed_failures or solve_time_seconds > (self.target_solve_time_sec * 1.5):
            new_diff = DifficultyLevel.EASY if current_difficulty == DifficultyLevel.MEDIUM else (
                DifficultyLevel.MEDIUM if current_difficulty == DifficultyLevel.HARD else DifficultyLevel.EASY
            )
            reason = (
                f"Group struggled with {failed_attempts} failed attempts and {solve_time_seconds:.1f}s solve time "
                f"(exceeding target {self.target_solve_time_sec}s). Lowering difficulty to {new_diff.value.upper()}."
            )
        elif failed_attempts == 0 and solve_time_seconds < (self.target_solve_time_sec * 0.5):
            new_diff = DifficultyLevel.HARD if current_difficulty == DifficultyLevel.MEDIUM else (
                DifficultyLevel.MEDIUM if current_difficulty == DifficultyLevel.EASY else DifficultyLevel.HARD
            )
            reason = (
                f"Group mastered the puzzle cleanly in {solve_time_seconds:.1f}s with 0 failed attempts! "
                f"Escalating challenge level to {new_diff.value.upper()}."
            )
        else:
            new_diff = current_difficulty
            reason = (
                f"Group solved puzzle in {solve_time_seconds:.1f}s with {failed_attempts} wrong attempts. "
                f"Performance matches optimal flow state. Maintaining difficulty at {current_difficulty.value.upper()}."
            )

        return DifficultyCritique(
            current_difficulty=current_difficulty,
            recommended_difficulty=new_diff,
            reasoning=reason,
            time_to_solve=round(solve_time_seconds, 2),
            failed_attempts=failed_attempts
        )
