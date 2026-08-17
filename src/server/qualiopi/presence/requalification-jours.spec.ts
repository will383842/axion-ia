/**
 * 🔴 Requalifier les journées d'une session quand des preuves existent.
 *
 * Défaut trouvé le 2026-08-17 : `saveSessionJoursAction` réécrit les journées
 * par `deleteMany` + `createMany`, sans regarder si une feuille d'émargement a
 * déjà été émise, ni si des émargements sont signés. Le PDF opposable et la
 * base peuvent donc dire deux choses différentes — en silence.
 */

import { describe, expect, it } from "vitest";
import {
  memesJournees,
  messageRefus,
  verdictRequalification,
  type JourDeclare,
  type PreuvesExistantes,
} from "./requalification-jours";

const J = (date: string, d = "09:00", f = "17:00"): JourDeclare => ({
  date,
  heureDebut: d,
  heureFin: f,
});

const SANS_PREUVE: PreuvesExistantes = {
  feuillesEmargement: 0,
  emargementsSignes: 0,
  creneaux: 0,
};

describe("🔴 réordonner n'est pas changer", () => {
  it("le même jeu de journées, dans un autre ordre, ne déclenche rien", () => {
    // Une garde qui crie sur un simple tri cesse d'être lue. Le formulaire peut
    // réordonner sans que rien ne change au fond.
    const a = [J("2026-09-10"), J("2026-09-11")];
    const b = [J("2026-09-11"), J("2026-09-10")];
    expect(memesJournees(a, b)).toBe(true);
    expect(verdictRequalification({ avant: a, apres: b, preuves: SANS_PREUVE }).changement).toBe(
      false,
    );
  });

  it("une heure qui change EST un changement", () => {
    // Les horaires figurent sur la feuille d'émargement au même titre que les
    // dates : les traiter comme du détail laisserait passer le cas le plus
    // fréquent (une demi-journée requalifiée en journée).
    expect(memesJournees([J("2026-09-10")], [J("2026-09-10", "09:00", "12:30")])).toBe(false);
  });

  it("un jour retiré ou ajouté EST un changement", () => {
    expect(memesJournees([J("2026-09-10"), J("2026-09-11")], [J("2026-09-10")])).toBe(false);
    expect(memesJournees([J("2026-09-10")], [J("2026-09-10"), J("2026-09-12")])).toBe(false);
  });

  it("réenregistrer à l'identique n'exige AUCUN motif", () => {
    // 🔴 Exiger un motif sur un clic sans effet apprendrait à en inventer un —
    // et un motif inventé au registre est pire qu'un motif absent.
    const v = verdictRequalification({
      avant: [J("2026-09-10")],
      apres: [J("2026-09-10")],
      preuves: { feuillesEmargement: 3, emargementsSignes: 2, creneaux: 4 },
    });
    expect(v.motifRequis).toBe(false);
    expect(v.enJeu).toEqual([]);
  });
});

describe("🔴 sans preuve, on corrige librement", () => {
  it("changer les journées d'une session vierge n'exige aucun motif", () => {
    // C'est le défaut D4 du plan : corriger une coquille de date ne doit pas
    // devenir une cérémonie. Interdire ici reproduirait le défaut sous un autre
    // nom — celui qui oblige à créer une nouvelle session pour une faute de frappe.
    const v = verdictRequalification({
      avant: [J("2026-09-10")],
      apres: [J("2026-09-12")],
      preuves: SANS_PREUVE,
    });
    expect(v.changement).toBe(true);
    expect(v.motifRequis).toBe(false);
  });
});

describe("🔴 avec une feuille d'émargement ÉMISE, le motif devient obligatoire", () => {
  const v = verdictRequalification({
    avant: [J("2026-09-10"), J("2026-09-11")],
    apres: [J("2026-09-12"), J("2026-09-13")],
    preuves: { feuillesEmargement: 1, emargementsSignes: 0, creneaux: 0 },
  });

  it("le motif est requis", () => {
    expect(v.motifRequis).toBe(true);
  });

  it("le message dit que la pièce est OPPOSABLE, et qu'il faudra la rectifier", () => {
    // Un refus qui se contente d'« opération impossible » envoie contourner
    // l'outil. Celui-ci nomme la conséquence exacte.
    const texte = v.enJeu.join(" ");
    expect(texte).toContain("opposable");
    expect(texte).toContain("rectifier au registre");
  });

  it("la feuille d'émargement vient EN PREMIER", () => {
    // 🔴 L'ordre n'est pas décoratif : c'est la seule pièce opposable de la
    // liste. Un émargement signé sans feuille émise se corrige encore ; une
    // feuille émise qui ment ne se corrige que par une rectification.
    const complet = verdictRequalification({
      avant: [J("2026-09-10")],
      apres: [J("2026-09-12")],
      preuves: { feuillesEmargement: 1, emargementsSignes: 2, creneaux: 4 },
    });
    expect(complet.enJeu[0]).toContain("feuille");
  });
});

describe("🔴 les créneaux déjà générés ne sont PAS réécrits — et on le dit", () => {
  it("le message avertit qu'ils garderont les anciennes dates", () => {
    // L'en-tête de `session-jours.ts` assume de ne pas y toucher (« une preuve
    // effacée ne se corrige pas »). Ce qui manquait, c'est de le DIRE à celui
    // qui requalifie : sinon il croit que tout suit.
    const v = verdictRequalification({
      avant: [J("2026-09-10")],
      apres: [J("2026-09-12")],
      preuves: { feuillesEmargement: 0, emargementsSignes: 0, creneaux: 4 },
    });
    expect(v.motifRequis).toBe(true);
    expect(v.enJeu.join(" ")).toContain("ne sont PAS réécrits");
  });
});

describe("🔴 le message de refus dit quoi faire", () => {
  it("il nomme l'enjeu ET la sortie", () => {
    const v = verdictRequalification({
      avant: [J("2026-09-10")],
      apres: [J("2026-09-12")],
      preuves: { feuillesEmargement: 1, emargementsSignes: 1, creneaux: 0 },
    });
    const m = messageRefus(v.enJeu);
    expect(m).toContain("pièces déjà produites");
    expect(m).toContain("motif de la requalification");
    expect(m).toContain("versé au journal");
    // Il porte les DEUX enjeux, pas seulement le premier.
    expect(m).toContain("feuille");
    expect(m).toContain("signé");
  });

  it("le singulier et le pluriel sont respectés", () => {
    // Un message qui écrit « 1 feuilles » se lit comme un message généré, et un
    // message qui a l'air généré ne se lit plus.
    const un = verdictRequalification({
      avant: [J("2026-09-10")],
      apres: [J("2026-09-12")],
      preuves: { feuillesEmargement: 1, emargementsSignes: 0, creneaux: 0 },
    }).enJeu.join(" ");
    expect(un).toContain("1 feuille d'émargement déjà émise");
    expect(un).not.toContain("feuilles");

    const trois = verdictRequalification({
      avant: [J("2026-09-10")],
      apres: [J("2026-09-12")],
      preuves: { feuillesEmargement: 3, emargementsSignes: 0, creneaux: 0 },
    }).enJeu.join(" ");
    expect(trois).toContain("3 feuilles d'émargement déjà émises");
  });
});
