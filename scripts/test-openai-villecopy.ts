import { generate } from "../src/server/content-gen/providers/provider-router";

async function main() {
  console.log("Testing OpenAI provider directly…");
  try {
    const r = await generate({
      jobId: "test-openai",
      contentType: "landing_ville",
      role: "text",
      systemPrompt: "You are a helpful assistant.",
      userPrompt: 'Respond with JSON: {"ping": "pong"}',
      maxTokens: 50,
      temperature: 0.2,
      preferredProvider: "openai",
    });
    console.log("✅ OpenAI OK");
    console.log("Model:", r.model);
    console.log("Cost:", r.costUsd);
    console.log("Output:", r.output);
  } catch (err) {
    console.log("❌ ERROR:", err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.log("Stack:", err.stack.slice(0, 500));
  }
}

main();
