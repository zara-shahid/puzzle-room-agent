import pytest
from backend.schemas import (
    PuzzleType,
    DifficultyLevel,
    RiddlePuzzle,
    CodeLockPuzzle,
    LogicGridPuzzle,
    HiddenCluePuzzle,
    GeneratedPuzzleChain
)
from backend.generator import PuzzleGenerator
from backend.grounded_generator import GroundedPuzzleGenerator
from backend.reflection_agent import ReflectionLoopAgent
from backend.rag import StudyMaterialRAG

@pytest.fixture
def rag_instance():
    return StudyMaterialRAG()

@pytest.fixture
def grounded_gen(rag_instance):
    return GroundedPuzzleGenerator(rag=rag_instance)

@pytest.fixture
def reflection_agent():
    return ReflectionLoopAgent(target_solve_time_sec=45.0, max_allowed_failures=2)

# --- 1. Puzzle Generation Test Cases ---
def test_unbounded_puzzle_generator():
    gen = PuzzleGenerator()
    chain = gen.generate_puzzle_chain(topic="Machine Learning", difficulty=DifficultyLevel.HARD)
    
    assert isinstance(chain, GeneratedPuzzleChain)
    assert chain.topic == "Machine Learning"
    assert chain.difficulty == DifficultyLevel.HARD
    assert len(chain.puzzles) == 4

    puzzle_types = {p.puzzle_type for p in chain.puzzles}
    assert PuzzleType.RIDDLE in puzzle_types
    assert PuzzleType.CODE_LOCK in puzzle_types
    assert PuzzleType.LOGIC_GRID in puzzle_types
    assert PuzzleType.HIDDEN_CLUE in puzzle_types

def test_grounded_puzzle_generation(grounded_gen):
    sample_text = """
    Mitochondria are membrane-bound cell organelles that generate most of the chemical energy needed to power the cell's biochemical reactions.
    Chemical energy produced by the mitochondria is stored in a small molecule called adenosine triphosphate (ATP).
    """
    chain = grounded_gen.generate_grounded_chain(
        topic="Cellular Biology",
        study_text=sample_text,
        difficulty=DifficultyLevel.MEDIUM
    )

    assert chain.topic == "Cellular Biology"
    assert len(chain.puzzles) == 4
    for p in chain.puzzles:
        assert p.id is not None
        assert len(p.title) > 0

# --- 2. Answerability Guardrail Test Cases ---
def test_answerability_guardrail_pass(grounded_gen):
    sample_text = "Photosynthesis occurs inside chloroplasts using chlorophyll pigments."
    riddle = RiddlePuzzle(
        id="p1",
        title="Grounded Riddle",
        riddle_text="Where does photosynthesis occur?",
        hint="Organelle name",
        solution="chloroplasts"
    )
    is_valid, reason = grounded_gen.validate_puzzle_answerability(riddle, [sample_text])
    assert is_valid is True
    assert "Grounded" in reason or "grounded" in reason

def test_answerability_guardrail_reject(grounded_gen):
    sample_text = "Photosynthesis occurs inside chloroplasts using chlorophyll pigments."
    unrelated_riddle = RiddlePuzzle(
        id="p2",
        title="Ungrounded Riddle",
        riddle_text="What is the speed of light in vacuum?",
        hint="Physics constant",
        solution="299792458"
    )
    is_valid, reason = grounded_gen.validate_puzzle_answerability(unrelated_riddle, [sample_text])
    assert is_valid is False
    assert "not found" in reason.lower()

# --- 3. Difficulty-Adjustment & Reflection Logic Test Cases ---
def test_difficulty_downgrade_on_high_failures(reflection_agent):
    critique = reflection_agent.critique_group_performance(
        current_difficulty=DifficultyLevel.MEDIUM,
        solve_time_seconds=30.0,
        failed_attempts=3
    )
    assert critique.recommended_difficulty == DifficultyLevel.EASY
    assert "struggled" in critique.reasoning.lower() or "lowering" in critique.reasoning.lower()

def test_difficulty_upgrade_on_fast_solve(reflection_agent):
    critique = reflection_agent.critique_group_performance(
        current_difficulty=DifficultyLevel.MEDIUM,
        solve_time_seconds=10.0,
        failed_attempts=0
    )
    assert critique.recommended_difficulty == DifficultyLevel.HARD
    assert "mastered" in critique.reasoning.lower() or "escalating" in critique.reasoning.lower()

def test_difficulty_maintain_flow_state(reflection_agent):
    critique = reflection_agent.critique_group_performance(
        current_difficulty=DifficultyLevel.MEDIUM,
        solve_time_seconds=35.0,
        failed_attempts=1
    )
    assert critique.recommended_difficulty == DifficultyLevel.MEDIUM
    assert "flow state" in critique.reasoning.lower() or "maintaining" in critique.reasoning.lower()

def test_stuck_signal_trigger(reflection_agent):
    res_failed = reflection_agent.check_stuck_signal(failed_attempts=2, elapsed_seconds=10.0, base_hint="Test hint")
    assert res_failed.is_stuck is True
    assert "incorrect attempts" in res_failed.stuck_signal_reason.lower()

    res_time = reflection_agent.check_stuck_signal(failed_attempts=0, elapsed_seconds=50.0, base_hint="Test hint")
    assert res_time.is_stuck is True
    assert "idle/stalled" in res_time.stuck_signal_reason.lower()
