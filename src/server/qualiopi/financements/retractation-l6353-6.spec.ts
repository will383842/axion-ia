/**
 * Art. L6353-6 (1) — aucune somme exigée ni versée avant le délai de rétractation.
 *
 * ## Le défaut que ce fichier verrouille
 *
 * L'article pose TROIS obligations cumulatives. Le dépôt n'en appliquait qu'une
 * — le plafond de 30 %. Le point (1), le délai de dix jours, était **calculé et
 * jamais lu** : `encaissableAPartirDu` n'était consommé nulle part dans `src/`,
 * et `calculerAcompte()` n'était appelé nulle part hors de ses propres tests.
 *
 * 🔴 C'est la pire forme de non-conformité : pas une absence de contrôle, mais un
 * contrôle en TROMPE-L'ŒIL. Le contrat de formation annonçait au particulier une
 * date d'encaissement que rien, côté serveur, n'appliquait. À la lecture du code
 * on croyait la règle implémentée ; à l'exécution, rien n'empêchait de facturer
 * un particulier le jour même de son acceptation.
 */

import { describe, it, expect } from "vitest";
import {
  DELAI_RETRACTATION_PARTICULIER_JOURS,
  dateEncaissablePartir,
  encaissementAutorise,
  dateEngagementParticulier,
} from "./acompte";

const JOUR_MS = 24 * 60 * 60 * 1000;
const ACCEPTE = new Date("2026-03-01T10:00:00.000Z");

describe("dateEncaissablePartir", () => {
  it("ajoute exactement les dix jours de l'article L6353-5", () => {
    expect(DELAI_RETRACTATION_PARTICULIER_JOURS).toBe(10);
    expect(dateEncaissablePartir(ACCEPTE).toISOString()).toBe("2026-03-11T10:00:00.000Z");
  });

  it("ne mute pas la date d'entrée", () => {
    const avant = ACCEPTE.getTime();
    dateEncaissablePartir(ACCEPTE);
    expect(ACCEPTE.getTime()).toBe(avant);
  });
});

describe("encaissementAutorise", () => {
  it("REFUSE le jour même de l'acceptation", () => {
    // Le cas nominal du défaut : rien n'empêchait cette facture.
    expect(encaissementAutorise(ACCEPTE, ACCEPTE)).toBe(false);
  });

  it("REFUSE la veille de l'expiration", () => {
    const veille = new Date(ACCEPTE.getTime() + 9 * JOUR_MS);
    expect(encaissementAutorise(ACCEPTE, veille)).toBe(false);
  });

  it("REFUSE une milliseconde avant le terme", () => {
    const presque = new Date(dateEncaissablePartir(ACCEPTE).getTime() - 1);
    expect(encaissementAutorise(ACCEPTE, presque)).toBe(false);
  });

  it("AUTORISE pile au terme", () => {
    // La borne est inclusive : le délai est « expiré » à l'instant exact.
    expect(encaissementAutorise(ACCEPTE, dateEncaissablePartir(ACCEPTE))).toBe(true);
  });

  it("AUTORISE après le terme", () => {
    const apres = new Date(ACCEPTE.getTime() + 11 * JOUR_MS);
    expect(encaissementAutorise(ACCEPTE, apres)).toBe(true);
  });

  it("🔴 REFUSE quand la date d'engagement est absente", () => {
    // Le point le plus important du fichier. Sans date, le délai est
    // INCALCULABLE : autoriser « faute de savoir » ferait de l'absence de donnée
    // un laissez-passer, précisément dans le cas où l'on ne peut rien prouver
    // devant un contrôle. Le refus est la seule réponse défendable.
    expect(encaissementAutorise(null, new Date("2030-01-01"))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Depuis QUELLE date court le délai — art. L6353-5
// ─────────────────────────────────────────────────────────────────────────────

const SIGNE_CONTRAT = new Date("2026-03-05T09:00:00.000Z");
const CONTRESIGNE = new Date("2026-03-06T16:30:00.000Z");

describe("dateEngagementParticulier", () => {
  it("retient la signature du contrat, PAS l'acceptation du devis", () => {
    // Le cœur du correctif. L6353-5 fait courir les dix jours à compter de la
    // conclusion du CONTRAT ; l'acceptation d'un devis n'existe nulle part dans
    // le code du travail. Tant que le garde-fou lisait `acceptedAt`, il
    // appliquait une règle légale à un intrant que la loi ne mentionne pas.
    const r = dateEngagementParticulier({
      signaturesContrat: [{ signeAt: SIGNE_CONTRAT, revokedAt: null }],
      devisAcceptedAt: ACCEPTE,
    });
    expect(r.source).toBe("signature_contrat");
    expect(r.date?.toISOString()).toBe(SIGNE_CONTRAT.toISOString());
  });

  it("🔴 retient la DERNIÈRE signature : le contrat n'est conclu qu'à la contresignature", () => {
    // Le circuit `contrat` déclare ["beneficiaire", "axionia"]. Retenir la
    // signature du bénéficiaire ferait partir le délai plus TÔT, donc expirer la
    // protection plus tôt. Entre deux lectures défendables, on prend la plus
    // protectrice — et c'est aussi la lecture littérale de « conclusion du
    // contrat » : un contrat bilatéral n'est conclu qu'à la dernière signature.
    const r = dateEngagementParticulier({
      signaturesContrat: [
        { signeAt: SIGNE_CONTRAT, revokedAt: null },
        { signeAt: CONTRESIGNE, revokedAt: null },
      ],
      devisAcceptedAt: ACCEPTE,
    });
    expect(r.date?.toISOString()).toBe(CONTRESIGNE.toISOString());
  });

  it("est indifférente à l'ordre de lecture des lignes", () => {
    // La requête Prisma n'ordonne rien : si le résultat dépendait de l'ordre
    // rendu par la base, la date d'encaissement changerait d'un appel à l'autre.
    const r = dateEngagementParticulier({
      signaturesContrat: [
        { signeAt: CONTRESIGNE, revokedAt: null },
        { signeAt: SIGNE_CONTRAT, revokedAt: null },
      ],
      devisAcceptedAt: null,
    });
    expect(r.date?.toISOString()).toBe(CONTRESIGNE.toISOString());
  });

  it("🔴 IGNORE une signature révoquée", () => {
    // Une preuve retirée du dossier ne fait courir aucune protection légale.
    // Sinon, une vieille signature révoquée ferait expirer le délai bien avant
    // la signature valable qui l'a remplacée — révoquer raccourcirait
    // rétroactivement une protection.
    const r = dateEngagementParticulier({
      signaturesContrat: [
        { signeAt: new Date("2026-01-02T08:00:00.000Z"), revokedAt: new Date("2026-03-04") },
        { signeAt: SIGNE_CONTRAT, revokedAt: null },
      ],
      devisAcceptedAt: null,
    });
    expect(r.source).toBe("signature_contrat");
    expect(r.date?.toISOString()).toBe(SIGNE_CONTRAT.toISOString());
  });

  it("REPLI sur l'acceptation du devis quand TOUTES les signatures sont révoquées", () => {
    const r = dateEngagementParticulier({
      signaturesContrat: [{ signeAt: SIGNE_CONTRAT, revokedAt: new Date("2026-03-07") }],
      devisAcceptedAt: ACCEPTE,
    });
    expect(r.source).toBe("acceptation_devis");
    expect(r.date?.toISOString()).toBe(ACCEPTE.toISOString());
  });

  it("REPLI sur l'acceptation du devis quand aucun contrat n'est signé", () => {
    // Sans ce repli, le correctif bloquerait d'un coup toute la facturation des
    // particuliers antérieurs au registre de signatures. Avec lui, ces dossiers
    // gardent EXACTEMENT le comportement d'avant.
    const r = dateEngagementParticulier({ signaturesContrat: [], devisAcceptedAt: ACCEPTE });
    expect(r.source).toBe("acceptation_devis");
    expect(r.date?.toISOString()).toBe(ACCEPTE.toISOString());
  });

  it("🔴 ni signature ni acceptation ⇒ AUCUNE date, donc REFUS", () => {
    const r = dateEngagementParticulier({ signaturesContrat: [], devisAcceptedAt: null });
    expect(r.source).toBe("aucune");
    expect(r.date).toBeNull();
    expect(encaissementAutorise(r.date, new Date("2099-01-01"))).toBe(false);
  });

  it("🔴 une date de signature illisible REFUSE, elle ne retombe pas sur le repli", () => {
    // Basculer sur `acceptedAt` choisirait une date antérieure, donc plus
    // permissive, sur la foi d'une donnée corrompue.
    const r = dateEngagementParticulier({
      signaturesContrat: [{ signeAt: new Date("pas-une-date"), revokedAt: null }],
      devisAcceptedAt: new Date("2020-01-01"),
    });
    expect(r.source).toBe("signature_contrat");
    expect(r.date).toBeNull();
    expect(encaissementAutorise(r.date, new Date("2099-01-01"))).toBe(false);
  });

  it("ne mute aucune entrée", () => {
    const sig = { signeAt: SIGNE_CONTRAT, revokedAt: null };
    const avant = SIGNE_CONTRAT.getTime();
    dateEngagementParticulier({ signaturesContrat: [sig], devisAcceptedAt: ACCEPTE });
    expect(SIGNE_CONTRAT.getTime()).toBe(avant);
    expect(sig.revokedAt).toBeNull();
  });
});

describe("le garde-fou est AU SERVEUR, et il est branché", () => {
  // Test de PROPRIÉTÉ. Le défaut d'origine n'était pas un mauvais calcul : le
  // calcul était juste. Il n'était appelé par personne. Un test de comportement
  // sur la fonction pure serait donc passé au vert pendant que la production
  // facturait sans contrôle — c'est exactement ce qui s'est produit.
  it("`encaissementAutorise` est appelé par le hub de facturation", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src", "server", "actions", "qualiopi", "facturation-hub.ts"),
      "utf8",
    );
    expect(source).toMatch(/encaissementAutorise\s*\(/);
    // Le garde-fou lit une date qui doit être dans le `select` Prisma : sans
    // elle, il lirait `undefined` et laisserait passer TOUTES les factures.
    expect(source).toMatch(/acceptedAt: true/);
  });

  it("la date d'engagement est DÉRIVÉE, pas relue directement de `acceptedAt`", async () => {
    // Même nature de test, et pour la même raison : la fonction de sélection
    // peut être parfaitement juste sans que personne l'appelle. Le hub doit
    // passer par elle, et interroger réellement le registre de signatures —
    // sans la requête, elle recevrait toujours une liste vide et retomberait
    // silencieusement sur le repli `acceptedAt`, c'est-à-dire sur le défaut.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src", "server", "actions", "qualiopi", "facturation-hub.ts"),
      "utf8",
    );
    expect(source).toMatch(/dateEngagementParticulier\s*\(/);
    expect(source).toMatch(/prisma\.documentSignature\.findMany/);
    expect(source).toMatch(/type: "contrat"/);
  });
});
