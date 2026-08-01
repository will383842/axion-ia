import { describe, it, expect } from "vitest";
import { decrireAction } from "../activity-labels";

describe("decrireAction", () => {
  it("traduit une clé domaine.objet.verbe en phrase française", () => {
    expect(decrireAction("qualiopi.client.update")).toEqual({
      icone: "organisation",
      texte: "Client modifié",
    });
  });

  // L'icône porte déjà le domaine : le répéter donne « Facturation relance
  // envoyée », plus lourd que « Relance envoyée ».
  it("ne répète pas le nom du domaine quand un objet est présent", () => {
    expect(decrireAction("facturation.relance.envoyer")).toEqual({
      icone: "facturation",
      texte: "Relance envoyée",
    });
  });

  // Sans accord, on lit « relance envoyé » / « facture émis » — ça saute aux
  // yeux. L'accord porte sur le NOYAU de l'objet, son dernier mot.
  it("accorde le participe au féminin selon l'objet", () => {
    expect(decrireAction("facturation.facture_libre.emettre").texte).toBe("Facture libre émis");
    expect(decrireAction("qualiopi.piece.contresignature").texte).toBe("Pièce contresignée");
    expect(decrireAction("qualiopi.session.create").texte).toBe("Session créée");
    expect(decrireAction("newsletter.purged").texte).toBe("Newsletter purgée");
  });

  // Seul le premier mot du participe s'accorde, sinon on obtiendrait
  // « exporté en CSVe ».
  it("n'accorde que le premier mot d'un participe composé", () => {
    expect(decrireAction("qualiopi.session.export_csv").texte).toBe("Session exportée en CSV");
  });

  it("choisit le domaine le plus spécifique quand plusieurs préfixes matchent", () => {
    // `qualiopi.document.*` doit l'emporter sur `qualiopi.*`.
    expect(decrireAction("qualiopi.document.convention.genere").icone).toBe("document");
    expect(decrireAction("qualiopi.sessions.create").icone).toBe("formation");
  });

  it("gère les objets composés de plusieurs segments", () => {
    expect(decrireAction("qualiopi.document.certificat_realisation.genere").texte).toBe(
      "Certificat de réalisation généré",
    );
  });

  // Le code mélange français et anglais dans les clés ; la console est en
  // français et ne doit pas afficher « Trainer document généré ».
  it("traduit les segments d'objet écrits en anglais", () => {
    expect(decrireAction("kb.draft.saved").texte).toBe("Brouillon enregistré");
    expect(decrireAction("qualiopi.trainer_document.genere").texte).toBe(
      "Document formateur généré",
    );
  });

  // Le point de tout l'exercice : 206 clés existent et il en apparaît à chaque
  // sprint. Une clé jamais déclarée doit rester lisible, sans point ni
  // tiret bas apparents.
  it("reste lisible sur une clé inconnue, sans jamais afficher la clé brute", () => {
    const r = decrireAction("un_domaine.mon_objet.verbe_inedit");
    expect(r.texte).not.toContain(".");
    expect(r.texte).not.toContain("_");
    expect(r.texte).toBe("Un domaine mon objet verbe inedit");
  });

  it("conjugue le verbe même quand l'objet est absent", () => {
    expect(decrireAction("qualiopi.alertes.synchroniser").texte).toBe("Alertes synchronisées");
  });

  it("ne renvoie jamais de texte vide", () => {
    for (const cle of ["", "   ", "noop", "created", "a.b.c.d.e"]) {
      const r = decrireAction(cle);
      expect(r.texte.length).toBeGreaterThan(0);
      expect(r.icone.length).toBeGreaterThan(0);
    }
  });
});
