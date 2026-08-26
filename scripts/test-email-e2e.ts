// Smoke e2e enqueue email (Sprint 15 / M8 step 4 — verifie chain complete).
// Usage : pnpm worker (term 1) + tsx scripts/test-email-e2e.ts (term 2)
//         puis check http://localhost:8025/api/v2/messages

import { enqueueEmail } from "../src/server/queue/queues";

async function main() {
  await enqueueEmail("contact-confirmed", "test@example.com", "fr", {
    contactName: "Will Test",
    submissionId: "smoke-12345",
  });
  console.log("✓ enqueued contact-confirmed → test@example.com (FR)");

  await enqueueEmail("contact-confirmed", "test-en@example.com", "en", {
    contactName: "Will Test",
    submissionId: "smoke-67890",
  });
  console.log("✓ enqueued contact-confirmed → test-en@example.com (EN)");

  // Laisse le temps a BullMQ de pousser sur Redis avant de quitter
  await new Promise((r) => setTimeout(r, 500));
  process.exit(0);
}

main();
