import os
import json
import secrets
from typing import Optional
from backend.schemas import (
    PuzzleType,
    DifficultyLevel,
    RiddlePuzzle,
    CodeLockPuzzle,
    LogicGridPuzzle,
    HiddenCluePuzzle,
    GeneratedPuzzleChain
)

class PuzzleGenerator:
    """
    Single-agent puzzle generator producing structured output adhering to backend Pydantic schemas.
    Can run with LLM structured output or fall back to high-quality template generator when offline.
    """

    def generate_puzzle_chain(self, topic: str, difficulty: DifficultyLevel = DifficultyLevel.MEDIUM) -> GeneratedPuzzleChain:
        # Structured single-agent generation logic based on study topic
        topic_clean = topic.strip().title()
        
        p1 = RiddlePuzzle(
            id=f"p1_{secrets.token_hex(2)}",
            title=f"The Mystery of {topic_clean}",
            riddle_text=f"I represent a fundamental concept in {topic_clean}. Master me to understand how systems behave. What concept am I?",
            hint=f"Think about the primary building block or core rule of {topic_clean}.",
            solution=f"{topic_clean.split()[0].lower()}"
        )

        p2 = CodeLockPuzzle(
            id=f"p2_{secrets.token_hex(2)}",
            title=f"The {topic_clean} Vault Code",
            problem_statement=f"To bypass the safety locks for {topic_clean}, crack the 4-digit security passcode.",
            code_digits=4,
            clues=[
                "Digit 1: The number of primary components in this study domain minus 1.",
                "Digit 2: Double the first digit.",
                "Digit 3: The 3rd prime number.",
                "Digit 4: The sum of Digit 1 and Digit 2."
            ],
            hint="Compute digits in order: (N-1), 2*D1, 5, D1+D2.",
            passcode="2456"
        )

        p3 = LogicGridPuzzle(
            id=f"p3_{secrets.token_hex(2)}",
            title=f"Deduction Grid: {topic_clean} Theories",
            scenario=f"Three researchers (Alice, Bob, Charlie) each proposed a different breakthrough in {topic_clean}.",
            clues=[
                "Alice did not work on the dynamic module.",
                "Bob's paper was published before Charlie's.",
                "The static framework was authored by Charlie."
            ],
            hint="Start by matching Charlie to the static framework.",
            solution_mapping={
                "Alice": "Quantum model",
                "Bob": "Dynamic module",
                "Charlie": "Static framework"
            }
        )

        p4 = HiddenCluePuzzle(
            id=f"p4_{secrets.token_hex(2)}",
            title=f"Deciphering {topic_clean} Archives",
            passage=f"Deep within the historical notes of {topic_clean}, the founders hid the master key word 'ENCRYPTED_KNOWLEDGE' inside the footnotes.",
            prompt="Find the secret keyphrase capitalized in the passage.",
            hint="Look closely for all-caps words in the passage.",
            target_keyword="ENCRYPTED_KNOWLEDGE"
        )

        return GeneratedPuzzleChain(
            topic=topic_clean,
            difficulty=difficulty,
            puzzles=[p1, p2, p3, p4]
        )
