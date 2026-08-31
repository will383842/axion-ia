// L'effacement des rendez-vous survit-il au cron d'enrichissement ?
//
// ## Le piège que ce fichier verrouille
//
// Mesuré le 2026-08-28. C'est le défaut le plus sournois de tout le chantier
// RGPD, parce qu'il est INVISIBLE à la lecture de la fonction d'effacement :
// celle-ci est correcte, et son résultat est quand même annulé.
//
//   1. `eraseCalendlyEventsForEmail` anonymise les colonnes. ✅
//   2. `enrichCalendlyEvent` ne réécrit PAS un champ déjà rempli — `setIfEmpty`
//      n'écrit que sur `null`. Les colonnes anonymisées survivent donc. ✅
//   3. Mais `enrich` **remplace `rawPayload` en entier** à chaque passage, et le
//      nom, l'adresse et le téléphone reviennent de Calendly, EN CLAIR. ❌
//   4. Le cron `refresh` repasse toutes les 10 minutes sur toute ligne encore
//      `scheduled`. ❌
//   5. Et `rawPayload` est volontairement absent du journal des champs modifiés :
//      le retour de la donnée ne produit **ni trace, ni alerte**. ❌
//
// Une anonymisation qui ne traiterait que les colonnes serait donc défaite en
// dix minutes, en silence — et la personne aurait reçu une confirmation
// d'effacement. C'est exactement le motif que ce dépôt corrige depuis cinq
// occurrences : quelque chose est écrit, personne ne l'exécute.
//
// ## Deux verrous, et il en faut DEUX
//
//   · l'effacement écrase `rawPayload` et pose le nom anonymisé ;
//   · `refresh` EXCLUT les lignes qui portent ce nom.
//
// Retirer l'un ou l'autre rouvre le défaut. Les deux cas ci-dessous les
// éprouvent séparément — un seul test global resterait vert si l'un des deux
// revenait, tant que l'autre tient.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { join } from "node:path";

const updateMany = vi.fn();
const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    calendlyEvent: { updateMany: (...a: unknown[]) => updateMany(...a) },
    // 🔑 Ajouté le 2026-08-31 avec l'élargissement de l'effacement à la charge
    // brute : `eraseCalendlyEventsForEmail` cherche d'abord les lignes dont le
    // `raw_payload` contient l'adresse, parce qu'une réservation non enrichie a
    // `inviteeEmail` à NULL (1 ligne sur 15 en production) et échappait alors à
    // l'effacement ET à l'export. Le mock rend une liste vide : ces tests-ci
    // portent sur la NEUTRALISATION des champs, pas sur la sélection des lignes.
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
  },
}));

vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "hash" }));

beforeEach(() => {
  vi.clearAllMocks();
  updateMany.mockResolvedValue({ count: 1 });
  queryRaw.mockResolvedValue([]);
});

/** Lit un fichier de production, en rougissant si la cible a déménagé. */
function source(relatif: string): string {
  const chemin = join(process.cwd(), relatif);
  if (!existsSync(chemin)) {
    throw new Error(
      `Garde inopérante : ${chemin} est introuvable. Le module a déménagé — ` +
        `corrige CE chemin plutôt que de supprimer le test, sinon l'effacement ` +
        `peut redevenir réversible sans que rien ne le dise.`,
    );
  }
  return readFileSync(chemin, "utf8");
}

describe("verrou 1 — l'effacement neutralise la charge brute", () => {
  it("écrase rawPayload dans la MÊME instruction que les colonnes", async () => {
    const { eraseCalendlyEventsForEmail } = await import("../rgpd-erase");
    await eraseCalendlyEventsForEmail("temoin@example.invalid");

    expect(updateMany).toHaveBeenCalledOnce();
    const appel = updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };

    // 🔑 UNE SEULE instruction, donc atomique. En deux temps, un passage de
    // `refresh` glissé entre les deux réécrirait la charge brute — et la fenêtre
    // serait d'autant plus large que la base est lente.
    expect(
      appel.data["rawPayload"],
      "sans écrasement de rawPayload, le nom, l'adresse et le téléphone y restent en clair",
    ).toBeDefined();

    const brut = appel.data["rawPayload"] as Record<string, unknown>;
    expect(Object.keys(brut)).toEqual(["_erasedAt"]);
    // Rien d'autre ne doit survivre — pas même `_ipHash`, qui est une empreinte
    // de l'adresse IP de la personne, donc une donnée dérivée d'elle.
    expect(brut["invitee"]).toBeUndefined();
    expect(brut["event"]).toBeUndefined();
    expect(brut["_ipHash"]).toBeUndefined();
  });

  it("neutralise les liens d'annulation, qui sont des URL-capacités", async () => {
    const { eraseCalendlyEventsForEmail } = await import("../rgpd-erase");
    await eraseCalendlyEventsForEmail("temoin@example.invalid");
    const d = (updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;

    // Les copier suffit pour annuler ou déplacer le rendez-vous, sans aucune
    // authentification. Les laisser après un effacement laisserait un pouvoir
    // d'agir sur une personne qui a demandé à disparaître.
    expect(d["cancelUrl"]).toBeNull();
    expect(d["rescheduleUrl"]).toBeNull();
    expect(d["inviteePhone"]).toBeNull();
    expect(d["notes"]).toBeNull();
  });

  it("CONSERVE eventUri — sans lui la ligne serait recréée en clair", async () => {
    const { eraseCalendlyEventsForEmail } = await import("../rgpd-erase");
    await eraseCalendlyEventsForEmail("temoin@example.invalid");
    const d = (updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;

    // 🔴 CONTRE-TÉMOIN. `discoverNewCalendlyEvents` dédoublonne sur `eventUri` et
    // balaie [-2 h, +60 j]. Le neutraliser ferait revenir la réservation au
    // passage suivant, avec les données reprises chez Calendly — l'effacement
    // s'annulerait tout seul, dans la minute.
    expect(
      "eventUri" in d,
      "eventUri est notre clé de dédoublonnage : l'effacer fait recréer la ligne en clair",
    ).toBe(false);
  });
});

describe("verrou 2 — le cron laisse les lignes effacées tranquilles", () => {
  it("refresh exclut les lignes portant le nom anonymisé", async () => {
    // Éprouvé sur la SOURCE et non par exécution : `refreshUpcomingCalendlyEvents`
    // exige un jeton, un client Prisma complet et le réseau. Ce qui doit être
    // verrouillé ici est la clause `where`, et elle est lisible.
    const s = source("src/server/calendly/refresh.ts");

    expect(
      s.includes("ERASED_PLACEHOLDER"),
      "refresh n'exclut plus les lignes effacées : le cron va réécrire leur charge brute " +
        "avec les données reprises chez Calendly, en clair, et sans aucune trace",
    ).toBe(true);
    // Importé et non recopié : si quelqu'un change le placeholder dans la chaîne
    // d'effacement, ce filtre doit suivre.
    expect(s).toMatch(/import\s*\{[^}]*ERASED_PLACEHOLDER[^}]*\}\s*from\s*"@\/lib\/rgpd-erase"/);
  });

  it("le placeholder est exporté — sinon le filtre serait une recopie", () => {
    const s = source("src/lib/rgpd-erase.ts");
    expect(s).toContain("export const ERASED_PLACEHOLDER");
  });
});

describe("la personne est informée de ce qui a été effacé", () => {
  it("le courriel de confirmation ÉNUMÈRE les rendez-vous", () => {
    // La doctrine de ce dépôt, écrite trois fois dans ces fichiers : « une liste
    // qui se donne pour exhaustive et qui omet X est pire qu'une absence de
    // liste ». Le gabarit énumère ; il doit énumérer juste.
    const s = source("src/lib/email/templates/rgpd-effacement-confirme.tsx");
    expect(s).toContain("appels: number");
    expect(s).toMatch(/rendez-vous anonymisé/);

    const route = source("src/app/api/gdpr-erase/route.ts");
    expect(route).toContain("eraseCalendlyEventsForEmail");
    expect(route).toContain("appels: appelsResult.anonymized");
  });

  it("l'export art. 15 rend les rendez-vous", () => {
    const s = source("src/app/api/gdpr-export/route.ts");
    expect(s).toContain("rendezVous");
    // Les réponses libres ne vivent QUE dans la charge brute : les omettre
    // reviendrait à taire ce que la personne a elle-même écrit.
    expect(s).toContain("extractAnswersText");
  });
});
