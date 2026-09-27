// RAPPELS DE L'INVITATION À L'ÉCHANGE — le passage quotidien (2026-09-27).
//
// Décision de Will du 2026-09-27 : la personne invitée à réserver son échange
// de 15 minutes, qui ne réserve pas, reçoit un rappel à J+3 puis un dernier à
// J+7 — et plus rien. La règle vit dans `lib/commercial-application/
// relance-invitation.ts`, la lecture dans `relance-invitation-etat.ts`.
//
// ── Pourquoi un BALAYAGE quotidien, et pas deux jobs retardés ─────────────
//   · il couvre les invitations parties AVANT son déploiement (le soir du
//     27/09, 58 invitations) : aucune n'a de job retardé, toutes ont une ligne
//     au journal des envois ;
//   · il n'y a RIEN à retirer de la file quand la personne réserve, répond ou
//     est archivée : aucun job n'attend. Des jobs retardés auraient exigé
//     d'être retirés sur chacun de ces chemins — et chaque chemin oublié aurait
//     fait partir un rappel à quelqu'un qui a déjà réservé ;
//   · l'état vit en base : un passage manqué est repris par le suivant.
//
// ── Pourquoi il n'y a pas de fenêtre entre la décision et le départ ───────
// Le passage ne pose que des jobs IMMÉDIATS (aucun `delayMs`) : le rappel part
// dans la minute. Et le worker d'e-mails relit l'état juste avant de l'envoyer
// (`motifRetenueRelanceInvitation`) : une réservation arrivée entre-temps le
// retient. La seule fenêtre restante est l'intervalle entre cette relecture et
// la remise au relais SMTP.
//
// ── Ce qui empêche un doublon ─────────────────────────────────────────────
// `jobId` déterministe (étape + empreinte + invitation) : BullMQ ignore un job
// dont l'identifiant existe, et le journal n'écrit pas deux lignes pour le même
// identifiant. Et le compte des rappels déjà tentés lit le journal ET la
// corbeille de validation, TOUT statut : un rappel garé, annulé ou en échec
// compte pour son étape — il ne se repose pas le lendemain.
//
// ── Ce qui l'arrête ───────────────────────────────────────────────────────
//   · `CALENDLY_APPORTEUR_URL` absent ou invalide : rien ne part, et c'est dit
//     dans le journal du worker (le rappel n'a pas d'autre lien à porter) ;
//   · l'opposition : relue ICI avant l'enfilage (comme le rattrapage du guide),
//     pour ne pas lever une alerte console par jour et par personne opposée ;
//     puis de nouveau au départ, par le filet du worker.

import { prisma } from "@/lib/prisma";
import { estLienCalendlyValide } from "@/lib/calendly/lien-valide";
import { enqueueEmail } from "@/server/queue/queues";
import { verdictAvantEnvoi } from "@/server/email/verdict-envoi";
import {
  AGE_MAX_INVITATION_MS,
  GABARIT_RELANCE_INVITATION,
  decisionRelance,
  jobIdRelanceInvitation,
  type EtapeRelanceInvitation,
  type MotifSansRelance,
} from "@/lib/commercial-application/relance-invitation";
import {
  COLONNES_LIGNE,
  GABARIT_INVITATION,
  lireEtatsRelance,
  type LigneSubmission,
  type PersonneInvitee,
} from "./relance-invitation-etat";

export interface CompteRenduRelances {
  /** Le passage n'a rien fait, et pourquoi. */
  readonly suspendu?: "lien-absent";
  /** Personnes dont la dernière invitation est partie dans la fenêtre. */
  readonly personnes: number;
  readonly envoyees: Record<EtapeRelanceInvitation, number>;
  /** Personnes écartées, par motif. */
  readonly ecartees: Partial<
    Record<MotifSansRelance | "en-file" | "oppose" | "non-enfile", number>
  >;
}

/** L'URL de réservation — la même que celle que la console met dans l'invitation. */
export function lienReservation(): string | null {
  const url = process.env["CALENDLY_APPORTEUR_URL"]?.trim();
  return url && estLienCalendlyValide(url) ? url : null;
}

function ajouter(
  ecartees: Record<string, number>,
  motif: MotifSansRelance | "en-file" | "oppose" | "non-enfile",
): void {
  ecartees[motif] = (ecartees[motif] ?? 0) + 1;
}

export async function passerRelancesInvitation(
  maintenant: Date = new Date(),
): Promise<CompteRenduRelances> {
  const envoyees: Record<EtapeRelanceInvitation, number> = { j3: 0, j7: 0 };
  const ecartees: Record<string, number> = {};

  const calendlyUrl = lienReservation();
  if (!calendlyUrl) {
    console.warn(
      "[relances-invitation] CALENDLY_APPORTEUR_URL absent ou invalide dans l'environnement du " +
        "worker : aucun rappel d'invitation n'est parti.",
    );
    return { suspendu: "lien-absent", personnes: 0, envoyees, ecartees };
  }

  // 1. Les invitations de la fenêtre — parties OU encore en file : une
  //    invitation plus récente encore en file suspend les rappels de la
  //    précédente (elle va partir, et elle recommence le compte).
  const invitations = await prisma.emailLog.findMany({
    where: {
      template: GABARIT_INVITATION,
      entityType: "Submission",
      status: { in: ["pending", "sent"] },
      createdAt: { gte: new Date(maintenant.getTime() - AGE_MAX_INVITATION_MS) },
      entityId: { not: null },
    },
    select: { id: true, entityId: true, createdAt: true, status: true },
    orderBy: { createdAt: "desc" },
  });
  if (invitations.length === 0) return { personnes: 0, envoyees, ecartees };

  // 2. Les lignes invitées, puis toutes les lignes de ces personnes.
  const idsInvites = [...new Set(invitations.map((i) => i.entityId as string))];
  const lignesInvitees = (await prisma.submission.findMany({
    where: { id: { in: idsInvites } },
    select: COLONNES_LIGNE,
  })) as LigneSubmission[];
  const ligneParId = new Map(lignesInvitees.map((l) => [l.id, l]));
  const empreintes = [
    ...new Set(lignesInvitees.map((l) => l.contactEmailHash).filter((h): h is string => !!h)),
  ];
  const lignesPersonnes = empreintes.length
    ? ((await prisma.submission.findMany({
        where: { contactEmailHash: { in: empreintes } },
        select: COLONNES_LIGNE,
      })) as LigneSubmission[])
    : [];
  const cleDe = (l: LigneSubmission) => l.contactEmailHash ?? `id:${l.id}`;
  const lignesDe = new Map<string, LigneSubmission[]>();
  for (const l of [...lignesInvitees, ...lignesPersonnes]) {
    const cle = cleDe(l);
    const liste = lignesDe.get(cle) ?? [];
    if (!liste.some((x) => x.id === l.id)) liste.push(l);
    lignesDe.set(cle, liste);
  }

  // 3. La DERNIÈRE invitation de chaque personne (la liste est triée, plus
  //    récente d'abord : la première rencontrée est la dernière envoyée).
  const personnes: PersonneInvitee[] = [];
  const vues = new Set<string>();
  for (const inv of invitations) {
    const ligne = ligneParId.get(inv.entityId as string);
    if (!ligne) continue; // ligne disparue de la base : rien à relancer
    const cle = cleDe(ligne);
    if (vues.has(cle)) continue;
    vues.add(cle);
    if (inv.status !== "sent") {
      ajouter(ecartees, "en-file");
      continue;
    }
    personnes.push({
      cle,
      lignes: lignesDe.get(cle) ?? [ligne],
      ligneInvitee: ligne,
      invitationId: inv.id,
      invitationLe: inv.createdAt,
    });
  }

  // 4. L'état de toutes ces personnes, en un lot.
  const etats = await lireEtatsRelance(personnes);

  // 5. La décision, puis l'envoi.
  for (const p of personnes) {
    const lu = etats.get(p.cle);
    if (!lu) continue;
    const decision = decisionRelance(lu.etat, maintenant);
    if (!decision.relancer) {
      ajouter(ecartees, decision.motif);
      continue;
    }
    const email = lu.email;
    if (!email) {
      ajouter(ecartees, "efface");
      continue;
    }
    const verdict = await verdictAvantEnvoi(email, {
      template: GABARIT_RELANCE_INVITATION,
      marketing: false,
      sollicitation: true,
    });
    if (verdict.retenu) {
      ajouter(ecartees, "oppose");
      continue;
    }
    const empreinte = p.ligneInvitee.contactEmailHash ?? `id-${p.ligneInvitee.id}`;
    // Le nom en toutes lettres, pas la constante : `catalogue.spec.ts` retrouve
    // l'émetteur de chaque gabarit par son nom littéral, et le type
    // `EmailJobName` refuse une faute de frappe. L'égalité avec
    // `GABARIT_RELANCE_INVITATION` (clé de lecture du journal) est vérifiée par
    // `les-rappels-de-l-invitation-partent-a-j3-puis-j7.spec.ts`.
    const res = await enqueueEmail(
      "apporteur-invitation-relance",
      email,
      p.ligneInvitee.locale === "en" ? "en" : "fr",
      { contactName: lu.nom, calendlyUrl, etape: decision.etape },
      {
        entityType: "Submission",
        entityId: p.ligneInvitee.id,
        jobId: jobIdRelanceInvitation(decision.etape, empreinte, p.invitationId),
      },
    );
    if (res.enqueued || res.garePourValidation) envoyees[decision.etape] += 1;
    else ajouter(ecartees, res.retenu ? "oppose" : "non-enfile");
  }

  return { personnes: personnes.length, envoyees, ecartees };
}
