// Détail d'une candidature — PII déchiffrées, réponses lisibles (label question),
// download CV authentifié, formulaire de suivi (statut/notes/assignation/suppr).

import Link from "next/link";
import { Fragment } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { markInboxRead } from "@/features/admin-inbox/reads";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminBadge } from "@/components/admin/ui";
import { getApplicationDetailAction } from "@/features/admin-job-applications/actions";
import { getJobOfferDetailAction } from "@/features/admin-job-offers/actions";
import { ApplicationStatusForm } from "./ApplicationStatusForm";
import { FriseCandidature } from "./FriseCandidature";
import { lireFilEmploi } from "@/features/echanges/lire-fil";
import { ComposerReponse } from "./ComposerReponse";
import { ConsignerAuJournal } from "./ConsignerAuJournal";
import { lireFrise, lireEntretiens } from "@/features/admin-job-applications/timeline";
import { lireAccuseReception } from "@/features/admin-job-applications/accuse-reception";
import { Entretiens } from "./Entretiens";
import { DeposerCv } from "./DeposerCv";
import { ProposerReseauApporteurs } from "./ProposerReseauApporteurs";
import { CreerFicheFormateur } from "./CreerFicheFormateur";
import {
  estCandidatureFormateur,
  mentionActivationFormateur,
  peutCreerFicheFormateur,
  statutFormateurDepuisOffre,
} from "@/lib/careers/fiche-formateur";
import { peutEngager } from "@/server/auth/habilitations";
import { ficheApporteurDeLaCandidature } from "@/features/admin-job-applications/proposer-reseau";
import { estLienCalendlyValide } from "@/lib/commercial-application/kit-apporteur";
import { adminPath } from "@/lib/admin-path";
// Date affichée en FR (audit UX : ISO brut "2026-07-31" illisible pour Will).
import { formatDateFrShort } from "@/lib/format-date-fr";
import { liensInsertionComposeur } from "@/lib/imprimes/liens-email";
import { env } from "@/env";
import {
  montantEnCentimes,
  parseScreeningQuestions,
  valeurAffichee,
} from "@/lib/careers/screening-answers";
import { questionsDePrix } from "@/features/admin-job-applications/video-freelance";
import {
  libelleRang,
  montrerBlocVideos,
  prochainGeste,
  rangDuPrix,
} from "@/features/admin-job-applications/fiche-blocs";
import { BarreEtapes } from "@/components/admin/etapes/BarreEtapes";
import { BARRE_EMPLOI, etapeEmploi } from "@/features/etapes/etapes";
import { extraireLiensVideo, montreDuTravail, sourcesDeLiens } from "@/lib/careers/liens-video";
import { prisma } from "@/lib/prisma";
import { relancerAnalysesEnAttente } from "@/server/careers/videos-candidat";
import { tailleLisible } from "@/lib/careers/videos";
import { isVideoFreelanceOffer } from "@/lib/careers/video-editor-offer";
import { partagesActifs } from "@/server/partages/config";
import { relancerAnalysesPartagesEnAttente } from "@/server/partages/depot";
import {
  compterLiensActifs,
  fichiersPourComposeur,
  lireFichiersEnvoyes,
} from "@/server/partages/suivi";
import { FichiersEnvoyes } from "./FichiersEnvoyes";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

function yn(v: boolean | null): string {
  return v === true ? "Oui" : v === false ? "Non" : "—";
}

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const a = await getApplicationDetailAction(id);
  // Boîte de réception (2026-07-29) — « non lu » façon boîte mail : ouvrir la
  // fiche vaut lecture, sans geste. Best-effort : `markInboxRead` ne throw
  // jamais, une demande client s'affiche même si l'accusé échoue.
  await markInboxRead(session?.user?.id, "job_application", id);

  if (!a) notFound();

  // Labels des questions de l'offre → rendu lisible des réponses (pas de JSON brut).
  //
  // 🔴 SANS CE GARDE, LA FICHE CANDIDAT REND UNE 500. Mesuré le 2026-09-04 sur
  // la base de recette, avec un vrai dossier sans offre :
  //
  //     prisma.jobOffer.findUnique({ where: { id: null } })
  //     -> Invalid `prisma.jobOffer.findUnique()` invocation
  //
  // ⚠️ J'avais d'abord écrit ici qu'« une requête sur `id: undefined` ne lève
  // pas : elle ne trouve rien ». C'est FAUX pour `findUnique`, qui valide son
  // argument et LÈVE. Le garde n'évite donc pas un affichage incomplet — il
  // évite un plantage de la page entière.
  //
  // `offerId` est `null` dans deux cas depuis le lot 6 : l'offre a été supprimée
  // (elle n'emporte plus le dossier) ou la candidature est spontanée. Dans les
  // deux cas la page reste entière, parce que le poste se lit sur
  // `offerTitleSnap`, figé à la soumission.
  const offer = a.offerId === null ? null : await getJobOfferDetailAction(a.offerId);

  // La frise porte le corps des messages envoyés, donc le nom de la personne :
  // sa lecture réapplique le prédicat d'ouverture du dossier plutôt que de se
  // fier à la garde de la page. Deux étages qui ne peuvent pas diverger.
  const acteur = { role: (session.user as { role?: string }).role };
  // Candidatures unifiées L5 — fichiers envoyés par lien privé. Tant que la
  // bibliothèque est ÉTEINTE, rien n'est lu et rien ne s'affiche (ni bloc, ni
  // bouton « Joindre des fichiers »).
  const partagesAllumes = partagesActifs();
  const [frise, fil, entretiens, accuse, ficheApporteur, partages] = await Promise.all([
    lireFrise(a.id, acteur),
    // L7 — le fil « Échanges » : journal, réponses reçues (L3), liens et
    // fichiers (L5/L5b), en une seule liste dans l'ordre des faits.
    lireFilEmploi(a.id, acteur),
    lireEntretiens(a.id, acteur),
    // L'accusé de réception automatique : parti, en échec, ou introuvable.
    // Même prédicat que la frise — il lit l'adresse du candidat.
    lireAccuseReception({ id: a.id, email: a.email, submittedAt: a.submittedAt }, acteur),
    // « Proposer le réseau d'apporteurs » (2026-09-28) : la fiche apporteur
    // déjà née de cette candidature, pour afficher le lien plutôt que le bouton.
    ficheApporteurDeLaCandidature(a.id),
    partagesAllumes
      ? Promise.all([
          fichiersPourComposeur(),
          lireFichiersEnvoyes(a.id),
          compterLiensActifs(a.id),
        ]).then(([bibliotheque, liens, actifs]) => ({ bibliotheque, liens, actifs }))
      : Promise.resolve(null),
  ]);
  const questions = parseScreeningQuestions(offer?.screeningQuestions);
  const qParId = new Map(questions.map((q) => [q.id, q]));
  const qLabels: Record<string, string> = {};
  for (const q of questions) qLabels[q.id] = q.labelFr ?? q.id;

  // Formulaire COURT des offres vidéo freelance (2026-09-26) : ni poste, ni
  // expérience, ni disponibilité, ni prétention, ni LinkedIn, ni photo ne sont
  // demandés. Afficher ces lignes à « — » ferait croire à un dossier incomplet ;
  // elles ne réapparaissent que si une valeur existe (dossier antérieur).
  const formulaireCourt = isVideoFreelanceOffer(offer?.slug);
  const montrer = (v: unknown) => !formulaireCourt || (v !== null && v !== undefined && v !== "");

  // « Ses vidéos » (Will, 2026-09-28) : tous les liens vers son travail, d'où
  // qu'ils viennent — formulaire, petit mot, portfolio, et ce qui est arrivé par
  // e-mail et a été recopié au journal. Nos propres messages sont exclus : ils ne
  // portent que nos liens.
  const liens = extraireLiensVideo(
    sourcesDeLiens(
      {
        answers: a.answers,
        motivation: a.motivation,
        linkedinUrl: a.linkedinUrl,
        evenements: frise.map((e) => ({
          type: e.type,
          summary: e.summary,
          occurredAt: e.occurredAt,
          body: e.body,
        })),
      },
      formatDateFrShort,
    ),
  );
  // État de chaque lien au dernier passage du lundi (table absente = rien à dire).
  const etats = new Map(
    (
      await prisma.jobApplicationLink
        .findMany({
          where: { applicationId: a.id },
          select: { url: true, etat: true, verifieLe: true, mortDepuis: true },
        })
        .catch(() => [])
    ).map((l) => [l.url, l]),
  );
  // Vidéos DÉPOSÉES (2026-09-28) : lues ici, relancées si l'antivirus a été
  // interrompu (le worker n'a pas le volume : pas de cron possible).
  await relancerAnalysesEnAttente(a.id);
  // L5b — un essai renvoyé par le candidat resté « en attente » (antivirus
  // coupé, redémarrage) repart à l'analyse à l'ouverture de sa fiche.
  if (partagesAllumes) void relancerAnalysesPartagesEnAttente();
  const videos = await prisma.jobApplicationVideo
    .findMany({
      where: { applicationId: a.id, statut: { in: ["analyse", "disponible", "rejetee"] } },
      orderBy: { createdAt: "asc" },
      select: { id: true, nomOriginal: true, taille: true, statut: true, motifRejet: true },
    })
    .catch(() => []);
  const montreVideo = liens.some(montreDuTravail) || videos.some((v) => v.statut === "disponible");

  // Ce que la candidature dit de son poste : l'offre si elle existe encore,
  // sinon l'intitulé figé (spontanée, offre supprimée). Forme du prédicat U2 :
  // offre IMBRIQUÉE (cf. `PosteCandidature`).
  const indicesPoste = {
    offerTitleSnap: a.offerTitleSnap,
    offer: offer
      ? {
          slug: offer.slug,
          titleFr: offer.titleFr,
          employmentType: offer.employmentType,
          secondaryEmploymentType: offer.secondaryEmploymentType,
        }
      : null,
  };
  // U3 — une candidature de FORMATEUR (freelance ou salarié) ne reçoit ni le
  // lien de l'échange apporteur, ni la proposition du réseau d'apporteurs.
  const candidatureFormateur = estCandidatureFormateur(indicesPoste);

  // L10/U6 — « Fiche formateur ». La carte n'apparaît que si la fiche existe,
  // ou si la passerelle s'ouvre ET que la personne connectée peut référencer
  // un intervenant (direction : même garde que l'action).
  const formateurLie = a.trainerId
    ? await prisma.trainer
        .findUnique({
          where: { id: a.trainerId },
          select: { id: true, actif: true, sousTraitantNda: true },
        })
        .catch(() => null)
    : null;
  const montrerFicheFormateur =
    formateurLie !== null ||
    (peutEngager(acteur.role, "contresigner") &&
      peutCreerFicheFormateur({ status: a.status, ...indicesPoste }));

  // ── L8c — LA FICHE EN BLOCS (maquette v2) ─────────────────────────────
  // En-tête (prochain geste, barre d'étapes) · 1 Identité · 2 Ses prix / Ses
  // réponses · 3 Vidéos et liens · 4 Échanges · 5 Fichiers envoyés · 6 Décision.
  const etape = etapeEmploi(a.status);
  const aRepondu = frise.some((e) => e.type === "email_envoye");
  const geste = prochainGeste(a.status, aRepondu);
  const prixQuestions = questionsDePrix(questions).filter((q) => a.answers[q.id]);
  const autresReponses =
    prixQuestions.length > 0 && a.offerId
      ? await prisma.jobApplication
          .findMany({
            where: { offerId: a.offerId, id: { not: a.id } },
            select: { answers: true },
            take: 1000,
          })
          .catch(() => [])
      : [];
  const tuilesPrix = prixQuestions.map((q) => {
    const montant = montantEnCentimes(a.answers[q.id]);
    const autres = autresReponses
      .map((r) => {
        const v =
          r.answers && typeof r.answers === "object" && !Array.isArray(r.answers)
            ? (r.answers as Record<string, unknown>)[q.id]
            : null;
        return typeof v === "string" ? montantEnCentimes(v) : null;
      })
      .filter((x): x is number => x !== null);
    return {
      id: q.id,
      libelle: q.court ?? q.labelFr ?? q.id,
      valeur: valeurAffichee(q, a.answers[q.id] ?? ""),
      rang: montant === null ? null : libelleRang(rangDuPrix(montant, autres)),
    };
  });
  const autresQuestions = Object.keys(a.answers).filter(
    (qid) => !prixQuestions.some((q) => q.id === qid),
  );
  const blocVideos = montrerBlocVideos({
    offreVideo: formulaireCourt,
    videos: videos.length,
    liens: liens.length,
  });
  let n = 0;
  const numero = (): number => ++n;

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`${a.civility ? `${a.civility} ` : ""}${a.firstName} ${a.lastName}`}
        description={`Candidature · ${a.offerTitleSnap} · ${formatDateFrShort(a.submittedAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
            <a href="#echanges" className="admin-button">
              Répondre
            </a>
            <Link href={`/fr/${adminPrefix}/contacts/candidatures`} className="admin-button-ghost">
              ← Liste
            </Link>
          </div>
        }
      />

      {/* En-tête : où en est la personne, et le geste attendu. */}
      <AdminCard>
        <BarreEtapes etapes={BARRE_EMPLOI} etape={etape} />
        {geste ? (
          <p className="admin-meta-small">
            Prochain geste : <strong>{geste}</strong>
          </p>
        ) : null}
      </AdminCard>

      <AdminCard>
        <h3 className="admin-section-title">{numero()} · Identité</h3>
        <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
          <dt className="font-medium">Email</dt>
          <dd>{a.email}</dd>
          <dt className="font-medium">Téléphone</dt>
          <dd>{a.phone}</dd>
          <dt className="font-medium">Ville</dt>
          <dd>{a.city ?? "—"}</dd>
          {montrer(a.currentRole) ? (
            <>
              <dt className="font-medium">Poste actuel</dt>
              <dd>{a.currentRole ?? "—"}</dd>
            </>
          ) : null}
          {montrer(a.experienceBand) ? (
            <>
              <dt className="font-medium">Expérience</dt>
              <dd>{a.experienceBand ?? "—"}</dd>
            </>
          ) : null}
          {montrer(a.availability) ? (
            <>
              <dt className="font-medium">Disponibilité</dt>
              <dd>{a.availability ?? "—"}</dd>
            </>
          ) : null}
          {montrer(a.salaryExpectation) ? (
            <>
              <dt className="font-medium">Prétention de revenus</dt>
              <dd>{a.salaryExpectation ?? "—"}</dd>
            </>
          ) : null}
          {montrer(a.linkedinUrl) ? (
            <>
              <dt className="font-medium">LinkedIn</dt>
              <dd>
                {a.linkedinUrl ? (
                  <a href={a.linkedinUrl} target="_blank" rel="noopener" className="admin-link">
                    {a.linkedinUrl}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </>
          ) : null}
          {montrer(a.hasDriverLicense) ? (
            <>
              <dt className="font-medium">Permis</dt>
              <dd>{yn(a.hasDriverLicense)}</dd>
            </>
          ) : null}
          {montrer(a.hasVehicle) ? (
            <>
              <dt className="font-medium">Véhicule</dt>
              <dd>{yn(a.hasVehicle)}</dd>
            </>
          ) : null}
          <dt className="font-medium">CV</dt>
          <dd>
            {a.hasCv ? (
              <>
                {/* L8c — « Lire ici » : un PDF s'ouvre dans le navigateur
                    (`?lire=1`), sans téléchargement ; tout autre format reste
                    un téléchargement. */}
                <a
                  href={`/fr/${adminPrefix}/contacts/candidatures/${a.id}/cv?lire=1`}
                  target="_blank"
                  rel="noopener"
                  className="admin-link admin-fil-lien"
                >
                  Lire ici
                </a>
                {" · "}
                <Link
                  href={`/fr/${adminPrefix}/contacts/candidatures/${a.id}/cv`}
                  className="admin-link admin-fil-lien"
                >
                  Télécharger {a.cvOriginalName ?? ""}
                </Link>
              </>
            ) : (
              <DeposerCv applicationId={a.id} />
            )}
          </dd>
          {montrer(a.hasPhoto || null) ? (
            <>
              <dt className="font-medium">Photo</dt>
              <dd>
                {a.hasPhoto ? (
                  <PhotoCandidat
                    href={`/fr/${adminPrefix}/contacts/candidatures/${a.id}/photo`}
                    mimeType={a.photoMimeType}
                    nomOriginal={a.photoOriginalName}
                  />
                ) : (
                  "non fournie"
                )}
              </dd>
            </>
          ) : null}
        </dl>
      </AdminCard>

      {tuilesPrix.length > 0 || autresQuestions.length > 0 || a.motivation ? (
        <AdminCard>
          <h3 className="admin-section-title">
            {numero()} · {tuilesPrix.length > 0 ? "Ses prix" : "Ses réponses"}
          </h3>
          {tuilesPrix.length > 0 ? (
            <div className="admin-tuiles">
              {tuilesPrix.map((t) => (
                <div key={t.id} className="admin-tuile">
                  <span className="admin-tuile-libelle">{t.libelle}</span>
                  <span className="admin-tuile-valeur">{t.valeur}</span>
                  {t.rang ? <span className="admin-meta-small">{t.rang}</span> : null}
                </div>
              ))}
            </div>
          ) : null}
          {a.motivation ? (
            <>
              <h4 className="admin-meta-small">Petit mot du candidat</h4>
              <p className="text-sm whitespace-pre-wrap">{a.motivation}</p>
            </>
          ) : null}
          {autresQuestions.length > 0 ? (
            <dl className="space-y-3 text-sm">
              {/* Dans l'ordre des QUESTIONS, pas dans celui de la base : Postgres
                range les clés d'un JSONB à sa façon (mesuré le 2026-09-26 : les
                prix sortaient mélangés au matériel et aux liens). Une réponse à
                une question retirée depuis garde sa place, à la fin. */}
              {[
                ...Object.keys(qLabels).filter((qid) => autresQuestions.includes(qid)),
                ...autresQuestions.filter((qid) => !(qid in qLabels)),
              ]
                .map((qid) => [qid, a.answers[qid]] as const)
                .map(([qid, val]) => (
                  <Fragment key={qid}>
                    <dt className="font-medium">{qLabels[qid] ?? qid}</dt>
                    <dd className="text-fg-muted whitespace-pre-wrap">
                      {val ? valeurAffichee(qParId.get(qid), val) : val}
                    </dd>
                  </Fragment>
                ))}
            </dl>
          ) : null}
        </AdminCard>
      ) : null}

      {blocVideos ? (
        <AdminCard>
          <h3 className="admin-section-title">{numero()} · Vidéos et liens</h3>
          {videos.length > 0 ? (
            <div className="mb-[var(--space-admin-4)] space-y-[var(--space-admin-4)]">
              {videos.map((v) => (
                <div key={v.id}>
                  <p className="text-sm font-medium">
                    {v.nomOriginal}{" "}
                    <span className="admin-meta-small">· {tailleLisible(v.taille)}</span>{" "}
                    {v.statut === "analyse" ? (
                      <AdminBadge tone="warning">analyse antivirus en cours</AdminBadge>
                    ) : v.statut === "rejetee" ? (
                      <AdminBadge tone="destructive">
                        refusée — {v.motifRejet ?? "motif inconnu"}
                      </AdminBadge>
                    ) : null}
                  </p>
                  {v.statut === "disponible" ? (
                    <video
                      controls
                      preload="metadata"
                      src={`/fr/${adminPrefix}/contacts/candidatures/${a.id}/video/${v.id}`}
                      style={{ width: "100%", maxWidth: 360, maxHeight: 480, background: "black" }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {!montreVideo ? (
            <p className="admin-alert admin-alert-warning mb-[var(--space-admin-3)]">
              Aucune vidéo ni lien vers son travail. Vous pouvez lui demander 2 ou 3 montages.
            </p>
          ) : null}
          {liens.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {liens.map((l) => (
                <li key={l.url}>
                  <AdminBadge tone="neutral">{l.plateforme}</AdminBadge>{" "}
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-link"
                    style={{ wordBreak: "break-all" }}
                  >
                    {l.url}
                  </a>{" "}
                  <span className="admin-meta-small">· {l.source}</span>
                  {(() => {
                    const e = etats.get(l.url.slice(0, 2000));
                    if (!e) return null;
                    if (e.etat === "mort")
                      return (
                        <>
                          {" "}
                          <AdminBadge tone="destructive">
                            lien mort depuis le {formatDateFrShort(e.mortDepuis ?? e.verifieLe)}
                          </AdminBadge>
                        </>
                      );
                    if (e.etat === "vivant")
                      return (
                        <span className="admin-meta-small">
                          {" "}
                          · vérifié le {formatDateFrShort(e.verifieLe)}
                        </span>
                      );
                    return null;
                  })()}
                </li>
              ))}
            </ul>
          ) : null}
        </AdminCard>
      ) : null}

      <AdminCard>
        <h3 id="echanges" className="admin-section-title">
          {numero()} · Échanges
        </h3>
        <div className="mb-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-3)]">
          <ComposerReponse
            applicationId={a.id}
            prenom={a.firstName}
            poste={a.offerTitleSnap}
            // Calculés ICI, côté serveur : `liensInsertionComposeur` tire
            // `@/content/imprimes` (donc `pricing.ts`) et lit `env` — deux
            // imports qu'un composant CLIENT ne doit pas tirer dans son
            // bundle pour trois boutons. Même doctrine que `OPTIONS_STATUT`
            // dans `ApplicationsV2.tsx`.
            liensInsertion={liensInsertionComposeur(env.CALENDLY_APPORTEUR_URL, {
              candidatureFormateur,
            })}
            partages={partages ? { bibliotheque: partages.bibliotheque } : null}
          />
          <ConsignerAuJournal applicationId={a.id} />
        </div>
        {/* L7 — UN seul fil : les réponses reçues (L3, « Ouvrir dans Zoho »),
            les messages envoyés avec leurs fichiers, les notes et appels. */}
        <FriseCandidature entrees={frise} faits={fil} accuse={accuse} />
      </AdminCard>

      {entretiens.length > 0 || a.status === "interview" ? (
        <AdminCard>
          <h3 className="admin-section-title">Entretiens</h3>
          <Entretiens
            applicationId={a.id}
            entretiens={entretiens.map((e) => ({
              id: e.id,
              round: e.round,
              mode: e.mode,
              state: e.state,
              scheduledAt: e.scheduledAt.toISOString(),
              heldAt: e.heldAt?.toISOString() ?? null,
              location: e.location,
              conductedByName: e.conductedByName,
              debrief: e.debrief,
              outcome: e.outcome,
            }))}
          />
        </AdminCard>
      ) : null}

      {partages ? (
        <AdminCard>
          <h3 className="admin-section-title">{numero()} · Fichiers envoyés</h3>
          <FichiersEnvoyes liens={partages.liens} />
        </AdminCard>
      ) : null}

      <AdminCard>
        <h3 className="admin-section-title">{numero()} · Décision</h3>
        <ApplicationStatusForm
          id={a.id}
          status={a.status}
          internalNotes={a.internalNotes}
          assignedTo={a.assignedTo}
          rejectionReason={a.rejectionReason}
          needsAttention={a.needsAttention}
          liensActifs={partages?.actifs ?? 0}
        />
      </AdminCard>

      {/* 2026-09-28 (Will) — proposer AUSSI le réseau d'apporteurs d'affaires
          indépendants à une personne qui a postulé à une offre salariée. La
          candidature au poste n'en est pas modifiée. Jamais à un formateur (U3). */}
      {candidatureFormateur ? null : (
        <AdminCard>
          <h3 className="admin-section-title">Réseau d&apos;apporteurs</h3>
          <ProposerReseauApporteurs
            applicationId={a.id}
            ficheExistante={
              ficheApporteur
                ? {
                    lien: adminPath("fr", `contacts/commercial/${ficheApporteur.id}`),
                    creeeLe: formatDateFrShort(ficheApporteur.creeeLe),
                  }
                : null
            }
            lienCalendlyConfigure={estLienCalendlyValide(env.CALENDLY_APPORTEUR_URL ?? "")}
          />
        </AdminCard>
      )}

      {montrerFicheFormateur ? (
        <AdminCard>
          <h3 className="admin-section-title">Fiche formateur</h3>
          <CreerFicheFormateur
            applicationId={a.id}
            statutPropose={statutFormateurDepuisOffre(indicesPoste)}
            ficheExistante={
              formateurLie
                ? {
                    lien: adminPath("fr", `qualiopi/formateurs/${formateurLie.id}`),
                    mention: mentionActivationFormateur(formateurLie),
                  }
                : null
            }
          />
        </AdminCard>
      ) : null}
    </AdminPageShell>
  );
}

/**
 * Photo du candidat : affichée quand le navigateur sait la rendre, proposée en
 * téléchargement sinon.
 *
 * 🔴 Le téléversement accepte le HEIC — format par défaut des iPhone — qu'aucun
 * navigateur hors Safari ne sait afficher, et que la route de consultation sert
 * donc en `application/octet-stream`. Une balise `<img>` inconditionnelle
 * produirait une image cassée : on aurait demandé une photo au candidat pour ne
 * jamais la voir, sans qu'aucune erreur ne le signale.
 */
const TYPES_AFFICHABLES = new Set(["image/jpeg", "image/png", "image/webp"]);

function PhotoCandidat({
  href,
  mimeType,
  nomOriginal,
}: {
  href: string;
  mimeType: string | null;
  nomOriginal: string | null;
}): React.ReactElement {
  if (mimeType && TYPES_AFFICHABLES.has(mimeType)) {
    return (
      <Link href={href} className="inline-block">
        {/* `next/image` est écarté : la route est authentifiée et hors
            web-root, l'optimiseur ne peut pas la lire. Dimensions fixées pour
            ne provoquer aucun décalage de mise en page au chargement. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt={`Photo de candidature${nomOriginal ? ` (${nomOriginal})` : ""}`}
          width={96}
          height={96}
          className="h-24 w-24 rounded-[var(--radius-admin-sm)] object-cover"
        />
      </Link>
    );
  }

  return (
    <>
      <Link href={href} className="admin-link">
        Télécharger {nomOriginal ?? "la photo"}
      </Link>
      <p className="admin-meta-small">
        Format non affichable dans le navigateur{mimeType ? ` (${mimeType})` : ""} — souvent une
        photo iPhone au format HEIC.
      </p>
    </>
  );
}
