/**
 * Lot 1ter — « produire ≠ remettre ».
 *
 * Le critère du plan, mot pour mot : *« une pièce générée d'avance n'est visible
 * du bénéficiaire qu'au moment où elle le concerne ; l'organisme, lui, la voit
 * toujours »*.
 *
 * 🔴 Le test qui compte le plus est celui d'EXHAUSTIVITÉ : tout type de
 * `DocumentType` doit avoir un jalon déclaré. Sans lui, ajouter un type à
 * l'enum le ferait retomber sur le défaut — et un défaut silencieux sur
 * « qu'est-ce que le stagiaire voit » n'est pas rattrapable.
 */

import { describe, expect, it } from "vitest";
import { DocumentType } from "../../../../prisma/generated/client";
import {
  TYPES_AVEC_JALON,
  TYPES_REMIS_AU_BENEFICIAIRE,
  jalonPour,
  pieceEstRemise,
  type MomentPiece,
} from "./piece-remise";
import { TYPES_PIECES_ESPACE_STAGIAIRE } from "./portail-service";

const d = (iso: string): Date => new Date(iso);

const DEBUT = d("2026-09-10T09:00:00.000Z");
const FIN = d("2026-09-11T17:00:00.000Z");

function piece(type: string, patch: Partial<MomentPiece> = {}): MomentPiece {
  return {
    type,
    sessionDateDebut: DEBUT,
    sessionDateFin: FIN,
    sessionStatut: "planifiee",
    ...patch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 aucun type de pièce ne se retrouve à l'écran par accident", () => {
  it.each(Object.values(DocumentType))("%s a un jalon DÉCLARÉ", (type) => {
    // Ajouter un type à l'enum sans l'inscrire dans la table le ferait
    // retomber sur le défaut. Ce test rougit avant, sur la machine de celui
    // qui ajoute le type.
    expect(
      TYPES_AVEC_JALON,
      `Le type « ${type} » n'a pas de jalon de remise : il retombe sur « jamais ». ` +
        `Décider, puis l'écrire — l'oubli ne doit pas être le réglage.`,
    ).toContain(type);
  });

  it("le défaut est « jamais », pas « immédiat »", () => {
    // 🔴 Ne rien montrer se corrige. Montrer au stagiaire une pièce qu'il ne
    // devait pas voir ne se rattrape pas.
    expect(jalonPour("un_type_qui_nexiste_pas")).toBe("jamais");
    expect(pieceEstRemise(piece("un_type_qui_nexiste_pas"), DEBUT)).toBe(false);
  });

  it("ne se laisse pas berner par une clé héritée d'Object.prototype", () => {
    expect(jalonPour("constructor")).toBe("jamais");
    expect(jalonPour("toString")).toBe("jamais");
  });
});

describe("🔴 les pièces organisme ↔ financeur ne sortent JAMAIS", () => {
  it.each([
    "facture",
    "avoir",
    "devis",
    "kit_opco",
    "kit_cpf",
    "kit_france_travail",
    "lettre_mission",
  ])("%s reste invisible du bénéficiaire", (type) => {
    // Elles portent des montants, des barèmes et des conditions qui ne
    // concernent pas la personne formée.
    expect(pieceEstRemise(piece(type), d("2027-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("… même sans date de session", () => {
    // 🔴 L'exception au « sans date, on remet » : une facture reste invisible,
    // session datée ou non.
    expect(
      pieceEstRemise(
        piece("facture", { sessionDateDebut: null, sessionDateFin: null, sessionStatut: null }),
        DEBUT,
      ),
    ).toBe(false);
  });
});

describe("🔴 la feuille d'émargement n'apparaît pas trois semaines à l'avance", () => {
  it("invisible avant le premier jour", () => {
    // C'est LE cas que la génération automatique du Lot 1ter va créer : six
    // pièces produites à la création de la session. Sans cette règle, le
    // stagiaire verrait sa feuille d'émargement dès l'inscription — un geste
    // qu'il ne peut pas poser, sur une page qui lui demande d'agir.
    expect(pieceEstRemise(piece("emargement"), d("2026-08-20T09:00:00.000Z"))).toBe(false);
  });

  it("visible à partir du premier jour, à la seconde", () => {
    expect(pieceEstRemise(piece("emargement"), DEBUT)).toBe(true);
  });

  it("visible pendant et après", () => {
    expect(pieceEstRemise(piece("emargement", { sessionStatut: "en_cours" }), FIN)).toBe(true);
  });
});

describe("🔴 les pièces d'après-séance attendent la séance", () => {
  it.each(["attestation", "certificat_realisation", "grille_evaluation", "releve_connexion"])(
    "%s est invisible avant la fin",
    (type) => {
      expect(pieceEstRemise(piece(type), d("2026-09-10T12:00:00.000Z"))).toBe(false);
    },
  );

  it("visible après la fin", () => {
    expect(pieceEstRemise(piece("attestation"), d("2026-09-12T09:00:00.000Z"))).toBe(true);
  });

  it("🔴 le STATUT prime sur l'horloge : une session close en avance libère les pièces", () => {
    // Sans cette règle, une session terminée plus tôt que prévu retiendrait
    // l'attestation jusqu'à la date théorique — le stagiaire attendrait un
    // document déjà dû.
    expect(
      pieceEstRemise(
        piece("attestation", { sessionStatut: "realisee" }),
        d("2026-09-10T12:00:00Z"),
      ),
    ).toBe(true);
  });
});

describe("🔴 les pièces qui PRÉPARENT sortent tout de suite", () => {
  it.each(["programme", "reglement_interieur", "livret_accueil", "convocation"])(
    "%s est visible dès qu'elle existe",
    (type) => {
      // Les cacher jusqu'au jour J priverait le stagiaire de ce qui lui permet
      // d'arriver informé — c'est l'obligation d'information (ind. 9).
      expect(pieceEstRemise(piece(type), d("2026-08-01T09:00:00.000Z"))).toBe(true);
    },
  );

  it("la convention aussi : on doit pouvoir relire ce qu'on signe", () => {
    expect(pieceEstRemise(piece("convention"), d("2026-08-01T09:00:00.000Z"))).toBe(true);
  });
});

describe("🔴 session annulée ou reportée : plus rien n'est demandé au bénéficiaire", () => {
  it.each(["annulee", "reportee"])("statut %s → aucune pièce remise", (statut) => {
    for (const type of ["programme", "emargement", "attestation", "convention"]) {
      expect(
        pieceEstRemise(piece(type, { sessionStatut: statut }), d("2026-09-20T09:00:00.000Z")),
        `« ${type} » reste visible sur une session ${statut}`,
      ).toBe(false);
    }
  });
});

describe("🔴 un trou de donnée ne doit pas faire disparaître une pièce", () => {
  it("sans date de session, on REMET", () => {
    // Même choix que `questionnaire-moment.ts`. Masquer « faute de savoir »
    // transformerait un trou de données en document jamais remis — et personne
    // ne s'en apercevrait, puisque rien ne s'afficherait.
    const sansDate = { sessionDateDebut: null, sessionDateFin: null, sessionStatut: null };
    expect(pieceEstRemise(piece("emargement", sansDate), DEBUT)).toBe(true);
    expect(pieceEstRemise(piece("attestation", sansDate), DEBUT)).toBe(true);
  });

  it("sans date de FIN, on retombe sur la date de début", () => {
    expect(
      pieceEstRemise(piece("attestation", { sessionDateFin: null }), d("2026-09-10T10:00:00.000Z")),
    ).toBe(true);
    expect(
      pieceEstRemise(piece("attestation", { sessionDateFin: null }), d("2026-09-09T10:00:00.000Z")),
    ).toBe(false);
  });
});

describe("🔴 la vue du portail ne peut pas déborder de l'autorité", () => {
  it("chaque type remonté par l'espace stagiaire a un jalon ≠ jamais", () => {
    // 🔴 Le portail porte SA liste de types dans sa requête — c'est légitime,
    // elle exclut les attestations qui ont déjà leur bloc et seraient sinon
    // affichées deux fois. Mais deux listes de « ce que le stagiaire voit »
    // divergent : le jour où l'une gagne une pièce interne, elle s'afficherait
    // sans que la seconde ne dise rien.
    //
    // La relation est donc figée ici : la VUE peut être plus étroite que
    // l'AUTORITÉ, jamais plus large.
    for (const type of TYPES_PIECES_ESPACE_STAGIAIRE) {
      expect(
        TYPES_REMIS_AU_BENEFICIAIRE,
        `L'espace stagiaire remonte « ${type} », dont le jalon est « jamais ». ` +
          `Soit la pièce ne doit pas y être, soit la table de jalons a tort — ` +
          `mais les deux ne peuvent pas se contredire.`,
      ).toContain(type);
    }
  });

  it("l'autorité ne se réduit pas à la vue — elle est plus large", () => {
    // Si les deux devenaient identiques, la table de jalons cesserait de servir
    // à autre chose qu'à recopier la requête, et le test ci-dessus ne
    // garderait plus rien.
    expect(TYPES_REMIS_AU_BENEFICIAIRE.length).toBeGreaterThan(
      TYPES_PIECES_ESPACE_STAGIAIRE.length,
    );
  });
});
