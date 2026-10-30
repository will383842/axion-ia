/**
 * Garde des clés « fiche complète » du dossier envoyé au CRM (lot C1). Données FICTIVES.
 * Miroir : `DossierClient.php` du CRM (axion-crm-pro, PR #379). Une clé inconnue du CRM
 * = 422 = synchro arrêtée en silence : la liste blanche est donc figée ici.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaFactice = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    client: { findUnique: fn() },
    factureFormation: { findMany: fn() },
    questionnaireAvantAudit: { findMany: fn(), findFirst: fn() },
    clientProfil: { findUnique: fn() },
    clientTache: { findFirst: fn(), count: fn() },
    emailOutbox: { count: fn(), findFirst: fn() },
    clientNote: { count: fn() },
    projetSuivi: { findFirst: fn() },
    projetContact: { findMany: fn() },
    rencontre: { findFirst: fn() },
    emailOpposition: { findMany: fn() },
    $queryRaw: fn(),
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: prismaFactice }));
vi.mock("@/lib/security/email-hash", () => ({
  hashEmailForLookup: (e: string) => "a".repeat(64) + e.length,
}));
vi.mock("@/server/partners-sync/producteurs/client", () => ({
  sirenTransmis: () => ({ siren: "123456789" }),
}));

import {
  CLES_CONTACT_CRM,
  CLES_DOSSIER_CRM,
  CLES_QUESTIONNAIRE_CRM,
  dossierPourCrm,
  empreinteDossier,
  entreprisePourCrm,
  evenementDossierClient,
  type EntreeInstantaneCrm,
} from "@/server/crm-sync/instantane-dossier";
import { lireEntreeDossier } from "@/server/crm-sync/lire-dossier";

const CLIENT = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const MAINTENANT = new Date("2026-10-30T10:00:00Z");

function entree(surcharge: Partial<EntreeInstantaneCrm> = {}): EntreeInstantaneCrm {
  return {
    clientId: CLIENT,
    numero: "AXI-CLI-004",
    type: "entreprise",
    raisonSociale: "Pharmacie Fictive",
    siren: "123456789",
    adresseRue: "1 rue des Tests",
    adresseCodePostal: "75001",
    adresseVille: "Paris",
    telephone: null,
    effectif: 12,
    factureEmise: false,
    factureHorsConsole: false,
    questionnaire: null,
    contacts: [],
    ...surcharge,
  };
}

const FICHE_PLEINE = {
  etape: "devis_envoye",
  cloturePrevue: new Date("2026-12-15T00:00:00Z"),
  sante: "a_surveiller",
  prochaineTache: { origine: "relance", echeanceLe: new Date("2026-11-03T00:00:00Z") },
  nbTachesOuvertes: 4,
  nbEmailsConsole: 7,
  nbNotesConsole: 2,
  questionnaireAttendus: 5,
  questionnaireDateLimite: new Date("2026-11-20T00:00:00Z"),
} as const;

function cles(valeur: unknown, sortie: string[] = []): string[] {
  if (Array.isArray(valeur)) valeur.forEach((v) => cles(v, sortie));
  else if (typeof valeur === "object" && valeur !== null) {
    for (const [k, v] of Object.entries(valeur)) {
      sortie.push(k.toLowerCase());
      cles(v, sortie);
    }
  }
  return sortie;
}

/** Les mots que le message ne doit porter dans AUCUNE clé, à aucune profondeur. */
const MOTS_INTERDITS = [
  "montant",
  "notes",
  "note",
  "texte",
  "prix",
  "tarif",
  "total",
  "reponse",
  "url",
  "intitule",
  "libelle",
  "etiquette",
  "responsable",
  "commentaire",
  "devis",
  "outils",
];

describe("photo du dossier : clés de la fiche complète", () => {
  it("fige la liste blanche, miroir de DossierClient.php", () => {
    expect([...CLES_DOSSIER_CRM]).toEqual([
      "version",
      "statut",
      "facture_emise",
      "rue",
      "telephone",
      "axi_cli",
      "effectif_tranche",
      "url_console",
      "questionnaire",
      "contacts",
      "etape",
      "cloture_prevue",
      "prochaine_action",
      "taches_ouvertes",
      "nb_emails_console",
      "nb_notes_console",
      "sante",
    ]);
    expect([...CLES_QUESTIONNAIRE_CRM]).toEqual([
      "envoye_le",
      "recu_le",
      "nb_reponses_equipe",
      "attendus",
      "date_limite",
    ]);
    expect([...CLES_CONTACT_CRM]).toEqual([
      "ref",
      "prenom",
      "nom",
      "email",
      "telephone",
      "fonction",
      "person_key",
      "role_decision",
    ]);
  });

  it("porte chaque clé quand la valeur existe, et seulement des clés de la liste", () => {
    const d = dossierPourCrm(entree({ fiche: FICHE_PLEINE }));
    expect(d).toMatchObject({
      etape: "devis_envoye",
      cloture_prevue: "2026-12-15",
      sante: "a_surveiller",
      prochaine_action: { type: "relance", date: "2026-11-03" },
      taches_ouvertes: { nb: 4, prochaine_le: "2026-11-03" },
      nb_emails_console: 7,
      nb_notes_console: 2,
      questionnaire: { attendus: 5, date_limite: "2026-11-20" },
    });
    for (const k of Object.keys(d)) expect(CLES_DOSSIER_CRM).toContain(k);
    for (const k of Object.keys(d.questionnaire!)) expect(CLES_QUESTIONNAIRE_CRM).toContain(k);
  });

  it("omet chaque clé vide ou invalide, jamais null", () => {
    const vide = dossierPourCrm(
      entree({
        fiche: {
          etape: null,
          cloturePrevue: null,
          sante: null,
          prochaineTache: null,
          nbTachesOuvertes: null,
          nbEmailsConsole: -1,
          nbNotesConsole: 1.5,
          questionnaireAttendus: null,
          questionnaireDateLimite: null,
        },
      }),
    );
    for (const k of [
      "etape",
      "cloture_prevue",
      "sante",
      "prochaine_action",
      "taches_ouvertes",
      "nb_emails_console",
      "nb_notes_console",
      "questionnaire",
    ]) {
      expect(Object.keys(vide)).not.toContain(k);
    }
    expect(JSON.stringify(vide)).not.toContain("null");
    // Sans fiche du tout : identique à l'ancien message.
    expect(Object.keys(dossierPourCrm(entree()))).not.toContain("etape");
  });

  it("la prochaine action ne porte jamais l'intitulé : relance si l'origine est relance, rendez_vous si rencontre, sinon autre", () => {
    const tache = (origine: string) =>
      dossierPourCrm(
        entree({
          fiche: {
            prochaineTache: { origine, echeanceLe: new Date("2026-11-03T00:00:00Z") },
            // Un intitulé glissé dans l'entrée ne doit pas voyager.
            ...({ intitule: "Appeler Mme Martin" } as object),
          },
        }),
      ).prochaine_action;
    expect(tache("relance")).toEqual({ type: "relance", date: "2026-11-03" });
    expect(tache("rencontre")).toEqual({ type: "rendez_vous", date: "2026-11-03" });
    for (const o of ["manuelle", "questionnaire"]) {
      expect(tache(o)).toEqual({ type: "autre", date: "2026-11-03" });
    }
    expect(JSON.stringify(dossierPourCrm(entree({ fiche: FICHE_PLEINE })))).not.toContain(
      "Appeler",
    );
  });

  it("aucune clé interdite, même imbriquée dans le message complet", () => {
    const hostile = {
      ...entree({
        fiche: FICHE_PLEINE,
        contacts: [
          {
            id: "c1",
            nom: "Marie Dupont",
            fonction: null,
            telephone: null,
            email: "m@exemple.fr",
            emailType: "pro",
            origine: "saisie",
            emailHash: "b".repeat(64),
            oppose: false,
            parti: false,
            roleDecision: "decideur",
          },
        ],
      }),
      montant: 1200,
      notes: "texte de note",
      intitule: "tâche",
      etiquettes: ["VIP"],
      responsable: "Will",
      urlConsole: "https://x/secret",
    } as unknown as EntreeInstantaneCrm;
    const message = evenementDossierClient(hostile, 3, MAINTENANT)!;
    // Les deux compteurs sont des NOMBRES (autorisés par le CRM) : leurs noms contiennent « notes ».
    const toutes = cles(message).filter(
      (k) => k !== "nb_notes_console" && k !== "nb_emails_console",
    );
    for (const mot of MOTS_INTERDITS) {
      expect(
        toutes.filter((k) => k.includes(mot)),
        mot,
      ).toEqual([]);
    }
    const texte = JSON.stringify(message);
    for (const secret of ["texte de note", "VIP", "Will", "secret", "1200"]) {
      expect(texte).not.toContain(secret);
    }
  });

  it("role_decision part par contact quand il existe, et un contact parti n'est jamais envoyé", () => {
    const contact = (id: string, roleDecision: "financeur" | null, parti = false) => ({
      id,
      nom: `Personne ${id}`,
      fonction: null,
      telephone: null,
      email: null,
      emailType: null,
      origine: "saisie",
      emailHash: null,
      oppose: false,
      parti,
      roleDecision,
    });
    const d = dossierPourCrm(
      entree({
        contacts: [
          contact("c1", "financeur"),
          contact("c2", null),
          contact("c3", "financeur", true),
        ],
      }),
    );
    expect(d.contacts).toHaveLength(2);
    expect(d.contacts![0]!.role_decision).toBe("financeur");
    expect(Object.keys(d.contacts![1]!)).not.toContain("role_decision");
  });

  it("même contenu = même empreinte ; un contenu différent change l'empreinte", () => {
    const e = entree({ fiche: FICHE_PLEINE });
    const a = empreinteDossier(entreprisePourCrm(e), dossierPourCrm(e));
    const b = empreinteDossier(
      entreprisePourCrm(e),
      dossierPourCrm(entree({ fiche: { ...FICHE_PLEINE } })),
    );
    expect(a).toBe(b);
    const c = empreinteDossier(
      entreprisePourCrm(e),
      dossierPourCrm(entree({ fiche: { ...FICHE_PLEINE, nbNotesConsole: 3 } })),
    );
    expect(c).not.toBe(a);
  });
});

describe("lecture du dossier : fiche complète", () => {
  const p = prismaFactice;

  beforeEach(() => {
    vi.clearAllMocks();
    p.client.findUnique.mockResolvedValue({
      id: CLIENT,
      numero: "AXI-CLI-004",
      type: "entreprise",
      raisonSociale: "Pharmacie Fictive",
      siren: "123456789",
      siret: null,
      adresseRue: null,
      adresseCodePostal: "75001",
      adresseVille: "Paris",
      effectif: 12,
      statut: "devis_envoye",
      updatedAt: new Date("2026-10-29T10:00:00Z"),
      fusionsAbsorbee: [],
      fusionsAbsorbante: [],
      contacts: [
        {
          id: "c1",
          nom: "Marie Dupont",
          fonction: null,
          telephone: null,
          statut: "actif",
          origine: "saisie",
          partiLe: null,
          updatedAt: new Date("2026-10-28T10:00:00Z"),
          adresses: [],
        },
      ],
    });
    p.factureFormation.findMany.mockResolvedValue([]);
    p.$queryRaw.mockResolvedValue([{ ok: false }]);
    p.questionnaireAvantAudit.findMany.mockResolvedValue([]);
    p.questionnaireAvantAudit.findFirst.mockResolvedValue({
      expireLe: new Date("2026-11-20T00:00:00Z"),
    });
    p.emailOpposition.findMany.mockResolvedValue([]);
    p.clientProfil.findUnique.mockResolvedValue(null);
    p.clientTache.findFirst.mockResolvedValue({
      origine: "relance",
      echeanceLe: new Date("2026-11-03T00:00:00Z"),
    });
    p.clientTache.count.mockResolvedValue(0);
    p.emailOutbox.count.mockResolvedValue(7);
    p.emailOutbox.findFirst.mockResolvedValue({ envoyeAt: new Date("2026-10-25T10:00:00Z") });
    p.clientNote.count.mockResolvedValue(2);
    p.projetSuivi.findFirst.mockResolvedValue({
      cloturePrevueLe: new Date("2026-12-15T00:00:00Z"),
    });
    p.projetContact.findMany.mockResolvedValue([
      { contactId: "c1", role: "utilisateur" },
      { contactId: "c1", role: "prescripteur" },
      { contactId: "c1", role: "financeur" },
    ]);
    p.rencontre.findFirst.mockResolvedValue(null);
  });

  async function dossier() {
    const lu = await lireEntreeDossier(CLIENT, MAINTENANT);
    expect(lu).not.toBeNull();
    return dossierPourCrm(lu!.entree);
  }

  it("lit les nombres et les états, sans jamais sélectionner un texte", async () => {
    const d = await dossier();
    expect(d).toMatchObject({
      etape: "devis_envoye",
      cloture_prevue: "2026-12-15",
      sante: "bonne",
      prochaine_action: { type: "relance", date: "2026-11-03" },
      nb_emails_console: 7,
      nb_notes_console: 2,
      questionnaire: { date_limite: "2026-11-20" },
    });
    expect(d.contacts![0]!.role_decision).toBe("financeur");
    // Aucune sélection de texte : ni intitulé, ni contenu de note, ni étiquette, ni responsable.
    const selects = [
      p.clientTache.findFirst.mock.calls[0]![0].select,
      p.questionnaireAvantAudit.findFirst.mock.calls[0]![0].select,
    ];
    expect(JSON.stringify(selects)).not.toMatch(/intitule|responsable|donnees|html|contenu/);
    expect(p.clientNote.count.mock.calls[0]![0]).toEqual({ where: { clientId: CLIENT } });
  });

  it("l'archive passe avant le statut", async () => {
    p.clientProfil.findUnique.mockResolvedValue({ archiveLe: new Date("2026-10-01T00:00:00Z") });
    expect((await dossier()).etape).toBe("archive");
  });

  it("client_actif et client_inactif donnent client ; perdu n'est pas inventé", async () => {
    const base = await p.client.findUnique();
    for (const [statut, attendu] of [
      ["client_actif", "client"],
      ["client_inactif", "client"],
      ["perdu", undefined],
    ] as const) {
      p.client.findUnique.mockResolvedValue({ ...base, statut });
      expect((await dossier()).etape).toBe(attendu);
    }
  });

  it("une tâche en retard met le compte à surveiller", async () => {
    p.clientTache.count.mockResolvedValue(2);
    const d = await dossier();
    expect(d.sante).toBe("a_surveiller");
    expect(d.taches_ouvertes).toEqual({ nb: 2, prochaine_le: "2026-11-03" });
  });

  it("0 tâche lue avec succès envoie nb: 0 ; une panne omet la clé", async () => {
    p.clientTache.findFirst.mockResolvedValue(null);
    const d = await dossier();
    expect(d.taches_ouvertes).toEqual({ nb: 0 });
    p.clientTache.count.mockRejectedValue(new Error("panne"));
    expect(Object.keys(await dossier())).not.toContain("taches_ouvertes");
  });

  it("date_limite se lit en jour de Paris, sans filtre expireLe ; départages par id", async () => {
    p.questionnaireAvantAudit.findFirst.mockResolvedValue({
      expireLe: new Date("2026-11-19T23:30:00Z"),
    });
    expect((await dossier()).questionnaire).toMatchObject({ date_limite: "2026-11-20" });
    const arg = p.questionnaireAvantAudit.findFirst.mock.calls[0]![0];
    expect(JSON.stringify(arg.where)).not.toContain("expireLe");
    expect(arg.orderBy).toContainEqual({ id: "asc" });
    expect(p.clientTache.findFirst.mock.calls[0]![0].orderBy).toContainEqual({ id: "asc" });
  });

  it("la santé ignore les rendez-vous de test interne", async () => {
    await dossier();
    expect(p.rencontre.findFirst.mock.calls[0]![0].where).toMatchObject({ estTestInterne: false });
  });

  it("une lecture en panne OMET sa clé et l'envoi part quand même", async () => {
    const panne = new Error("base indisponible");
    p.clientProfil.findUnique.mockRejectedValue(panne);
    p.clientTache.findFirst.mockRejectedValue(panne);
    p.clientTache.count.mockRejectedValue(panne);
    p.emailOutbox.count.mockRejectedValue(panne);
    p.clientNote.count.mockRejectedValue(panne);
    p.projetSuivi.findFirst.mockRejectedValue(panne);
    p.projetContact.findMany.mockRejectedValue(panne);
    p.questionnaireAvantAudit.findFirst.mockRejectedValue(panne);
    const lu = await lireEntreeDossier(CLIENT, MAINTENANT);
    expect(lu).not.toBeNull();
    const d = dossierPourCrm(lu!.entree);
    for (const k of [
      "etape",
      "cloture_prevue",
      "sante",
      "prochaine_action",
      "taches_ouvertes",
      "nb_emails_console",
      "nb_notes_console",
      "questionnaire",
    ]) {
      expect(Object.keys(d), k).not.toContain(k);
    }
    expect(d.contacts![0]).not.toHaveProperty("role_decision");
    expect(d).toMatchObject({ statut: "prospect", facture_emise: false, axi_cli: "AXI-CLI-004" });
    expect(evenementDossierClient(lu!.entree, 1, MAINTENANT)).not.toBeNull();
  });

  it("la santé n'est jamais devinée quand une de ses entrées est illisible", async () => {
    // 1re lecture (statut client, obligatoire) : bonne ; 2e (santé) : en panne.
    p.factureFormation.findMany.mockResolvedValueOnce([]);
    p.factureFormation.findMany.mockRejectedValueOnce(new Error("panne"));
    expect(Object.keys(await dossier())).not.toContain("sante");
  });

  it("lire deux fois le même contenu donne la même empreinte", async () => {
    const a = (await lireEntreeDossier(CLIENT, MAINTENANT))!.entree;
    const b = (await lireEntreeDossier(CLIENT, new Date("2026-10-30T10:05:00Z")))!.entree;
    expect(empreinteDossier(entreprisePourCrm(a), dossierPourCrm(a))).toBe(
      empreinteDossier(entreprisePourCrm(b), dossierPourCrm(b)),
    );
  });
});
