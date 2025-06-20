import { ChromaClient } from "chromadb";
export const client = new ChromaClient({ host: "localhost", port: 8000 });
import { GoogleGeminiEmbeddingFunction } from "@chroma-core/google-gemini";
import { tool } from "ai";
import z from "zod";

const embedder = new GoogleGeminiEmbeddingFunction({
  apiKey: Bun.env.GEMINI_KEY,
  modelName: "models/text-embedding-004",
  taskType: "RETRIEVAL_QUERY",
});

const collection = await client.getCollection({
  name: "bible_wbt",
  embeddingFunction: embedder,
});

export const createBibleTool = () =>
  tool({
    description:
      "A tool for querying the Bible. Use this tool to get verses or passages from the Bible. Includes the relevant context.",
    parameters: z.object({
      query: z.string().describe("The search query to execute."),
    }),
    execute: async ({ query }) => {
      const searchResponse = await collection.query({
        queryTexts: [query],
        nResults: 5,
      });

      if (!searchResponse || !searchResponse.documents) {
        throw new Error("Failed to fetch Bible verses");
      }

      return searchResponse.metadatas[0];
    },
  });
