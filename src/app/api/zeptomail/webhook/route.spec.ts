/**
 * Garde : la sonde d'accessibilité doit rendre 200.
 *
 * 🔴 Sans elle, ZeptoMail REFUSE de créer le webhook. Mesuré en
 * production le 2026-09-01 : la route n'exportait que `POST`, donc un `GET`
 * rendait **405** et le panneau affichait « URL cannot be reached ». Le bouton
 * « Ajouter » ne créait rien, et le compteur `dernier appel webhook` restait
 * à `JAMAIS` — non parce que les appels étaient refusés, mais parce que le
 * webhook n'avait jamais pu exister.
 *
 * Cette garde est volontairement minuscule : elle ne vérifie qu'un code et
 * l'absence de fuite. C'est exactement ce dont dépend la création du webhook,
 * et rien de plus.
 */

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Le module importe prisma, redis et le service d'alertes au chargement. On les
// neutralise : cette garde ne teste QUE la sonde GET, qui ne les touche pas.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), set: vi.fn() } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({ creerOuDedup: vi.fn() }));

import { GET } from "./route";

describe("sonde d'accessibilité du webhook ZeptoMail", () => {
  it("🔴 rend 200 — ZeptoMail refuse de créer le webhook sinon", async () => {
    const r = GET();
    expect(
      r.status,
      "ZeptoMail interroge l'URL avant d'accepter la création du webhook et " +
        "exige un 200. Tout autre code affiche « URL cannot be reached » et " +
        "rend la création impossible — quel que soit l'état de la clé.",
    ).toBe(200);
    await r.text();
  });

  it("ne divulgue RIEN du système — pas même si une clé est configurée", async () => {
    const corps = await GET().json();
    // Un point d'entrée public ne renseigne pas sur son propre armement.
    expect(Object.keys(corps).sort()).toEqual(["endpoint", "ok"]);
    expect(JSON.stringify(corps)).not.toMatch(/key|cle|secret|token/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 GARDE DE CÂBLAGE — le module peut être parfait ET débranché.
//
// Le 2026-09-01, la PR qui a ajouté la sonde `GET` a été construite à partir
// d'une copie PÉRIMÉE de `route.ts`, prise dans un arbre de travail partagé
// resté sur une autre branche. Le diff a donc RETIRÉ l'appel à
// `noterAppelWebhook()` qu'une PR antérieure y avait posé.
//
// 🔑 `webhook-battement.ts` est resté parfait. Ses tests sont restés
// verts. `verifierSanteEmails()` a continué de lire la valeur — qui n'était
// plus jamais écrite. **Une fonction correcte et débranchée est indiscernable
// d'une fonction correcte et branchée, tant qu'on ne mesure que la fonction.**
// Le compteur aurait affiché `JAMAIS` pour toujours, et la cause n'aurait été
// visible dans aucun test.
//
// Cette garde ne teste donc pas un comportement : elle lit le FICHIER de la
// route et exige que l'appel s'y trouve. C'est le seul contrôle qui distingue
// « branché » de « débranché », parce que le câblage n'est pas observable
// depuis le module appelé. Même dispositif que
// `le-worker-initialise-sentry.spec.ts`, pour la même raison.
// ─────────────────────────────────────────────────────────────────────────────

describe("câblage du battement dans la route", () => {
  // Chemin depuis la racine du dépôt plutôt que `import.meta.url` : sous
  // vitest, cette dernière n'est pas toujours une URL `file:` et la
  // conversion lève avant même que la garde ne mesure quoi que ce soit.
  const SOURCE = readFileSync(
    join(process.cwd(), "src", "app", "api", "zeptomail", "webhook", "route.ts"),
    "utf8",
  );

  it("🔴 la route APPELLE `noterAppelWebhook()`", () => {
    expect(
      /void\s+noterAppelWebhook\s*\(/.test(SOURCE),
      "La route n'appelle plus `noterAppelWebhook()`. Le module reste correct " +
        "et ses tests verts, mais plus rien n'écrit la date du dernier appel : " +
        "`verifierSanteEmails()` affichera `JAMAIS` à jamais, sans qu'aucun " +
        "test ne rougisse. C'est arrivé le 2026-09-01, par un commit bâti sur " +
        "une copie périmée de ce fichier.",
    ).toBe(true);
  });

  it("l'appel est placé APRÈS la vérification de signature", () => {
    // Avant, n'importe quel POST public ferait battre le compteur — l'instrument
    // perdrait son sens, puisqu'il est censé prouver un abonnement AUTHENTIFIÉ.
    const iSignature = SOURCE.indexOf("invalid_signature");
    const iBattement = SOURCE.indexOf("noterAppelWebhook()");
    expect(iSignature, "marqueur de signature introuvable").toBeGreaterThan(0);
    expect(
      iBattement,
      "Le battement doit suivre la vérification de signature : sinon n'importe " +
        "quel appel non authentifié ferait battre le compteur, et celui-ci ne " +
        "prouverait plus l'abonnement ZeptoMail.",
    ).toBeGreaterThan(iSignature);
  });
});
