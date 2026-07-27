/**
 * Garde-fou de cohérence des sous-processeurs (lot L10 / constat X2).
 *
 * POURQUOI CE FICHIER EXISTE — Calendly est arrivé en production le 2026-05-26,
 * onze jours après le gel de `SUBPROCESSORS_LAST_UPDATED` au 2026-05-15, et est
 * resté absent des trois registres pendant deux mois pendant que
 * `/sous-processeurs` se déclarait « exhaustive » (RGPD art. 13.1.e). Un runbook
 * annuel n'aurait pas rattrapé ça : le mode de défaillance est une feature
 * mergée entre deux revues. Il faut un test qui casse au commit.
 *
 * POURQUOI LE SCAN PORTE SUR LA CSP, ET PAS SUR LE JSX — première version de ce
 * fichier : un grep de `src="https://…` / `href="https://…` sur `src/components`
 * et `src/app`. Rejeté, pour deux raisons mesurées :
 *   1. FAUX POSITIFS — 13 hôtes remontent, dont www.insee.fr, x.com,
 *      creativecommons.org, www.linkedin.com : de simples liens sortants, aucun
 *      transfert de données. Le test était rouge à l'arrivée.
 *   2. FAUX NÉGATIF SUR LE CAS VISÉ — l'embed Calendly incriminé s'écrivait
 *      `src={CALENDLY_WIDGET_JS}` et `data-url={finalUrl}`, des identifiants.
 *      Aucun littéral. Le test n'aurait PAS attrapé l'omission qu'il prétend
 *      empêcher.
 * La CSP est le vrai goulot : aucun tiers ne peut charger dans le navigateur
 * sans figurer dans `script-src` / `connect-src` / `frame-src`, quelle que soit
 * la façon dont l'URL est écrite en JSX. La liste est courte et curée, donc
 * stable — et un ajout y est toujours un acte conscient.
 *
 * NE PAS « simplifier » en remplaçant les tables ci-dessous par une heuristique.
 * Leur intérêt est précisément d'obliger à classer chaque nouvel hôte à la main.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SUBPROCESSORS } from "../subprocessors";
import { LEGAL_PAGES } from "../legal";

const ROOT = process.cwd();

/**
 * Hôte autorisé par la CSP → fragment du `name` de l'entrée SUBPROCESSORS qui le
 * couvre. AJOUTER UNE LIGNE ICI EST UN ACTE CONSCIENT : cela signifie qu'on a
 * aussi créé l'entrée dans la SSOT, la ligne dans `_AUDIT/DPA-REGISTER.md`, et
 * vérifié que le tiers est gaté sur consentement.
 */
const CSP_HOST_OWNER: Record<string, string> = {
  "calendly.com": "Calendly",
  "*.calendly.com": "Calendly",
  "assets.calendly.com": "Calendly",
  "www.clarity.ms": "Microsoft",
  "*.clarity.ms": "Microsoft",
  "*.ingest.sentry.io": "Sentry",
  "*.ingest.de.sentry.io": "Sentry",
  "*.ingest.us.sentry.io": "Sentry",
  "api.stripe.com": "Stripe",
  "checkout.stripe.com": "Stripe",
  "api.telegram.org": "Telegram",
  "challenges.cloudflare.com": "Cloudflare",
  "*.r2.cloudflarestorage.com": "Cloudflare",
  "plausible.axion-ia.com": "Plausible",
};

/**
 * Hôtes autorisés par la CSP qui ne SONT PAS des sous-traitants — avec le motif.
 * Un motif vague ici est une faute : c'est la porte de sortie du garde-fou.
 */
const CSP_HOST_JUSTIFIED: Record<string, string> = {
  // `next/font/google` télécharge et AUTO-HÉBERGE les fontes au build
  // (src/app/[locale]/layout.tsx : Manrope, Inconsolata, Fraunces). Aucune
  // requête runtime du navigateur vers Google — vérifié le 2026-07-26 :
  //   curl -s https://axion-ia.com/fr/appel | grep -o 'fonts\.\(googleapis\|gstatic\)\.com' → vide
  // Ces deux directives CSP sont défensives/vestigiales. Si elles devenaient
  // effectives, Google deviendrait un sous-traitant à déclarer.
  "fonts.googleapis.com":
    "next/font/google auto-héberge au build — aucune requête runtime (vérifié en prod)",
  "fonts.gstatic.com": "idem fonts.googleapis.com",
};

/** Hôtes tiers autorisés par la CSP, extraits du fichier source. */
function cspHosts(): string[] {
  const csp = readFileSync(join(ROOT, "src", "lib", "csp.ts"), "utf8");
  const hosts = new Set<string>();
  for (const m of csp.matchAll(/https:\/\/([a-zA-Z0-9.*-]+)/g)) {
    if (m[1]) hosts.add(m[1]);
  }
  return [...hosts].sort();
}

/** Premier mot significatif d'un nom commercial ("Calendly LLC" → "Calendly"). */
function firstToken(name: string): string {
  return (name.split(/[\s(,]/)[0] ?? name).replace(/[^A-Za-z]/g, "");
}

describe("cohérence des sous-processeurs", () => {
  it("Calendly figure dans la SSOT, avec la bonne base légale et le bon cadre de transfert", () => {
    const calendly = SUBPROCESSORS.find((s) => /calendly/i.test(s.name));
    expect(calendly, "aucune entrée Calendly dans SUBPROCESSORS").toBeDefined();
    // 6.1.b et non 6.1.a : le consentement en jeu est celui de l'art. 82
    // (accès au terminal), pas une base légale de traitement.
    expect(calendly?.legalBasis).toBe("6.1.b_contract");
    expect(calendly?.transferFramework).toBe("scc");
    expect(calendly?.activationStatus).toBe("active");
  });

  it("tout hôte tiers autorisé par la CSP est couvert par la SSOT, ou justifié explicitement", () => {
    const names = SUBPROCESSORS.map((s) => s.name).join(" | ");
    for (const host of cspHosts()) {
      if (host in CSP_HOST_JUSTIFIED) {
        expect(
          CSP_HOST_JUSTIFIED[host]?.length ?? 0,
          `Le motif de justification de "${host}" est vide.`,
        ).toBeGreaterThan(20);
        continue;
      }
      const owner = CSP_HOST_OWNER[host];
      expect(
        owner,
        `L'hôte "${host}" est autorisé à charger dans le navigateur du visiteur par ` +
          `src/lib/csp.ts, mais n'est classé nulle part. Déclarer le sous-processeur ` +
          `dans src/content/subprocessors.ts ET dans _AUDIT/DPA-REGISTER.md puis ` +
          `l'ajouter à CSP_HOST_OWNER ; ou, s'il ne traite aucune donnée, ` +
          `l'ajouter à CSP_HOST_JUSTIFIED avec un motif vérifié.`,
      ).toBeDefined();
      expect(names, `"${host}" est rattaché à "${owner}", absent de SUBPROCESSORS.`).toContain(
        owner as string,
      );
    }
  });

  it("la section transferts de la politique de confidentialité n'énumère AUCUN sous-processeur", () => {
    // La divergence historique venait d'une prose recopiée à la main : elle
    // affirmait que « les seuls transferts hors UE » concernaient 3 modèles d'IA,
    // alors que la SSOT en déclarait 7 autres hors UE. Une prose qui n'énumère
    // pas ne peut pas diverger — c'est CET invariant qu'on verrouille, et la
    // liste interdite est DÉRIVÉE de la SSOT pour couvrir aussi les futurs.
    const privacy = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
    expect(privacy).toBeDefined();
    const transferBodies = [privacy?.fr, privacy?.en]
      .flatMap((v) => v?.sections ?? [])
      .filter((s) => /transfert|transfer/i.test(s.title))
      .map((s) => s.body)
      .join("\n");
    expect(transferBodies.length, "aucune section transferts trouvée").toBeGreaterThan(0);

    for (const s of SUBPROCESSORS) {
      const token = firstToken(s.name);
      expect(
        transferBodies,
        `"${token}" (${s.name}) est nommé dans la section transferts de legal.ts. ` +
          `Toute énumération finit par diverger de src/content/subprocessors.ts — ` +
          `renvoyer à /sous-processeurs sans nommer personne.`,
      ).not.toContain(token);
    }
  });

  it("chaque entrée de la SSOT figure dans le registre interne art. 30", () => {
    const register = readFileSync(join(ROOT, "_AUDIT", "DPA-REGISTER.md"), "utf8");
    for (const s of SUBPROCESSORS) {
      expect(
        register,
        `"${s.name}" est déclaré publiquement mais absent de _AUDIT/DPA-REGISTER.md — ` +
          `le registre art. 30 est la pièce demandée en premier en audit.`,
      ).toContain(firstToken(s.name));
    }
  });
});
