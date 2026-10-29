import { describe, expect, it } from "vitest";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import {
  assemblerFicheVille,
  etatCrmDe,
  LIBELLE_CRM,
  libelleResultatCrm,
  refCrmDemande,
  refCrmVisio,
  type DemandeFiche,
  type LigneCrm,
  type VisioBrute,
} from "../fiche-ville";

const MAINTENANT = new Date("2026-11-01T10:00:00Z");

const demande = (id: string, email: string, extra: Partial<DemandeFiche> = {}): DemandeFiche => ({
  id,
  nom: `Personne ${id}`,
  email,
  telephone: "0612345678",
  telephoneVisio: null,
  villeCle: "lyon",
  ville: "Lyon",
  creeLe: new Date("2026-10-27T10:00:00Z"),
  statut: "recue",
  rattachement: "sans_fiche",
  clientId: null,
  fichesProches: [],
  compte: true,
  doublon: false,
  depuis: null,
  emailHash: hashEmailForLookup(email),
  ...extra,
});

const reponses = (...qr: Array<[string, string]>) => ({
  invitee: { questions_and_answers: qr.map(([question, answer]) => ({ question, answer })) },
});

const visio = (id: string, email: string, extra: Partial<VisioBrute> = {}): VisioBrute => ({
  id,
  inviteeEmail: email,
  startTime: new Date("2026-11-10T09:00:00Z"),
  status: "active",
  rawPayload: reponses(
    ["Quel est votre secteur d'activité ?", "Commerce"],
    ["Nom de l'entreprise", "Société Exemple"],
  ),
  ...extra,
});

const fiche = (d: DemandeFiche[], v: VisioBrute[], cle = "lyon") =>
  assemblerFicheVille(d, v, cle, { maintenant: MAINTENANT });

const ligneCrm = (subjectRef: string, status: string, extra: Partial<LigneCrm> = {}): LigneCrm => ({
  subjectRef,
  status,
  crmResult: null,
  sentAt: null,
  attempts: 0,
  ...extra,
});

describe("fiche d'une ville", () => {
  it("rapproche la visio de la demande par l'empreinte de l'e-mail (casse ignorée)", () => {
    const f = fiche([demande("a", "alice@exemple.fr")], [visio("v1", "Alice@Exemple.fr")]);
    expect(f.personnes[0]?.visio?.id).toBe("v1");
    expect(f.personnes[0]?.visio?.profil?.secteur).toBe("Commerce");
    expect(f.personnes[0]?.visio?.profil?.entreprise).toBe("Société Exemple");
    expect(f.visiosPrises).toBe(1);
    expect(f.visiosSansDemande).toEqual([]);
  });

  it("une visio annulée est affichée « annulée » et n'est pas comptée dans les visios prises", () => {
    const f = fiche(
      [demande("a", "alice@exemple.fr")],
      [visio("v1", "alice@exemple.fr", { status: "canceled" })],
    );
    expect(f.personnes[0]?.visio?.statut).toBe("annulee");
    expect(f.visiosPrises).toBe(0);
  });

  it("une visio passée est « passée », une visio à venir « prévue »", () => {
    const f = fiche(
      [demande("a", "alice@exemple.fr"), demande("b", "bob@exemple.fr")],
      [
        visio("v1", "alice@exemple.fr", { startTime: new Date("2026-10-30T09:00:00Z") }),
        visio("v2", "bob@exemple.fr"),
      ],
    );
    expect(f.personnes.map((p) => p.visio?.statut)).toEqual(["passee", "prevue"]);
  });

  it("une demande effacée n'a ni visio ni réponses, même si une visio porte la même adresse", () => {
    const f = fiche(
      [demande("x", "efface@exemple.fr", { statut: "effacee_rgpd", nom: "[effacé]" })],
      [visio("v1", "efface@exemple.fr")],
    );
    expect(f.personnes[0]?.visio).toBeNull();
  });

  it("une demande sans empreinte n'a jamais de visio", () => {
    const f = fiche(
      [demande("x", "inconnu@exemple.fr", { emailHash: null })],
      [visio("v1", "inconnu@exemple.fr")],
    );
    expect(f.personnes[0]?.visio).toBeNull();
  });

  it("une visio sans demande de Lyon est rattachée à Lyon, pas à Annecy", () => {
    const orpheline = visio("v9", "orpheline@exemple.fr", {
      rawPayload: reponses(["Ville de l'entreprise", "Lyon"]),
    });
    const lyon = fiche([demande("a", "alice@exemple.fr")], [orpheline], "lyon");
    expect(lyon.visiosSansDemande.map((v) => v.id)).toEqual(["v9"]);
    expect(lyon.visiosPrises).toBe(1);
    const annecy = fiche(
      [demande("b", "bob@exemple.fr", { villeCle: "?annecy", ville: "Annecy" })],
      [orpheline],
      "?annecy",
    );
    expect(annecy.visiosSansDemande).toEqual([]);
  });

  it("une visio effacée (_erasedAt) n'a aucune réponse", () => {
    const f = fiche(
      [demande("a", "alice@exemple.fr")],
      [
        visio("v1", "alice@exemple.fr", {
          rawPayload: {
            ...reponses(["Quel est votre secteur d'activité ?", "Commerce"]),
            _erasedAt: "2026-10-30",
          },
        }),
      ],
    );
    expect(f.personnes[0]?.visio?.efface).toBe(true);
    expect(f.personnes[0]?.visio?.profil).toBeNull();
  });

  it("la ville est ouverte à 5 demandes comptées, pas à 4", () => {
    const cinq = ["a", "b", "c", "d", "e"].map((i) => demande(i, `${i}@exemple.fr`));
    expect(fiche(cinq, []).ouverte).toBe(true);
    expect(fiche(cinq, []).comptees).toBe(5);
    expect(fiche(cinq.slice(0, 4), []).ouverte).toBe(false);
    expect(fiche(cinq.slice(0, 4), []).seuil).toBe(5);
  });

  it("un doublon et une demande écartée ne comptent pas", () => {
    const d = [
      demande("a", "a@exemple.fr"),
      demande("b", "b@exemple.fr", { compte: false, doublon: true }),
      demande("c", "c@exemple.fr", { statut: "ecartee" }),
    ];
    const f = fiche(d, []);
    expect(f.comptees).toBe(1);
    expect(f.recues).toBe(2);
    expect(f.personnes).toHaveLength(3);
  });

  it("passe les indicateurs de lecture tels quels", () => {
    const f = assemblerFicheVille([], [], "lyon", { tronquee: true, visiosIndisponibles: true });
    expect(f.tronquee).toBe(true);
    expect(f.visiosIndisponibles).toBe(true);
    expect(f.ouverte).toBe(false);
  });
});

describe("fiche d'une ville : visios d'une autre ville", () => {
  const orpheline = visio("v9", "orpheline@exemple.fr", {
    rawPayload: reponses(["Ville de l'entreprise", "Lyon"]),
  });

  it("une visio qui déclare Lyon mais dont l'adresse est celle d'une demande d'Annecy n'est pas listée à Lyon", () => {
    const f = assemblerFicheVille([demande("a", "alice@exemple.fr")], [orpheline], "lyon", {
      maintenant: MAINTENANT,
      empreintesDemandesDuTour: new Set([hashEmailForLookup("orpheline@exemple.fr") ?? ""]),
    });
    expect(f.visiosSansDemande).toEqual([]);
    expect(f.visiosPrises).toBe(0);
  });

  it("sans demande ailleurs, la même visio reste une visio sans mini-demande de Lyon", () => {
    const f = assemblerFicheVille([demande("a", "alice@exemple.fr")], [orpheline], "lyon", {
      maintenant: MAINTENANT,
      empreintesDemandesDuTour: new Set(["autre-empreinte"]),
    });
    expect(f.visiosSansDemande.map((v) => v.id)).toEqual(["v9"]);
    expect(f.visiosPrises).toBe(1);
  });
});

describe("fiche d'une ville : l'état d'envoi au CRM Pro", () => {
  it("chaque statut de l'outbox a son libellé", () => {
    expect(LIBELLE_CRM.sent).toBe("CRM : envoyée");
    expect(LIBELLE_CRM.pending).toBe("CRM : en attente");
    expect(LIBELLE_CRM.failed).toBe("CRM : échec, sera rejouée");
    expect(LIBELLE_CRM.gave_up).toBe("CRM : abandon, à traiter (voir Synchro CRM)");
    expect(LIBELLE_CRM.absente).toBe("CRM : non envoyée");
    expect(LIBELLE_CRM.indisponible).toBe("CRM : état indisponible");
    for (const statut of ["sent", "pending", "failed", "gave_up"] as const) {
      const etat = etatCrmDe([ligneCrm("site:tour-demande:a", statut)], "site:tour-demande:a");
      expect(etat.statut).toBe(statut);
    }
  });

  it("ligne absente : non envoyée ; lecture en panne (null) : état indisponible", () => {
    expect(etatCrmDe([], "site:tour-demande:a").statut).toBe("absente");
    expect(
      etatCrmDe([ligneCrm("site:tour-demande:autre", "sent")], "site:tour-demande:a").statut,
    ).toBe("absente");
    expect(etatCrmDe(null, "site:tour-demande:a").statut).toBe("indisponible");
  });

  it("garde la réponse du CRM, la date d'envoi et les tentatives ; pending_match est dit en clair", () => {
    const sentAt = new Date("2026-10-28T08:00:00Z");
    const etat = etatCrmDe(
      [
        ligneCrm("site:tour-demande:a", "sent", {
          crmResult: "pending_match",
          sentAt,
          attempts: 2,
        }),
      ],
      "site:tour-demande:a",
    );
    expect(etat).toEqual({
      statut: "sent",
      crmResult: "pending_match",
      envoyeLe: sentAt,
      tentatives: 2,
    });
    expect(libelleResultatCrm("pending_match")).toBe("reçue par le CRM, rattachement en attente");
    expect(libelleResultatCrm("created")).toBe("created");
    expect(libelleResultatCrm(null)).toBeNull();
  });

  it("plusieurs lignes pour une référence : la plus à traiter l'emporte", () => {
    const ref = "site:calendly_event:v1";
    const etat = etatCrmDe([ligneCrm(ref, "sent"), ligneCrm(ref, "gave_up")], ref);
    expect(etat.statut).toBe("gave_up");
  });

  it("un statut inconnu est ignoré (non envoyée)", () => {
    expect(
      etatCrmDe([ligneCrm("site:tour-demande:a", "bizarre")], "site:tour-demande:a").statut,
    ).toBe("absente");
  });

  it("l'état est dit par personne : sa demande, et sa visio si elle en a une", () => {
    const f = fiche(
      [demande("a", "alice@exemple.fr"), demande("b", "bob@exemple.fr")],
      [visio("v1", "alice@exemple.fr")],
    );
    expect(f.personnes[0]?.crmDemande.statut).toBe("absente");
    expect(f.personnes[1]?.crmVisio).toBeNull();

    const g = assemblerFicheVille(
      [demande("a", "alice@exemple.fr"), demande("b", "bob@exemple.fr")],
      [visio("v1", "alice@exemple.fr")],
      "lyon",
      {
        maintenant: MAINTENANT,
        lignesCrm: [
          ligneCrm(refCrmDemande("a"), "sent", { crmResult: "created" }),
          ligneCrm(refCrmVisio("v1"), "failed"),
          ligneCrm(refCrmDemande("b"), "pending"),
        ],
      },
    );
    expect(g.personnes[0]?.crmDemande.statut).toBe("sent");
    expect(g.personnes[0]?.crmDemande.crmResult).toBe("created");
    expect(g.personnes[0]?.crmVisio?.statut).toBe("failed");
    expect(g.personnes[1]?.crmDemande.statut).toBe("pending");
    expect(g.personnes[1]?.crmVisio).toBeNull();
  });

  it("lecture de l'outbox en panne (lignesCrm null) : « état indisponible » pour tous", () => {
    const f = assemblerFicheVille(
      [demande("a", "alice@exemple.fr")],
      [visio("v1", "alice@exemple.fr")],
      "lyon",
      { maintenant: MAINTENANT, lignesCrm: null },
    );
    expect(f.personnes[0]?.crmDemande.statut).toBe("indisponible");
    expect(f.personnes[0]?.crmVisio?.statut).toBe("indisponible");
  });
});
