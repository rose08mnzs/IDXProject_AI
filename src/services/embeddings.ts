function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 8000);
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch("http://localhost:11434/api/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nomic-embed-text",
      input: cleanText(text),
      truncate: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama embed failed: ${response.status} ${body}`);
  }

  const data = await response.json();

  if (!data?.embeddings?.[0]) {
    throw new Error("Ollama returned no embedding");
  }

  return data.embeddings[0];
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const cleaned = texts.map(cleanText).filter((t) => t.length > 0);
  if (cleaned.length === 0) return [];

  const response = await fetch("http://localhost:11434/api/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nomic-embed-text",
      input: cleaned,
      truncate: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama batch embed failed: ${response.status} ${body}`);
  }

  const data = await response.json();

  if (!Array.isArray(data?.embeddings)) {
    throw new Error("Ollama returned invalid embeddings");
  }

  return data.embeddings;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}