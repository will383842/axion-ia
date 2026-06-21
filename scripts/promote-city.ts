// Marker ES module — isolation namespace vs autres scripts dossier `scripts/`.
export {};

// City promoter skeleton — audit indexation 2026-05-18 P2-22.
//
// Outil semi-manuel : prend en input un slug ville + service type + génère
// la copy `copy.services.<svc>` via Claude API, output un draft markdown
// que Will peut review puis intégrer manuellement dans
// `src/content/villes/data/<region>/<ville>.ts`.
//
// Usage :
//   npx tsx scripts/promote-city.ts --ville=lyon --region=auvergne-rhone-alpes \
//     --service=audit [--service=interventions] [--service=implementation] \
//     [--output=_AUDIT/city-drafts/lyon.md]
//
// Pré-requis env vars :
//   - ANTHROPIC_API_KEY (Claude API)
//
// V1 = generation 1 ville × 1-3 services par run. V2 (Sprint dédié) =
// BullMQ worker batch + auto-commit FS + IndexNow trigger. V3 = stockage
// DB au lieu FS (table `VilleCopyDraft`).
//
// Coût : ~$0.20-0.50 par ville (Claude Sonnet 4.6, ~3000 tokens output × 3
// services). Limite Will à 10-20 villes/jour pour rester < $5/jour budget.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

type ServiceType = "audit" | "interventions" | "implementation";

const SERVICE_DESCRIPTIONS: Record<ServiceType, string> = {
  audit: "Audit IA opérationnel 5 jours — cartographie, scoring ROI, plan chiffré priorisé.",
  interventions: "Intervention IA sur site 1 jour — diagnostic + démos + plan d'action.",
  implementation:
    "Implémentation IA 6-8 semaines — cadrage + prototype + déploiement + support 30j.",
};

interface Args {
  ville: string;
  region: string;
  services: ServiceType[];
  output: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const opts: { ville?: string; region?: string; services: ServiceType[]; output?: string } = {
    services: [],
  };
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const [, key, val] = m;
    if (!val) continue;
    if (key === "ville") opts.ville = val;
    else if (key === "region") opts.region = val;
    else if (
      key === "service" &&
      (val === "audit" || val === "interventions" || val === "implementation")
    ) {
      opts.services.push(val);
    } else if (key === "output") opts.output = val;
  }
  if (!opts.ville || !opts.region) {
    console.error("[promote-city] --ville and --region required");
    process.exit(1);
  }
  if (opts.services.length === 0) {
    opts.services = ["audit", "interventions", "implementation"];
  }
  return {
    ville: opts.ville,
    region: opts.region,
    services: opts.services,
    output: opts.output ?? `_AUDIT/city-drafts/${opts.ville}.md`,
  };
}

async function generateServiceCopy(
  ville: string,
  region: string,
  service: ServiceType,
  apiKey: string,
): Promise<string> {
  const description = SERVICE_DESCRIPTIONS[service];
  const prompt = `Tu génères le contenu copy.services.${service} pour la page Axion-IA \`/${service}/par-ville/${ville}\`.

Contexte :
- Cabinet IA opérationnel B2B Axion-IA (SAS française), interventions remote/sur-site en France.
- Service ciblé : ${description}
- Ville cible : ${ville} (région ${region})
- Doctrine cap : 95% AxionIA-centric (méthodologie cabinet) + 5% data INSEE ville (anti-doorway HCU 2024).
- Cible : ~1500 mots Markdown structurés.

Structure requise (10 sections AxionIA-centric obligatoires) :
1. **Direct answer** : 40-80 mots condensant la proposition de valeur ${service} × ${ville}.
2. **Pourquoi un ${service} IA à ${ville}** : 2 paragraphes contexte tissu économique local + valeur cabinet.
3. **Notre méthodologie ${service}** : 3-5 étapes cabinet (pas généralités).
4. **Cas d'usage ${ville}** : 2-3 exemples sectoriels spécifiques au tissu économique local.
5. **Livrables ${service}** : liste précise de ce que reçoit le client.
6. **Tarification ${service}** : référence SSOT \`pricing.ts\` (4 tiers, mention range honnête).
7. **Process Axion-IA** : intervention remote OU sur-site ${ville} (~3h trajet Paris).
8. **FAQ ${service} × ${ville}** : 4 questions Q/R structurées (300 chars max par answer).
9. **Cas concrets liés** : référence /cas-concrets si pertinent.
10. **CTA contact** : phrase finale + lien /reserver.

Contraintes éditoriales :
- Aucun stub structurel ("Bienvenue à ${ville}", "Notre cabinet à ${ville}").
- Lexique cabinet : intervention, audit, ROI mesuré, méthodologie, livrables.
- Pas de superlatifs creux ("leader", "expertise inégalée").
- Ton : sobre, opérationnel, conseil senior.
- Mention spécifique ${ville} ≤ 5 occurrences (anti-bourrage).

Output : Markdown brut prêt à intégrer dans \`copy.services.${service}\` d'un objet ville TS.`;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("Claude API response missing content");
  return text;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[promote-city] ANTHROPIC_API_KEY env var required.");
    console.error("  Run : ANTHROPIC_API_KEY=sk-... npx tsx scripts/promote-city.ts ...");
    process.exit(1);
  }

  console.log(
    `[promote-city] generating copy for ${args.ville} (${args.region}) — services : ${args.services.join(", ")}`,
  );

  const sections: string[] = [
    `# Draft copy ville : ${args.ville} (${args.region})`,
    ``,
    `Généré ${new Date().toISOString()} via \`scripts/promote-city.ts\` (audit indexation 2026-05-18 P2-22).`,
    `Modèle : ${MODEL}. Services : ${args.services.join(", ")}.`,
    ``,
    `**Workflow Will** :`,
    `1. Review chaque section ci-dessous`,
    `2. Intégrer dans \`src/content/villes/data/${args.region}/${args.ville}.ts\` sous \`copy.services.<svc>\``,
    `3. Commit + push → trigger build SSG + IndexNow ping auto post-deploy`,
    ``,
    `---`,
    ``,
  ];

  for (const service of args.services) {
    console.log(`[promote-city] generating ${service}...`);
    try {
      const text = await generateServiceCopy(args.ville, args.region, service, apiKey);
      sections.push(`## Service: ${service}`, ``, text, ``, `---`, ``);
    } catch (err) {
      sections.push(
        `## Service: ${service}`,
        ``,
        `**ERREUR génération** : ${err instanceof Error ? err.message : String(err)}`,
        ``,
        `---`,
        ``,
      );
      console.error(`[promote-city] ${service} failed:`, err);
    }
  }

  await mkdir(dirname(args.output), { recursive: true });
  await writeFile(args.output, sections.join("\n"), "utf-8");

  console.log(`[promote-city] draft written : ${args.output}`);
  console.log(
    `  → Will : review + intégrer dans content/villes/data/${args.region}/${args.ville}.ts`,
  );
}

void main();
