/**
 * REQ-INT-003 (enveloppe), REQ-ARG-002 (idempotence), REQ-SEC-010 / REQ-QA-008
 * (signature), et l'INERTIE sans `PARTNERS_SYNC_ENABLED`.
 *
 * Les motifs de validation ne sont pas retapés ici : ils sont LUS dans la copie du
 * JSON Schema publié par Partners. Un test qui recopie le motif qu'il vérifie ne
 * vérifie que sa propre copie.
 */
import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cheminContratPublie } from "../contrat/empreinte";
import { estPartnersSyncActif, secretPartners } from "../config";
import { enveloppe, horodatageSignature, identifiantEvenement, signerCorps } from "../enveloppe";

const PUBLIE = JSON.parse(readFileSync(cheminContratPublie(), "utf8")) as {
  required: string[];
  additionalProperties: boolean;
  properties: Record<string, { pattern?: string; const?: number }>;
};

const MOTIF_UUID = new RegExp(PUBLIE.properties.event_id?.pattern ?? "(?!)");
const MOTIF_INSTANT = new RegExp(PUBLIE.properties.occurred_at?.pattern ?? "(?!)");

const FAIT = {
  type: "paiement.recu" as const,
  cleDeFait: "payment:3f2b1c40-0000-4000-8000-000000000001",
  occurredAt: new Date("2026-09-05T08:00:00.000Z"),
  sujet: { kind: "payment", id: "3f2b1c40-0000-4000-8000-000000000001" },
  payload: { paymentId: "3f2b1c40-0000-4000-8000-000000000001" },
  sequence: 1,
};

describe("INERTIE — rien ne part sans `PARTNERS_SYNC_ENABLED`", () => {
  const avant = { ...process.env };
  beforeEach(() => {
    delete process.env.PARTNERS_SYNC_ENABLED;
    delete process.env.PARTNERS_SYNC_SECRET;
  });
  afterEach(() => {
    process.env = { ...avant };
  });

  it("le drapeau ABSENT ⇒ inactif", () => {
    expect(estPartnersSyncActif()).toBe(false);
  });

  it("le drapeau à « 1 », « yes », « TRUE » ⇒ TOUJOURS inactif : seul « true » exact ouvre", () => {
    // Une comparaison laxiste est la façon la plus banale d'ouvrir une vanne qu'on
    // croyait fermée. Le drapeau maître de `crm-sync` suit exactement cette règle.
    for (const valeur of ["1", "yes", "TRUE", "True", " true", "true "]) {
      process.env.PARTNERS_SYNC_ENABLED = valeur;
      expect(estPartnersSyncActif()).toBe(false);
    }
  });

  it("« true » exact ⇒ actif", () => {
    process.env.PARTNERS_SYNC_ENABLED = "true";
    expect(estPartnersSyncActif()).toBe(true);
  });

  it("le drapeau est relu à CHAQUE appel, jamais figé au chargement du module", () => {
    // 🔑 Un drapeau capturé au chargement est inchangeable sans redémarrage — et
    // surtout, il rend le test précédent impossible à écrire honnêtement.
    process.env.PARTNERS_SYNC_ENABLED = "true";
    expect(estPartnersSyncActif()).toBe(true);
    process.env.PARTNERS_SYNC_ENABLED = "false";
    expect(estPartnersSyncActif()).toBe(false);
  });

  it("le secret absent rend null — jamais une chaîne vide qui signerait quand même", () => {
    expect(secretPartners()).toBeNull();
    process.env.PARTNERS_SYNC_SECRET = "   ";
    expect(secretPartners()).toBeNull();
  });
});

describe("REQ-INT-003 — l'enveloppe est celle du schéma publié", () => {
  it("porte EXACTEMENT les neuf champs requis, ni un de plus ni un de moins", () => {
    // `additionalProperties: false` à la racine : un champ de plus vaut 422, donc
    // `gave_up`. L'égalité de l'ensemble est la seule assertion qui l'attrape.
    expect(PUBLIE.additionalProperties).toBe(false);
    expect(Object.keys(enveloppe(FAIT)).sort()).toEqual([...PUBLIE.required].sort());
  });

  it("`event_id` respecte le motif UUID v4 du schéma publié", () => {
    expect(enveloppe(FAIT).event_id).toMatch(MOTIF_UUID);
  });

  it("`occurred_at` et `emitted_at` portent un fuseau explicite", () => {
    const e = enveloppe(FAIT);
    expect(e.occurred_at).toMatch(MOTIF_INSTANT);
    expect(e.emitted_at).toMatch(MOTIF_INSTANT);
  });

  it("`occurred_at` est l'instant du FAIT, pas celui de l'émission", () => {
    expect(enveloppe(FAIT).occurred_at).toBe("2026-09-05T08:00:00.000Z");
  });

  it("`schema_version` est celui du schéma publié", () => {
    expect(enveloppe(FAIT).schema_version).toBe(PUBLIE.properties.schema_version?.const);
  });

  it("REFUSE un type hors du contrat v1 — `candidature.recue` ne s'émet pas en v1", () => {
    // Le consommateur v1 rend 422 sur tout `event_type` hors énumération. Émettre
    // serait fabriquer un `gave_up` : autant s'arrêter ici, bruyamment.
    expect(() => enveloppe({ ...FAIT, type: "candidature.recue" as never })).toThrow(/contrat v1/i);
  });
});

describe("REQ-ARG-002 — l'idempotence tient à un `event_id` DÉTERMINISTE", () => {
  it("le même fait rend le même `event_id`, deux fois de suite", () => {
    // 🔑 C'est l'assertion qui porte l'exigence. Un `randomUUID()` par appel ferait
    // de chaque rejeu un événement NEUF : le récepteur ne pourrait plus dédoublonner
    // sur `event_id`, et REQ-ARG-002 serait inapplicable côté producteur.
    expect(identifiantEvenement("paiement.recu", FAIT.cleDeFait)).toBe(
      identifiantEvenement("paiement.recu", FAIT.cleDeFait),
    );
  });

  it("deux faits différents rendent deux `event_id` différents", () => {
    expect(identifiantEvenement("paiement.recu", "payment:A")).not.toBe(
      identifiantEvenement("paiement.recu", "payment:B"),
    );
  });

  it("le même sujet sous DEUX types rend deux `event_id` différents", () => {
    expect(identifiantEvenement("paiement.recu", "x")).not.toBe(
      identifiantEvenement("paiement.rembourse", "x"),
    );
  });

  it("l'identifiant déterministe respecte quand même le motif UUID v4 du contrat", () => {
    // ⚠️ Le piège : un UUID v5 (le déterministe normalisé) porte un « 5 » comme
    // chiffre de version et serait REFUSÉ par le motif publié, qui exige un « 4 ».
    for (const cle of ["a", "b", "c", "payment:42", "facture:zzz", "…é@#"]) {
      expect(identifiantEvenement("paiement.recu", cle)).toMatch(MOTIF_UUID);
    }
  });
});

describe("REQ-SEC-010 / REQ-QA-008 — la signature porte « t.corps exact »", () => {
  it("signe l'horodatage ET le corps, jointes par un point", () => {
    const attendu = signerCorps("secret", "1757059200", '{"a":1}');
    expect(attendu).toMatch(/^[0-9a-f]{64}$/);
    expect(signerCorps("secret", "1757059200", '{"a":1}')).toBe(attendu);
  });

  it("un horodatage différent change la signature — sinon la requête serait rejouable à vie", () => {
    expect(signerCorps("secret", "1757059201", '{"a":1}')).not.toBe(
      signerCorps("secret", "1757059200", '{"a":1}'),
    );
  });

  it("un corps différent change la signature", () => {
    expect(signerCorps("secret", "1757059200", '{"a":2}')).not.toBe(
      signerCorps("secret", "1757059200", '{"a":1}'),
    );
  });

  it("🔴 la découpe « t.corps » ne peut pas être DÉPLACÉE : un horodatage à point est REFUSÉ", () => {
    // Ce contre-témoin a d'abord échoué, et il avait raison : `signerCorps` rendait
    // la MÊME signature pour ("1", "23.4") et ("1.23", "4"). Deux messages, une
    // signature. La parade est de rendre l'horodatage non ambigu, pas de changer le
    // séparateur — que le contrat écrit.
    expect(() => signerCorps("s", "1.23", "4")).toThrow(/horodatage/i);
    expect(signerCorps("s", "1", "23.4")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("l'horodatage produit par ce module est TOUJOURS acceptable par la signature", () => {
    // Témoin positif : sans lui, on aurait pu resserrer le motif au point de refuser
    // l'horodatage que le canal produit réellement, et ne le découvrir qu'en prod.
    const t = horodatageSignature(new Date("2026-09-05T08:00:00.000Z"));
    expect(t).toBe("1788595200");
    expect(signerCorps("s", t, "{}")).toMatch(/^[0-9a-f]{64}$/);
  });
});
