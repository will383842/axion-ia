/**
 * Contrat-cadre v3 — ce que sa signature exige en plus d'une pièce ordinaire
 * (lot L7c, ADR 0066 étape 7).
 *
 *  · la partie `sous_traitant` signe avec un CODE à usage unique reçu par
 *    e-mail (`code-signature.ts`, gabarit F17) ;
 *  · le registre public est relu PAR LE CONTRÔLE DU LOT L4
 *    (`controlerRegistreFormateur` : verdict et ligne de preuve en ajout seul).
 *    🔴 Aucun contrat sans SIREN ACTIF CONFIRMÉ (règle du propriétaire) : la
 *    signature, la demande de code et la contresignature exigent un contrôle
 *    qui CONFIRME l'entreprise active et l'établissement ouvert. Introuvable,
 *    fermé, cessé, registre muet, délai, état « non dit » = refus, avec un
 *    message qui oriente. À la signature, un tel contrôle de moins de 30 jours
 *    suffit, sinon un contrôle est fait ; à la contresignature, un contrôle est
 *    TOUJOURS fait (la vérification a lieu lors de la conclusion). Un orange
 *    qui ne porte que sur le numéro de déclaration (en cours, hors liste) ou
 *    l'activité ne bloque pas : le contrat se signe sans numéro (article 19),
 *    l'écran W-4 (L9) le montre.
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
import type { VerdictRegistre } from "../../../../../prisma/generated/client";
import {
  SOURCE_REGISTRE,
  controlerRegistreFormateur,
  type SourceRegistre,
} from "@/server/qualiopi/formateurs-independants/controle";
import {
  FRAICHEUR_CONTROLE_JOURS,
  etatControle,
  type MotifControle,
} from "@/server/qualiopi/formateurs-independants/controle-regles";

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
 *
 * 🔴 N'affirme que ce que le registre a DIT. Le client ne rend qu'un « actif »
 * global (unité légale ET établissement) : l'état du SIREN n'est donc écrit
 * « A » que sur un actif confirmé, et laissé `null` (« non dit ») sinon — un
 * établissement introuvable ou fermé n'a jamais un SIREN déclaré actif dans la
 * preuve.
 */
export function sourceRegistreAnnuaire(lecteur: LecteurRegistre = lireRegistre): SourceRegistre {
  return {
    async lireEntreprise(siret) {
      const r = await lecteur(siret);
      if (!r.ok) {
        if (r.raison === "indisponible") return null;
        // Introuvable : un registre qui RÉPOND sans l'établissement, sans rien dire de l'état.
        return {
          siren: siret.slice(0, 9),
          etatAdministratif: null,
          naf: null,
          etablissement: null,
        };
      }
      const actif = r.entreprise.active === true;
      return {
        siren: r.entreprise.siren,
        etatAdministratif: actif ? "A" : null,
        naf: r.entreprise.naf,
        etablissement: { siret: r.entreprise.siret ?? siret, ouvert: actif },
      };
    },
    async lireListeOF() {
      return null;
    },
  };
}

/**
 * Motifs qui laissent l'entreprise CONFIRMÉE ACTIVE : ils ne portent que sur
 * l'activité déclarée ou le numéro de déclaration (le contrat se signe sans
 * numéro, article 19). Liste FERMÉE : tout autre motif — SIRET absent, registre
 * muet, établissement introuvable ou fermé, SIREN cessé, et tout motif futur —
 * refuse.
 */
const MOTIFS_SANS_EFFET_SUR_L_ENTREPRISE: ReadonlySet<string> = new Set<MotifControle>([
  "activite_a_controler",
  "nda_absent",
  "nda_en_cours",
  "liste_of_muette",
  "nda_non_verifie",
  "nda_hors_liste",
]);

/**
 * 🔑 RÈGLE DU PROPRIÉTAIRE : aucun contrat sans SIREN ACTIF confirmé par le
 * registre. Vrai seulement pour un verdict non rouge dont TOUS les motifs sont
 * étrangers à l'état de l'entreprise.
 */
export function entrepriseActiveConfirmee(
  verdict: VerdictRegistre,
  motifs: ReadonlyArray<string>,
): boolean {
  return verdict !== "rouge" && motifs.every((m) => MOTIFS_SANS_EFFET_SUR_L_ENTREPRISE.has(m));
}

/**
 * La PREUVE inscrite (réponse du registre, en canonique) dit-elle, pour CE
 * SIRET, un SIREN actif et un établissement ouvert ? Relue pour ne jamais se
 * fier au seul libellé d'un motif.
 */
export function preuveEntrepriseActive(reponseSource: unknown, siret: string): boolean {
  if (typeof reponseSource !== "object" || reponseSource === null) return false;
  const e = (reponseSource as Record<string, unknown>)["entreprise"];
  if (typeof e !== "object" || e === null) return false;
  const ent = e as Record<string, unknown>;
  const etab = ent["etablissement"];
  if (typeof etab !== "object" || etab === null) return false;
  const et = etab as Record<string, unknown>;
  return ent["etatAdministratif"] === "A" && et["ouvert"] === true && et["siret"] === siret;
}

const MESSAGES = {
  sansFiche:
    "Le contrat ne peut pas être signé pour l'instant : votre dossier est incomplet. Votre interlocuteur chez Axion-IA va le compléter.",
  nonConfirme:
    "Le contrat ne peut pas être signé pour l'instant : le registre public des entreprises ne confirme pas que l'entreprise du SIRET indiqué dans votre dossier est active. Vérifiez ce numéro dans votre dossier ; si votre entreprise vient d'être immatriculée ou si sa situation a changé, répondez à notre e-mail et nous reprendrons la vérification avec vous.",
  muet: "Le registre public des entreprises ne répond pas pour l'instant, et le contrat ne se signe qu'après sa lecture. Réessayez dans quelques minutes ; si cela persiste, répondez à notre e-mail.",
  ndaAutreSiren:
    "Le contrat ne peut pas être signé pour l'instant : sur la liste publique, le numéro de déclaration d'activité de votre dossier est inscrit au nom d'une autre entreprise. Vérifiez ce numéro ; s'il est exact, répondez à notre e-mail et nous reprendrons la vérification avec vous.",
  contresignerSansFiche:
    "Contresignature impossible : la fiche du cocontractant n'est pas celle d'un formateur indépendant.",
  contresignerNonConfirme:
    "Contresignature impossible : le registre public ne confirme pas que l'entreprise du cocontractant est active (SIRET absent ou introuvable, établissement fermé ou entreprise cessée). Vérifiez le SIRET de la fiche, puis réessayez.",
  contresignerNdaAutreSiren:
    "Contresignature impossible : le numéro de déclaration du cocontractant est inscrit, sur la liste publique, au nom d'une autre entreprise.",
  contresignerMuet:
    "Le registre public ne répond pas pour l'instant : la contresignature exige sa lecture. Réessayez dans quelques minutes.",
  organisme:
    "Ce contrat d'organisme ne peut pas encore être signé en ligne. Contactez votre interlocuteur chez Axion-IA.",
} as const;

/** Le message qui oriente, selon ce que le registre a (ou n'a pas) dit. */
function messageRefus(motifs: ReadonlyArray<string>, contresigne: boolean): string {
  const ent = motifs.filter((m) => !MOTIFS_SANS_EFFET_SUR_L_ENTREPRISE.has(m));
  // Registre muet SEUL (aucune réponse) : « réessayez ». Un introuvable porte en
  // plus « établissement introuvable » : c'est le numéro qu'il faut vérifier.
  if (ent.length > 0 && ent.every((m) => m === "registre_muet")) {
    return contresigne ? MESSAGES.contresignerMuet : MESSAGES.muet;
  }
  if (ent.length === 0 && motifs.includes("nda_autre_siren")) {
    return contresigne ? MESSAGES.contresignerNdaAutreSiren : MESSAGES.ndaAutreSiren;
  }
  return contresigne ? MESSAGES.contresignerNonConfirme : MESSAGES.nonConfirme;
}

function motifsDeLaLigne(motif: string | null): string[] {
  return motif === null || motif === "" ? [] : motif.split(",").map((m) => m.trim());
}

const JOUR_MS = 24 * 3600 * 1000;

/**
 * Signature : le dernier contrôle INTERROGÉ (jamais une ligne de validation),
 * de moins de 30 jours, au SIRET actuel de la fiche, qui confirme l'entreprise
 * active dans sa preuve. `rouge` = le dernier état connu refuse sans relire ;
 * `a_refaire` = rien de probant, on interroge.
 */
async function controleRecent(
  trainerId: string,
  siretFiche: string,
  maintenant: Date,
): Promise<{ issue: "confirme" | "a_refaire" } | { issue: "rouge"; motifs: string[] }> {
  const lignes = await prisma.verificationRegistreSousTraitance.findMany({
    where: { trainerId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      verdict: true,
      source: true,
      verifieAt: true,
      createdAt: true,
      motif: true,
      siret: true,
      reponseSource: true,
    },
  });
  const etat = etatControle(lignes, maintenant);
  if (etat.statut === "rouge") {
    const derniere = [...lignes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    // Un rouge porté par un AUTRE SIRET que celui de la fiche (numéro corrigé
    // depuis) ne ferme pas la porte : le registre est relu, sans impasse.
    if (derniere !== undefined && derniere.siret !== siretFiche) return { issue: "a_refaire" };
    return { issue: "rouge", motifs: motifsDeLaLigne(derniere?.motif ?? null) };
  }
  const l = [...lignes]
    .filter((x) => x.source === SOURCE_REGISTRE)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (l === undefined) return { issue: "a_refaire" };
  const at = l.verifieAt.getTime();
  const frais =
    !Number.isNaN(at) &&
    at <= maintenant.getTime() &&
    maintenant.getTime() - at <= FRAICHEUR_CONTROLE_JOURS * JOUR_MS;
  const probant =
    frais &&
    siretFiche !== "" &&
    l.siret === siretFiche &&
    entrepriseActiveConfirmee(l.verdict, motifsDeLaLigne(l.motif)) &&
    preuveEntrepriseActive(l.reponseSource, siretFiche);
  return { issue: probant ? "confirme" : "a_refaire" };
}

/**
 * Objection propre au contrat-cadre v3, pour une partie qui s'apprête à signer
 * (ou à demander le code qui permet de signer). `null` = rien à objecter. Toute
 * autre pièce rend `null` sans rien lire.
 *
 * 🔴 FERMÉ PAR DÉFAUT : seul un SIREN actif et un établissement ouvert,
 * CONFIRMÉS par le registre et inscrits dans une preuve datée, laissent signer
 * ou contresigner. Introuvable, fermé, cessé, réponse vide, panne, délai, état
 * « non dit » : refus, avec un message qui oriente.
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
  const contresigne = input.partie === "axionia";
  // Une v3 ne connaît que ces deux parties : toute autre est refusée, jamais laissée passer.
  if (input.partie !== "sous_traitant" && !contresigne) {
    return { message: MESSAGES.organisme };
  }

  const maintenant = input.maintenant ?? new Date();

  const piece = await prisma.documentGenere.findUnique({
    where: { id: input.documentGenereId },
    select: { trainerId: true, trainer: { select: { siret: true } } },
  });
  if (piece === null) return { message: "Pièce introuvable." };
  // Contrat d'organisme : son circuit vient avec le lot des organismes.
  if (piece.trainerId === null) return { message: MESSAGES.organisme };

  // Signature : un contrôle de moins de 30 jours qui CONFIRME l'entreprise
  // active, au SIRET actuel de la fiche, suffit ; un rouge récent refuse sans
  // relire. Contresignature : toujours relu.
  if (!contresigne) {
    const siretFiche = (piece.trainer?.siret ?? "").replace(/\s+/g, "");
    const recent = await controleRecent(piece.trainerId, siretFiche, maintenant);
    if (recent.issue === "rouge") return { message: messageRefus(recent.motifs, false) };
    if (recent.issue === "confirme") return null;
  }

  let r: Awaited<ReturnType<typeof controlerRegistreFormateur>>;
  try {
    r = await controlerRegistreFormateur(prisma, input.source ?? sourceRegistreAnnuaire(), {
      trainerId: piece.trainerId,
      verifieParId: contresigne ? (input.adminId ?? null) : null,
      maintenant,
    });
  } catch {
    // Preuve non inscrite (base, journal) : rien n'est confirmé, rien ne se signe.
    return { message: contresigne ? MESSAGES.contresignerMuet : MESSAGES.muet };
  }
  if (!r.ok) return { message: contresigne ? MESSAGES.contresignerSansFiche : MESSAGES.sansFiche };
  if (!entrepriseActiveConfirmee(r.verdict, r.motifs)) {
    return { message: messageRefus(r.motifs, contresigne) };
  }
  return null;
}
