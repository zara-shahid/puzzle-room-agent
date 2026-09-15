from backend.rag import StudyMaterialRAG

def test_rag_sanity_check():
    rag = StudyMaterialRAG()
    
    sample_study_material = """
    Cellular respiration is a set of metabolic reactions and processes that take place in the cells of organisms
    to convert chemical energy from nutrients into adenosine triphosphate (ATP), and then release waste products.
    The reactions involved in respiration include glycolysis, the citric acid cycle (Krebs cycle), and oxidative phosphorylation.
    
    Glycolysis is the metabolic pathway that converts glucose into pyruvate. The free energy released in this process is used
    to form the high-energy molecules ATP and NADH. Glycolysis takes place in the cytoplasm of cell.
    
    Photosynthesis, on the other hand, is used by plants to synthesize nutrients from carbon dioxide and water using light energy.
    Photosynthesis occurs inside chloroplasts and produces oxygen as a byproduct.
    """

    print("--- Ingesting Sample Study Material ---")
    chunk_count = rag.ingest_material(text=sample_study_material, topic="Cellular Biology")
    print(f"Ingested {chunk_count} chunks into RAG store.")
    assert chunk_count > 1

    print("\n--- Sanity Check 1: Querying 'Glycolysis ATP' ---")
    query_1 = "What is glycolysis and how does it form ATP?"
    results_1 = rag.retrieve_relevant_chunks(query=query_1, top_k=2)
    
    for idx, res in enumerate(results_1, 1):
        print(f"Match {idx} [Score {res['score']}]: {res['text'].strip()}")
    
    assert any("glycolysis" in r["text"].lower() for r in results_1)
    assert any("atp" in r["text"].lower() for r in results_1)

    print("\n--- Sanity Check 2: Querying 'Photosynthesis Chloroplasts' ---")
    query_2 = "Where does photosynthesis occur and what is the byproduct?"
    results_2 = rag.retrieve_relevant_chunks(query=query_2, top_k=2)

    for idx, res in enumerate(results_2, 1):
        print(f"Match {idx} [Score {res['score']}]: {res['text'].strip()}")

    assert any("photosynthesis" in r["text"].lower() for r in results_2)
    assert any("chloroplasts" in r["text"].lower() for r in results_2)

    print("\n[SUCCESS] Day 4 RAG Ingestion and Sanity Check PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_rag_sanity_check()
