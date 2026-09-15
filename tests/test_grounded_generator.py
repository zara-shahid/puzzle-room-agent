from backend.rag import StudyMaterialRAG
from backend.grounded_generator import GroundedPuzzleGenerator
from backend.schemas import DifficultyLevel, RiddlePuzzle

def test_grounded_puzzle_generation():
    rag = StudyMaterialRAG()
    generator = GroundedPuzzleGenerator(rag=rag)

    sample_text = """
    Photosynthesis is the biological process used by plants to convert light energy into chemical energy.
    It takes place primarily inside chloroplasts using chlorophyll pigments.
    The primary reaction converts carbon dioxide and water into glucose and oxygen gas.
    """

    print("--- Testing Grounded Puzzle Generation from Study Material ---")
    chain = generator.generate_grounded_chain(
        topic="Photosynthesis",
        study_text=sample_text,
        difficulty=DifficultyLevel.MEDIUM
    )

    assert chain.topic == "Photosynthesis"
    assert len(chain.puzzles) == 4

    print("\n--- Testing Automated Answerability Guardrail Check ---")
    # Test valid puzzle validation
    valid_riddle = chain.puzzles[0]
    is_valid, reason = generator.validate_puzzle_answerability(valid_riddle, [sample_text])
    print(f"Validation Result for Grounded Riddle: Valid={is_valid}, Reason='{reason}'")
    assert is_valid is True

    # Test invalid puzzle validation (guardrail trigger)
    invalid_riddle = RiddlePuzzle(
        id="invalid_1",
        title="Unrelated Question",
        riddle_text="What is the capital of Mars?",
        hint="No hint",
        solution="Olympus"
    )
    is_valid_inv, reason_inv = generator.validate_puzzle_answerability(invalid_riddle, [sample_text])
    print(f"Validation Result for Unanswerable Riddle: Valid={is_valid_inv}, Reason='{reason_inv}'")
    assert is_valid_inv is False

    print("\n[SUCCESS] Day 5 Grounded Puzzle Generator & Guardrail Test PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_grounded_puzzle_generation()
