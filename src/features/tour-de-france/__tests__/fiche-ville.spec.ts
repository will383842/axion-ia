import { describe, expect, it } from "vitest";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { assemblerFicheVille, type DemandeFiche, type VisioBrute } from "../fiche-ville";

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
