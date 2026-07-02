# IDXProject_AI
A production multi-agent AI assistant capable of real-time MLS property search, market analytics, semantic recommendations, RAG knowledge retrieval, and WhatsApp + email communication — powered by OpenClaw.

## Stack
- OpenClaw
- Ollama (`qwen3:8b`)
- MySQL
- WhatsApp
- Python / TypeScript

## Project structure
- IDXProject_AI
  - Docs/
      - Week_0_IDX_Internship_AI.md
      - Week_1_IDX_Internship_AI.md
      - Week_2_IDX_Internship_AI.md
  - src/
      - parser/
          - propertyParser.ts
      - tests/
          - propertyParser.test.ts
      - types/
          - propertyFilters.ts
  - package.json
  - tsconfig.json
  - README.md

## Current status
- Week 2 completed
- OpenClaw running locally
- MySQL database created and imported
- WhatsApp channel linked and tested
- Natural language property search parser implemented

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
