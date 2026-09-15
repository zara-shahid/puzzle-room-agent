import json
from backend.generator import PuzzleGenerator
from backend.schemas import DifficultyLevel

def test_puzzle_generation():
    generator = PuzzleGenerator()
    test_topic = "Quantum Computing"
    
    print(f"--- Generating Puzzle Chain for Topic: '{test_topic}' ---")
    chain = generator.generate_puzzle_chain(topic=test_topic, difficulty=DifficultyLevel.MEDIUM)

    assert chain.topic == test_topic
    assert len(chain.puzzles) == 4
    
    types_present = [p.puzzle_type.value for p in chain.puzzles]
    print(f"Generated Puzzle Types: {types_present}")
    
    assert "riddle" in types_present
    assert "code-lock" in types_present
    assert "logic-grid" in types_present
    assert "hidden-clue" in types_present

    print("\n--- Validating Pydantic Schema Output ---")
    serialized = chain.model_dump_json(indent=2)
    print(serialized)
    print("\n[SUCCESS] Day 3 Structured Puzzle Generator Test PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_puzzle_generation()
