/**
 * Lot 1 §1.3 + §1.5 — le parcours d'un dossier, et son test de vérité.
 *
 * 🔴 La rév. 1 du plan exigeait un test sur des données de production :
 * inexécutable, les tests tournent sur un Prisma mocké (contrat stub, ADR 0026).
 * Ce module ayant été écrit PUR — il reçoit un état, il ne le charge pas — le
 * test de vérité redevient possible : on rejoue le dossier réel en mémoire.
 *
 * La fixture `dossier-invest-sun-1` reproduit les défauts CONSTATÉS sur le
 * premier dossier réel :
 *   · positionnement répondu APRÈS le début → l'étape ne doit pas être verte ;
 *   · convention signée d'un seul côté → « signée » doit rester faux ;
 *   · attestation émise avant l'évaluation → avertissement.
 */

import { describe, expect, it } from "vitest";
import { construireParcours, type SessionParcoursInput } from "./session-parcours";

const d = (iso: string): Date => new Date(iso);

const DEBUT = d("2026-09-10T09:00:00.000Z");
const FIN = d("2026-09-11T17:00:00.000Z");

/** Un dossier vierge, tout à faire, largement en avance. */
function dossier(patch: Partial<SessionParcoursInput> = {}): SessionParcoursInput {
  return {
    session: {
      statut: "planifiee",
      dateDebut: DEBUT,
      dateFin: FIN,
      formateurPrincipalId: null,
      financementType: "direct",
    },
    documents: [],
    signaturesParPiece: new Map(),
    inscriptions: [],
    liensEmargementActifs: 0,
    creneauxEmargement: 0,
    maintenant: d("2026-08-01T09:00:00.000Z"),
    ...patch,
  };
}

function inscription(patch: Partial<SessionParcoursInput["inscriptions"][number]> = {}) {
  return {
    id: "e1",
    statut: "planifiee",
    emargementSigneAt: null,
    convocationEnvoyeeAt: null,
    questionnaires: [],
    evaluationFinaleAt: null,
    aUnAccesPortail: false,
    ...patch,
  };
}

const etapeDe = (p: ReturnType<typeof construireParcours>, cle: string) =>
  p.etapes.find((e) => e.cle === cle)!;

// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 le dossier couvre les quinze étapes du plan", () => {
  it("les rend toutes, dans l'ordre chronologique", () => {
    const p = construireParcours(dossier({ inscriptions: [inscription()] }));
    expect(p.etapes.map((e) => e.cle)).toEqual([
      "formateur_assigne",
      "convention_generee",
      "convention_signee",
      "convention_contresignee",
      "positionnement_envoye",
      "positionnement_repondu",
      "convocation_envoyee",
      "creneaux_emargement",
      "liens_signature_emis",
      "emargement_signe",
      "evaluation_finale",
      "attestation",
      "acces_portail",
      "satisfaction_chaud",
      "satisfaction_froid",
    ]);
  });

  it("chaque étape porte le GESTE et l'ACTEUR", () => {
    // Une checklist qui dit « manquant » sans dire qui fait quoi renvoie à la
    // mémoire de celui qui lit — exactement ce que le lot supprime.
    const p = construireParcours(dossier({ inscriptions: [inscription()] }));
    for (const e of p.etapes) {
      expect(
        e.geste.trim().length,
        `L'étape « ${e.cle} » ne dit pas quel geste poser`,
      ).toBeGreaterThan(30);
    }
  });

  it("chaque étape porte son état dans le TEXTE, pas dans la seule couleur", () => {
    const p = construireParcours(dossier({ inscriptions: [inscription()] }));
    for (const e of p.etapes) {
      expect(e.mention, `L'étape « ${e.cle} » n'a pas de mention lisible`).toMatch(/\S{5,}/);
    }
  });
});

describe("🔴 une pièce ANNULÉE ne compte pas", () => {
  const conventionAnnulee = {
    id: "doc1",
    type: "convention",
    numero: "AXI-DOC-2026-003",
    createdAt: d("2026-08-02T00:00:00.000Z"),
    annuleeAt: d("2026-08-03T00:00:00.000Z"),
  };

  it("une convention annulée ne rend pas l'étape « générée »", () => {
    // Constaté en production sur AXI-DOC-2026-003 : la pièce annulée continuait
    // d'alimenter l'écran. Une pièce morte est indiscernable d'une pièce
    // valable si on ne lit pas `annuleeAt`.
    const p = construireParcours(dossier({ documents: [conventionAnnulee] }));
    expect(etapeDe(p, "convention_generee").etat).not.toBe("fait");
  });

  it("deux conventions ACTIVES déclenchent un avertissement nominatif", () => {
    // 🔴 Deux pièces opposables sur le même dossier : l'écran ne peut pas
    // choisir laquelle fait foi. L'humain doit annuler l'ancienne AU REGISTRE.
    const p = construireParcours(
      dossier({
        documents: [
          { ...conventionAnnulee, id: "a", numero: "AXI-DOC-2026-003", annuleeAt: null },
          { ...conventionAnnulee, id: "b", numero: "AXI-DOC-2026-009", annuleeAt: null },
        ],
      }),
    );
    const e = etapeDe(p, "convention_generee");
    expect(e.avertissement).toContain("AXI-DOC-2026-003");
    expect(e.avertissement).toContain("AXI-DOC-2026-009");
    expect(e.avertissement).toContain("annuler l'ancienne au registre");
  });
});

describe("🔴 un seul côté signé ne vaut PAS signature", () => {
  const convention = {
    id: "doc1",
    type: "convention",
    numero: "AXI-DOC-2026-010",
    createdAt: d("2026-08-02T00:00:00.000Z"),
    annuleeAt: null,
  };

  it("le client a signé, l'organisme n'a pas contresigné : DEUX lignes, une seule verte", () => {
    // 🔴 L'INTENTION D'ORIGINE EST PRÉSERVÉE, elle a changé de ligne.
    //
    // Avant, une seule étape « Convention signée par toutes les parties »
    // portait les deux gestes, et l'assertion vérifiait qu'elle restait ROUGE
    // sur une pièce signée d'un seul côté. Depuis la scission (Lot 3sexies),
    // c'est la ligne du CONTRESEING qui doit rester rouge — et celle du client
    // devient légitimement verte, puisqu'il a bel et bien signé.
    //
    // Ce qui ne doit PAS changer : rien, nulle part, ne doit laisser croire
    // que la convention est conclue. C'est ce que ce test garde.
    const p = construireParcours(
      dossier({
        documents: [convention],
        signaturesParPiece: new Map([["doc1", [{ partie: "client" }]]]),
      }),
    );
    expect(etapeDe(p, "convention_signee").etat).toBe("fait");

    const contreseing = etapeDe(p, "convention_contresignee");
    expect(contreseing.etat).not.toBe("fait");
    // Et le message dit QUI doit agir : c'est le seul des deux gestes qui ne
    // dépend de personne d'autre que nous.
    expect(contreseing.avertissement).toContain("PAS nous");
  });

  it("🔴 TRIPARTITE : le financeur seul ne suffit pas", () => {
    // Le défaut que j'ai FAILLI introduire en scindant l'étape. Une première
    // version testait « au moins une signature qui n'est pas la nôtre » : sur
    // une convention tripartite, dont le circuit exige
    // ["client", "financeur", "axionia"], elle serait passée au vert sur la
    // seule signature du financeur — le client n'ayant rien signé.
    //
    // La liste des parties vient de `partiesRequisesPour`, le SSOT des dix
    // circuits. La recompter ici la ferait diverger au premier circuit ajouté.
    const tripartite = { ...convention, type: "convention_tripartite" };
    const partiel = construireParcours(
      dossier({
        documents: [tripartite],
        signaturesParPiece: new Map([["doc1", [{ partie: "financeur" }]]]),
      }),
    );
    expect(etapeDe(partiel, "convention_signee").etat).not.toBe("fait");

    const complet = construireParcours(
      dossier({
        documents: [tripartite],
        signaturesParPiece: new Map([["doc1", [{ partie: "financeur" }, { partie: "client" }]]]),
      }),
    );
    expect(etapeDe(complet, "convention_signee").etat).toBe("fait");
  });

  it("🔴 contresignée AVANT la signature du client : le circuit est inversé", () => {
    // L'organisme signe en DERNIER. Une pièce contresignée sans signature
    // client signale un circuit mal joué — et, avant la scission, elle aurait
    // fait passer l'étape unique pour « à moitié faite » sans dire de quel
    // côté. Le contre-cas est celui qui prouve que les deux mesures sont bien
    // indépendantes.
    const p = construireParcours(
      dossier({
        documents: [convention],
        signaturesParPiece: new Map([["doc1", [{ partie: "axionia" }]]]),
      }),
    );
    expect(etapeDe(p, "convention_signee").etat).not.toBe("fait");
    expect(etapeDe(p, "convention_contresignee").etat).toBe("fait");
    expect(etapeDe(p, "convention_contresignee").avertissement).toContain("DERNIER");
  });

  it("toutes les parties ont signé : l'étape est faite", () => {
    const p = construireParcours(
      dossier({
        documents: [convention],
        signaturesParPiece: new Map([
          // 🔴 Les noms viennent du SSOT (`parties-requises.ts`), ils ne se
          // devinent pas : le circuit `convention` porte ["client", "axionia"].
          // Ma premiere version inventait "organisme" — et le test rougissait
          // pour la bonne raison.
          ["doc1", [{ partie: "client" }, { partie: "axionia" }]],
        ]),
      }),
    );
    expect(etapeDe(p, "convention_signee").etat).toBe("fait");
  });
});

describe("🔴 fixture « dossier-invest-sun-1 » — les défauts réels rejoués", () => {
  /** L'état du dossier tel qu'il était, le lendemain de la session. */
  const investSun = dossier({
    session: {
      statut: "realisee",
      dateDebut: DEBUT,
      dateFin: FIN,
      formateurPrincipalId: "f1",
      financementType: "direct",
    },
    // 🔴 Le dossier regarde neuf jours apres la fin — le moment ou on l'audite
    // vraiment. A J+1 la fenetre de 48 h des jetons d'emargement est encore
    // ouverte, et l'echeance d'evaluation (J+2) n'est meme pas passee : la
    // fixture n'exercait alors AUCUN des cas irreversibles qu'elle pretend
    // rejouer.
    maintenant: d("2026-09-20T09:00:00.000Z"),
    documents: [
      {
        id: "conv",
        type: "convention",
        numero: "AXI-DOC-2026-020",
        createdAt: d("2026-09-01T00:00:00.000Z"),
        annuleeAt: null,
      },
      {
        // 🔴 Attestation émise le lendemain de la fin, sans évaluation finale.
        id: "att",
        type: "attestation",
        numero: "AXI-ATT-2026-004",
        createdAt: d("2026-09-12T08:00:00.000Z"),
        annuleeAt: null,
      },
    ],
    // Signée d'un seul côté.
    signaturesParPiece: new Map([["conv", [{ partie: "client" }]]]),
    inscriptions: [
      inscription({
        id: "e1",
        emargementSigneAt: null,
        convocationEnvoyeeAt: null,
        evaluationFinaleAt: null,
        questionnaires: [
          {
            type: "positionnement",
            envoyeAt: d("2026-09-09T00:00:00.000Z"),
            // 🔴 Répondu APRÈS le début de la session.
            reponduAt: d("2026-09-10T14:00:00.000Z"),
          },
        ],
      }),
    ],
    liensEmargementActifs: 0,
    creneauxEmargement: 0,
  });

  const p = construireParcours(investSun);

  it("🔴 le défaut réel : le client avait signé, NOUS jamais", () => {
    // Dossier de production rejoué. La convention portait UNE signature, celle
    // du client. Avant la scission, une seule ligne rouge disait « convention
    // non signée » — sans dire de quel côté, donc sans dire que le geste
    // manquant était le NÔTRE et qu'il ne dépendait de personne.
    expect(etapeDe(p, "convention_signee").etat).toBe("fait");
    expect(etapeDe(p, "convention_contresignee").etat).toBe("hors_delai");
  });

  it("l'émargement jamais signé est HORS DÉLAI — les jetons ont expiré", () => {
    // Le geste n'est plus possible : la fenêtre de 48 h après la fin est
    // passée. C'est le cas où « rattrapable » serait un mensonge.
    expect(etapeDe(p, "emargement_signe").etat).toBe("hors_delai");
  });

  it("l'attestation émise sans évaluation est SIGNALÉE", () => {
    // 🔴 Le défaut le plus grave du dossier n°1 : attester d'acquis que
    // personne n'a constatés.
    expect(etapeDe(p, "attestation").avertissement).toContain("acquis non constatés");
  });

  it("l'évaluation finale manquante reste RATTRAPABLE — elle l'est vraiment", () => {
    // Aucune borne : évaluer en retard laisse un écart de date, pas une
    // impossibilité. Le dire « hors délai » ferait renoncer.
    expect(etapeDe(p, "evaluation_finale").etat).toBe("rattrapable");
  });

  it("le pire état du dossier remonte en HORS DÉLAI", () => {
    expect(p.pire).toBe("hors_delai");
  });

  it("l'avancement n'inventé pas d'étapes : n sur N réels", () => {
    expect(p.avancement.total).toBe(15);
    expect(p.avancement.fait).toBeLessThan(p.avancement.total);
  });
});

describe("🔴 la convocation dit « on ne sait pas » plutôt que de mentir", () => {
  it("session commencée, aucune trace d'envoi : INDÉTERMINÉ, jamais ✅ ni ✗", () => {
    // `EmailLog` n'a aucun lien vers une session ; si la colonne d'état est
    // nulle sur une session déjà passée, l'envoi a pu avoir lieu avant qu'elle
    // n'existe. Un ✅ mentirait sur une obligation réglementaire (ind. 9) ; un
    // ✗ ferait reconvoquer des stagiaires déjà convoqués.
    const p = construireParcours(
      dossier({
        maintenant: d("2026-09-11T09:00:00.000Z"),
        inscriptions: [inscription({ convocationEnvoyeeAt: null })],
      }),
    );
    const e = etapeDe(p, "convocation_envoyee");
    expect(e.etat).toBe("indetermine");
    expect(e.mention).toContain("Rattachement non établi");
    expect(e.mention).toContain("avant de reconvoquer");
  });

  it("session à venir, aucun envoi : simplement À FAIRE", () => {
    const p = construireParcours(
      dossier({
        maintenant: d("2026-09-01T09:00:00.000Z"),
        inscriptions: [inscription({ convocationEnvoyeeAt: null })],
      }),
    );
    expect(etapeDe(p, "convocation_envoyee").etat).toBe("a_faire");
  });

  it("une convocation partielle sur session passée n'est PAS indéterminée", () => {
    // Une trace existe : la dérivation a abouti, il manque des envois. C'est un
    // manque, pas une incertitude — et le distinguer compte.
    const p = construireParcours(
      dossier({
        maintenant: d("2026-09-11T09:00:00.000Z"),
        inscriptions: [
          inscription({ id: "a", convocationEnvoyeeAt: d("2026-09-05T00:00:00.000Z") }),
          inscription({ id: "b", convocationEnvoyeeAt: null }),
        ],
      }),
    );
    expect(etapeDe(p, "convocation_envoyee").etat).toBe("hors_delai");
  });
});

describe("🔴 les étapes par stagiaire comptent « n/m »", () => {
  it("deux inscrits, un émargement : 1/2 et pas « fait »", () => {
    const p = construireParcours(
      dossier({
        maintenant: d("2026-09-11T20:00:00.000Z"),
        inscriptions: [
          inscription({ id: "a", emargementSigneAt: d("2026-09-10T10:00:00.000Z") }),
          inscription({ id: "b" }),
        ],
      }),
    );
    const e = etapeDe(p, "emargement_signe");
    expect(e.avancement).toEqual({ fait: 1, total: 2 });
    expect(e.etat).not.toBe("fait");
  });

  it("une inscription ANNULÉE ne compte pas dans le total", () => {
    // Compter les désistements ferait un « 2/3 » impossible à solder, et une
    // checklist qu'on ne peut pas terminer cesse d'être suivie.
    const p = construireParcours(
      dossier({
        maintenant: d("2026-09-11T20:00:00.000Z"),
        inscriptions: [
          inscription({ id: "a", emargementSigneAt: d("2026-09-10T10:00:00.000Z") }),
          inscription({ id: "b", statut: "annulee" }),
        ],
      }),
    );
    expect(etapeDe(p, "emargement_signe").avancement).toEqual({ fait: 1, total: 1 });
    expect(etapeDe(p, "emargement_signe").etat).toBe("fait");
  });

  it("aucune inscription active : les étapes par stagiaire sont SANS OBJET", () => {
    // Et pas « à faire » : réclamer un émargement sans personne à émarger est
    // une tâche insoluble, et une tâche insoluble apprend à ignorer la liste.
    const p = construireParcours(dossier({ maintenant: d("2026-09-11T20:00:00.000Z") }));
    expect(etapeDe(p, "emargement_signe").etat).toBe("sans_objet");
    expect(etapeDe(p, "positionnement_envoye").etat).toBe("sans_objet");
    // …mais les étapes du DOSSIER restent dues.
    expect(etapeDe(p, "convention_generee").etat).not.toBe("sans_objet");
  });
});

describe("🔴 un statut terminal REPLIE la checklist", () => {
  it("session reportée : aucune étape déroulée, la filiation est dite", () => {
    const p = construireParcours(
      dossier({
        session: {
          statut: "reportee",
          dateDebut: DEBUT,
          dateFin: FIN,
          formateurPrincipalId: null,
          financementType: "direct",
          sessionReporteeNumero: "AXI-SESS-2026-007",
        },
      }),
    );
    expect(p.etapes).toEqual([]);
    expect(p.repliee?.motif).toContain("AXI-SESS-2026-007");
  });

  it("session annulée : repliée, et aucune action réclamée", () => {
    // Dérouler quatorze étapes sur une session annulée demanderait des gestes
    // que plus personne ne doit poser.
    const p = construireParcours(
      dossier({
        session: {
          statut: "annulee",
          dateDebut: DEBUT,
          dateFin: FIN,
          formateurPrincipalId: null,
          financementType: "direct",
        },
      }),
    );
    expect(p.repliee).not.toBeNull();
    expect(p.pire).toBe("sans_objet");
  });
});

describe("🔴 les avertissements qui coûtent cher à oublier", () => {
  it("réémettre les liens tue le QR déjà imprimé — c'est écrit", () => {
    const p = construireParcours(dossier({ liensEmargementActifs: 3 }));
    expect(etapeDe(p, "liens_signature_emis").avertissement).toContain("révoque");
  });

  it("l'accès portail est global au stagiaire — c'est écrit", () => {
    // Le cas réel : une stagiaire suivant deux sessions, dont les pièces sont
    // dédupliquées par type — la convocation de l'une masque celle de l'autre.
    const p = construireParcours(dossier({ inscriptions: [inscription()] }));
    expect(etapeDe(p, "acces_portail").avertissement).toContain("global au stagiaire");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lot 5 — « chaque étape possède un chemin vers l'état hors-délai »
//
// 🔴 L'exigence du plan, prise à la lettre, prescrit une RÉGRESSION : quatre
// étapes n'ont volontairement aucune borne, parce qu'évaluer ou attester en
// retard laisse un écart de DATE, pas une impossibilité. Leur imposer une borne
// ferait renoncer à des gestes encore utiles.
//
// Ce que l'exigence voulait dire, et qui est juste : **aucune étape ne doit se
// retrouver sans état terminal PAR OUBLI**. Le code ne distinguait pas les deux
// `null` — une borne oubliée ressemblait exactement à une borne volontairement
// absente. Désormais l'absence se DÉCLARE, et ce test balaie les quinze clés.
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 aucune étape n'est privée d'état terminal par OUBLI", () => {
  // Un dossier qui exerce les quinze étapes, longtemps après la fin : c'est
  // le seul moment où toutes ont eu l'occasion de devenir terminales.
  const p = construireParcours(
    dossier({
      session: {
        statut: "realisee",
        dateDebut: DEBUT,
        dateFin: FIN,
        formateurPrincipalId: "f1",
        financementType: "direct",
      },
      maintenant: d("2027-01-15T09:00:00.000Z"),
      inscriptions: [inscription()],
    }),
  );

  it("les quinze étapes sont bien rendues", () => {
    // Sans ceci, une liste vide ferait passer tout le bloc au vert.
    expect(p.etapes).toHaveLength(15);
  });

  it.each(p.etapes.map((e) => [e.cle, e] as const))(
    "%s : soit elle atteint un état terminal, soit elle DIT pourquoi elle n'en a pas",
    (_cle, etape) => {
      // `hors_delai` et `fait` sont terminaux ; `sans_objet` sort du parcours.
      const terminale =
        etape.etat === "hors_delai" || etape.etat === "fait" || etape.etat === "sans_objet";
      if (terminale) return;
      expect(
        etape.motifSansBorne,
        `L'étape « ${etape.cle} » reste « ${etape.etat} » plus de quatre mois après la fin ` +
          `de la session, sans déclarer pourquoi elle n'a pas de borne. Une borne oubliée ` +
          `ressemble exactement à une borne volontairement absente : il faut la DIRE.`,
      ).toMatch(/\S/);
    },
  );

  it("les quatre absences déclarées portent une raison de FOND, pas un libellé", () => {
    // Un motif d'une ligne creuse (« pas de borne ») satisferait le test
    // précédent sans rien apprendre à personne.
    const declarees = p.etapes.filter((e) => e.motifSansBorne !== undefined);
    expect(declarees.length).toBeGreaterThanOrEqual(4);
    for (const e of declarees) {
      expect(
        (e.motifSansBorne ?? "").length,
        `Le motif de « ${e.cle} » est trop court pour expliquer quoi que ce soit.`,
      ).toBeGreaterThan(60);
    }
  });

  it("une étape AVEC borne n'invente pas de motif d'absence", () => {
    // Sinon l'écran afficherait « pas de borne parce que … » sous une étape qui
    // en a une — une contradiction visible.
    const avecBorne = p.etapes.find((e) => e.cle === "convention_signee")!;
    expect(avecBorne.motifSansBorne).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 AUCUN EMOJI DANS CE QUI EST RENDU À L'ÉCRAN
//
// Trouvé le 2026-08-17 par la vague d'agents, dans MON code du matin : la ligne
// `geste` du suivi à froid portait un « 🔴 » — et « À traiter » rend
// `etape.geste` tel quel. L'emoji était donc DÉJÀ affiché en production.
//
// Le dépôt l'interdit : lucide-react pour les icônes, et l'information s'écrit
// en toutes lettres (un emoji n'a pas de texte alternatif, un lecteur d'écran
// l'annonce « gros cercle rouge » au milieu d'une phrase).
//
// ⚠️ La règle ne vaut QUE pour les chaînes rendues. Un 🔴 en commentaire est
// légitime — et abondant dans ce fichier. C'est pourquoi ce test lit les VALEURS
// produites, pas le source : un test statique sur le fichier s'accuserait de ses
// propres commentaires, piège déjà payé le 17/08 sur une autre garde.
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 rien de ce qui s'affiche ne porte d'emoji", () => {
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

  const p = construireParcours(
    dossier({
      session: {
        statut: "realisee",
        dateDebut: DEBUT,
        dateFin: FIN,
        formateurPrincipalId: "f1",
        financementType: "direct",
      },
      maintenant: d("2026-09-20T09:00:00.000Z"),
      inscriptions: [inscription()],
    }),
  );

  it("les quinze étapes sont bien là", () => {
    // Sans ceci, une liste vide ferait passer tout le bloc au vert.
    expect(p.etapes).toHaveLength(15);
  });

  it.each(p.etapes.map((e) => [e.cle, e] as const))(
    "%s : ni le libellé, ni la mention, ni le geste, ni l'avertissement",
    (_cle, etape) => {
      for (const [champ, valeur] of [
        ["libelle", etape.libelle],
        ["mention", etape.mention],
        ["geste", etape.geste],
        ["avertissement", etape.avertissement ?? ""],
        ["motifSansBorne", etape.motifSansBorne ?? ""],
      ] as const) {
        expect(
          EMOJI.test(valeur),
          `L'étape « ${etape.cle} » porte un emoji dans son champ « ${champ} », et ` +
            `ce champ est RENDU À L'ÉCRAN. Un emoji n'a pas de texte alternatif : ` +
            `un lecteur d'écran l'annonce au milieu de la phrase.`,
        ).toBe(false);
      }
    },
  );
});
