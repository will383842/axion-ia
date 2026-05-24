# Test 14 — Cost tracker monthly caps + kill-switch

## Date : 2026-05-22

## cost-tracker.ts

src/server/content-gen/lib/cost-tracker.ts
src/server/content-gen/lib/**tests**/cost-tracker.spec.ts

## Monthly caps providers

src/server/content-gen/lib/cost-tracker.ts:36:async function handleCostCapHit(provider: ProviderKey, spent: number, cap: number): Promise<void> {
src/server/content-gen/lib/cost-tracker.ts:87: reason: `Auto-trigger : tous les providers role=text en cost cap (dernier=${provider})`,
src/server/content-gen/lib/cost-tracker.ts:96: reason: `Auto-trigger : tous les providers role=text en cost cap (dernier=${provider})`,
src/server/content-gen/lib/cost-tracker.ts:109: `Cause : tous les providers role=text en cost cap mensuel.\n` +
src/server/content-gen/lib/cost-tracker.ts:220: await alertCostCap80(provider, spent + estimatedCostUsd, cap, queuedJobs);
src/server/content-gen/lib/cost-tracker.ts:230: await handleCostCapHit(provider, spent, cap);
src/server/content-gen/lib/cost-tracker.ts:232: `Cost cap reached for ${provider}: $${spent.toFixed(4)}/$${cap.toFixed(2)} (+ $${estimatedCostUsd.toFixed(4)})`,

## Alerte 80% + kill-switch

src/server/content-gen/lib/cost-tracker.ts:27: _ → activer kill switch global content-gen (`ContentGenConfig.kill_switch`).
src/server/content-gen/lib/cost-tracker.ts:82: where: { key: "kill_switch" },
src/server/content-gen/lib/cost-tracker.ts:84: key: "kill_switch",
src/server/content-gen/lib/cost-tracker.ts:177: _ - Si `>= 0.8 * monthlyCapUsd` → log warning (Telegram alert § 12.3bis Sprint 1 Day 5).
src/server/content-gen/lib/cost-tracker.ts:182:export async function assertCostCapAvailable(
src/server/content-gen/lib/cost-tracker.ts:209: // P1-17 fix audit opérationnel 2026-05-14 — warning à 80% pour anticiper
src/server/content-gen/lib/cost-tracker.ts:211: // pre-call < 80%, post-call >= 80%) pour éviter spam Telegram.
src/server/content-gen/lib/cost-tracker.ts:212: const threshold80 = cap _ 0.8;
src/server/content-gen/lib/retry.ts:23: _ Applique un jitter multiplicatif aléatoire dans [0.8, 1.2] au délai fourni,
src/server/content-gen/lib/retry.ts:29: const factor = 0.8 + Math.random() _ 0.4; // [0.8, 1.2]
src/server/content-gen/lib/**tests**/cost-tracker.spec.ts:10:import { assertCostCapAvailable, trackCost } from "../cost-tracker";
src/server/content-gen/lib/**tests**/cost-tracker.spec.ts:13: it("assertCostCapAvailable returns void in bypass mode (DB inaccessible)", async () => {
src/server/content-gen/lib/**tests**/cost-tracker.spec.ts:15: await expect(assertCostCapAvailable("openai", 0.1)).resolves.toBeUndefined();
src/server/content-gen/providers/anthropic.ts:11: _ - cost cap check pré-call via assertCostCapAvailable
src/server/content-gen/providers/anthropic.ts:32:import { assertCostCapAvailable, trackCost } from "../lib/cost-tracker";
src/server/content-gen/providers/anthropic.ts:156: await assertCostCapAvailable("anthropic", 0.15);
src/server/content-gen/providers/openai.ts:9: \* - cost cap check pré-call via assertCostCapAvailable
src/server/content-gen/providers/openai.ts:27:import { assertCostCapAvailable, trackCost } from "../lib/cost-tracker";
src/server/content-gen/providers/openai.ts:124: await assertCostCapAvailable("openai", 0.1);
src/server/content-gen/providers/perplexity.ts:28:import { assertCostCapAvailable, trackCost } from "../lib/cost-tracker";

## Telegram alerte trigger

src/server/content-gen/lib/cost-tracker.ts:15:import { sendTelegram } from "@/lib/telegram";
src/server/content-gen/lib/cost-tracker.ts:59: await sendTelegram({
src/server/content-gen/lib/cost-tracker.ts:105: await sendTelegram({
src/server/content-gen/shared/content-gen-alerts.ts:12:import { sendTelegram } from "@/lib/telegram";
src/server/content-gen/shared/content-gen-alerts.ts:31: await sendTelegram({
src/server/content-gen/shared/content-gen-alerts.ts:55: await sendTelegram({
src/server/content-gen/shared/content-gen-alerts.ts:78: await sendTelegram({
src/server/content-gen/shared/content-gen-alerts.ts:102: await sendTelegram({
src/server/content-gen/shared/content-gen-alerts.ts:124: await sendTelegram({
src/server/content-gen/shared/content-gen-alerts.ts:146: await sendTelegram({
