import time
from backend.reflection_agent import ReflectionLoopAgent
from backend.schemas import DifficultyLevel

def test_reflection_loop_critique():
    agent = ReflectionLoopAgent(target_solve_time_sec=60.0, max_allowed_failures=3)

    print("--- Test Case 1: Group Struggling (3 Failed Attempts & 100s Solve Time) ---")
    c1 = agent.critique_group_performance(
        current_difficulty=DifficultyLevel.MEDIUM,
        solve_time_seconds=100.0,
        failed_attempts=3
    )
    print(f"Critique Output 1:\n  Recommended: {c1.recommended_difficulty.value.upper()}\n  Reasoning: {c1.reasoning}")
    assert c1.recommended_difficulty == DifficultyLevel.EASY

    print("\n--- Test Case 2: Group Speeding Through (0 Failed Attempts & 15s Solve Time) ---")
    c2 = agent.critique_group_performance(
        current_difficulty=DifficultyLevel.MEDIUM,
        solve_time_seconds=15.0,
        failed_attempts=0
    )
    print(f"Critique Output 2:\n  Recommended: {c2.recommended_difficulty.value.upper()}\n  Reasoning: {c2.reasoning}")
    assert c2.recommended_difficulty == DifficultyLevel.HARD

    print("\n--- Test Case 3: Group in Optimal Flow State (1 Failed Attempt & 45s Solve Time) ---")
    c3 = agent.critique_group_performance(
        current_difficulty=DifficultyLevel.MEDIUM,
        solve_time_seconds=45.0,
        failed_attempts=1
    )
    print(f"Critique Output 3:\n  Recommended: {c3.recommended_difficulty.value.upper()}\n  Reasoning: {c3.reasoning}")
    assert c3.recommended_difficulty == DifficultyLevel.MEDIUM

    print("\n[SUCCESS] Day 7 Reflection Loop & Explainable Adaptive Difficulty Test PASSED!")

if __name__ == "__main__":
    test_reflection_loop_critique()
