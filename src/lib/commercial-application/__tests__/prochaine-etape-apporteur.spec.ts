import { describe, expect, it } from "vitest";

import { etapeDuSuivi, type DossierApporteurResume } from "../etape-suivi-apporteur";
import { prochaineEtape } from "../prochaine-etape-apporteur";
import type { SuiviInvitation } from "../relance-invitation";

const MAINTENANT = new Date("2026-11-27T10:00:00Z");
const jours = (n: number) => new Date(MAINTENANT.getTime() - n * 86_400_000);

function suivi(p: Partial<SuiviInvitation> = {}): SuiviInvitation {
  return { invitation: jours(3), relances: [], echange: null, ...p };
}
function dossier(p: Partial<DossierApporteurResume> = {}): DossierApporteurResume {
  return {
    id: "d1",
    statut: "dossier_en_cours",
    signeParSocieteAt: null,
    contratEnvoyeLe: null,
    ...p,
  };
}
function lire(
  s: SuiviInvitation | null,
  d: DossierApporteurResume | null,
  o: { peutEngager?: boolean; aUnEchange?: boolean } = {},
) {
  const etape = etapeDuSuivi({ suivi: s, dossier: d }, MAINTENANT);
  return prochaineEtape(etape, {
    suivi: s,
    dossier: d,
    peutEngager: o.peutEngager ?? true,
    aUnEchange: o.aUnEchange ?? true,
    maintenant: MAINTENANT,
  });
}

describe("la prochaine étape d'un candidat apporteur", () => {
  it("candidat : « Envoyer l'invitation »", () => {
    const r = lire(null, null);
    expect(r.bouton).toEqual({
      type: "ancre",
      libelle: "Envoyer l'invitation",
      href: "#invitation",
    });
  });

  it("lien envoyé : date, pas d'alerte avant 14 jours", () => {
    const r = lire(suivi({ invitation: jours(14) }), null);
    expect(r.phrase).toContain("Invité le");
    expect(r.alerte).toBeNull();
    expect(r.bouton).toBeNull();
  });

  it("lien envoyé : « Sans nouvelles depuis 16 jours » après 14 jours", () => {
    expect(lire(suivi({ invitation: jours(16) }), null).alerte).toBe(
      "Sans nouvelles depuis 16 jours",
    );
  });

  it("retenu SANS dossier, administrateur : le bouton d'ouverture du contrat", () => {
    const s = suivi({ decision: { type: "retenu", le: jours(1) } });
    const r = lire(s, null);
    expect(r.bouton).toEqual({ type: "ouvrir-contrat" });
    expect(r.phrase).toContain("le contrat n'est pas parti");
  });

  it("retenu SANS dossier, non-administrateur : la phrase, aucun bouton", () => {
    const s = suivi({ decision: { type: "retenu", le: jours(1) } });
    const r = lire(s, null, { peutEngager: false });
    expect(r.bouton).toBeNull();
    expect(r.phrase).toContain("administrateur");
  });

  it("retenu sans dossier ni échange rattaché : pas de bouton, on dit pourquoi", () => {
    const s = suivi({ decision: { type: "retenu", le: jours(1) } });
    const r = lire(s, null, { aUnEchange: false });
    expect(r.bouton).toBeNull();
    expect(r.phrase).toContain("rattachez");
  });

  it("dossier ouvert SANS envoi : on dit que le lien n'est pas parti, bouton vers le dossier", () => {
    const r = lire(suivi(), dossier());
    expect(r.phrase).toBe(
      "Dossier ouvert, mais le lien du contrat n'est pas parti : envoyez-le depuis le dossier.",
    );
    expect(r.bouton).toEqual({ type: "dossier", libelle: "Envoyer le lien depuis le dossier" });
  });

  it("contrat envoyé : lien vers le dossier", () => {
    const r = lire(suivi(), dossier({ contratEnvoyeLe: jours(2) }));
    expect(r.bouton).toEqual({ type: "dossier", libelle: "Voir le dossier apporteur" });
  });

  it("signé à vérifier : « Vérifier et contresigner »", () => {
    const r = lire(suivi(), dossier({ statut: "a_verifier" }));
    expect(r.bouton).toEqual({ type: "dossier", libelle: "Vérifier et contresigner" });
  });

  it("contresigné : aucun bouton", () => {
    expect(lire(suivi(), dossier({ statut: "signe" })).bouton).toBeNull();
  });

  it("échange fait : ancre vers les boutons de résultat", () => {
    const r = lire(suivi({ echange: "reserve", echangeLe: jours(1) }), null);
    expect(r.bouton).toMatchObject({ type: "ancre", href: "#rendez-vous" });
  });

  it("une réponse plus récente que la dernière action est signalée", () => {
    expect(lire(suivi({ invitation: jours(5), reponse: jours(2) }), null).reponseLe).toEqual(
      jours(2),
    );
  });

  it("une réponse plus ancienne que la dernière action n'est pas signalée", () => {
    expect(lire(suivi({ invitation: jours(2), reponse: jours(4) }), null).reponseLe).toBeNull();
  });
});
