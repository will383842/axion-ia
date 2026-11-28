/** Lot 5 : lecture (base) de l'état de la section « Mon compte bancaire ». Application seulement. */
import "server-only";

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

import { quatreDerniersCaracteres, seuilExpiration } from "./changement-iban-regles";
import { etatSectionCompte, type EtatSection } from "./changement-iban-espace";
import { changementIbanActif, secretEmpreinteDisponible } from "./interrupteur-changement-iban";
import { lireIbanClair } from "./iban-purge";

export interface SectionCompte {
  readonly etat: EtatSection;
  /** « 1234 » : le compte actuel, jamais l'IBAN entier. */
  readonly fin4: string | null;
  readonly demandeId: string | null;
  readonly demandeeAt: Date | null;
  readonly confirmeeAt: Date | null;
}

export async function lireSectionCompte(
  apporteurId: string,
  restreint: boolean,
): Promise<SectionCompte> {
  const vide = (etat: EtatSection): SectionCompte => ({
    etat,
    fin4: null,
    demandeId: null,
    demandeeAt: null,
    confirmeeAt: null,
  });
  if (restreint) return vide({ etat: "absente" });
  const fiche = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { statut: true, iban: true, telephone: true },
  });
  if (!fiche) return vide({ etat: "absente" });
  const iban = lireIbanClair(fiche.iban);
  const fin4 = iban ? quatreDerniersCaracteres(iban) : null;
  const interrupteur = changementIbanActif();
  const secret = secretEmpreinteDisponible();
  let d: Awaited<ReturnType<typeof prisma.apporteurChangementIban.findFirst>> = null;
  if (interrupteur && secret) {
    try {
      d = await prisma.apporteurChangementIban.findFirst({
        where: { apporteurId },
        orderBy: { demandeeAt: "desc" },
      });
    } catch (err) {
      if ((err as { code?: unknown })?.code === "P2021") {
        return { ...vide({ etat: "ferme" }), fin4 };
      }
      throw err;
    }
  }
  // Une demande jamais confirmée et périmée se lit « expirée » sans attendre le balayage.
  const statut =
    d && d.statut === "a_confirmer" && d.demandeeAt < seuilExpiration(new Date())
      ? "expiree"
      : d?.statut;
  const etat = etatSectionCompte({
    signe: fiche.statut === "signe",
    restreint,
    interrupteur,
    secret,
    aTelephone: !!decryptPii(fiche.telephone)?.trim(),
    demande:
      d && statut
        ? {
            statut: statut as never,
            demandeeAt: d.demandeeAt,
            confirmeeAt: d.confirmeeAt,
            motifRefus: d.motifRefus,
          }
        : null,
  });
  return {
    etat,
    fin4,
    demandeId: d?.id ?? null,
    demandeeAt: d?.demandeeAt ?? null,
    confirmeeAt: d?.confirmeeAt ?? null,
  };
}

export type LienCompte = { action: "confirmer"; fin4: string } | { action: "bloquer" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lecture SANS EFFET d'un lien de l'e-mail : de quelle action s'agit-il ? `null` pour tout lien
 * faux, périmé, déjà utilisé, d'une autre demande ou service fermé : une seule réponse neutre.
 */
export async function lireLienCompte(
  demandeId: string,
  signature: string,
): Promise<LienCompte | null> {
  if (!changementIbanActif() || !secretEmpreinteDisponible() || !UUID.test(demandeId)) return null;
  const { signatureBloquerValide, signatureConfirmerValide } =
    await import("./jeton-changement-iban");
  let d;
  try {
    d = await prisma.apporteurChangementIban.findUnique({ where: { id: demandeId } });
  } catch (err) {
    if ((err as { code?: unknown })?.code === "P2021") return null;
    throw err;
  }
  if (!d) return null;
  if (
    d.statut === "a_confirmer" &&
    d.demandeeAt >= seuilExpiration(new Date()) &&
    signatureConfirmerValide(d.id, d.apporteurId, signature)
  ) {
    return { action: "confirmer", fin4: d.ibanFin4 };
  }
  if (
    (d.statut === "a_confirmer" || d.statut === "confirmee") &&
    signatureBloquerValide(d.id, d.apporteurId, signature)
  ) {
    return { action: "bloquer" };
  }
  return null;
}
