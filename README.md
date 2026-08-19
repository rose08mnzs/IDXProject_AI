# IDXProject_AI
A production multi-agent AI assistant capable of real-time MLS property search, market analytics, semantic recommendations, RAG knowledge retrieval, and WhatsApp + email communication — powered by OpenClaw.

## Stack
- OpenClaw
- Ollama (`qwen3:8b`)
- Ollama (`nomic-embed-text`)
- MySQL
- WhatsApp
- Python / TypeScript

## Project structure
- IDXProject_AI
  - Docs/
    - Week_0_IDX_Internship_AI.md
    - Week_1_IDX_Internship_AI.md
    - Week_2_IDX_Internship_AI.md
    - Week_3_IDX_Internship_AI.md
    - Week_4_IDX_Internship_AI.md
    - Week_5_IDX_Internship_AI.md
    - Week_6_IDX_Internship_AI.md
    - Week_7_IDX_Internship_AI.md
    - Week_8_IDX_Internship_AI.md
    - Week_9_IDX_Internship_AI.md
  - src/
    - config/
        - db.ts
      - agents/
        - agents.ts
        - types.ts
      - services/
        - listings.ts
        - format.ts
        - marketAnalytics.ts
        - embeddings.ts
        - semanticSearch.ts
        - recommendation.ts
        - embeddings.ts
        - rag.ts
        - intentClassifier.ts
        - orchestrator.ts
      - session/
        - sessionManager.ts
      - skills/
        - week3Skill.ts
        - propertySearchSkill.ts
        - week4Skill.ts
        - week5Skill.ts
        - week7Skill.ts
        - week8Skill.ts
        - week9Skill.ts
      - parser/
        - propertyParser.ts
      - types/
        - propertyFilters.ts
        - marketAnalytics.ts
        - rag.ts
      - tests/
        - testDb.test.ts
        - propertyParser.test.ts
        - week3Search.test.ts
        - testSearch.test.ts
        - testWeek4Conversation.test.ts
        - testWeek5MarketAnalytics.test.ts
        - week6embeddings.test.ts
        - week6SemanticSearch.test.ts
        - week7Recommendation.test.ts
        - week8Rag.test.ts
        - week9Orchestrator.test.ts
    - OpenClaw
      - src/
        - idx/
          - property-search.ts
        - auto-reply/
        - reply/
          - get-reply.ts
  - package.json
  - tsconfig.json
  - README.md

## Current status
- Week 9 completed
- OpenClaw running locally
- MySQL database created and imported
- WhatsApp channel linked and tested
- Natural language property search parser implemented
- MLS Database Integration implemented
- Conversational Property Search Agent Implemented
- Per-user session memory Implemented 
- Market analytics implemented and tested
- Semantic search integrated into Week 4
- Local embeddings and vector search working with Ollama
- Embedding cache table implemented for performance
- Hybrid recommendation engine
- RAG pipeline implemented
- Knowledge sources indexed for retrieval
- Multi-agent orchestration implemented
- Centralized intent classifier implemented
- Mixed-intent query detection implemented


## Roadmap
- Week 0: Environment Setup
- Week 1: Architecture Fundamentals
- Week 2: NL Property Search
- Week 3: Database Integration
- Week 4: Conversational Agent
- Week 5: Market Analytics
- Week 6: Embeddings & Vector Search
- Week 7: Recommendation Engine
- Week 8: RAG Pipeline
- Week 9: Multi-Agent Orchestration
- Week 10: WhatsApp Layer
- Week 11: Email Agents & Safety
- Week 12: Capstone Demo

## Notes
- MySQL is hosted in a local Docker container.
- OpenClaw is configured with Ollama for local inference.
- WhatsApp is connected through the OpenClaw WhatsApp channel.
- Environment variables are stored locally in .env and are not committed to Git.
