import { generateText, tool, type LanguageModel } from "ai";
import type { leadAgent, LeadAgentSchema } from "./lead";
import z from "zod";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { createBibleTool } from "../db";

const SYSTEM_SUB_RESEARCH = `
You are a subagent for a lead research agent. Your task is to research a specific step of a larger research plan.
You will receive a detailed plan from the lead agent, which includes the research steps to take.
Your objective is to research the step assigned to you and return your findings in a structured format.
You will not communicate with other subagents, and you will not share results with them.
You can use a web search tool to search through the internet for information.
You can use the bible tool to query the Bible for relevant verses or passages.
Make sure to follow the guidance provided by the lead agent and adhere to the task boundaries.
If you need to search the web, use the search tool provided.
Keep searching the web until you have enough information to answer the research step thoroughly. Don't hesitate to search multiple times.
You can search the web for more information if a bible verse or passage does not provide enough context or information.
You should only answer if you have enough information to provide a comprehensive answer to the objective. If you do not have enough information, continue researching until you do. 
If no information is available, say "No information found" and do not answer the objective.

## answering:
When you have completed your research, use the answer tool to provide the final answer to the research question.
You must include all relevant information in your answer. Make sure to also detail the steps you took to arrive at your answer. 
Follow the output format provided by the lead agent.
`;

const createAnswerTool = () =>
  tool({
    description: "A tool for providing the final answer.",
    parameters: z.object({
      // steps: z.array(
      //   z.object({
      //     step: z.string().describe("The research step taken by the subagent."),
      //     sources: z.array(z.string()).describe("Sources used for this step."),
      //     result: z.string().describe("Findings from this research step."),
      //   })
      // ),
      sources: z
        .array(z.string())
        .describe(
          "Sources used for this research step. Include URLs or references to the sources or bible verses used."
        ),
      answer: z
        .string()
        .describe(
          "The final answer to the research question. Be very precise and make sure to include all relevant information. Use the findings from the research steps to construct a comprehensive answer."
        ),
    }),
  });

const createSearchTool = () =>
  tool({
    description: "A tool for searching the web.",
    parameters: z.object({
      query: z.string().describe("The search query to execute."),
    }),
    execute: async ({ query }) => {
      const searchResponse = await fetch(
        `http://localhost:8080/search?q=${query}&format=json`
      );

      if (!searchResponse.ok) {
        throw new Error("Failed to fetch search results");
      }

      const data = await searchResponse.json();
      const searchResults = data.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippit: result.content,
        content: "",
      }));

      // fetch html for the top 5 results
      const htmlResults = await Promise.all(
        searchResults.slice(0, 3).map(async (result: any) => {
          const response = await fetch(result.url);
          const html = await response.text();
          const markdown = NodeHtmlMarkdown.translate(html);
          return { ...result, content: markdown };
        })
      );
      return {
        results: htmlResults,
        query,
      };
    },
  });

export const subAgent = async (
  plan: LeadAgentSchema["subagents"][number],
  model: LanguageModel
) => {
  const { toolCalls } = await generateText({
    model,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 0, // No thinking budget for subagents cus expensiveee
        },
      },
    },
    onStepFinish: (step) => {
      console.log(`Subagent step finished: ${step.text}`);
    },
    tools: {
      search: createBibleTool(),
      answer: createAnswerTool(),
    },
    system: SYSTEM_SUB_RESEARCH,
    prompt: `
    # Subagent Research Task
    ## Objective
    ${plan.objective}
    ## Output Format
    ${plan.outputFormat}
    ## Guidance
    ${plan.guidance}
    ## Task Boundaries
    ${plan.taskBoundaries}
    `,
    toolChoice: "required",
    maxSteps: 10,
  });

  return toolCalls.find((call) => call.toolName === "answer")?.args;
};
