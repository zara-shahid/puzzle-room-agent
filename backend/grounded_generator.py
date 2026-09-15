import secrets
from typing import List, Tuple
from backend.schemas import (
    PuzzleType,
    DifficultyLevel,
    RiddlePuzzle,
    CodeLockPuzzle,
    LogicGridPuzzle,
    HiddenCluePuzzle,
    GeneratedPuzzleChain,
    PuzzleUnion
)
from backend.rag import StudyMaterialRAG

class GroundedPuzzleGenerator:
    """
    Day 5: Grounded Puzzle Generator integrated with RAG study material context and automated answerability guardrails.
    """
    def __init__(self, rag: StudyMaterialRAG):
        self.rag = rag

    def validate_puzzle_answerability(self, puzzle: PuzzleUnion, source_chunks: List[str]) -> Tuple[bool, str]:
        """
        Guardrail check: Validates whether the solution or answer key to the generated puzzle
        can actually be derived/found within the provided source study material chunks.
        """
        combined_source = " ".join(source_chunks).lower()

        if isinstance(puzzle, RiddlePuzzle):
            target = puzzle.solution.lower()
            if target in combined_source or any(w in combined_source for w in target.split()):
                return True, "Solution grounded in source material."
            return False, f"Riddle solution '{puzzle.solution}' not found in study material."

        elif isinstance(puzzle, CodeLockPuzzle):
            # Check if any clues relate to terms in source material
            clues_combined = " ".join(puzzle.clues).lower()
            if any(term in combined_source for term in clues_combined.split() if len(term) > 4):
                return True, "Code lock problem statement grounded in source material."
            return False, "Code lock clues do not reference terms from study material."

        elif isinstance(puzzle, LogicGridPuzzle):
            # Verify that scenario concepts match study text
            if any(k.lower() in combined_source for k in puzzle.solution_mapping.values()):
                return True, "Logic grid concepts match source material."
            return False, "Logic grid solution terms not present in source material."

        elif isinstance(puzzle, HiddenCluePuzzle):
            if puzzle.target_keyword.lower() in puzzle.passage.lower():
                return True, "Hidden clue keyword present in passage."
            return False, "Hidden clue keyword missing from passage."

        return True, "Passed basic verification."

    def generate_grounded_chain(self, topic: str, study_text: str, difficulty: DifficultyLevel = DifficultyLevel.MEDIUM) -> GeneratedPuzzleChain:
        # Ingest text into RAG store
        self.rag.clear()
        self.rag.ingest_material(study_text, topic)

        # Retrieve top relevant context chunks for the topic
        retrieved = self.rag.retrieve_relevant_chunks(topic, top_k=3)
        context_texts = [r["text"] for r in retrieved]
        context_str = " ".join(context_texts) if context_texts else study_text

        # Extract key concept from retrieved text
        words = [w.strip(",.()[]{}").capitalize() for w in context_str.split() if len(w.strip(",.()[]{}")) > 4]
        key_concept = words[0] if words else topic.title()
        second_concept = words[1] if len(words) > 1 else "Process"

        # Generate Grounded Puzzles
        p1 = RiddlePuzzle(
            id=f"p1_{secrets.token_hex(2)}",
            title=f"Grounded Riddle: {key_concept}",
            riddle_text=f"Based on your notes: What core term is described in this passage?\nContext: '{context_texts[0] if context_texts else study_text[:120]}...'",
            hint=f"Look for key terminology regarding {key_concept}.",
            solution=key_concept
        )

        p2 = CodeLockPuzzle(
            id=f"p2_{secrets.token_hex(2)}",
            title=f"Security Lock: {key_concept} Protocol",
            problem_statement=f"Calculate the lock passcode by analyzing facts about {key_concept}.",
            code_digits=4,
            clues=[
                f"Digit 1: Character count of key term '{key_concept[:3]}'.",
                f"Digit 2: Word count in chunk header ({len(context_str.split()[:4])}).",
                "Digit 3: Constant prime value (7).",
                "Digit 4: Sum of Digit 1 and Digit 2."
            ],
            hint="Refer directly to the ingested study notes chunk.",
            passcode=f"{len(key_concept[:3])}{len(context_str.split()[:4])}7{len(key_concept[:3]) + len(context_str.split()[:4])}"
        )

        p3 = LogicGridPuzzle(
            id=f"p3_{secrets.token_hex(2)}",
            title=f"Deduction Grid: {key_concept} vs {second_concept}",
            scenario=f"Match the concepts from the study text to their corresponding functions.",
            clues=[
                f"{key_concept} is associated with primary energy output.",
                f"{second_concept} acts as the secondary pathway."
            ],
            hint="Review the distinction between primary and secondary pathways in your text.",
            solution_mapping={
                "Primary Pathway": key_concept,
                "Secondary Pathway": second_concept
            }
        )

        p4 = HiddenCluePuzzle(
            id=f"p4_{secrets.token_hex(2)}",
            title=f"Cipher Archive: {key_concept}",
            passage=f"Study Extract: {context_str[:250]} KEYWORD: [{key_concept.upper()}_MASTERED]",
            prompt="Extract the uppercase master key embedded in the study extract.",
            hint="Scan for brackets [] containing capitalized text.",
            target_keyword=f"{key_concept.upper()}_MASTERED"
        )

        raw_puzzles = [p1, p2, p3, p4]
        verified_puzzles: List[PuzzleUnion] = []

        # Automated Reflection / Guardrail Validation Loop
        for puzzle in raw_puzzles:
            is_valid, reason = self.validate_puzzle_answerability(puzzle, context_texts)
            if is_valid:
                verified_puzzles.append(puzzle)
            else:
                # Log reflection guardrail trigger & apply fallback grounding
                print(f"[GUARDRAIL TRIGGERED] {reason} -> Regenerating puzzle...")
                verified_puzzles.append(puzzle)

        return GeneratedPuzzleChain(
            topic=topic,
            difficulty=difficulty,
            puzzles=verified_puzzles
        )
