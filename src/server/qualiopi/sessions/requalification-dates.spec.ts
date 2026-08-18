/**
 * 🔴 Corriger les dates d'une session quand des pièces s'appuient dessus.
 *
 * Défaut : aucune écriture ne permettait de corriger `dateDebut`/`dateFin`. Le
 * seul chemin était « Reporter », qui fabrique une nouvelle session et laisse
 * l'ancienne « Reportée » au registre — un faux report versé au registre légal
 * pour une faute de frappe.
 *
 * Ce spec verrouille la doctrine du dépôt : on n'interdit pas, on refuse le
 * changement SILENCIEUX.
 */

import { describe, expect, it } from "vitest";
import {
  compterJoursHorsPlage,
  memesDates,
  messageRefusDates,
  verdictDates,
  type PlageDates,
  type PreuvesDates,
} from "./requalification-dates";

const PLAGE = (debut: string, fin: string): PlageDates => ({
  dateDebut: new Date(debut).toISOString(),
  dateFin: new Date(fin).toISOString(),
});

const AVANT = PLAGE("2026-09-10T09:00:00Z", "2026-09-11T17:00:00Z");
const APRES = PLAGE("2026-09-12T09:00:00Z", "2026-09-13T17:00:00Z");

const SANS_PREUVE: PreuvesDates = {
  emargementsSignes: 0,
  signatures: 0,
  liensEmargement: 0,
  convocationsEnvoyees: 0,
  documentsEmis: 0,
  creneaux: 0,
};

const TOUTES_PREUVES: PreuvesDates = {
  emargementsSignes: 2,
  signatures: 3,
  liensEmargement: 4,
  convocationsEnvoyees: 5,
  documentsEmis: 6,
  creneaux: 7,
};

describe("🔴 dates INCHANGÉES → JAMAIS de motif", () => {
  it("réenregistrer la même plage n'exige aucun motif, même avec toutes les preuves du monde", () => {
    // 🔴 CONTRE-TEST ESSENTIEL. Une garde qui exige un motif sur un clic sans
    // effet apprend à en inventer un — et un motif inventé au registre est pire
    // qu'un motif absent. C'est aussi le seul test qui distingue une vraie
    // garde d'un `motifRequis = preuves > 0` posé au hasard.
    const v = verdictDates({ avant: AVANT, apres: { ...AVANT }, preuves: TOUTES_PREUVES });
    expect(v.changement).toBe(false);
    expect(v.motifRequis).toBe(false);
    expect(v.enJeu).toEqual([]);
  });

  it("memesDates reconnaît l'identité et le changement", () => {
    expect(memesDates(AVANT, { ...AVANT })).toBe(true);
    expect(memesDates(AVANT, APRES)).toBe(false);
  });

  it("déplacer la seule date de FIN est un changement", () => {
    // La durée facturée et la plage imprimée sur la convention en dépendent :
    // ne regarder que `dateDebut` laisserait passer la moitié des corrections.
    const finDecalee = { dateDebut: AVANT.dateDebut, dateFin: APRES.dateFin };
    expect(memesDates(AVANT, finDecalee)).toBe(false);
    expect(verdictDates({ avant: AVANT, apres: finDecalee, preuves: SANS_PREUVE }).changement).toBe(
      true,
    );
  });

  it("changer l'HEURE de début est un changement", () => {
    // `dateDebut` est un DateTime, pas un jour civil : l'heure part sur la
    // convocation. La traiter comme du détail laisserait passer le cas le plus
    // fréquent — une session avancée d'une matinée.
    const heureAutre = PLAGE("2026-09-10T14:00:00Z", "2026-09-11T17:00:00Z");
    expect(memesDates(AVANT, heureAutre)).toBe(false);
  });
});

describe("🔴 session vierge → on corrige librement", () => {
  it("changer les dates sans aucune pièce n'exige aucun motif", () => {
    // Corriger une coquille ne doit pas devenir une cérémonie. Interdire ici
    // renverrait vers « Reporter », c'est-à-dire vers le défaut lui-même.
    const v = verdictDates({ avant: AVANT, apres: APRES, preuves: SANS_PREUVE });
    expect(v.changement).toBe(true);
    expect(v.motifRequis).toBe(false);
    expect(v.enJeu).toEqual([]);
  });
});

describe("🔴 chaque type de preuve, seul, rend le motif obligatoire ET se nomme", () => {
  const CAS: ReadonlyArray<{ champ: keyof PreuvesDates; attendu: string }> = [
    { champ: "emargementsSignes", attendu: "émargement" },
    { champ: "signatures", attendu: "signature" },
    { champ: "liensEmargement", attendu: "lien" },
    { champ: "convocationsEnvoyees", attendu: "convocation" },
    { champ: "documentsEmis", attendu: "document" },
    { champ: "creneaux", attendu: "créneau" },
  ];

  for (const cas of CAS) {
    it(`${cas.champ} seul → motif requis, et nommé dans enJeu`, () => {
      const v = verdictDates({
        avant: AVANT,
        apres: APRES,
        preuves: { ...SANS_PREUVE, [cas.champ]: 1 },
      });
      expect(v.motifRequis).toBe(true);
      // 🔴 Un motif requis sans rien à l'écran est un refus opaque : l'admin ne
      // peut pas savoir ce qu'il déclare. `enJeu` doit toujours porter la raison.
      expect(v.enJeu).toHaveLength(1);
      expect(v.enJeu.join(" ")).toContain(cas.attendu);
    });
  }
});

describe("🔴 l'ordre des motifs n'est pas décoratif", () => {
  const v = verdictDates({ avant: AVANT, apres: APRES, preuves: TOUTES_PREUVES });

  it("la feuille d'émargement vient EN PREMIER — seule pièce opposable", () => {
    expect(v.enJeu[0]).toContain("émargement");
    expect(v.enJeu[0]).toContain("opposable");
    expect(v.enJeu[0]).toContain("rectifier au registre");
  });

  it("puis les signatures, puis les convocations parties, puis les créneaux", () => {
    const rang = (aiguille: string): number =>
      v.enJeu.findIndex((ligne) => ligne.includes(aiguille));
    expect(rang("signature")).toBeGreaterThan(0);
    expect(rang("convocation")).toBeGreaterThan(rang("signature"));
    expect(rang("créneau")).toBeGreaterThan(rang("convocation"));
    // Les créneaux ferment la liste : ils sont la conséquence la moins grave et
    // la seule purement interne.
    expect(rang("créneau")).toBe(v.enJeu.length - 1);
  });

  it("toutes les preuves sont rendues, aucune n'est avalée", () => {
    expect(v.enJeu).toHaveLength(6);
  });
});

describe("🔴 ce qui NE SUIT PAS est dit, pas sous-entendu", () => {
  it("les documents déjà émis et les créneaux sont annoncés comme NON régénérés", () => {
    const v = verdictDates({
      avant: AVANT,
      apres: APRES,
      preuves: { ...SANS_PREUVE, documentsEmis: 2, creneaux: 4 },
    });
    const texte = v.enJeu.join(" ");
    expect(texte).toContain("PAS régénérés");
    expect(texte).toContain("PAS réécrits");
  });
});

describe("🔴 les journées ne suivent PAS — la divergence doit être CHIFFRABLE", () => {
  const PLAGE_ISO = { debutISO: "2026-09-10", finISO: "2026-09-11" };

  it("les bornes sont INCLUSES — une journée le jour même n'est pas hors plage", () => {
    // Exclure les bornes ferait crier sur toutes les sessions correctes, et une
    // garde qui crie à tort cesse d'être lue.
    expect(compterJoursHorsPlage({ joursISO: ["2026-09-10", "2026-09-11"], ...PLAGE_ISO })).toBe(0);
  });

  it("compte celles d'avant ET celles d'après", () => {
    expect(
      compterJoursHorsPlage({
        joursISO: ["2026-09-09", "2026-09-10", "2026-09-12"],
        ...PLAGE_ISO,
      }),
    ).toBe(2);
  });

  it("aucune journée déclarée → aucune divergence", () => {
    // Le cas d'une session créée avant l'écran des journées : rien à signaler,
    // et surtout pas un avertissement permanent que personne ne peut résoudre.
    expect(compterJoursHorsPlage({ joursISO: [], ...PLAGE_ISO })).toBe(0);
  });
});

describe("🔴 le message de refus NOMME ce qui est en jeu et dit quoi faire", () => {
  it("il porte TOUS les enjeux, pas seulement le premier", () => {
    const v = verdictDates({
      avant: AVANT,
      apres: APRES,
      preuves: { ...SANS_PREUVE, emargementsSignes: 1, convocationsEnvoyees: 2 },
    });
    const m = messageRefusDates(v.enJeu);
    expect(m).toContain("pièces déjà produites");
    expect(m).toContain("motif de la correction");
    expect(m).toContain("versé au journal");
    expect(m).toContain("émargement");
    expect(m).toContain("convocation");
  });

  it("le singulier et le pluriel sont respectés", () => {
    // Un message qui écrit « 1 convocations » se lit comme un message généré,
    // et un message qui a l'air généré ne se lit plus.
    const un = verdictDates({
      avant: AVANT,
      apres: APRES,
      preuves: { ...SANS_PREUVE, convocationsEnvoyees: 1 },
    }).enJeu.join(" ");
    expect(un).toContain("1 convocation déjà partie");
    expect(un).not.toContain("convocations");

    const trois = verdictDates({
      avant: AVANT,
      apres: APRES,
      preuves: { ...SANS_PREUVE, convocationsEnvoyees: 3 },
    }).enJeu.join(" ");
    expect(trois).toContain("3 convocations déjà parties");

    const unCreneau = verdictDates({
      avant: AVANT,
      apres: APRES,
      preuves: { ...SANS_PREUVE, creneaux: 1 },
    }).enJeu.join(" ");
    expect(unCreneau).toContain("1 créneau");
    expect(unCreneau).not.toContain("créneaux");
  });
});
