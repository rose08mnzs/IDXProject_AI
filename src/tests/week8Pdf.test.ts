import fs from "node:fs/promises";
import path from "node:path";
import { PDFParse } from "pdf-parse";

const KNOWLEDGE_DIR = path.resolve(
  "./Docs/knowledge"
);

async function extractPdf(
  fileName: string,
  outputFileName: string,
  startPage?: number,
  endPage?: number
): Promise<void> {
  const inputPath = path.join(
    KNOWLEDGE_DIR,
    fileName
  );

  const outputPath = path.join(
    KNOWLEDGE_DIR,
    outputFileName
  );

  const buffer = await fs.readFile(
    inputPath
  );

  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText();

    const firstPage = Math.max(
      1,
      startPage ?? 1
    );

    const lastPage = Math.min(
      endPage ?? result.pages.length,
      result.pages.length
    );

    const text = result.pages
      .slice(firstPage - 1, lastPage)
      .map(
        (page: any, index: number) =>
          `PAGE ${firstPage + index}\n${page.text ?? ""}`
      )
      .join("\n\n");

    await fs.writeFile(
      outputPath,
      text,
      "utf8"
    );

    console.log(
      `Created ${outputFileName} from ${fileName}`
    );
  } finally {
    await parser.destroy();
  }
}

async function run() {
  await extractPdf(
    "Real_Estate_Primer.pdf",
    "Real_Estate_Primer.txt"
  );

  await extractPdf(
    "Trestle_Property_MetaData.pdf",
    "Trestle_Property_Metadata.txt"
  );

  await extractPdf(
    "AI_Agentic_Engineer_Intern_Handbook_2026_v2.pdf",
    "IDX_Handbook_Schema.txt",
    4,
    6
  );

  console.log(
    "Week 8 knowledge extraction complete."
  );
}

run().catch((error) => {
  console.error(
    "Week 8 extraction failed:",
    error
  );

  process.exit(1);
});