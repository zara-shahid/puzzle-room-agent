import time
from backend.reflection_agent import ReflectionLoopAgent
from backend.schemas import DifficultyLevel

def test_stuck_signal_and_adaptive_hints():
    agent = ReflectionLoopAgent(target_solve_time_sec=45.0, max_allowed_failures=2)
    sample_base_hint = "Focus on the primary organelle responsible for ATP production."

    print("--- Test Case 1: Group Not Stuck (1 Wrong Attempt, 10s Elapsed) ---")
    res1 = agent.check_stuck_signal(failed_attempts=1, elapsed_seconds=10.0, base_hint=sample_base_hint)
    print(f"Stuck Check 1: IsStuck={res1.is_stuck}")
    assert res1.is_stuck is False

    print("\n--- Test Case 2: Stuck Signal via Failed Attempts (2 Wrong Attempts) ---")
    res2 = agent.check_stuck_signal(failed_attempts=2, elapsed_seconds=15.0, base_hint=sample_base_hint, hint_level=0)
    print(f"Stuck Check 2: IsStuck={res2.is_stuck}, Reason='{res2.stuck_signal_reason}'")
    print(f"Subtle Hint: {res2.subtle_hint}")
    assert res2.is_stuck is True
    assert "2 consecutive incorrect attempts" in res2.stuck_signal_reason
    assert sample_base_hint in res2.subtle_hint

    print("\n--- Test Case 3: Stuck Signal via Time Threshold (50s Elapsed > 45s Target) ---")
    res3 = agent.check_stuck_signal(failed_attempts=0, elapsed_seconds=50.0, base_hint=sample_base_hint, hint_level=1)
    print(f"Stuck Check 3: IsStuck={res3.is_stuck}, Reason='{res3.stuck_signal_reason}'")
    print(f"Subtle Hint: {res3.subtle_hint}")
    assert res3.is_stuck is True
    assert "Group idle/stalled" in res3.stuck_signal_reason

    print("\n[SUCCESS] Day 8 Stuck Signal & Adaptive Subtle Hint Test PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_stuck_signal_and_adaptive_hints()
