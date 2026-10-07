// La colonne « Étape » de la liste des apporteurs (2026-10-07, demande de Will).
//
// Will ne comprenait pas la colonne « Réponse » (Sans réponse / Répondu /
// Échec / Archivé, puis les badges du suivi de l'invitation) : elle disait ce
// qui s'était passé dans la boîte mail, pas OÙ EN EST la personne. L'étape se
// lit d'un mot, dans l'ordre du parcours :
//
//   Candidat → Lien envoyé → Échange réservé → Échange fait → Retenu →
//   Contrat envoyé le JJ/MM → Dossier signé (à vérifier) → Contrat contresigné
//   le JJ/MM ; ou Non retenu / Absent.
//
// Précision de Will (même jour) : « Invité » s'appelle « Lien envoyé » ; qui n'a
// jamais reçu le lien reste « Candidat », avec en petit la raison quand une
// donnée existante la dit (dossier à compléter, a refusé les messages…).

import { describe, expect, it } from "vitest";

import {
  etapeDuSuivi,
  libelleEtapeSuivi,
  lienEtapeSuivi,
  motifSansLien,
  precisionEtapeSuivi,
  motifArchivageAuto,
  doitArchiverAutomatiquement,
  MARQUE_ARCHIVAGE_AUTO,
  type DossierApporteurResume,
} from "../etape-suivi-apporteur";
import type { SuiviInvitation } from "../relance-invitation";

const MAINTENANT = new Date("2026-10-07T12:00:00Z");
const INVITE_LE = new Date("2026-09-30T09:00:00Z");

function suivi(over: Partial<SuiviInvitation> = {}): SuiviInvitation {
  return { invitation: INVITE_LE, relances: [], echange: null, ...over };
}

function dossier(over: Partial<DossierApporteurResume> = {}): DossierApporteurResume {
  return {
    id: "dossier-1",
    statut: "dossier_en_cours",
    signeParSocieteAt: null,
    contratEnvoyeLe: null,
    ...over,
  };
}

const libelle = (d: Parameters<typeof etapeDuSuivi>[0]) =>
  libelleEtapeSuivi(etapeDuSuivi(d, MAINTENANT));

describe("l'étape, du début à la fin du parcours", () => {
  it("lien jamais reçu : « Candidat », sans précision inventée", () => {
    const e = etapeDuSuivi({}, MAINTENANT);
    expect(libelleEtapeSuivi(e)).toBe("Candidat");
    expect(precisionEtapeSuivi(e)).toBeNull();
  });

  it("« Candidat » porte en petit la raison connue", () => {
    const e = etapeDuSuivi({ motifSansLien: "dossier-a-completer" }, MAINTENANT);
    expect(libelleEtapeSuivi(e)).toBe("Candidat");
    expect(precisionEtapeSuivi(e)).toBe("dossier à compléter");
    expect(precisionEtapeSuivi(etapeDuSuivi({ motifSansLien: "opposition" }, MAINTENANT))).toBe(
      "a refusé les messages",
    );
  });

  it("le lien parti l'emporte sur une raison ancienne", () => {
    expect(libelle({ suivi: suivi(), motifSansLien: "dossier-a-completer" })).toBe(
      "Lien envoyé le 30/09",
    );
  });

  it("lien de réservation parti : « Lien envoyé le JJ/MM »", () => {
    expect(libelle({ suivi: suivi() })).toBe("Lien envoyé le 30/09");
  });

  it("les rappels ne changent pas l'étape : toujours « Lien envoyé »", () => {
    const s = suivi({ relances: [new Date("2026-10-03T08:00:00Z")] });
    expect(libelle({ suivi: s })).toBe("Lien envoyé le 30/09");
  });

  it("échange annulé : on revient à « Lien envoyé », et on le dit", () => {
    expect(libelle({ suivi: suivi({ echange: "annule" }) })).toBe(
      "Lien envoyé le 30/09 · échange annulé",
    );
  });

  it("échange à venir : « Échange réservé le JJ/MM »", () => {
    const s = suivi({ echange: "reserve", echangeLe: new Date("2026-10-09T08:00:00Z") });
    expect(libelle({ suivi: s })).toBe("Échange réservé le 09/10");
  });

  it("échange passé sans issue : « Échange fait »", () => {
    const s = suivi({ echange: "reserve", echangeLe: new Date("2026-10-06T08:00:00Z") });
    expect(libelle({ suivi: s })).toBe("Échange fait");
  });

  it("« À revoir » reste un échange fait", () => {
    const s = suivi({ echange: "reserve", decision: { type: "a-revoir" } });
    expect(libelle({ suivi: s })).toBe("Échange fait · à revoir");
  });

  it("absent : « Absent »", () => {
    const s = suivi({ echange: "reserve", decision: { type: "absent", le: null } });
    expect(libelle({ suivi: s })).toBe("Absent");
  });

  it("retenu, sans dossier ouvert : « Retenu »", () => {
    const s = suivi({ echange: "reserve", decision: { type: "retenu", le: MAINTENANT } });
    expect(libelle({ suivi: s })).toBe("Retenu");
  });

  it("dossier ouvert, lien parti : « Contrat envoyé le JJ/MM »", () => {
    const s = suivi({ echange: "reserve", decision: { type: "retenu", le: MAINTENANT } });
    const d = dossier({ contratEnvoyeLe: new Date("2026-10-05T10:00:00Z") });
    expect(libelle({ suivi: s, dossier: d })).toBe("Contrat envoyé le 05/10");
  });

  it("dossier ouvert, aucun envoi journalisé : « Retenu » (on n'invente pas de date)", () => {
    expect(libelle({ dossier: dossier() })).toBe("Retenu");
  });

  it("l'apporteur a signé : « Dossier signé (à vérifier) »", () => {
    expect(libelle({ dossier: dossier({ statut: "a_verifier" }) })).toBe(
      "Dossier signé (à vérifier)",
    );
  });

  it("complément demandé : « Dossier à compléter »", () => {
    expect(libelle({ dossier: dossier({ statut: "a_completer" }) })).toBe("Dossier à compléter");
  });

  it("contresigné : « Contrat contresigné le JJ/MM »", () => {
    const d = dossier({ statut: "signe", signeParSocieteAt: new Date("2026-10-06T15:00:00Z") });
    expect(libelle({ dossier: d })).toBe("Contrat contresigné le 06/10");
  });

  it("non retenu : « Non retenu »", () => {
    const s = suivi({ echange: "reserve", decision: { type: "non-retenu", le: MAINTENANT } });
    expect(libelle({ suivi: s, sansSuite: true })).toBe("Non retenu");
  });

  it("classée sans suite à la main, sans issue d'échange : « Sans suite »", () => {
    expect(libelle({ suivi: suivi(), sansSuite: true })).toBe("Sans suite");
  });

  it("🔑 le dossier prime sur l'issue de l'échange (il vient après)", () => {
    const s = suivi({ echange: "reserve", decision: { type: "retenu", le: MAINTENANT } });
    const d = dossier({ statut: "signe", signeParSocieteAt: new Date("2026-10-06T15:00:00Z") });
    expect(etapeDuSuivi({ suivi: s, dossier: d }, MAINTENANT).type).toBe("contrat-contresigne");
  });

  it("aucun libellé ne tutoie", () => {
    const cas = [
      {},
      { suivi: suivi() },
      { dossier: dossier({ statut: "a_verifier" }) },
      { dossier: dossier({ statut: "refuse" }) },
      { dossier: dossier({ statut: "resilie" }) },
    ];
    for (const c of cas) expect(libelle(c).toLowerCase()).not.toMatch(/\bton\b|\bta\b|\btu\b/);
  });
});

describe("le clic sur l'étape", () => {
  const liens = {
    fiche: "/fr/admin/contacts/commercial/s1",
    dossier: (id: string) => `/fr/admin/apporteurs/${id}`,
  };

  it("ouvre le dossier apporteur s'il existe", () => {
    expect(lienEtapeSuivi({ dossier: dossier() }, liens)).toBe("/fr/admin/apporteurs/dossier-1");
  });

  it("sinon, ouvre la fiche", () => {
    expect(lienEtapeSuivi({ suivi: suivi() }, liens)).toBe("/fr/admin/contacts/commercial/s1");
  });
});

describe("l'archivage automatique : deux motifs, et deux seulement", () => {
  it("contrat contresigné → archivé", () => {
    const d = dossier({ statut: "signe", signeParSocieteAt: MAINTENANT });
    expect(motifArchivageAuto(etapeDuSuivi({ dossier: d }, MAINTENANT))).toBe(
      "contrat-contresigne",
    );
  });

  it("issue « Non retenu » → archivé", () => {
    const s = suivi({ decision: { type: "non-retenu", le: MAINTENANT } });
    expect(motifArchivageAuto(etapeDuSuivi({ suivi: s }, MAINTENANT))).toBe("non-retenu");
  });

  it.each([
    ["candidat", {}],
    ["lien envoyé", { suivi: suivi() }],
    ["absent", { suivi: suivi({ decision: { type: "absent" as const, le: null } }) }],
    ["retenu", { suivi: suivi({ decision: { type: "retenu" as const, le: MAINTENANT } }) }],
    ["dossier signé", { dossier: dossier({ statut: "a_verifier" }) }],
    ["dossier refusé", { dossier: dossier({ statut: "refuse" }) }],
  ])("%s → rien", (_, d) => {
    expect(motifArchivageAuto(etapeDuSuivi(d, MAINTENANT))).toBeNull();
  });

  it("une fiche déjà archivée, à la corbeille ou non apporteur n'est jamais touchée", () => {
    const apporteur = { unifiedType: "recrutement", subType: "candidature-commerciale" };
    const base = { archivedAt: null, deletedAt: null, status: "in_progress", details: apporteur };
    expect(doitArchiverAutomatiquement(base)).toBe(true);
    expect(doitArchiverAutomatiquement({ ...base, archivedAt: MAINTENANT })).toBe(false);
    expect(doitArchiverAutomatiquement({ ...base, status: "archived" })).toBe(false);
    expect(doitArchiverAutomatiquement({ ...base, deletedAt: MAINTENANT })).toBe(false);
    expect(doitArchiverAutomatiquement({ ...base, details: { unifiedType: "contact" } })).toBe(
      false,
    );
  });

  it("🔴 une fiche déjà archivée automatiquement puis DÉSARCHIVÉE par Will n'est jamais ré-archivée", () => {
    const details = {
      unifiedType: "recrutement",
      subType: "candidature-commerciale",
      [MARQUE_ARCHIVAGE_AUTO]: "2026-10-01T08:00:00.000Z",
    };
    expect(
      doitArchiverAutomatiquement({
        archivedAt: null,
        deletedAt: null,
        status: "in_progress",
        details,
      }),
    ).toBe(false);
  });
});

describe("pourquoi le lien n'est pas parti — seulement ce que les données disent", () => {
  const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };

  it("une opposition enregistrée : « a refusé les messages », avant tout le reste", () => {
    expect(
      motifSansLien({ details: { ...APPORTEUR, etape: "premier-contact" }, opposee: true }),
    ).toBe("opposition");
  });

  it.each([
    ["retenu", "adresse-bloquee"],
    ["efface", "coordonnees-effacees"],
    ["origine-interdite", "adresse-annonce-tiers"],
    ["accord-manquant", "accord-manquant"],
    ["lien-invalide", "envoi-non-abouti"],
  ])("l'envoi automatique a noté « %s » → %s", (issue, motif) => {
    const details = { ...APPORTEUR, invitationAuto: { le: "2026-10-01T08:00:00Z", issue } };
    expect(motifSansLien({ details, opposee: false })).toBe(motif);
  });

  it("un envoi automatique réussi ou déjà fait n'est pas une raison", () => {
    for (const issue of ["envoyee", "en-validation", "deja-invitee"]) {
      const details = { ...APPORTEUR, invitationAuto: { le: "x", issue } };
      expect(motifSansLien({ details, opposee: false })).toBeNull();
    }
  });

  it("premier contact ou écran 1 : « dossier à compléter » (seul le dossier complet est invité)", () => {
    expect(
      motifSansLien({ details: { ...APPORTEUR, etape: "premier-contact" }, opposee: false }),
    ).toBe("dossier-a-completer");
    expect(
      motifSansLien({ details: { ...APPORTEUR, origine: "ecran-1-du-dossier" }, opposee: false }),
    ).toBe("dossier-a-completer");
  });

  it("dossier complet sans trace d'envoi, ou saisie manuelle : aucune raison inventée", () => {
    expect(motifSansLien({ details: { ...APPORTEUR }, opposee: false })).toBeNull();
    expect(
      motifSansLien({ details: { ...APPORTEUR, origine: "saisie-manuelle" }, opposee: false }),
    ).toBeNull();
    expect(motifSansLien({ details: null, opposee: false })).toBeNull();
  });
});
