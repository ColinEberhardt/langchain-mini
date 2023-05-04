import env from "dotenv";
env.config();

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
const rl = readline.createInterface({ input, output });

const googleSearch = async (question) =>
  await fetch(
    `https://serpapi.com/search?api_key=${process.env.SERPAPI_API_KEY}&q=${question}`
  )
    .then((res) => res.json())
    .then(
      (res) =>
        res.answer_box?.answer ||
        res.answer_box?.snippet ||
        res.organic_results?.[0]?.snippet
    );

const tools = {
  search: {
    description:
      "a search engine. useful for when you need to answer questions about current events. input should be a search query.",
    execute: googleSearch,
  },
};

const question = await rl.question("How can I help? ");

// construct the prompt, using our question
import fs from "fs";
const promptTemplate = fs.readFileSync("prompt.txt", "utf8");
let prompt = promptTemplate.replace("${question}", question).replace(
  "${tools}",
  Object.keys(tools)
    .map((toolname) => `${toolname}: ${tools[toolname].description}`)
    .join("\n")
);

// use GPT-3.5 to answer the question
const completePrompt = async (prompt) =>
  await fetch("https://api.openai.com/v1/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.OPENAI_API_KEY,
    },
    body: JSON.stringify({
      model: "text-davinci-003",
      prompt,
      max_tokens: 256,
      temperature: 1,
      stream: false,
      stop: ["Observation:"],
    }),
  })
    .then((res) => res.json())
    .then((res) => res.choices[0].text);

let finished = false;
while (!finished) {
  const response = await completePrompt(prompt);
  console.log(response);

  // add this to the prompt
  prompt += response;

  // does the response have an action?
  const action = response.match(/Action: (.*)/)?.[1];
  if (action) {
    const actionInput = response.match(/Action Input: "?(.*)"?/)?.[1];

    // execute the action
    const result = await tools[action].execute(actionInput);
    prompt += `Observation: ${result}\n`;
  } else {
    console.log(prompt);
    finished = true;
  }
}

rl.close();
