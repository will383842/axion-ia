/**
 * Contrat-cadre v3 — ce que sa signature exige en plus d'une pièce ordinaire
 * (lot L7c, ADR 0066 étape 7).
 *
 *  · la partie `sous_traitant` signe avec un CODE à usage unique reçu par
 *    e-mail (`code-signature.ts`, gabarit F17) ;
 *  · le registre public est relu PAR LE CONTRÔLE DU LOT L4
 *    (`controlerRegistreFormateur` : verdict et ligne de preuve en ajout seul).
 *    À la signature, un contrôle de moins de 30 jours non rouge suffit, sinon
 *    un contrôle est fait ; à la contresignature, un contrôle est TOUJOURS
 *    fait (la vérification a lieu lors de la conclusion) : rouge = refus,
 *    registre muet = refus (« réessayez »). Un orange pour une autre raison
 *    (numéro de déclaration en cours, activité à contrôler) ne bloque pas : le
 *    contrat se signe sans numéro (article 19), l'écran W-4 (L9) le montre.
 *
 * 🔑 LIVRÉ ÉTEINT PAR CONSTRUCTION. Tout ici ne vise que le contrat-cadre de
 * version 3 ou plus (`templates/versions-arretees.ts`). Aucun appelant n'émet
 * encore de v3 : les contrats v2 des organismes se signent exactement comme
 * avant, sans code ni lecture du registre.
 *
 * Module neutre (ni `server-only`, ni Next) : lisible par le worker.
 */

import { prisma } from "@/lib/prisma";
import { lireRegistre, type ResultatRegistre } from "@/features/apporteurs-reseau/annuaire";
import { versionGabaritInstantane } from "@/server/qualiopi/documents/templates/gabarit-versions";
import {
  controlerRegistreFormateur,
  type SourceRegistre,
} from "@/server/qualiopi/formateurs-independants/controle";
import { etatControle } from "@/server/qualiopi/formateurs-independants/controle-regles";

import type { PartieSignataire } from "./document-signature-hash";

/** Première version du contrat de sous-traitance signée avec un code. */
export const VERSION_CONTRAT_CADRE_AVEC_CODE = 3;

function versionDeLaPiece(metadata: unknown): number {
  if (typeof metadata !== "object" || metadata === null) return 1;
  return versionGabaritInstantane((metadata as Record<string, unknown>)["renderData"]);
}

/** Vrai pour un contrat-cadre de sous-traitance en version 3 ou plus. */
export function estContratCadre(type: string, metadata: unknown): boolean {
  return (
    type === "contrat_sous_traitance" &&
    versionDeLaPiece(metadata) >= VERSION_CONTRAT_CADRE_AVEC_CODE
  );
}

/** La signature de cette partie, sur cette pièce, exige-t-elle un code ? */
export function codeRequis(type: string, metadata: unknown, partie: PartieSignataire): boolean {
  return estContratCadre(type, metadata) && partie === "sous_traitant";
}

/**
 * « jeanne.martin@exemple.fr » → « j***@e***.fr ». Ce qui s'affiche à l'écran
 * après l'envoi du code : assez pour reconnaître son adresse, pas assez pour la
 * lire.
 */
export function masquerAdresse(email: string): string {
  const [local = "", domaine = ""] = email.trim().split("@");
  const point = domaine.lastIndexOf(".");
  const nom = point > 0 ? domaine.slice(0, point) : domaine;
  const extension = point > 0 ? domaine.slice(point) : "";
  return `${local.slice(0, 1)}***@${nom.slice(0, 1)}***${extension}`;
}

/** Comparaison d'adresses : casse et espaces ignorés. */
export function memeAdresse(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  return n(a) !== "" && n(a) === n(b);
}

export type LecteurRegistre = (identifiant: string) => Promise<ResultatRegistre>;

/**
 * Le registre des entreprises commun, vu par le PORT du contrôle L4. Le client
 * est celui du réseau apporteurs, réutilisé tel quel : il rejoindra le module
 * neutre au lot FAC-5, sans rien changer ici. La liste publique des organismes
 * de formation n'a pas encore de client : elle répond « muette », ce qui
 * donne au plus un orange, jamais un rouge.
 */
export function sourceRegistreAnnuaire(lecteur: LecteurRegistre = lireRegistre): SourceRegistre {
  return {
    async lireEntreprise(siret) {
      const r = await lecteur(siret);
      if (!r.ok) {
        if (r.raison === "indisponible") return null;
        // Introuvable : un registre qui RÉPOND sans l'établissement.
        return { siren: siret.slice(0, 9), etatAdministratif: "A", naf: null, etablissement: null };
      }
      return {
        siren: r.entreprise.siren,
        etatAdministratif: "A",
        naf: r.entreprise.naf,
        etablissement: { siret: r.entreprise.siret ?? siret, ouvert: r.entreprise.active },
      };
    },
    async lireListeOF() {
      return null;
    },
  };
}

const MESSAGES = {
  sansFiche:
    "Le contrat ne peut pas être signé pour l'instant : votre dossier est incomplet. Votre interlocuteur chez Axion-IA va le compléter.",
  nonConforme:
    "Votre entreprise n'apparaît pas active au registre public des entreprises : le contrat ne peut pas être signé. Si votre situation a changé, répondez à notre e-mail.",
  contresignerSansFiche:
    "Contresignature impossible : la fiche du cocontractant n'est pas celle d'un formateur indépendant.",
  contresignerNonConforme:
    "Contresignature impossible : le registre public signale l'entreprise du cocontractant comme fermée ou cessée, ou son numéro de déclaration au nom d'une autre entreprise.",
  contresignerMuet:
    "Le registre public ne répond pas pour l'instant : la contresignature exige sa lecture. Réessayez dans quelques minutes.",
  organisme:
    "Ce contrat d'organisme ne peut pas encore être signé en ligne. Contactez votre interlocuteur chez Axion-IA.",
} as const;

/** Lignes de contrôle d'un formateur, pour en lire l'état (L4). */
async function etatDuControle(trainerId: string, maintenant: Date) {
  const lignes = await prisma.verificationRegistreSousTraitance.findMany({
    where: { trainerId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { verdict: true, source: true, verifieAt: true, createdAt: true },
  });
  return etatControle(lignes, maintenant);
}

/**
 * Objection propre au contrat-cadre v3, pour une partie qui s'apprête à signer.
 * `null` = rien à objecter. Toute autre pièce rend `null` sans rien lire.
 *
 * `adminId` : l'administrateur qui contresigne, auteur de la ligne de contrôle.
 */
export async function objectionContratCadre(input: {
  readonly documentGenereId: string;
  readonly type: string;
  readonly metadata: unknown;
  readonly partie: PartieSignataire;
  readonly adminId?: string | null;
  readonly maintenant?: Date;
  readonly source?: SourceRegistre;
}): Promise<{ message: string } | null> {
  if (!estContratCadre(input.type, input.metadata)) return null;
  if (input.partie !== "sous_traitant" && input.partie !== "axionia") return null;

  const maintenant = input.maintenant ?? new Date();
  const contresigne = input.partie === "axionia";

  const piece = await prisma.documentGenere.findUnique({
    where: { id: input.documentGenereId },
    select: { trainerId: true },
  });
  if (piece === null) return { message: "Pièce introuvable." };
  // Contrat d'organisme : son circuit vient avec le lot des organismes.
  if (piece.trainerId === null) return { message: MESSAGES.organisme };

  // Signature : un contrôle probant de moins de 30 jours suffit ; un rouge
  // récent refuse sans relire.
  if (!contresigne) {
    const etat = await etatDuControle(piece.trainerId, maintenant);
    if (etat.statut === "rouge") return { message: MESSAGES.nonConforme };
    if (etat.probant) return null;
  }

  const r = await controlerRegistreFormateur(prisma, input.source ?? sourceRegistreAnnuaire(), {
    trainerId: piece.trainerId,
    verifieParId: contresigne ? (input.adminId ?? null) : null,
    maintenant,
  });
  if (!r.ok) return { message: contresigne ? MESSAGES.contresignerSansFiche : MESSAGES.sansFiche };
  if (r.verdict === "rouge") {
    return { message: contresigne ? MESSAGES.contresignerNonConforme : MESSAGES.nonConforme };
  }
  // Registre muet : la signature passe (la contresignature relira) ; la
  // contresignature, elle, ne se fait jamais sans lecture.
  if (contresigne && r.motifs.includes("registre_muet")) {
    return { message: MESSAGES.contresignerMuet };
  }
  return null;
}
