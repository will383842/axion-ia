/**
 * Une facture par CRÉANCE — et le reste à charge redevient facturable.
 *
 * Les deux défauts fermés, trouvés par la vérification de bout en bout du 16/08 :
 *
 * 1. en subrogation, le destinataire était ÉCRASÉ à « opco » : impossible
 *    d'émettre la seconde facture, celle du reste à charge à l'entreprise ;
 * 2. aucune facture n'était rattachée à son dossier, ce qui rendait le pont
 *    encaissement → dossier inopérant.
 *
 * La règle métier n'a jamais été douteuse (plan, Lot 8, étape 6) : **l'OPCO
 * paie sa part, le client le reste à charge**. Ce qui manquait était le chemin.
 */

import { describe, expect, it } from "vitest";
import {
  choisirCreancePourFacture,
  destinatairesFacturables,
  type CreanceFacturable,
} from "./facture-par-creance";

function creance(patch: Partial<CreanceFacturable> = {}): CreanceFacturable {
  return {
    id: "cr-1",
    payeurType: "entreprise",
    payeurNom: "Acme",
    montantAttenduCents: 100000,
    factureFormationId: null,
    ...patch,
  };
}

/** Un dossier subrogé typique : l'OPCO couvre 200 €, l'entreprise doit 100 €. */
const DOSSIER_SUBROGE: CreanceFacturable[] = [
  creance({
    id: "cr-opco",
    payeurType: "opco_subroge",
    payeurNom: "Atlas",
    montantAttenduCents: 20000,
  }),
  creance({
    id: "cr-ent",
    payeurType: "entreprise",
    payeurNom: "Acme",
    montantAttenduCents: 10000,
  }),
];

describe("🔴 le reste à charge est facturable à l'entreprise, même en subrogation", () => {
  it("choisir « entreprise » rend la créance de l'entreprise", () => {
    const r = choisirCreancePourFacture(DOSSIER_SUBROGE, "entreprise");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.creance.payeurNom).toBe("Acme");
    expect(r.montantHtCents).toBe(10000);
  });

  it("choisir « opco » rend la créance de l'OPCO, pour SA part seulement", () => {
    // 🔴 Le montant vient de la créance, pas de la session. Facturer le total à
    // l'OPCO puis le reste à l'entreprise réclamerait deux fois la même somme.
    const r = choisirCreancePourFacture(DOSSIER_SUBROGE, "opco");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.montantHtCents).toBe(20000);
  });

  it("les DEUX destinataires sont proposés — c'est ce qui rend les deux factures possibles", () => {
    expect(destinatairesFacturables(DOSSIER_SUBROGE).sort()).toEqual(["entreprise", "opco"]);
  });

  it("la somme des deux créances égale le dû total — rien n'est réclamé deux fois", () => {
    const opco = choisirCreancePourFacture(DOSSIER_SUBROGE, "opco");
    const ent = choisirCreancePourFacture(DOSSIER_SUBROGE, "entreprise");
    expect(opco.ok && ent.ok && opco.montantHtCents + ent.montantHtCents).toBe(30000);
  });
});

describe("🔴 on ne facture pas un débiteur que le dossier ne reconnaît pas", () => {
  it("refuse « opco » sur un dossier sans créance OPCO — le trou « opco sans subrogation »", () => {
    const r = choisirCreancePourFacture([creance()], "opco");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("destinataire_inconnu");
  });

  it("le refus NOMME les débiteurs réels au lieu de dire « invalide »", () => {
    const r = choisirCreancePourFacture(DOSSIER_SUBROGE, "stagiaire");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // Un refus qui dit seulement « destinataire invalide » laisse chercher.
    expect(r.message).toContain("Atlas");
    expect(r.message).toContain("Acme");
  });
});

describe("🔴 anti-double-émission : chaque facture consomme un numéro LÉGAL", () => {
  it("refuse une créance déjà facturée", () => {
    const r = choisirCreancePourFacture([creance({ factureFormationId: "f-1" })], "entreprise");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("deja_facturee");
  });

  it("une créance déjà facturée sort des destinataires proposés", () => {
    const partiel = [
      creance({
        id: "cr-opco",
        payeurType: "opco_subroge",
        payeurNom: "Atlas",
        factureFormationId: "f-1",
      }),
      creance({ id: "cr-ent", payeurType: "entreprise", payeurNom: "Acme" }),
    ];
    // Proposer un choix qui sera refusé au clic est la définition d'un écran
    // qui ment.
    expect(destinatairesFacturables(partiel)).toEqual(["entreprise"]);
  });

  it("mais une SECONDE créance du même type reste facturable", () => {
    // Deux employeurs distincts en inter-entreprises : facturer l'un ne doit
    // pas bloquer l'autre.
    const inter = [
      creance({ id: "a", payeurNom: "Acme", factureFormationId: "f-1" }),
      creance({ id: "b", payeurNom: "Beta" }),
    ];
    const r = choisirCreancePourFacture(inter, "entreprise");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.creance.id).toBe("b");
  });
});

describe("les cas où l'on ne facture pas", () => {
  it("une créance NULLE ne se facture pas — rien à encaisser", () => {
    // Subrogation totale : le reste à charge est nul, la ligne est conservée
    // pour que le dossier ait toujours un débiteur, mais l'émettre produirait
    // une facture à zéro.
    const r = choisirCreancePourFacture([creance({ montantAttenduCents: 0 })], "entreprise");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("montant_nul");
  });

  it("🔴 aucun dossier → `aucune_creance`, PAS une erreur", () => {
    // Un dossier peut légitimement ne pas exister : financement direct, affaire
    // antérieure au mécanisme. L'appelant retombe alors sur le comportement
    // historique — refuser ici bloquerait une émission licite.
    const r = choisirCreancePourFacture([], "entreprise");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.raison).toBe("aucune_creance");
  });

  it("aucun destinataire proposé quand tout est facturé ou nul", () => {
    expect(
      destinatairesFacturables([
        creance({ factureFormationId: "f-1" }),
        creance({ id: "z", montantAttenduCents: 0 }),
      ]),
    ).toEqual([]);
  });
});

describe("la correspondance créance → destinataire est un-pour-un", () => {
  it.each([
    ["opco_subroge", "opco"],
    ["entreprise", "entreprise"],
    ["france_travail", "france_travail"],
    ["stagiaire", "stagiaire"],
  ] as const)("%s → %s", (payeurType, destinataire) => {
    const r = choisirCreancePourFacture([creance({ payeurType })], destinataire);
    expect(r.ok, `${payeurType} n'a pas résolu vers ${destinataire}`).toBe(true);
  });
});
