from typing import Dict, List
from pydantic import BaseModel

class ConceptStruggleMetric(BaseModel):
    puzzle_id: str
    puzzle_title: str
    concept_name: str
    failed_attempts: int
    solve_time_seconds: float
    struggle_score: float
    struggle_severity: str # "LOW", "MODERATE", "HIGH"
    learning_recommendation: str

class SessionSummaryReport(BaseModel):
    room_code: str
    topic: str
    total_puzzles: int
    total_session_time_seconds: float
    overall_struggle_rating: str
    struggled_concepts: List[ConceptStruggleMetric]
    key_takeaway_summary: str

class SessionSummaryAnalyzer:
    """
    Day 9 Feature: Post-Escape Room Learning & Analytics Summary.
    Transforms raw room metrics (failed attempts, solve time, hints) into actionable study insights.
    """
    def generate_summary_report(
        self,
        room_code: str,
        topic: str,
        puzzles: List[dict]
    ) -> SessionSummaryReport:
        metrics: List[ConceptStruggleMetric] = []
        total_time = 0.0
        total_failures = 0

        for p in puzzles:
            solve_time = p.get("solve_time_seconds") or 30.0
            failed_attempts = p.get("failed_attempts", 0)
            total_time += solve_time
            total_failures += failed_attempts

            # Struggle Score Formula: Failed Attempts * 2.5 + (Solve Time / 20.0)
            struggle_score = (failed_attempts * 2.5) + (solve_time / 20.0)

            if struggle_score >= 4.0:
                severity = "HIGH"
                rec = f"Critical review required: Re-read core definitions for '{p['title']}'. Practice problem formulation."
            elif struggle_score >= 2.0:
                severity = "MODERATE"
                rec = f"Secondary review suggested: Group took several attempts on '{p['title']}'. Brush up on related notes."
            else:
                severity = "LOW"
                rec = f"Mastered: Concept demonstrated strong grasp with rapid solve time."

            metrics.append(ConceptStruggleMetric(
                puzzle_id=p["id"],
                puzzle_title=p["title"],
                concept_name=p["title"].split(":")[-1].strip() if ":" in p["title"] else p["title"],
                failed_attempts=failed_attempts,
                solve_time_seconds=round(solve_time, 1),
                struggle_score=round(struggle_score, 2),
                struggle_severity=severity,
                learning_recommendation=rec
            ))

        # Overall rating
        if total_failures >= 4 or total_time > 200.0:
            overall = "Challenging - Targeted Study Recommended"
            takeaway = f"The session revealed key knowledge gaps in {topic}. Review the high-struggle concepts below before your exam."
        else:
            overall = "Mastered - High Retention Demonstrated"
            takeaway = f"Great work! The group demonstrated strong understanding of {topic} with quick resolution times."

        return SessionSummaryReport(
            room_code=room_code,
            topic=topic,
            total_puzzles=len(puzzles),
            total_session_time_seconds=round(total_time, 1),
            overall_struggle_rating=overall,
            struggled_concepts=metrics,
            key_takeaway_summary=takeaway
        )
