/**
 * Admin — fiches collaborateurs « à valider » : comparaison côte à côte, accords reçus, indexation
 * prévue, puis décision (brouillon, publier, refuser). Administrateurs seulement ; la garde de
 * lecture passe AVANT toute lecture de base. Server Component, force-dynamic, noindex.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { CollaborateurForm } from "@/components/admin/collaborateurs/CollaborateurForm";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { prisma } from "@/lib/prisma";
import { TEAM_CATEGORIES, evaluerIndexabilite } from "@/lib/equipe/donnees";
import { ficheInitiale } from "@/components/admin/collaborateurs/fiche-initiale";
import { lireReponseQuestionnaire } from "@/lib/equipe/console/reponse-questionnaire";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Fiches à valider | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const JOUR = (d: Date | string) => new Date(d).toISOString().slice(0, 16).replace("T", " ");

export default async function AValiderPage({
  params,
}: {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}) {
  const { locale, adminPrefix } = await params;
  const login = `/${locale}/${adminPrefix}/login`;
  const acces = await gardeLectureEchanges(
    login,
    () => "Les fiches collaborateurs sont réservées aux administrateurs.",
  );
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const retour = `/${locale}/${adminPrefix}/collaborateurs`;

  let fiches: Awaited<ReturnType<typeof lire>> | null = null;
  try {
    fiches = await lire();
  } catch {
    fiches = null; // table absente (migration en attente) : dit plus bas.
  }

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Fiches à valider"
        description="Relisez, modifiez si besoin, puis publiez, mettez en brouillon ou refusez. Rien ne se publie tout seul."
      />
      <p className="mb-4">
        <Link className="underline" href={retour}>
          ← Retour aux collaborateurs
        </Link>
      </p>
      {fiches === null ? (
        <p>Indisponible (migration en attente ?).</p>
      ) : fiches.length === 0 ? (
        <p>Aucune fiche à valider.</p>
      ) : (
        fiches.map(({ m, reponse }) => {
          const idx = evaluerIndexabilite(m);
          const lue = reponse ? lireReponseQuestionnaire(reponse.answers) : null;
          const lignes: Array<[string, string | null, string | null]> = [
            ["Prénom", m.firstName, lue?.prenom ?? null],
            ["Intitulé", m.jobTitle, lue?.intitule ?? null],
            ["Présentation", m.bioMd, lue?.presentation ?? null],
            ["Langues", m.languages.join(", ") || null, lue?.langues.join(", ") || null],
            ["Lieu", m.locationLabel, lue?.lieu ?? null],
          ];
          return (
            <article key={m.id} className="border-terracotta mb-10 space-y-4 border-t-4 pt-4">
              <h2 className="text-xl font-semibold">
                {m.firstName} ·{" "}
                {TEAM_CATEGORIES.find((c) => c.slug === m.category)?.singulier ?? m.category}
              </h2>

              <section aria-label="Comparaison">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th>Champ</th>
                      <th>Fiche enregistrée</th>
                      <th>
                        Réponse du questionnaire{reponse ? ` (${JOUR(reponse.submittedAt)})` : ""}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map(([nom, fiche, rep]) => (
                      <tr
                        key={nom}
                        className={rep !== null && rep !== fiche ? "bg-terracotta-soft" : ""}
                      >
                        <th scope="row">{nom}</th>
                        <td className="whitespace-pre-wrap">{fiche ?? "—"}</td>
                        <td className="whitespace-pre-wrap">
                          {reponse ? (rep ?? "—") : "Aucune réponse"}
                        </td>
                      </tr>
                    ))}
                    {lue?.apport ? (
                      <tr>
                        <th scope="row">Apport</th>
                        <td>—</td>
                        <td className="whitespace-pre-wrap">{lue.apport}</td>
                      </tr>
                    ) : null}
                    {lue?.categorie.map(([question, texte]) => (
                      <tr key={question}>
                        <th scope="row">{question}</th>
                        <td>—</td>
                        <td className="whitespace-pre-wrap">{texte}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {reponse ? null : (
                  <p>Aucune réponse de questionnaire conservée pour cette fiche.</p>
                )}
              </section>

              <section aria-label="Accords reçus" className="space-y-1">
                <h3 className="font-semibold">Accords et attestation</h3>
                <ul className="list-disc pl-5">
                  <li>
                    Publication :{" "}
                    {m.publicationConsentAt
                      ? `reçu le ${JOUR(m.publicationConsentAt)} (${m.publicationConsentVersion ?? "version inconnue"})`
                      : "NON reçu — la publication sera refusée"}
                  </li>
                  <li>
                    Photo :{" "}
                    {m.photoConsentAt
                      ? `reçu le ${JOUR(m.photoConsentAt)} (${m.photoConsentVersion ?? "version inconnue"})`
                      : "non reçu — avatar seulement"}
                  </li>
                  <li>
                    LinkedIn :{" "}
                    {m.linkedinConsentAt
                      ? `reçu le ${JOUR(m.linkedinConsentAt)} (${m.linkedinConsentVersion ?? "version inconnue"})`
                      : "non reçu — lien non affiché"}
                  </li>
                  <li>
                    Attestation de responsabilité :{" "}
                    {lue?.attestation
                      ? `donnée le ${JOUR(lue.attestation.at)} (${lue.attestation.version})`
                      : "non retrouvée"}
                  </li>
                </ul>
              </section>

              <section aria-label="Photo proposée" className="space-y-1">
                <h3 className="font-semibold">Photo proposée</h3>
                {m.photoKind === "reelle" && m.photoUrl256 ? (
                  // eslint-disable-next-line @next/next/no-img-element -- aperçu admin d'une image servie par la route photo de l'application
                  <img
                    src={m.photoUrl256}
                    alt={m.photoAlt ?? `Photo de ${m.firstName}`}
                    width={128}
                    height={128}
                  />
                ) : (
                  <p>Aucune photo : l&apos;avatar à initiales sera affiché.</p>
                )}
                {m.photoKind === "reelle" && !m.photoConsentAt ? (
                  <p role="alert">Photo sans accord photo : à retirer avant de publier.</p>
                ) : null}
              </section>

              <section aria-label="Indexation prévue" className="space-y-1">
                <h3 className="font-semibold">Indexation prévue</h3>
                <AdminBadge tone={idx.indexable ? "success" : "warning"}>
                  {idx.indexable ? "Indexable" : "noindex"}
                </AdminBadge>
                {idx.manque.length > 0 ? (
                  <ul className="list-disc pl-5">
                    {idx.manque.map((x) => (
                      <li key={x}>Il manque : {x}</li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <CollaborateurForm
                key={m.updatedAt.toISOString()}
                initial={ficheInitiale(m)}
                modeValidation
              />
            </article>
          );
        })
      )}
    </AdminPageShell>
  );
}

async function lire() {
  const membres = await prisma.teamMember.findMany({
    where: { status: "a_valider" },
    orderBy: { updatedAt: "asc" },
    take: 50,
  });
  const reponses =
    membres.length === 0
      ? []
      : await prisma.teamQuestionnaireSubmission.findMany({
          where: { memberId: { in: membres.map((m) => m.id) }, status: "recue" },
          orderBy: { submittedAt: "desc" },
          select: { memberId: true, answers: true, submittedAt: true },
        });
  return membres.map((m) => ({
    m,
    reponse: reponses.find((r) => r.memberId === m.id) ?? null,
  }));
}
