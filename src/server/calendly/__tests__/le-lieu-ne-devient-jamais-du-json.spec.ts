// @vitest-environment node

/**
 * Verrou — un lieu que Calendly n'a pas encore résolu vaut `null`, jamais une
 * chaîne JSON.
 *
 * ## Le défaut, et pourquoi il était invisible
 *
 * `extractInviteeData` retombait sur une sérialisation de l'objet quand celui-ci
 * ne portait ni `join_url` ni `location`. L'intention était de « ne rien
 * perdre ». Le résultat était une chaîne comme :
 *
 *     {"type":"google_conference","status":"processing"}
 *
 * posée dans `calendly_events.location`, puis recopiée telle quelle dans
 * l'e-mail du prospect : « Nous nous retrouvons en visioconférence :
 * {"type":"google_conference"…} ».
 *
 * Le cas n'a rien de théorique. **Calendly crée la conférence de façon
 * asynchrone** : entre la réservation et la création du lien, le lieu porte
 * `status: "processing"` sans `join_url`. La capture tombe dans cette fenêtre
 * dès qu'elle est rapide — et elle l'est : le webhook livre en 2 secondes,
 * mesuré le 2026-09-01.
 *
 * Aucun test ne pouvait le voir : jusqu'à cette date, **aucune visioconférence
 * n'avait jamais été réservée**. Les 19 lignes de production étaient toutes des
 * appels téléphoniques, où le lieu est une simple chaîne.
 *
 * ## Pourquoi `null` est la bonne réponse, et pas seulement la moins mauvaise
 *
 * La colonne se remplit par `setIfEmpty`, qui n'écrit que sur `null`. Rendre
 * `null` laisse donc la place, et `refreshUpcomingCalendlyEvents` — qui rappelle
 * `enrich` toutes les 10 minutes sur les rendez-vous à venir — posera le vrai
 * lien dès que Calendly l'aura créé.
 *
 * Une chaîne, fût-elle du JSON, REMPLISSAIT la colonne et interdisait
 * définitivement cette correction. C'est ce qui transformait une gêne passagère
 * en défaut permanent.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CHEMIN = "src/server/calendly/api.ts";

/**
 * Le bloc qui CALCULE le lieu, isolé depuis la source brute.
 *
 * 🔑 ON NE FILTRE PAS LES COMMENTAIRES DU FICHIER ENTIER. Un premier jet le
 * faisait, et le filtre a mangé la quasi-totalité d'`api.ts` : un motif naïf de
 * commentaire de bloc s'accroche à des séquences qui n'en ouvrent aucun. La
 * garde était alors verte en ne mesurant plus rien du tout.
 *
 * L'isolement est plus sûr, et il suffit : entre la déclaration et son
 * point-virgule, il n'y a que du code. La longue note qui EXPLIQUE le défaut est
 * placée au-dessus, donc hors du bloc — elle ne peut pas faire passer la garde
 * par sa seule présence.
 */
const source = readFileSync(join(process.cwd(), CHEMIN), "utf8");
const blocLieu = /const location =[\s\S]*?;\r?\n/.exec(source)?.[0] ?? "";

describe("le lieu d'un rendez-vous ne devient jamais du JSON", () => {
  it("🔑 le bloc qui calcule le lieu est bien lisible", () => {
    // Contre-témoin : si le motif cessait de mordre, le test suivant passerait
    // en ne mesurant rien du tout.
    expect(
      blocLieu.length,
      "le calcul du lieu est introuvable dans api.ts — la garde ne mesure plus rien",
    ).toBeGreaterThan(50);
    expect(blocLieu, "il doit toujours lire `join_url`").toContain("join_url");
  });

  it("🔴 aucune sérialisation ne sert de valeur de repli", () => {
    expect(
      /JSON\.stringify/.test(blocLieu),
      "le repli par sérialisation est revenu. Il pose une chaîne comme " +
        '{"type":"google_conference","status":"processing"} dans la colonne du lieu, ' +
        "qui part telle quelle dans l'e-mail du prospect — et que `setIfEmpty` " +
        "empêche ensuite de corriger, définitivement.",
    ).toBe(false);
  });

  it("🔑 CONTRE-TÉMOIN : le bloc isolé ne contient QUE du code", () => {
    // Si l'isolement débordait sur la note placée au-dessus, la garde
    // deviendrait verte d'avance : cette note écrit le nom de la fonction
    // fautive pour raconter le défaut corrigé.
    expect(blocLieu, "le bloc a débordé sur les commentaires").not.toContain("//");
    expect(blocLieu, "le bloc a débordé sur les commentaires").not.toContain("LE REPLI");
    expect(blocLieu).toContain("locationRaw");
  });
});

describe("ce que produit une charge Calendly réelle", () => {
  /**
   * Reproduit le calcul d'`api.ts` sur des charges observées.
   *
   * ⚠️ On n'exécute pas `extractInviteeData` — elle fait des appels réseau. Ce
   * bloc vérifie donc le COMPORTEMENT attendu, pendant que les tests ci-dessus
   * vérifient que la source ne contient pas le repli fautif. Les deux ensemble
   * couvrent ce qu'aucun des deux ne couvre seul.
   */
  function lieuCalcule(locationRaw: unknown): string | null {
    if (typeof locationRaw === "string") return locationRaw.slice(0, 500);
    if (typeof locationRaw !== "object" || locationRaw === null) return null;
    const o = locationRaw as Record<string, unknown>;
    const url = typeof o["join_url"] === "string" ? o["join_url"] : null;
    const loc = typeof o["location"] === "string" ? o["location"] : null;
    return url ?? loc ?? null;
  }

  it("🔴 une visio dont le lien n'est PAS ENCORE créé rend null", () => {
    // La charge exacte que Calendly renvoie dans la fenêtre asynchrone.
    expect(lieuCalcule({ type: "google_conference", status: "processing" })).toBeNull();
  });

  it("une visio dont le lien EST créé rend le lien", () => {
    // Charge réelle du 2026-09-01, première visio jamais réservée.
    expect(
      lieuCalcule({
        type: "google_conference",
        status: "pushed",
        join_url: "https://calendly.com/events/be44303d/google_meet",
      }),
    ).toBe("https://calendly.com/events/be44303d/google_meet");
  });

  it("un appel téléphonique rend le numéro", () => {
    expect(lieuCalcule({ type: "outbound_call", location: "+33 6 11 22 33 44" })).toBe(
      "+33 6 11 22 33 44",
    );
  });

  it("🔑 la valeur rendue reste vide pour setIfEmpty, donc corrigible", () => {
    // C'est TOUTE la raison de préférer `null` : `setIfEmpty` n'écrit que sur
    // une colonne vide. Une chaîne — fût-elle du JSON — la remplit et gèle
    // définitivement la valeur, alors que `refresh` repasse toutes les 10 min.
    const enAttente = lieuCalcule({ type: "google_conference", status: "processing" });
    expect(enAttente == null, "une valeur non nulle bloquerait la correction ultérieure").toBe(
      true,
    );
  });

  it("ne lève jamais, quelle que soit la forme reçue", () => {
    for (const p of [null, undefined, 42, [], { type: "x" }, { join_url: 3 }]) {
      expect(() => lieuCalcule(p)).not.toThrow();
    }
  });
});
