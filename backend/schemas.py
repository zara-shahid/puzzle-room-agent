from enum import Enum
from typing import List, Optional, Union, Literal
from pydantic import BaseModel, Field

class PuzzleType(str, Enum):
    RIDDLE = "riddle"
    CODE_LOCK = "code-lock"
    LOGIC_GRID = "logic-grid"
    HIDDEN_CLUE = "hidden-clue"

class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"

# --- Individual Puzzle Schemas ---
class RiddlePuzzle(BaseModel):
    puzzle_type: Literal[PuzzleType.RIDDLE] = PuzzleType.RIDDLE
    id: str = Field(description="Unique ID of the puzzle")
    title: str = Field(description="Catchy title for the riddle")
    riddle_text: str = Field(description="The riddle question or description")
    hint: str = Field(description="Subtle hint that helps without giving away the solution")
    solution: str = Field(description="The exact answer to the riddle (case-insensitive check)")
    lore_entry: Optional[str] = Field(default=None, description="2-3 sentence dark-fantasy lore fragment revealed when this puzzle is solved")

class CodeLockPuzzle(BaseModel):
    puzzle_type: Literal[PuzzleType.CODE_LOCK] = PuzzleType.CODE_LOCK
    id: str = Field(description="Unique ID of the puzzle")
    title: str = Field(description="Title of the code lock puzzle")
    problem_statement: str = Field(description="Scenario or question requiring a numeric code to unlock")
    code_digits: int = Field(default=4, description="Length of the required numeric passcode")
    clues: List[str] = Field(description="Sequence of clues leading to the passcode digits")
    hint: str = Field(description="Hint guiding the player towards solving the code")
    passcode: str = Field(description="The numeric string passcode required to open the lock (e.g. '4815')")
    lore_entry: Optional[str] = Field(default=None, description="2-3 sentence dark-fantasy lore fragment revealed when this puzzle is solved")

class LogicGridItem(BaseModel):
    category: str
    options: List[str]

class LogicGridPuzzle(BaseModel):
    puzzle_type: Literal[PuzzleType.LOGIC_GRID] = PuzzleType.LOGIC_GRID
    id: str = Field(description="Unique ID of the puzzle")
    title: str = Field(description="Title of the logic grid puzzle")
    scenario: str = Field(description="Background story setting up the items to be paired/deduced")
    clues: List[str] = Field(description="Deduction rules/clues provided to solve the grid")
    hint: str = Field(description="Hint to help untangle logical deductions")
    solution_mapping: dict = Field(description="Key-value dictionary representing the correct associations")
    lore_entry: Optional[str] = Field(default=None, description="2-3 sentence dark-fantasy lore fragment revealed when this puzzle is solved")

class HiddenCluePuzzle(BaseModel):
    puzzle_type: Literal[PuzzleType.HIDDEN_CLUE] = PuzzleType.HIDDEN_CLUE
    id: str = Field(description="Unique ID of the puzzle")
    title: str = Field(description="Title of the hidden clue puzzle")
    passage: str = Field(description="A piece of text, cipher, or description containing hidden details")
    prompt: str = Field(description="What the player must discover or extract from the passage")
    hint: str = Field(description="Hint directing where or how to look in the passage")
    target_keyword: str = Field(description="The secret keyword or keyphrase hidden inside the passage")
    lore_entry: Optional[str] = Field(default=None, description="2-3 sentence dark-fantasy lore fragment revealed when this puzzle is solved")

PuzzleUnion = Union[RiddlePuzzle, CodeLockPuzzle, LogicGridPuzzle, HiddenCluePuzzle]

class GeneratedPuzzleChain(BaseModel):
    topic: str = Field(description="The study topic this puzzle chain covers")
    difficulty: DifficultyLevel
    puzzles: List[PuzzleUnion] = Field(description="Ordered list of generated grounded puzzles forming the escape chain")
