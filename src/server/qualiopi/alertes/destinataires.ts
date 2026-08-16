/**
 * Lot 14 (T3b) — De quel GUICHET à quelles ADRESSES.
 *
 * `routage.ts` décide qui doit agir ; ce fichier-ci trouve son adresse. La
 * séparation n'est pas cosmétique : le routage est une règle métier stable et
 * testable sans base, la résolution dépend de l'annuaire des comptes admin du
 * jour.
 *
 * ## 🔴 Les deux façons dont ce module peut mentir, et leur traitement
 *
 * 1. **Un guichet sans titulaire.** Personne ne porte le rôle
 *    `responsable_qualite` — c'est le cas au 16/08/2026, et c'est même l'objet
 *    d'une alerte (`responsable_qualite_absent`). Router vers une liste vide
 *    ferait disparaître l'alerte en silence : le canal unique était bruyant,
 *    une liste vide serait muette, et **muet est pire**. On retombe donc sur
 *    l'adresse de secours, et la dégradation est RENDUE (`replis`), jamais
 *    devinée.
 *
 * 2. **Le guichet `formateur`.** Écrire à cent formateurs sous-traitants au
 *    sujet d'un manquement de conformité est une décision commerciale — pas un
 *    effet de bord technique. Tant que `ALERTES_ECRIRE_AUX_FORMATEURS` n'est
 *    pas explicitement à `"true"`, ces alertes vont au guichet qualité **en
 *    nommant le formateur concerné**, et le repli est déclaré. Le jour où Will
 *    tranche, un drapeau suffit ; aucun code à réécrire.
 */

import { prisma } from "@/lib/prisma";
import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import type { RoleAdmin } from "@/server/auth/habilitations";
import { GUICHETS, LIBELLE_GUICHET, ROLES_PAR_GUICHET, type GuichetAlerte } from "./routage";

/**
 * L'adresse de dernier recours — **empruntée au SSOT**, jamais réécrite.
 *
 * 🔴 Ma première version recopiait ici la chaîne d'origine de
 * `notifierAlerteInterne`, repli en dur sur une adresse Gmail personnelle
 * compris. La garde `destinataires-internes.spec.ts` l'a refusée en CI — et elle avait
 * raison : le Lot 13 venait précisément de supprimer cette adresse personnelle
 * de deux endroits, dont un qui envoyait le CV complet d'un candidat hors du
 * domaine de l'organisme. Recopier un repli, c'est ressusciter celui qu'on
 * vient d'enterrer.
 *
 * Ce module ne connaît donc plus aucune adresse. Il demande.
 */
function adresseDeSecours(): string {
  return destinataireAlertesInternes();
}

/** Le drapeau qui ouvre le guichet `formateur` vers l'extérieur. */
export function ecritureAuxFormateursActivee(): boolean {
  return process.env["ALERTES_ECRIRE_AUX_FORMATEURS"] === "true";
}

export interface DestinatairesGuichet {
  readonly guichet: GuichetAlerte;
  /** Les adresses réellement retenues. Jamais vide. */
  readonly adresses: ReadonlyArray<string>;
  /**
   * Pourquoi on n'a PAS pu servir le guichet nominal, s'il y a lieu.
   * `null` = le guichet a bien ses titulaires.
   *
   * 🔴 Ce champ est le livrable, autant que les adresses : il doit apparaître
   * dans le message envoyé. Un repli silencieux redevient un canal global.
   */
  readonly repli: string | null;
}

function isStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/**
 * Résout tous les guichets en une passe.
 *
 * 🔴 Une seule requête pour tous les guichets, pas une par guichet : à quatre
 * guichets et un cron quotidien c'est indolore, mais c'est le patron que T3a
 * vient d'imposer au même domaine (`createMany` au lieu de N allers-retours),
 * et un patron qu'on abandonne à un endroit revient partout.
 */
export async function resoudreDestinataires(): Promise<Map<GuichetAlerte, DestinatairesGuichet>> {
  const secours = adresseDeSecours();
  const resultat = new Map<GuichetAlerte, DestinatairesGuichet>();

  let comptes: { email: string; role: RoleAdmin }[] = [];
  if (!isStub()) {
    try {
      comptes = (await prisma.adminUser.findMany({
        where: { status: "active" },
        select: { email: true, role: true },
      })) as { email: string; role: RoleAdmin }[];
    } catch (err) {
      // Fail-soft DÉCLARÉ : sans annuaire, tout part au secours plutôt que
      // nulle part. Une panne d'annuaire ne doit pas éteindre les alertes.
      console.error(
        "[alertes-destinataires] annuaire des comptes admin illisible — repli sur l'adresse de secours :",
        err instanceof Error ? err.message : String(err),
      );
      for (const g of GUICHETS) {
        resultat.set(g, {
          guichet: g,
          adresses: [secours],
          repli: "annuaire des comptes admin illisible",
        });
      }
      return resultat;
    }
  }

  for (const guichet of GUICHETS) {
    if (guichet === "formateur" && !ecritureAuxFormateursActivee()) {
      const qualite = adressesPourRoles(comptes, ROLES_PAR_GUICHET["qualite"]);
      resultat.set(guichet, {
        guichet,
        adresses: qualite.length > 0 ? qualite : [secours],
        repli:
          "l'écriture directe aux formateurs n'est pas activée " +
          "(ALERTES_ECRIRE_AUX_FORMATEURS) — routé vers le guichet qualité, " +
          "le formateur concerné est nommé dans le message",
      });
      continue;
    }

    const adresses = adressesPourRoles(comptes, ROLES_PAR_GUICHET[guichet]);
    if (adresses.length > 0) {
      resultat.set(guichet, { guichet, adresses, repli: null });
    } else {
      resultat.set(guichet, {
        guichet,
        adresses: [secours],
        repli: `aucun compte actif ne dessert le guichet « ${LIBELLE_GUICHET[guichet]} » (rôles attendus : ${ROLES_PAR_GUICHET[guichet].join(", ") || "aucun"})`,
      });
    }
  }

  return resultat;
}

/**
 * Les adresses des comptes portant l'un des rôles, dans l'ordre des rôles.
 *
 * ⚠️ L'ordre suit `ROLES_PAR_GUICHET`, qui place le rôle SPÉCIALISÉ avant les
 * rôles généralistes : le responsable qualité arrive avant l'admin. Trier par
 * e-mail mettrait un `admin@` devant un `qualite@` par pur hasard alphabétique.
 * Dédoublonné : un même compte ne reçoit pas deux fois le même message.
 */
function adressesPourRoles(
  comptes: ReadonlyArray<{ email: string; role: RoleAdmin }>,
  roles: ReadonlyArray<RoleAdmin>,
): string[] {
  const vues = new Set<string>();
  const sorties: string[] = [];
  for (const role of roles) {
    for (const c of comptes) {
      if (c.role !== role) continue;
      const email = c.email.trim().toLowerCase();
      if (email === "" || vues.has(email)) continue;
      vues.add(email);
      sorties.push(email);
    }
  }
  return sorties;
}
