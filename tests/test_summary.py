from backend.summary_analyzer import SessionSummaryAnalyzer

def test_session_summary_generation():
    analyzer = SessionSummaryAnalyzer()
    
    sample_puzzles = [
        {"id": "p1", "title": "Riddle: Photosynthesis", "solve_time_seconds": 15.0, "failed_attempts": 0},
        {"id": "p2", "title": "Vault Code: Chloroplasts", "solve_time_seconds": 75.0, "failed_attempts": 3},
        {"id": "p3", "title": "Grid: Light Reactions", "solve_time_seconds": 40.0, "failed_attempts": 1}
    ]

    print("--- Generating Post-Session Summary Report ---")
    report = analyzer.generate_summary_report(
        room_code="TEST01",
        topic="Photosynthesis & Cell Biology",
        puzzles=sample_puzzles
    )

    print(f"Room Code: {report.room_code}")
    print(f"Overall Rating: {report.overall_struggle_rating}")
    print(f"Key Takeaway: {report.key_takeaway_summary}")
    print("\nConcept Struggle Breakdown:")
    for c in report.struggled_concepts:
        print(f"  [{c.struggle_severity}] {c.concept_name} -> Score: {c.struggle_score}, Failures: {c.failed_attempts}")

    assert report.total_puzzles == 3
    assert any(c.struggle_severity == "HIGH" for c in report.struggled_concepts)
    print("\n[SUCCESS] Day 9 End-of-Session Summary Test PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_session_summary_generation()
