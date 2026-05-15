// Agent 9 — Probe axe-core sur prod (home FR mobile)
// AUDIT-ONLY. Lance Playwright + axe-core/playwright et écrit le rapport JSON.
import { chromium, devices } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { writeFileSync } from "node:fs";

const URL = process.env.PROBE_URL || "https://axion-ia.com/fr";
const OUT = process.env.PROBE_OUT || "_AUDIT/E2E-NAV-CTA-2026-05-15/axe-home-fr.json";

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 14"] });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 30_000 });

const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
  .analyze();

const summary = {
  url: URL,
  ts: new Date().toISOString(),
  violations: results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    helpUrl: v.helpUrl,
    nodeCount: v.nodes.length,
    sampleSelector: v.nodes[0]?.target?.join(" > "),
    sampleHtml: v.nodes[0]?.html?.slice(0, 200),
  })),
  incomplete: results.incomplete.map((v) => ({ id: v.id, nodeCount: v.nodes.length })),
  passCount: results.passes.length,
};
writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.log(
  "violations=",
  summary.violations.length,
  "incomplete=",
  summary.incomplete.length,
  "passes=",
  summary.passCount,
);

await browser.close();
