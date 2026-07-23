import express from "express";
import { parsePropertyQuery } from "./parser/propertyParser";
import { handleWeek3Search } from "./skills/week3Skill";
import { week5Skill } from "./skills/week5Skill";
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/property-search", async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.body as {
      query?: string;
      page?: number;
      limit?: number;
    };

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required" });
    }

    const filters = await parsePropertyQuery(query);
    const result = await handleWeek3Search({
      filters,
      page,
      limit,
    });

    return res.json(result);
  } catch (error) {
    console.error("Property search API failed:", error);
    return res.status(500).json({ error: "Property search failed" });
  }
});

app.post("/market-analytics", async (req, res) => {
  try {
    const { query } = req.body as { query?: string };

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "query is required" });
    }

    const result = await week5Skill(query);
    return res.json(result);
  } catch (error) {
    console.error("Market analytics API failed:", error);
    return res.status(500).json({ error: "Market analytics failed" });
  }
});

const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`Property API running at http://127.0.0.1:${port}`);
});