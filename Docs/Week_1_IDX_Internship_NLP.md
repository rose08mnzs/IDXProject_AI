# WEEK 1 - OpenClaw Architecture Fundamentals

## Overview
OpenClaw is a multi-agent orchestration runtime. It does not answer questions itself; instead, it receives a user's request, determines what the user wants, routes the request to the correct AI skill, interacts with external tools such as MySQL or Ollama, stores conversation context, and returns the final response.
The architecture below illustrates how a user request travels through the entire system.

---

## Concepts
- **Channel**: The interface used to communicate with the AI.
- **OpenClaw Runtime**: Central processing engine.
- **Intent Detection**: Identifies what the user wants.
- **Agent Orchestrator**: Select which skills should process the request.
- **Skills**: Specialized modules that perform specific tasks such as property search, market analytics, recommendations, or knowledge retrieval.
- **Tools**: Functions that skills call to interact with databases, models, or external services.
- **Session**: Per-user conversation state during a chat.
- **Short-term Memory**: Stores the session information.
- **Long-term Memory**: Stores information across conversations.
- **Response**: Formats and sends the final response back to the user through the selected communication channel.

## OpenClaw Architecture Workflow

```mermaid
flowchart TD

%% ======================================
%% USER
%% ======================================

U([User])

REQ["Example Request<br/>Show me 3-bedroom homes in Irvine under $1M"]

U --> REQ

%% ======================================
%% CHANNELS
%% ======================================

subgraph CHANNELS["Channels"]

WA["WhatsApp"]

CC["ClickClack"]

end

REQ --> WA
REQ --> CC

%% ======================================
%% OPENCLAW
%% ======================================

subgraph RUNTIME["OpenClaw Runtime"]

R1["Receive Message"]

R2["Normalize Request"]

R3["Intent Detection"]

R4["Session & Memory Lookup"]

R5["Agent Orchestrator"]

R1 --> R2
R2 --> R3
R3 --> R4
R4 --> R5

end

WA --> R1
CC --> R1

%% ======================================
%% SKILLS
%% ======================================

subgraph SKILLS["Skills"]

PS["Property Search"]

MA["Market Analytics"]

REC["Recommendation Engine"]

RAG["RAG Assistant"]

end

R5 --> PS
R5 --> MA
R5 --> REC
R5 --> RAG

%% ======================================
%% TOOLS
%% ======================================

subgraph TOOLS["Tools"]
FN["Functions"]
end

PS --> FN
MA --> FN
REC --> FN
RAG --> FN

%% ======================================
%% DATA
%% ======================================

subgraph BACKEND["Services"]

MYSQL[("MySQL Database<br/>rets_property<br/>california_sold")]

OLLAMA["Ollama<br/>qwen3:8b"]

VECTOR["Vector Store"]

end

FN-->BACKEND

%% ======================================
%% MEMORY
%% ======================================

subgraph MEMORY["Memory"]

SM["Short-term"]

LM["Long-term"]

end

BACKEND --> MEMORY

%% ======================================
%% RESPONSE
%% ======================================

subgraph RESPONSE["Response"]

GEN["Generate Response"]

FORMAT["Format Response"]

SEND["Send Response"]

GEN --> FORMAT

FORMAT --> SEND

end

MEMORY --> RESPONSE

%% ======================================
%% RESULT
%% ======================================

RESP["Example Response

- 12 Properties Found

- Irvine, CA

- Starting from $875,000

- 3 Beds - Pool - View"]

SEND --> RESP

RESP --> USER([User Receives Response])
```

# Current Environment

## Runtime
- OpenClaw

## Model
- Ollama (qwen3:8b)

## Database
- MySQL 8 (Docker)

### Tables:
- rets_property
- california_sold

## Communication Channels
- ClickClack (For testing)
- WhatsApp

