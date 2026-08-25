import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.5 });
await p.goto(pathToFileURL(join(here, "communique.html")).href, { waitUntil: "networkidle" });
const pages = await p.locator("section.page").all();
for (const [i, el] of pages.entries()) {
  await el.screenshot({ path: join(here, `apercu-p${i + 1}.png`) });
}
await b.close();
console.log("captures:", pages.length);
