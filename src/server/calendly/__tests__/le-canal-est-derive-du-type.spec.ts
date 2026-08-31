// @vitest-environment node

/**
 * Verrou — le canal d'un rendez-vous se dérive du TYPE Calendly, jamais d'une
 * constante, et jamais d'abord de la forme du texte.
 *
 * ## Pourquoi l'ordre de dérivation est la propriété à garder
 *
 * `calendly_events.location` est **librement éditable** depuis la console :
 * `updateCalendlyEventSchema` n'impose qu'une longueur maximale, aucun format.
 * « chez le client », « Teams », « à définir » y sont acceptés. Et `enrich.ts`
 * emploie `setIfEmpty` : une valeur saisie à la main n'est **jamais** écrasée
 * par Calendly ensuite.
 *
 * Un canal déduit d'abord de la forme du texte laisserait donc une faute de
 * frappe décider du contenu d'un e-mail envoyé au prospect. D'où l'ordre : le
 * `type` d'abord, la forme seulement en dernier recours.
 *
 * ## Ce que le contre-témoin protège
 *
 * Rendre `telephone` par défaut ferait passer tous les tests « téléphone » et
 * paraîtrait juste — jusqu'au jour où un rendez-vous en visio annoncerait un
 * appel. Le cas « rien ne tranche » doit donc rendre `inconnu`, et c'est
 * vérifié explicitement.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canalDuRendezVous, LIBELLE_CANAL, INTITULE_FORMAT } from "../canal";

/** Construit un payload de la forme `enrich` (événement sous `event`). */
function payloadEnrich(type: string): unknown {
  return { invitee: {}, event: { location: { type, join_url: "https://exemple.invalid/x" } } };
}

/** Construit un payload de la forme `discover` (événement à la racine). */
function payloadDiscover(type: string): unknown {
  return { uri: "x", location: { type } };
}

describe("le canal se dérive du type Calendly", () => {
  it("reconnaît une visio sur les deux formes de payload", () => {
    expect(canalDuRendezVous(null, payloadEnrich("google_conference"))).toBe("visio");
    expect(canalDuRendezVous(null, payloadDiscover("google_conference"))).toBe("visio");
  });

  it("reconnaît un appel téléphonique — le seul type en production aujourd'hui", () => {
    expect(canalDuRendezVous("+33 1 99 00 12 34", payloadEnrich("outbound_call"))).toBe(
      "telephone",
    );
  });

  it("🔴 le TYPE l'emporte sur la forme du texte", () => {
    // Le cas qui compte : un lieu saisi à la main qui ressemble à un numéro,
    // sur un rendez-vous que Calendly déclare en visio. Se fier au texte
    // annoncerait un appel à quelqu'un qui attend un lien.
    expect(canalDuRendezVous("+33 6 12 34 56 78", payloadEnrich("google_conference"))).toBe(
      "visio",
    );
    // Et réciproquement.
    expect(
      canalDuRendezVous("https://exemple.invalid/reunion", payloadEnrich("outbound_call")),
    ).toBe("telephone");
  });

  it("retombe sur la forme quand le type est inconnu de nous", () => {
    expect(canalDuRendezVous("https://meet.google.com/abc", payloadEnrich("un_type_futur"))).toBe(
      "visio",
    );
    expect(canalDuRendezVous("+33 1 99 00 12 34", payloadEnrich("un_type_futur"))).toBe(
      "telephone",
    );
  });

  it("sans payload du tout, la forme suffit", () => {
    expect(canalDuRendezVous("https://meet.google.com/abc")).toBe("visio");
    expect(canalDuRendezVous("+256 776 870606")).toBe("telephone");
  });

  it("🔑 CONTRE-TÉMOIN : quand rien ne tranche, c'est « inconnu » — jamais un défaut", () => {
    // Les quatre formes réellement rencontrées en base ou saisissables en console.
    expect(canalDuRendezVous(null)).toBe("inconnu");
    expect(canalDuRendezVous("")).toBe("inconnu");
    expect(canalDuRendezVous("   ")).toBe("inconnu");
    expect(canalDuRendezVous("chez le client")).toBe("inconnu");
    // Et avec un payload vide de toute information de lieu.
    expect(canalDuRendezVous("à définir", { event: {} })).toBe("inconnu");
  });

  it("ne lève jamais, quelle que soit la forme du payload", () => {
    for (const p of [
      null,
      undefined,
      42,
      "texte",
      [],
      { event: null },
      { event: { location: 3 } },
    ]) {
      expect(() => canalDuRendezVous(null, p)).not.toThrow();
      expect(canalDuRendezVous(null, p)).toBe("inconnu");
    }
  });
});

describe("les deux listes de types téléphone ne divergent pas", () => {
  it("🔑 tout type « téléphone » connu de l'extraction l'est aussi du canal", () => {
    // 🔑 DÉRIVÉ, pas recopié : on relit la liste de `api.ts` dans le fichier,
    // et on exige que le canal traite chacun de ses types comme un téléphone.
    // Deux listes qui doivent s'accorder ne doivent pas être comparées de tête.
    const src = readFileSync(join(process.cwd(), "src/server/calendly/api.ts"), "utf8");
    const bloc = /const PHONE_LOCATION_TYPES = new Set\(\[([\s\S]*?)\]\)/.exec(src)?.[1];
    expect(
      bloc,
      "PHONE_LOCATION_TYPES introuvable dans api.ts — la garde ne mesure plus rien",
    ).toBeDefined();

    const types = [...(bloc ?? "").matchAll(/"([a-z_]+)"/g)].map((m) => m[1] as string);
    expect(
      types.length,
      "aucun type extrait : le motif de lecture a cessé de mordre",
    ).toBeGreaterThan(0);

    for (const t of types) {
      expect(
        canalDuRendezVous(null, payloadEnrich(t)),
        `api.ts range « ${t} » parmi les téléphones, le canal en fait autre chose`,
      ).toBe("telephone");
    }
  });
});

describe("le vocabulaire d'affichage", () => {
  it("🔑 l'intitulé est « Format », pas « Canal » — ce mot est déjà pris en console", () => {
    // `contacts/page.tsx` emploie déjà « Canal » pour le type de message entrant.
    // Deux sens pour un mot à deux écrans d'intervalle : arbitré par Will.
    expect(INTITULE_FORMAT).toBe("Format");
  });

  it("chaque canal a un libellé lisible, y compris l'inconnu", () => {
    expect(Object.keys(LIBELLE_CANAL).sort()).toEqual(["inconnu", "telephone", "visio"]);
    for (const v of Object.values(LIBELLE_CANAL)) expect(v.trim().length).toBeGreaterThan(0);
  });
});
