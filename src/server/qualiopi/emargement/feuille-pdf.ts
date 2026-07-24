/**
 * Qualiopi T13 — Données de la feuille d'émargement à produire en PDF.
 *
 * ## Ce que ce module corrige
 *
 * Le PDF affichait une DATE UNIQUE et un « 09h00–17h00 » codé en dur, sans
 * modules, sans écart de signature, sans rien des signatures elles-mêmes. Sur
 * une session de plusieurs jours, la pièce était donc fausse — et
 * `CAA Nantes 20/04/2021` sanctionne précisément les feuilles sans horaires
 * exacts, sans nom de formateur, et aux intitulés divergents entre documents.
 *
 * ## L'ancrage de chaîne — la mitigation qui manquait
 *
 * Un chaînage ne détecte JAMAIS la suppression des DERNIERS maillons : retirer
 * les signatures de fin laisse un préfixe parfaitement valide. Il faut un point
 * fixe hors de la base.
 *
 * Ce PDF l'est : il est numéroté séquentiellement, haché et stocké sur R2. En y
 * imprimant, pour chaque stagiaire, le NOMBRE de signatures et l'empreinte de
 * tête au moment du tirage, on rend la troncature détectable — il suffit de
 * comparer. Le document devient l'ancre que le registre seul ne peut pas être.
 *
 * ## La mitigation obligatoire de D13
 *
 * La fenêtre de signature va jusqu'à la fin de session + 48 h, contre la
 * recommandation initiale. L'écart entre `signeAt` et le créneau DOIT donc
 * apparaître : un écart de 40 h visible et assumé se défend, le même écart muet
 * ne se défend pas — cf. CAA Nantes 20/04/2021 sur les signatures aux dates
 * impossibles.
 *
 * Stub-safe : retourne `null` au build SSG.
 */

import { prisma } from "@/lib/prisma";
import { parisDateISO, parisMinutesDuJour } from "@/server/qualiopi/presence/time";
import type { DemiJourneeLabel } from "@/server/qualiopi/presence/types";
import { fenetreDemiJournee } from "@/server/qualiopi/presence/repartition-distanciel";

export interface CaseEmargement {
  demiJournee: DemiJourneeLabel;
  /** `null` si le stagiaire n'a pas signé cette demi-journée. */
  signeAHeure: string | null;
  /**
   * Écart entre la signature et la fin de la demi-journée, en clair.
   *
   * `null` quand la signature tombe dans le créneau. Sinon « + 2 h 15 », affiché
   * TEL QUEL sur la feuille : c'est la mitigation obligatoire de la décision D13.
   */
  ecart: string | null;
  methode: string | null;
  /** Vrai si la signature a été recueillie sur le poste du formateur. */
  surPosteFormateur: boolean;
}

export interface LignePdf {
  stagiaireNom: string;
  entreprise: string | null;
  cases: CaseEmargement[];
  /** Ancrage : nombre de signatures et empreinte de tête au tirage. */
  nbSignatures: number;
  empreinteTete: string | null;
}

export interface ContresignatureCase {
  demiJournee: DemiJourneeLabel;
  /** Formateur qui a contresigné cette demi-journée. */
  formateurNom: string;
  /** Heure de la contresignature (heure de Paris), pour l'écart D13 côté formateur. */
  signeAHeure: string;
  methode: string;
}

export interface JourneePdf {
  dateLisible: string;
  horaires: string;
  formateurNom: string;
  modules: string[];
  demiJournees: DemiJourneeLabel[];
  lignes: LignePdf[];
  /**
   * Contresignatures du formateur pour cette journée, par demi-journée.
   *
   * Exigence « stagiaire ET formateur » (CAA Nantes 20/04/2021) : une feuille
   * sans la signature du formateur est insuffisamment probante. Vide tant que le
   * formateur n'a pas contresigné — la feuille le montre alors comme incomplet.
   */
  contresignatures: ContresignatureCase[];
}

export interface FeuillePdf {
  intituleFormation: string;
  numeroSession: string;
  journees: JourneePdf[];
  /** Somme des signatures, tous stagiaires — l'ancre globale du tirage. */
  totalSignatures: number;
}

const LIBELLE_DEMI: Record<DemiJourneeLabel, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  journee: "Journée",
};

function dateLisible(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function hhmm(d: Date): string {
  const m = parisMinutesDuJour(d);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}h${String(m % 60).padStart(2, "0")}`;
}

/**
 * Écart lisible entre une signature et la FIN de sa demi-journée.
 *
 * Signer pendant le créneau ne produit aucun écart. Signer après en produit un,
 * et il est affiché : c'est le prix assumé d'une fenêtre de 48 h.
 */
export function ecartLisible(
  signeAt: Date,
  jourIso: string,
  finDemiJourneeMin: number,
): string | null {
  const jourSignature = parisDateISO(signeAt);
  const minutesSignature = parisMinutesDuJour(signeAt);

  const joursEcart = Math.round(
    (new Date(`${jourSignature}T00:00:00Z`).getTime() -
      new Date(`${jourIso}T00:00:00Z`).getTime()) /
      86_400_000,
  );
  const ecartMin = joursEcart * 24 * 60 + minutesSignature - finDemiJourneeMin;
  if (ecartMin <= 0) return null;

  const jours = Math.floor(ecartMin / (24 * 60));
  const heures = Math.floor((ecartMin % (24 * 60)) / 60);
  const minutes = ecartMin % 60;
  const parts: string[] = [];
  if (jours > 0) parts.push(`${jours} j`);
  if (heures > 0) parts.push(`${heures} h`);
  if (minutes > 0 && jours === 0) parts.push(`${minutes} min`);
  return `+ ${parts.join(" ")}`;
}

/**
 * Rassemble tout ce qu'une feuille d'émargement conforme doit porter.
 *
 * ⚠️ L'ordre de lecture des signatures est celui de l'INSERTION (`createdAt`),
 * jamais de `signeAt` — ce dernier est figé avant l'écriture de l'image sur R2,
 * et trier dessus produirait une empreinte de tête incohérente avec celle que
 * `verifierChaine` attend.
 */
export async function construireFeuillePdf(
  sessionId: string,
  // 🔴 H3 — le dossier d'audit inclut les inscriptions sous droit à l'effacement
  // (nom déjà anonymisé « [supprime] », signatures CONSERVÉES art. 17 §3 b) : leurs
  // heures signées doivent rester justifiables. La feuille admin courante, elle,
  // les exclut (minimisation) — d'où le drapeau, faux par défaut.
  inclureEffaces = false,
): Promise<FeuillePdf | null> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return null;

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      numero: true,
      titreSession: true,
      formateurPrincipal: { select: { nom: true, prenom: true } },
      jours: {
        select: {
          date: true,
          heureDebut: true,
          heureFin: true,
          modules: true,
          trainer: { select: { nom: true, prenom: true } },
        },
        orderBy: { date: "asc" },
      },
      enrollments: {
        where: inclureEffaces ? {} : { trainee: { deletedAt: null } },
        orderBy: { trainee: { nom: "asc" } },
        select: {
          id: true,
          trainee: { select: { nom: true, prenom: true, entreprise: true, deletedAt: true } },
          emargementSignatures: {
            where: { revokedAt: null },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              date: true,
              demiJournee: true,
              signeAt: true,
              methode: true,
              selfHash: true,
              recueilliParTrainerId: true,
            },
          },
        },
      },
      // La signature du formateur (contresignature), au grain demi-journée. Même
      // ordre d'insertion que les signatures stagiaires — jamais `signeAt`.
      emargementContresignatures: {
        where: { revokedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { date: true, demiJournee: true, formateurNom: true, signeAt: true, methode: true },
      },
    },
  });

  if (session === null) return null;

  let totalSignatures = 0;

  const journees: JourneePdf[] = session.jours.map((jour) => {
    const iso = parisDateISO(jour.date);
    const formateur = jour.trainer ?? session.formateurPrincipal;
    const modules = Array.isArray(jour.modules)
      ? (jour.modules as unknown[]).filter((m): m is string => typeof m === "string")
      : [];

    // Demi-journées réellement portées par cette journée, dans l'ordre.
    const demiJournees: DemiJourneeLabel[] = [];
    for (const dj of ["matin", "apres_midi"] as const) {
      const f = fenetreDemiJournee(jour.heureDebut, jour.heureFin, dj);
      if (f.finMin > f.debutMin) demiJournees.push(dj);
    }
    // 🔴 M4 — un créneau au grain « journee » (hérité d'un import distanciel,
    // préservé s'il porte une signature) était SIGNÉ mais rendu par des cases
    // vides, alors que l'ancrage le comptait : grille et ancrage se
    // contredisaient sur la pièce remise à l'auditeur. On rend sa colonne dès
    // qu'une signature « journee » existe ce jour-là.
    const aSignatureJournee = session.enrollments.some((e) =>
      e.emargementSignatures.some(
        (s) => parisDateISO(s.date) === iso && s.demiJournee === "journee",
      ),
    );
    if (aSignatureJournee) demiJournees.push("journee");

    const lignes: LignePdf[] = session.enrollments.map((inscription) => {
      const signatures = inscription.emargementSignatures;
      const cases = demiJournees.map((dj) => {
        const sig = signatures.find((x) => parisDateISO(x.date) === iso && x.demiJournee === dj);
        if (sig === undefined) {
          return {
            demiJournee: dj,
            signeAHeure: null,
            ecart: null,
            methode: null,
            surPosteFormateur: false,
          };
        }
        const { finMin } = fenetreDemiJournee(jour.heureDebut, jour.heureFin, dj);
        return {
          demiJournee: dj,
          signeAHeure: hhmm(sig.signeAt),
          ecart: ecartLisible(sig.signeAt, iso, finMin),
          methode: sig.methode,
          surPosteFormateur: sig.recueilliParTrainerId !== null,
        };
      });

      return {
        stagiaireNom: `${inscription.trainee.prenom} ${inscription.trainee.nom}`.trim(),
        // L-A — `supprimerStagiaire` anonymise nom/prénom/email mais PAS l'entreprise.
        // Sur le dossier d'audit incluant les effacés, on la masque quand même : une
        // raison sociale peut identifier un travailleur indépendant.
        entreprise: inscription.trainee.deletedAt !== null ? null : inscription.trainee.entreprise,
        cases,
        // Ancrage : ces deux valeurs figées dans un document numéroté rendent
        // détectable la suppression des DERNIÈRES signatures, que le chaînage
        // seul ne voit pas.
        nbSignatures: signatures.length,
        empreinteTete: signatures[signatures.length - 1]?.selfHash ?? null,
      };
    });

    totalSignatures += lignes.reduce((s, l) => s + l.nbSignatures, 0);

    const contresignatures: ContresignatureCase[] = session.emargementContresignatures
      .filter((c) => parisDateISO(c.date) === iso)
      .map((c) => ({
        demiJournee: c.demiJournee as DemiJourneeLabel,
        formateurNom: c.formateurNom,
        signeAHeure: hhmm(c.signeAt),
        methode: c.methode,
      }));

    return {
      dateLisible: dateLisible(iso),
      horaires: `${jour.heureDebut}–${jour.heureFin}`,
      formateurNom: formateur === null ? "" : `${formateur.prenom} ${formateur.nom}`.trim(),
      modules,
      demiJournees,
      lignes,
      contresignatures,
    };
  });

  return {
    intituleFormation: session.titreSession,
    numeroSession: session.numero,
    journees,
    // Divisé par le nombre de journées : chaque journée répète les mêmes lignes,
    // donc le total brut compterait N fois les mêmes signatures.
    totalSignatures: journees.length === 0 ? 0 : Math.round(totalSignatures / journees.length),
  };
}

export { LIBELLE_DEMI };
