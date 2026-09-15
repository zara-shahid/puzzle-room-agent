import time
from typing import Dict, List, Tuple
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

class ReflectionLoopAgent:
    """
    Day 7 Core Innovation Feature: Explainable Reflection Loop.
    Watches group performance metrics (time-to-solve, failed attempts) and evaluates whether
    the next puzzle in the escape room chain should be easier, remain the same, or become harder.
    """
    def __init__(self, target_solve_time_sec: float = 60.0, max_allowed_failures: int = 3):
        self.target_solve_time_sec = target_solve_time_sec
        self.max_allowed_failures = max_allowed_failures

    def critique_group_performance(
        self,
        current_difficulty: DifficultyLevel,
        solve_time_seconds: float,
        failed_attempts: int
    ) -> DifficultyCritique:
        """
        Deterministic, explainable rule engine that critiques group performance.
        Defendable logic for demo:
        - If failed_attempts >= 3 OR solve_time > 90s => Group is struggling -> Decrease Difficulty
        - If failed_attempts == 0 AND solve_time < 30s => Group is speeding through -> Increase Difficulty
        - Otherwise => Group is in optimal flow state -> Maintain Difficulty
        """
        if failed_attempts >= self.max_allowed_failures or solve_time_seconds > (self.target_solve_time_sec * 1.5):
            # Downgrade difficulty
            new_diff = DifficultyLevel.EASY if current_difficulty == DifficultyLevel.MEDIUM else (
                DifficultyLevel.MEDIUM if current_difficulty == DifficultyLevel.HARD else DifficultyLevel.EASY
            )
            reason = (
                f"Group struggled with {failed_attempts} failed attempts and {solve_time_seconds:.1f}s solve time "
                f"(exceeding target {self.target_solve_time_sec}s). Lowering difficulty to {new_diff.value.upper()}."
            )
        elif failed_attempts == 0 and solve_time_seconds < (self.target_solve_time_sec * 0.5):
            # Upgrade difficulty
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
