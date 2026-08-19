function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

const OLLAMA_URL =
  process.env.OLLAMA_URL ||
  "http://localhost:11434";

const EMBEDDING_MODEL =
  process.env.OLLAMA_EMBEDDING_MODEL ||
  "nomic-embed-text";

const EMBEDDING_BATCH_SIZE = 16;

async function embedBatch(
  texts: string[]
): Promise<number[][]> {
  const cleaned = texts
    .map(cleanText)
    .filter(
      (text) => text.length > 0
    );

  if (!cleaned.length) {
    return [];
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(
        `${OLLAMA_URL}/api/embed`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            model:
              EMBEDDING_MODEL,
            input: cleaned,
            truncate: true,
          }),
        }
      );

      if (!response.ok) {
        const body =
          await response.text();

        throw new Error(
          `Ollama embed failed: ${response.status} ${body}`
        );
      }

      const data =
        await response.json();

      if (
        !Array.isArray(
          data?.embeddings
        )
      ) {
        throw new Error(
          "Ollama returned invalid embeddings"
        );
      }

      if (
        data.embeddings.length !==
        cleaned.length
      ) {
        throw new Error(
          `Ollama returned ${data.embeddings.length} embeddings for ${cleaned.length} inputs`
        );
      }

      return data.embeddings;
    } catch (error) {
      lastError = error;

      console.warn(
        `Ollama embedding batch attempt ${attempt}/3 failed:`,
        error
      );

      if (attempt < 3) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              1000 * attempt
            )
        );
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        "Ollama embedding batch failed"
      );
}

export async function getEmbedding(
  text: string
): Promise<number[]> {
  const embeddings =
    await getEmbeddings([text]);

  if (!embeddings[0]) {
    throw new Error(
      "Ollama returned no embedding"
    );
  }

  return embeddings[0];
}

export async function getEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const cleaned = texts
    .map(cleanText)
    .filter(
      (text) => text.length > 0
    );

  if (!cleaned.length) {
    return [];
  }

  const results: number[][] = [];

  // console.log(
  //   `Generating ${cleaned.length} embeddings in batches of ${EMBEDDING_BATCH_SIZE}...`
  // );

  for (
    let i = 0;
    i < cleaned.length;
    i += EMBEDDING_BATCH_SIZE
  ) {
    const batch =
      cleaned.slice(
        i,
        i +
          EMBEDDING_BATCH_SIZE
      );

    // console.log(
    //   `Embedding batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(cleaned.length / EMBEDDING_BATCH_SIZE)} (${batch.length} texts)`
    // );

    const embeddings =
      await embedBatch(batch);

    results.push(
      ...embeddings
    );
  }

  // console.log(
  //   `Generated ${results.length} embeddings successfully.`
  // );

  return results;
}

export function cosineSimilarity(
  a: number[],
  b: number[]
): number {
  if (
    a.length !== b.length ||
    a.length === 0
  ) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom =
    Math.sqrt(magA) *
    Math.sqrt(magB);

  return denom === 0
    ? 0
    : dot / denom;
}