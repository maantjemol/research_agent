import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import { leadAgent } from "./agents/lead.ts";
import { subAgent } from "./agents/sub.ts";

const GEMINI_KEY = Bun.env.GEMINI_KEY;

if (!GEMINI_KEY) {
  throw new Error("GEMINI_KEY environment variable is not set.");
}

const google = createGoogleGenerativeAI({
  apiKey: GEMINI_KEY,
});

const model = google("gemini-2.5-flash");

const question =
  "Create a evening study for my bible study group on the topic of 'The power of prayer'";
console.log(`Question: ${question}`);
console.log("Making a plan...");
const plan = await leadAgent(question, model);

// execute subagents in parallel
console.log("Executing subagents...");
const researchSteps = plan.subagents.map((subagent) =>
  subAgent(subagent, model)
);

// await all subagents to finish
const results = await Promise.all(researchSteps);

const researchData = `
# User Question:
${question}

# Research plan:
${plan.plan}

${plan.subagents.length} subagents were created to research the topic.

${plan.subagents
  .map(
    (subagent, index) => `
# Subagent ${index + 1}: 
## Objective
${subagent.objective}
## Output Format
${subagent.outputFormat}
## Guidance
${subagent.guidance}
## Task Boundaries
${subagent.taskBoundaries}
## Results
${results[0]?.answer || "No results found."}
## sources
${
  results[index]?.sources
    ? results[index].sources.map((source) => `- ${source}`).join("\n")
    : "No sources found."
}
`
  )
  .join("\n\n")}
`;

console.log("Generating final report...");
const finalReport = await generateText({
  model,
  providerOptions: {
    google: {
      thinkingConfig: {
        thinkingBudget: -1,
      },
    },
  },
  messages: [
    {
      role: "system",
      content:
        "You are a researcher. Write a final, very detailed, multipage report that summarizes the findings that are supplied. Make sure to include everything and answer the question in full. Use markdown. Include citations in the form of [Link text Here](https://link-url-here.org)",
    },
    {
      role: "user",
      content: researchData,
    },
  ],
});

console.log(finalReport.text); // "Hello! How can I assist you today?"

const path = "./report.md";
await Bun.write(path, finalReport.text);
