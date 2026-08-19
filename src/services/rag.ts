import fs from "node:fs/promises";
import path from "node:path";

import {
  cosineSimilarity,
  getEmbeddings,
} from "./embeddings";

import type {
  RagAnswer,
  RagChunk,
  RagSourceDoc,
  RagSourceType,
} from "../types/rag";

let cachedIndex: RagChunk[] | null = null;

const STOP_WORDS = new Set([
  "what",
  "does",
  "mean",
  "means",
  "what's",
  "what’s",
  "is",
  "are",
  "the",
  "this",
  "that",
  "these",
  "those",
  "a",
  "an",
  "of",
  "in",
  "on",
  "for",
  "to",
  "and",
  "or",
  "with",
  "from",
  "about",
  "tell",
  "me",
  "please",
  "can",
  "you",
  "explain",
  "define",
  "definition",
  "meaning",
]);

//DOCUMENT LOADING

async function loadKnowledgeDocument(
  fileName: string,
  sourceType: RagSourceType
): Promise<RagSourceDoc | null> {
  const root =
    process.env.RAG_KNOWLEDGE_DIR //||
    //path.resolve("C:/Users/rose0/idxproject/ai/IDXProject_AI/Docs/knowledge"); //replace

  const filePath = path.join(root,fileName);

  try {
    const content = await fs.readFile(filePath,"utf8");

    return {
      title: fileName,
      content,
      sourceType,
      metadata: {
        path: filePath,
      },
    };
  } catch (error) {
    console.error(
      `Could not load ${fileName}:`,
      error
    );

    return null;
  }
}

async function loadWeek8Documents(): Promise<RagSourceDoc[]> {
  const documents = await Promise.all([
    loadKnowledgeDocument("Real_Estate_Primer.txt","real-estate-primer"),
    loadKnowledgeDocument("Trestle_Property_Metadata.txt","trestle-metadata"),
    loadKnowledgeDocument("IDX_Handbook_Schema.txt","handbook-schema"),
  ]);

  return documents.filter((doc): doc is RagSourceDoc => Boolean(doc));
}

function normalizeText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanRetrievedText(text: string): string {
  let cleaned = normalizeText(text);

  const noisePatterns: RegExp[] = [
    /^Confidential\s*[—-]\s*IDX Exchange Internship Program.*$/gim,
    /^IDX Exchange\s*\|\s*AI Agentic Engineer Intern Handbook.*$/gim,
    /^AI Agentic Engineer Intern Handbook.*$/gim,
    /^Confidential.*of\s+\d+\s*$/gim,
    /^\s*of\s+\d+\s*$/gim,
    /^\s*Page\s+\d+\s*(?:of\s+\d+)?\s*$/gim,
    /^\s*\d+\s*\/\s*\d+\s*$/gim,
  ];

  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern,"");
  }

  cleaned = cleaned.replace(/\bPAGE\s+\d+\b/gi,"");

  return cleaned.replace(/\n{3,}/g, "\n\n").trim();
}

// WHATSAPP FORMATTING
function formatSchemaText(text: string): string {
  const cleaned = cleanRetrievedText(text);

  if (!cleaned) {
    return "";
  }

  const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
  const output: string[] = [];

  let previousWasColumnHeader = false;

  for (const line of lines) {
    const isColumnHeader = /^Column\s+Type\s+Description$/i.test(line);

    if (isColumnHeader) {
      if (previousWasColumnHeader) {
        continue;
      }
      previousWasColumnHeader = true;
      output.push("Column | Type | Description");
      continue;
    }

    previousWasColumnHeader = false;
    output.push(line);
  }

  return output.join("\n");
}
function formatWhatsAppKnowledgeText(text: string,sourceType?: RagSourceType): string {
  let cleaned = cleanRetrievedText(text);
  if (!cleaned) {
    return "";
  }
  if (sourceType === "handbook-schema" || sourceType === "trestle-metadata") {
    cleaned = formatSchemaText(cleaned);
  }

  // Remove repeated spaces.
  cleaned = cleaned.replace(/[ \t]{2,}/g," ");

  // Remove extra blank lines inside the answer.
  cleaned =cleaned.replace(/\n\s*\n+/g,"\n");

  // Remove spaces around line breaks.
  cleaned =cleaned.replace(/[ \t]+\n/g,"\n");

  return cleaned.trim();
}

function getQueryTerms(query: string): string[] {
  const normalized =query.toLowerCase().replace(/[?!.:,;()[\]{}"']/g," ")
      .split(/\s+/).map((word) =>word.trim()).filter(Boolean);

  const terms: string[] = [];

  for (const word of normalized) {
    if (word.length < 3 || STOP_WORDS.has(word)) {
      continue;
    }

    terms.push(word);

    const components =word.split(/[_-]+/).filter((part) =>part.length >= 3 &&
            !STOP_WORDS.has(part));

    for (const component of components) {
      terms.push(component);
    }
  }

  return Array.from(new Set(terms));
}

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[_-]+/g," ").replace(/[^a-z0-9\s]/g," ")
    .replace(/\s+/g," ").trim();
}

function isNumberedHeading(line: string): boolean {
  return /^\s*\d+\.\s+.+/.test(line);
}

function isMarkdownHeading(line: string): boolean {
  return /^\s*#{1,6}\s+.+/.test(line);
}

function isTableHeading(line: string): boolean {
  const normalized =line.trim();

  return (/^table\s*:/i.test(normalized) || 
  /^(california_sold|rets_property)$/i.test(normalized));
}

function isSchemaFieldLine(line: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*\s+(String|Decimal|Int|Int32|Int64|Integer|Boolean|Date|DateTime|DateTimeOffset|Double|Long|Enum|VARCHAR|INT|DECIMAL|MEDIUMTEXT|LONGTEXT|TEXT|FLOAT|BIGINT)\b/i.test(line.trim());
}

interface SourceBlock {
  title: string;
  content: string;
}

function buildSchemaBlocks(text: string): SourceBlock[] {
  const normalized =normalizeText(text);

  const lines =normalized.split("\n").map((line) =>line.trim()).filter(Boolean);

  if (!lines.length) {
    return [];
  }

  const blocks: SourceBlock[] =[];
  let currentTitle ="Schema Reference";
  let currentLines: string[] =[];

  const flush = () => {if (!currentLines.length) {return;}
    blocks.push({title:currentTitle,
      content:currentLines.join("\n"),
    });
    currentLines = [];
  };

  for (const line of lines) {
    const tableMatch =line.match(/^(?:table\s*:\s*)?([A-Za-z][A-Za-z0-9_]*)\s*(?:[—–-]\s*.*)?$/i);
    const looksLikeTableName =tableMatch && (tableMatch[1].includes("_") ||
        /^table\s*:/i.test(line));

    if (looksLikeTableName) {
      flush();
      currentTitle =tableMatch![1];
      currentLines.push(line);
      continue;
    }

    currentLines.push(line);
  }

  flush();

  return blocks;
}

function buildStructuredBlocks(text: string,sourceType: RagSourceType): SourceBlock[] {
  const normalized =normalizeText(text);

  if (!normalized) {
    return [];
  }

  if (sourceType ==="handbook-schema") {
    return buildSchemaBlocks(normalized);
  }

  const lines =normalized.split("\n").map((line) =>line.trim()).filter(Boolean);

  if (!lines.length) {
    return [];
  }

  if (sourceType ==="trestle-metadata") {
    const blocks: SourceBlock[] =[];

    let currentTitle ="Trestle Metadata";
    let currentLines: string[] =[];

    const flush = () => {
      if (!currentLines.length) {
        return;
      }

      blocks.push({title:currentTitle,
        content:currentLines.join("\n"),
      });

      currentLines = [];
    };

    for (const line of lines) {
      if (isSchemaFieldLine(line)) {
        flush();

        const match =line.match(/^([A-Za-z][A-Za-z0-9_]*)/);

        currentTitle =match?.[1] ?? "Trestle Field";

        currentLines.push(line);
      } 
      else {
        currentLines.push(line);
      }
    }

    flush();

    return blocks;
  }

  const blocks: SourceBlock[] =[];
  let currentTitle ="Knowledge Document";
  let currentLines: string[] =[];

  const flush = () => {
    if (!currentLines.length) {
      return;
    }

    blocks.push({
      title:currentTitle,
      content:currentLines.join("\n"),
    });

    currentLines = [];
  };

  for (const line of lines) {
    if (isNumberedHeading(line) ||isMarkdownHeading(line)) {
      flush();

      currentTitle =line.replace(/^#+\s*/,"").trim();
      currentLines.push(line);
      continue;
    }

    currentLines.push(line);
  }

  flush();

  return blocks;
}

function splitLargeBlock(block: SourceBlock,chunkSize: number): string[] {
  const sectionPrefix = `[SECTION: ${block.title}]`;

  if (block.content.length <=chunkSize) {
    return [`${sectionPrefix}\n${block.content}`,];
  }

  const paragraphs =block.content.split(/\n\s*\n/).map((paragraph) =>paragraph.trim())
      .filter(Boolean);

  if (!paragraphs.length) {
    return [`${sectionPrefix}\n${block.content}`,];
  }

  const chunks: string[] =[];

  let currentParagraphs: string[] =[];

  let currentLength =sectionPrefix.length;

  for (const paragraph of paragraphs) {
    const paragraphLength =paragraph.length + 2;

    if (currentParagraphs.length >0 && currentLength + paragraphLength > chunkSize) {
      chunks.push([sectionPrefix,...currentParagraphs,].join("\n\n"));

      const overlap =currentParagraphs[currentParagraphs.length - 1];

      currentParagraphs = [overlap,];

      currentLength =sectionPrefix.length + overlap.length + 2;
    }

    currentParagraphs.push(paragraph);

    currentLength += paragraphLength;
  }

  if (currentParagraphs.length > 0) {
    chunks.push([sectionPrefix,...currentParagraphs,].join("\n\n"));
  }

  return chunks;
}

function getChunkConfig(sourceType: RagSourceType): {size: number;} {
  switch (sourceType) {
    case "handbook-schema":
      return {
        size: 1800,
      };

    case "trestle-metadata":
      return {
        size: 1200,
      };

    case "real-estate-primer":
      return {
        size: 1600,
      };

    case "week5-market":
      return {
        size: 1200,
      };
  }
}

function buildSourceChunks(doc: RagSourceDoc): string[] {
  const blocks =buildStructuredBlocks(doc.content,doc.sourceType);
  const config =getChunkConfig(doc.sourceType);
  const output: string[] =[];

  for (const block of blocks ) {
    output.push(...splitLargeBlock(block, config.size));
  }

  return output;
}

async function buildIndex(): Promise<RagChunk[]> {
  const documents =await loadWeek8Documents();

  if (!documents.length) {
    throw new Error("No Week 8 RAG source documents were loaded.");
  }

  const pending: Array<{doc: RagSourceDoc;chunk: string;chunkIndex: number;}> = [];

  for (const doc of documents) {
    const chunks =buildSourceChunks(doc);

    chunks.forEach((chunk,index) => {pending.push({doc,chunk,chunkIndex:index,});
      }
    );
  }

  const embeddings =await getEmbeddings(pending.map((item) =>item.chunk));

  return pending.map((item,index) => ({
      source:item.doc.title,
      sourceType:item.doc.sourceType,
      chunk:item.chunk,
      chunkIndex:item.chunkIndex,
      embedding:embeddings[index],
      metadata:item.doc.metadata,
    })
  );
}

export async function getWeek8Index(forceReload = false): Promise<RagChunk[]> {
  if (!cachedIndex || forceReload) {
    cachedIndex =await buildIndex();
  }

  return cachedIndex;
}

// RETRIEVAL
function calculateLexicalScore(question: string,chunkText: string): number {
  const terms =getQueryTerms(question);

  if (!terms.length) {
    return 0;
  }

  const lowerChunk =chunkText.toLowerCase();

  let score = 0;
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const term of terms) {
    const isIdentifier =term.includes("_") || term.includes("-");

    const weight =isIdentifier ? 4 : 1; 
    totalWeight += weight;

    const escaped =term.replace( /[.*+?^${}()|[\]\\]/g,"\\$&");
    const regex = new RegExp( `(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, "i");

    if (regex.test(chunkText)) {
      matchedWeight +=weight;
      score +=weight;
    }
  }

  if (totalWeight > 0) {
    score += (matchedWeight / totalWeight) * 1.5;
  }

  const identifiers =terms.filter((term) =>term.includes("_") || term.includes("-"));

  for (const identifier of identifiers) {
    if (lowerChunk.includes(identifier.toLowerCase())) {
      score += 3;
    }
  }

  const sectionMatch =chunkText.match(/^\[SECTION:\s*(.+?)\]/i);

  if (sectionMatch?.[1]) {
    const title =sectionMatch[1].toLowerCase();

    for (const term of terms) {
      if (title.includes(term.toLowerCase())) {
        score +=term.includes("_") || term.includes("-") ? 5 : 1.5;
      }
    }
  }

  return score;
}

export async function retrieveRelevantChunks(question: string,index: RagChunk[],topK = 8): Promise<RagChunk[]> {
  if (!index.length) {
    return [];
  }

  const [queryEmbedding,] = await getEmbeddings([question,]);

  if (!queryEmbedding) {
    return [];
  }

  const definitionQuestion = /\b(what does|what is|define|definition|meaning|explain)\b/i.test(question);

  const scored =index.map((chunk) => {
          const semanticScore =cosineSimilarity(queryEmbedding,chunk.embedding);
          const lexicalScore =calculateLexicalScore(question,chunk.chunk);
          let adjustedLexicalScore =lexicalScore;
          const sectionMatch =chunk.chunk.match(/^\[SECTION:\s*(.+?)\]/i);
          const sectionTitle =sectionMatch?.[1] ?? "";
          const queryTerms =getQueryTerms(question);
          let sectionScore = 0;

          for (const term of queryTerms) {
            const escaped =term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
            const regex =new RegExp(`\\b${escaped}\\b`,"i");

            if (regex.test(sectionTitle)) {
              sectionScore +=4;
            }
          }

          if (definitionQuestion && sectionScore > 0) {
            sectionScore += 4;
          }

          adjustedLexicalScore += sectionScore;

          if (definitionQuestion && /\bDOM\b/i.test(question) && /days on market/i.test(sectionTitle)) {
            adjustedLexicalScore += 6;
          }

          if (definitionQuestion && /\bCDOM\b/i.test(question) && /cumulative days on market/i.test(sectionTitle)) {
            adjustedLexicalScore += 6;
          }

          const finalScore = semanticScore * 0.55 + adjustedLexicalScore * 0.45;

          return {
            chunk,
            semanticScore,
            lexicalScore: adjustedLexicalScore,
            finalScore,
          };
        }
      ).sort((a, b) =>b.finalScore - a.finalScore);

  return scored.slice(0, topK).map((item) =>item.chunk);
}

// PASSAGE EXTRACTION
interface PassageCandidate {
  text: string;
  score: number;
}

function splitIntoEvidenceUnits(text: string): string[] {
  const normalized =cleanRetrievedText(text);

  if (!normalized) {
    return [];
  }

  const paragraphs =normalized.split(/\n\s*\n/).map((paragraph) =>paragraph.trim()
      ).filter(Boolean);

  if (paragraphs.length > 1) {
    return paragraphs;
  }

  const lines =normalized.split("\n").map((line) =>line.trim()).filter(Boolean);

  return lines.length > 1 ? lines : [normalized];
}

function scorePassage(question: string,passage: string,sectionTitle = ""): number {
  
  const terms =getQueryTerms(question);
  const normalizedPassage =normalizeForSearch(passage);
  const normalizedTitle =normalizeForSearch(sectionTitle);

  if (!normalizedPassage) {
    return 0;
  }

  let score = 0;

  for (const term of terms) {

    const escaped =term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const regex =new RegExp(`\\b${escaped}\\b`,"i");

    if (regex.test(passage)) {
      score += 1;
    }
  }

  if (normalizedTitle) {
    for (const term of terms) {
      if ( normalizedTitle.includes(term)) {
        score += 4;
      }
    }

    if (/\bdom\b/i.test(question) && /days on market/i.test(sectionTitle)) {
      score += 8;
    }

    if (/\bcdom\b/i.test(question) && /cumulative days on market/i.test(sectionTitle)) {
      score += 8;
    }
  }

  const definitionQuestion =/\b(what does|what is|define|definition|meaning|explain)\b/i.test(question);

  if (definitionQuestion) {
    if (/\bmeans\b/i.test(passage)) {
      score += 3;
    }

    if (/\bit measures\b/i.test(passage)) {
      score += 5;
    }

    if (/\bis one of the\b/i.test(passage)) {
      score += 2;
    }

    if (/\brefers to\b/i.test(passage)) {
      score += 3;
    }
  }

  if (passage.length >= 50 && passage.length <= 700) {
    score += 1;
  }

  return score;
}

function isCollectionQuestion(question: string): boolean {
  return /\b(columns|fields|schema|list|which)\b/i.test(question);
}

function getExplicitIdentifier(
  question: string
): string | null {

  const underscoreMatch =question.match(/\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/);

  if (underscoreMatch) {
    return underscoreMatch[0];
  }

  const camelCaseMatch =question.match(/\b[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*\b/);

  if (camelCaseMatch) {
    return camelCaseMatch[0];
  }

  return null;
}

function extractIdentifierRow(identifier: string,content: string): string | null {
  
  const lines =content.split("\n").map((line) =>line.trim()).filter(Boolean);
  const escaped =identifier.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const identifierRegex =new RegExp(`^${escaped}(?:\\s|$)`,"i");

  for (let i = 0;i < lines.length;i++) {
    if (!identifierRegex.test(lines[i])) {
      continue;
    }

    const result = [lines[i],];

    for (let j = i + 1; j < lines.length && result.length < 4;j++) {

      const next =lines[j];
      const nextField =/^[A-Za-z][A-Za-z0-9_]*\s+(?:BIGINT|INT|INTEGER|DOUBLE|FLOAT|DECIMAL|VARCHAR|TEXT|MEDIUMTEXT|LONGTEXT|BOOLEAN|DATE|DATETIME|String|Decimal|Int32|Int64|Boolean|DateTime|Enum)\b/i.test(next);

      if (nextField) {
        break;
      }

      if (/^\[SECTION:/i.test(next) || /^Column\s*\|/i.test(next)) {
        break;
      }

      result.push(next);
    }

    const combined =result.join(" ");

    if (new RegExp(`\\b${escaped}\\b`,"i").test(combined)) {
      return combined;
    }
  }

  return null;
}

// BEST PASSAGE
function extractBestPassage(question: string,chunk: RagChunk): string {
  const raw =cleanRetrievedText(chunk.chunk);

  if (!raw) {
    return "";
  }

  const sectionMatch =raw.match(/^\[SECTION:\s*(.+?)\]/i);
  const sectionTitle =sectionMatch?.[1]?.trim() || "";
  const content =raw.replace(/^\[SECTION:\s*.+?\]\s*/i,"");

  if (!content) {
    return sectionTitle;
  }

  const identifier =getExplicitIdentifier(question);
  const definitionQuestion =/\b(what does|what is|define|definition|meaning|explain)\b/i.test(question);

  if (identifier && definitionQuestion) {
    const row = extractIdentifierRow(identifier,content);

    if (row) {
      return row;
    }
  }

  if (isCollectionQuestion(question) && (
      chunk.sourceType ==="handbook-schema" ||
      chunk.sourceType ==="trestle-metadata"
    )) {
    return sectionTitle
      ? `${sectionTitle}\n${content}`
      : content;
  }

  if (definitionQuestion) {
    const lines =content.split("\n").map((line) =>line.trim()).filter(Boolean);

    if (lines.length > 0) {

      const subsectionHeading =/^(how\s+(?:it|this)\s+is\s+calculated|calculation|calculating|formula|examples?|analyst\s+notes?|additional\s+notes?|important\s+notes?|key\s+points?)\s*:?\s*$/i;
      const definitionLines: string[] =[];

      for (const line of lines) {
        if (subsectionHeading.test(line)) {
          break;
        }

        definitionLines.push(line);
      }

      const definitionText =cleanRetrievedText(definitionLines.join("\n\n"));

      if (definitionText) {
        if (sectionTitle) {

          const queryTerms =getQueryTerms(question);
          const titleMatches =queryTerms.some((term) => {
                const escaped =term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

                return new RegExp( `\\b${escaped}\\b`, "i").test(sectionTitle);
              }
            );

          if (titleMatches) {
            return definitionText;
          }
        }

        return definitionText;
      }
    }
  }

  const units =splitIntoEvidenceUnits(content);

  if (!units.length) {
    return content;
  }

  const candidates:PassageCandidate[] =units.map((unit,index) => {
        let score =scorePassage(question,unit,sectionTitle);

        if (definitionQuestion) {
          if (index === 0) {
            score += 6;
          } 
          else if (index === 1) {
            score += 2;
          }

          if ( /\bit measures\b/i.test(unit)) {
            score += 6;
          }

          if (/\bis defined as\b/i.test(unit)) {
            score += 6;
          }

          if (/\bmeans\b/i.test(unit)) {
            score += 5;
          }

          if (/\brefers to\b/i.test(unit)) {
            score += 5;
          }
        }

        return {text:unit,score,};
      }
    );

  candidates.sort((a, b) =>b.score -a.score);

  if (candidates.length > 0) {
    return candidates[0].text.trim();
  }

  return sectionTitle ? `${sectionTitle}\n${content}` : content;
}

// ANSWER WEEK 8 QUESTION
export async function answerWeek8Question(question: string): Promise<RagAnswer> {
  const index =await getWeek8Index();

  if (!index.length) {
    return {question,
      answer:"No relevant source text was found in the Week 8 knowledge base.",
      confidence: "low",
      sources: [],
    };
  }

  const identifier =getExplicitIdentifier(question);
  const definitionQuestion =/\b(what does|what is|define|definition|meaning|explain)\b/i.test(question);

  if (identifier && definitionQuestion) {
    const exactChunks =index.filter((chunk) => {
          const escaped =identifier.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
          const regex =new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`,"i");

          return regex.test(
            chunk.chunk
          );
        }
      );

    if (exactChunks.length > 0) {
      exactChunks.sort((a, b) => {
          const aSchema =a.sourceType ==="handbook-schema" ||
            a.sourceType ==="trestle-metadata" ? 1 : 0;

          const bSchema =b.sourceType ==="handbook-schema" ||
            b.sourceType ==="trestle-metadata" ? 1 : 0;

          return (bSchema - aSchema);
        }
      );

      for (const chunk of exactChunks) {
        const content = cleanRetrievedText(chunk.chunk).replace(/^\[SECTION:\s*.+?\]\s*/i,"");

        const row =extractIdentifierRow(identifier,content);

        if (row && row.length > 10) {
          return {
            question,
            answer:formatWhatsAppKnowledgeText(row,chunk.sourceType),
            confidence:"high",
            sources: [{
                source:chunk.source,
                sourceType:chunk.sourceType,
                chunkIndex:chunk.chunkIndex,
                pages:chunk.metadata ?.pages,
              },
            ],
          };
        }
      }
    }
  }

  // HYBRID RETRIEVAL
  const chunks =await retrieveRelevantChunks(question,index,8);

  if (!chunks.length) {
    return {
      question,
      answer: "No relevant source text was found in the Week 8 knowledge base.",
      confidence: "low",
      sources: [],
    };
  }

  let bestChunk =chunks[0];
  const bestSectionMatch =bestChunk.chunk.match(/^\[SECTION:\s*(.+?)\]/i);
  const bestSectionTitle = bestSectionMatch?.[1]?.trim() || "";

  if (bestSectionTitle) {
    const sectionChunks =index.filter((chunk) => {
            const match =chunk.chunk.match(/^\[SECTION:\s*(.+?)\]/i);

            if (!match?.[1]) {
              return false;
            }

            return (
              chunk.source ===bestChunk.source &&
              chunk.sourceType ===bestChunk.sourceType &&
              match[1].trim() ===bestSectionTitle
            );
          }
        )
        .sort((a, b) =>a.chunkIndex - b.chunkIndex );

    if (sectionChunks.length > 0) {

      const sectionParts = sectionChunks.map((chunk) =>cleanRetrievedText(chunk.chunk
            ).replace(/^\[SECTION:\s*.+?\]\s*/i,"")
        );

      // Remove exact duplicate overlap paragraphs while preserving original source order.
      const combinedParts: string[] =[];

      for (const part of sectionParts) {
        if (!part) {
          continue;
        }

        if (combinedParts.length ===0) {
          combinedParts.push(part);
          continue;
        }

        const previous =combinedParts[combinedParts.length - 1];

        // If this chunk begins with the previous
        // chunk's final paragraph, remove the duplicate.
        const previousParagraphs =previous.split(/\n\s*\n/).map((p) =>p.trim()).filter(Boolean);

        const currentParagraphs =part.split(/\n\s*\n/).map((p) =>p.trim()).filter(Boolean);

        if (previousParagraphs.length > 0 && currentParagraphs.length > 0) {
          const lastPrevious =previousParagraphs[previousParagraphs.length - 1];

          const firstCurrent = currentParagraphs[0];

          if (lastPrevious === firstCurrent) {
            currentParagraphs.shift();
            if (currentParagraphs.length > 0) {
              combinedParts.push(currentParagraphs.join("\n\n"));
            }

            continue;
          }
        }

        combinedParts.push(part);
      }

      const combinedSection =combinedParts.join("\n\n");

      /*Create a temporary source chunk containing the
      complete logical section. Its embedding isn't
      used anymore, only its source metadata.*/
      bestChunk = {
        ...bestChunk,
        chunk:`[SECTION: ${bestSectionTitle}]\n${combinedSection}`,
        chunkIndex:sectionChunks[0].chunkIndex,
      };
    }
  }

  // EXTRACT SOURCE PASSAGE
  const answer =extractBestPassage(question,bestChunk);
  const formattedAnswer =formatWhatsAppKnowledgeText(answer ||
      cleanRetrievedText(bestChunk.chunk),bestChunk.sourceType);
  return {
    question,
    answer:formattedAnswer,
    confidence: "high",
    sources: [
      {
        source:bestChunk.source,
        sourceType:bestChunk.sourceType,
        chunkIndex:bestChunk.chunkIndex,
        pages:bestChunk.metadata?.pages,
      },
    ],
  };
}

// WHATSAPP RESPONSE FORMAT
export function formatWeek8Response(result: RagAnswer): string {
  const uniqueSources =Array.from(
      new Map(result.sources.map((source) => [
            `${source.source}|${source.sourceType}`,source,])
      ).values()
    );

  const sources = uniqueSources.length > 0 ? uniqueSources.map((source) => {
              const pages =source.pages ? `, pages ${source.pages}` : "";

              return `• ${source.source}${pages}`;
            }
          ).join("\n") : "• No sources found";

  return [
    "📚 RAG Answer",
    "",
    result.answer.trim(),
    "",
    `Confidence: ${result.confidence}`,
    "",
    "Sources:",
    sources,
  ].join("\n");
}