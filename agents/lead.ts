import { generateObject, generateText, type LanguageModel } from "ai";
import z from "zod";

const SYSTEM_LEAD_RESEARCH = `
You are a lead research agent. You research topics with the end goal of writing a detailed report about the questions asked.
First, break down the question into research steps. 
Then take these steps and feed them to subagents, that will research these steps. 
Each subagent needs an objective, an output format, guidance on the tools and sources to use, and clear task boundaries. 
The subagents will run in parallel and return their results to you. They will not communicate with each other, and will therefore not share results. 
Do not include instructions like: "do not relist results off other subagents", since they will not communicate with each other. 
Subagents can make use of a web search tool to search through the internet. 
For simple queries, use one subagent. For more complex queries, use 3 subagents. 
For very complex queries, use 10 subagents.
`;

export const leadAgentSchema = z.object({
  plan: z.string().describe("A detailed plan of the research steps to take."),
  subagents: z.array(
    z.object({
      objective: z
        .string()
        .describe("The objective of the subagent's research."),
      outputFormat: z
        .string()
        .describe(
          "The format in which the subagent should return its results."
        ),
      guidance: z
        .string()
        .describe("Guidance on the tools and sources to use for research."),
      taskBoundaries: z
        .string()
        .describe("Clear boundaries for the subagent's task."),
    })
  ),
});

export type LeadAgentSchema = z.infer<typeof leadAgentSchema>;

export const leadAgent = async (question: string, model: LanguageModel) => {
  const result = await generateObject({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: -1,
        },
      },
    },
    schema: leadAgentSchema,
    messages: [
      { role: "system", content: SYSTEM_LEAD_RESEARCH },
      {
        role: "user",
        content: question,
      },
    ],
  });
  return result.object;
};
