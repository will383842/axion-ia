/**
 * EXPORT ART. 15 DU DOSSIER CLIENT (chantier visio, 2026-09-29 ; ADR 0056 §6,
 * plan §3.15).
 *
 * Appelé par `src/app/api/gdpr-export/route.ts`. Rend à une personne, par son
 * adresse (et toutes les autres adresses connues de la même fiche personne),
 * ce que le dossier client détient SUR ELLE — et rien de ce qu'il détient sur
 * les autres :
 *
 *   · sa fiche (`client_contacts`) et ses adresses ;
 *   · ses rôles dans les projets, ses participations (date, titre) ;
 *   · SES paroles : les segments de SA voix, quand Will a validé la
 *     correspondance de voix (sinon on ne sait pas qui parle) ;
 *   · les faits dont elle est le SUJET : l'énoncé SEUL, jamais la citation —
 *     la citation est la phrase d'un tiers (« c'est la DAF qui décide ») ;
 *   · les faits qu'ELLE a dits : énoncé et citation (ses propres mots) —
 *     seulement quand le LOCUTEUR est validé (participation dont Will a
 *     validé la voix, ou `contactLocuteurId` posé) et que le fait n'est ni
 *     rejeté ni remplacé : un fait rejeté pour `rectification` est souvent
 *     un fait mal attribué, et sa citation serait la phrase d'un tiers ;
 *   · les preuves d'accord des rencontres auxquelles elle a participé
 *     (type, date, version du texte annoncé) ;
 *   · les questions qu'on lui a adressées et ses réponses ;
 *   · les e-mails de suivi qui lui ont été préparés (le message lui-même est
 *     rendu avec `email_outbox` / `email_logs`).
 *
 * Tout texte issu d'une conversation est déchiffré par `chiffrer-parole`, qui
 * LÈVE plutôt que de rendre du chiffré ou un texte de remplacement. Une
 * lecture impossible est DITE dans l'export (`avertissements`), jamais tue.
 */

import { dechiffrerParole, dechiffrerParoleOuNull } from "@/lib/chiffrer-parole";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";

/**
 * Ce que l'export libre-service du dossier client ne rend PAS, et pourquoi.
 * La garde `tests/unit/ci/les-tables-du-dossier-client-suivent-la-personne.spec.ts`
 * accepte un modèle `rgpd: dossier-client` soit parce que ce module le lit,
 * soit parce qu'il figure ici avec son motif.
 */
export const EXCLUSIONS_EXPORT_DOSSIER: ReadonlyArray<{
  readonly modele: string;
  readonly motif: string;
}> = [
  {
    modele: "CompteRendu",
    motif:
      "un compte rendu d'échange professionnel rapporte aussi les propos d'autres personnes : " +
      "réponse manuelle sous un mois, tiers occultés (contact@axion-ia.com). Vos paroles et " +
      "les faits qui vous concernent sont, eux, rendus ci-dessus.",
  },
  {
    // RGPD-03 (vérification finale du 30/09) : la transcription n'est rendue
    // que pour une voix que Williams a rattachée à la personne (`voixValideeLe`).
    modele: "TranscriptionSegment",
    motif:
      "la transcription d'une voix pas encore attribuée (Williams n'a pas encore confirmé " +
      "qu'elle est la vôtre) n'est pas rendue automatiquement : elle peut être celle d'une " +
      "autre personne. Elle existe pendant 12 mois après le rendez-vous ; réponse manuelle " +
      "sous un mois, après vérification de la voix (contact@axion-ia.com).",
  },
  {
    modele: "PreRemplissage",
    motif:
      "trace interne des cases pré-remplies ; les valeurs viennent des faits déjà " +
      "rendus ci-dessus, sauf le corps d'un e-mail de suivi, qui vous est rendu tel qu'il a " +
      "été envoyé avec vos e-mails.",
  },
];

/** Le texte de la notice, pour `notice.excludedTables` de l'export. */
export const NOTICE_EXCLUSIONS_DOSSIER = EXCLUSIONS_EXPORT_DOSSIER.map(
  (e) => `dossier client — ${e.modele} (${e.motif})`,
);

export interface ExportDossierClient {
  readonly personnes: ReadonlyArray<{
    readonly entreprise: string;
    readonly nom: string;
    readonly fonction: string | null;
    readonly telephone: string | null;
    readonly statut: string;
    readonly partiLe: Date | null;
    readonly oppositionTraitementIaLe: Date | null;
    readonly adresses: ReadonlyArray<{ readonly email: string; readonly nature: string }>;
  }>;
  readonly projets: ReadonlyArray<{
    readonly numero: string;
    readonly titre: string;
    readonly role: string;
  }>;
  readonly rencontres: ReadonlyArray<{
    readonly date: Date | null;
    readonly titre: string;
    readonly role: string;
  }>;
  readonly paroles: ReadonlyArray<{
    readonly rencontreLe: Date | null;
    readonly debutMs: number;
    readonly texte: string;
  }>;
  readonly faitsVousConcernant: ReadonlyArray<{
    readonly type: string;
    readonly enonce: string;
    readonly constateLe: Date;
  }>;
  readonly vosPropos: ReadonlyArray<{
    readonly type: string;
    readonly enonce: string;
    readonly citation: string | null;
    readonly constateLe: Date;
  }>;
  readonly preuvesAccord: ReadonlyArray<{
    readonly type: string;
    readonly survenuLe: Date;
    readonly versionTexte: string;
  }>;
  readonly questionnairesRecus: ReadonlyArray<{
    readonly version: number;
    readonly statut: string;
    readonly questions: ReadonlyArray<{ readonly texte: string; readonly reponse: string | null }>;
  }>;
  readonly emailsSuiviPrepares: ReadonlyArray<{ readonly preparesLe: Date }>;
  readonly avertissements: readonly string[];
}

const VIDE: ExportDossierClient = {
  personnes: [],
  projets: [],
  rencontres: [],
  paroles: [],
  faitsVousConcernant: [],
  vosPropos: [],
  preuvesAccord: [],
  questionnairesRecus: [],
  emailsSuiviPrepares: [],
  avertissements: [],
};

/** Déchiffre, ou le dit : jamais de chiffré ni de texte de remplacement rendu. */
function lisible(
  valeur: string,
  avertir: (message: string) => void,
  rubrique: string,
): string | null {
  try {
    return dechiffrerParole(valeur);
  } catch {
    avertir(
      `${rubrique} : un texte n'a pas pu être déchiffré au moment de l'export — cette ` +
        "rubrique peut être incomplète. Écrivez à contact@axion-ia.com pour une vérification manuelle.",
    );
    return null;
  }
}

/**
 * L'export du dossier client pour une adresse. Ne lève pas : une lecture
 * impossible devient un avertissement.
 */
export async function exporterDossierClientPour(email: string): Promise<ExportDossierClient> {
  const empreinte = hashEmailForLookup(email);
  if (!empreinte) return VIDE;

  const avertissements: string[] = [];
  const avertir = (m: string): void => {
    if (!avertissements.includes(m)) avertissements.push(m);
  };

  try {
    const trouvees = await prisma.clientContactAdresse.findMany({
      where: { emailHash: empreinte },
      select: { contactId: true },
    });
    const contactIds = [...new Set(trouvees.map((a) => a.contactId))];

    const contacts =
      contactIds.length === 0
        ? []
        : await prisma.clientContact.findMany({
            where: { id: { in: contactIds } },
            select: {
              id: true,
              nom: true,
              fonction: true,
              telephone: true,
              statut: true,
              partiLe: true,
              oppositionIaLe: true,
              client: { select: { raisonSociale: true } },
              adresses: { select: { email: true, nature: true, emailHash: true } },
            },
          });
    const toutesEmpreintes = [
      ...new Set([empreinte, ...contacts.flatMap((c) => c.adresses.map((a) => a.emailHash))]),
    ];

    const participations = await prisma.rencontreParticipant.findMany({
      where: {
        OR: [{ emailHash: { in: toutesEmpreintes } }, { contactId: { in: contactIds } }],
      },
      select: { id: true, role: true, voixValideeLe: true, rencontreId: true },
    });
    const rencontresVues =
      participations.length === 0
        ? []
        : await prisma.rencontre.findMany({
            where: { id: { in: [...new Set(participations.map((p) => p.rencontreId))] } },
            select: { id: true, titre: true, debutReel: true, debutPrevu: true },
          });
    const rencontreDe = new Map(rencontresVues.map((r) => [r.id, r]));
    const sesParticipants = new Set(participations.map((p) => p.id));
    // Sa voix n'est « sienne » que si Will a validé la correspondance.
    const sesVoixValidees = new Set(
      participations.filter((p) => p.voixValideeLe !== null).map((p) => p.id),
    );
    const dateDeRencontre = new Map(rencontresVues.map((r) => [r.id, r.debutReel ?? r.debutPrevu]));

    const projets =
      contactIds.length === 0
        ? []
        : await prisma.projetContact.findMany({
            where: { contactId: { in: contactIds } },
            select: { projetId: true, role: true },
          });
    const fichesProjet =
      projets.length === 0
        ? []
        : await prisma.projet.findMany({
            where: { id: { in: projets.map((p) => p.projetId) } },
            select: { id: true, numero: true, titre: true },
          });

    const segments =
      sesVoixValidees.size === 0
        ? []
        : await prisma.transcriptionSegment.findMany({
            where: { participantId: { in: [...sesVoixValidees] } },
            select: {
              participantId: true,
              debutMs: true,
              texte: true,
              transcription: {
                select: { enregistrement: { select: { rencontreId: true } } },
              },
            },
            orderBy: [{ transcriptionId: "asc" }, { ordre: "asc" }],
          });

    const faits = await prisma.fait.findMany({
      where: {
        statut: { not: "efface" },
        OR: [
          { contactSujetId: { in: contactIds } },
          { contactLocuteurId: { in: contactIds } },
          { participantLocuteurId: { in: [...sesParticipants] } },
        ],
      },
      select: {
        type: true,
        enonce: true,
        citation: true,
        constateLe: true,
        contactSujetId: true,
        contactLocuteurId: true,
        participantLocuteurId: true,
        statut: true,
      },
      orderBy: { constateLe: "asc" },
    });

    const rencontreIds = rencontresVues.map((r) => r.id);
    const preuves =
      rencontreIds.length === 0
        ? []
        : await prisma.enregistrementConsentement.findMany({
            where: { rencontreId: { in: rencontreIds } },
            select: { type: true, survenuLe: true, versionTexte: true },
            orderBy: { survenuLe: "asc" },
          });

    const questionnaires =
      contactIds.length === 0
        ? []
        : await prisma.questionnaireCadrage.findMany({
            where: { contactDestinataireId: { in: contactIds } },
            select: { id: true, version: true, statut: true },
          });
    const questions =
      questionnaires.length === 0
        ? []
        : await prisma.questionnaireQuestion.findMany({
            where: { questionnaireId: { in: questionnaires.map((q) => q.id) } },
            select: { questionnaireId: true, ordre: true, texte: true, reponse: true },
            orderBy: { ordre: "asc" },
          });

    const emails =
      contactIds.length === 0
        ? []
        : await prisma.emailSuivi.findMany({
            where: { contactId: { in: contactIds } },
            select: { creeLe: true },
          });

    const siens = new Set(contactIds);
    // « Elle l'a dit » exige un locuteur VALIDÉ (plan §3.15 : « ses citations
    // (locuteur validé) ») : `contactLocuteurId` n'est posé qu'après la
    // validation de Will (ou pour la titulaire d'une réservation Calendly), et
    // une participation ne compte que si sa voix a été validée. Sans cela,
    // l'extraction qui prête à Alice une phrase de Bruno rendrait à Alice les
    // mots de Bruno.
    const aDit = (f: (typeof faits)[number]): boolean =>
      (f.contactLocuteurId !== null && siens.has(f.contactLocuteurId)) ||
      (f.participantLocuteurId !== null && sesVoixValidees.has(f.participantLocuteurId));
    // Un fait rejeté ou remplacé n'est plus « ce qu'elle a dit » : il peut
    // être rejeté justement parce qu'il est mal attribué (`rectification`).
    const ecarteDesPropos = (f: (typeof faits)[number]): boolean =>
      f.statut === "rejete" || f.statut === "remplace";

    return {
      personnes: contacts.map((c) => ({
        entreprise: c.client.raisonSociale,
        nom: c.nom,
        fonction: c.fonction,
        telephone: c.telephone,
        statut: c.statut,
        partiLe: c.partiLe,
        oppositionTraitementIaLe: c.oppositionIaLe,
        adresses: c.adresses.map((a) => ({ email: a.email, nature: a.nature })),
      })),
      projets: projets.flatMap((p) => {
        const fiche = fichesProjet.find((f) => f.id === p.projetId);
        return fiche ? [{ numero: fiche.numero, titre: fiche.titre, role: p.role }] : [];
      }),
      rencontres: participations.flatMap((p) => {
        const r = rencontreDe.get(p.rencontreId);
        return r ? [{ date: r.debutReel ?? r.debutPrevu, titre: r.titre, role: p.role }] : [];
      }),
      // Double filet : la requête ne demande que ses segments, et le code
      // écarte tout segment qui ne serait pas d'une de SES voix validées.
      paroles: segments.flatMap((s) => {
        if (s.participantId === null || !sesVoixValidees.has(s.participantId)) return [];
        const texte = lisible(s.texte, avertir, "paroles");
        if (texte === null) return [];
        const rencontreId = s.transcription.enregistrement.rencontreId;
        return [
          { rencontreLe: dateDeRencontre.get(rencontreId) ?? null, debutMs: s.debutMs, texte },
        ];
      }),
      // Les faits dont elle est le sujet SANS les avoir dits : énoncé seul.
      faitsVousConcernant: faits.flatMap((f) => {
        if (aDit(f) || f.contactSujetId === null || !siens.has(f.contactSujetId)) return [];
        const enonce = lisible(f.enonce, avertir, "faitsVousConcernant");
        return enonce === null ? [] : [{ type: f.type, enonce, constateLe: f.constateLe }];
      }),
      // Ce qu'elle a dit : ses propres mots, citation comprise.
      vosPropos: faits.flatMap((f) => {
        if (!aDit(f) || ecarteDesPropos(f)) return [];
        const enonce = lisible(f.enonce, avertir, "vosPropos");
        if (enonce === null) return [];
        let citation: string | null = null;
        try {
          citation = dechiffrerParoleOuNull(f.citation);
        } catch {
          avertir(
            "vosPropos : une citation n'a pas pu être déchiffrée au moment de l'export. " +
              "Écrivez à contact@axion-ia.com pour une vérification manuelle.",
          );
        }
        return [{ type: f.type, enonce, citation, constateLe: f.constateLe }];
      }),
      preuvesAccord: preuves.map((p) => ({
        type: p.type,
        survenuLe: p.survenuLe,
        versionTexte: p.versionTexte,
      })),
      questionnairesRecus: questionnaires.map((q) => ({
        version: q.version,
        statut: q.statut,
        questions: questions
          .filter((qq) => qq.questionnaireId === q.id)
          .map((qq) => ({
            texte: lisible(qq.texte, avertir, "questionnairesRecus") ?? "",
            reponse:
              qq.reponse === null ? null : lisible(qq.reponse, avertir, "questionnairesRecus"),
          })),
      })),
      emailsSuiviPrepares: emails.map((e) => ({ preparesLe: e.creeLe })),
      avertissements,
    };
  } catch {
    return {
      ...VIDE,
      avertissements: [
        "dossierClient : lecture impossible au moment de l'export — cette rubrique peut être " +
          "incomplète. Écrivez à contact@axion-ia.com pour une vérification manuelle.",
      ],
    };
  }
}
