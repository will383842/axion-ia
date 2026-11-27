// Challenges d'apporteurs (invitation libre) — la liste : brouillons, en cours, à venir, passés.
// Rien n'est affiché d'un apporteur ici ; rien n'est visible des apporteurs tant qu'un challenge
// n'est pas publié.

import Link from "next/link";

import { ChallengesEteints } from "@/components/admin/apporteurs/challenges/ChallengesEteints";
import { AdminBadge, AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { jourParis } from "@/features/apporteurs-reseau/autofacture-donnees";
import { listerChallenges } from "@/features/apporteurs-reseau/challenge-donnees";
import {
  etatDansLaListe,
  LIBELLE_PRODUIT,
  montantEnLettres,
  type EtatListe,
} from "@/features/apporteurs-reseau/challenge-regles";
import { messageErreur, messageRetour } from "@/features/apporteurs-reseau/challenge-messages";
import { challengesConsoleActifs } from "@/features/apporteurs-reseau/interrupteur-challenges-console";
import { peutEngager } from "@/server/auth/habilitations";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const GROUPES: ReadonlyArray<{ cle: EtatListe; titre: string }> = [
  { cle: "brouillon", titre: "Brouillons" },
  { cle: "en_cours", titre: "En cours" },
  { cle: "a_venir", titre: "À venir" },
  { cle: "passe", titre: "Passés" },
  { cle: "archive", titre: "Archivés" },
];

const dateFr = (iso: string) => iso.split("-").reverse().join("/");

export default async function ChallengesPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  if (!challengesConsoleActifs()) return <ChallengesEteints />;
  const peutEcrire = peutEngager(acces.role, "facturer");
  const sp = await searchParams;
  const base = `/fr/${adminPrefix}/apporteurs/challenges`;
  const aujourdhui = jourParis(new Date());
  const tous = await listerChallenges();

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Challenges des apporteurs"
        description="Une invitation libre, jamais un objectif."
        actions={
          peutEcrire ? (
            <Link href={`${base}/nouveau`} className="admin-button">
              Nouveau challenge
            </Link>
          ) : null
        }
      />
      <AdminCard as="section">
        <p>
          Un challenge est une information mise à disposition. Aucune relance, aucun classement,
          aucun décompte, aucun objectif individuel.
        </p>
      </AdminCard>
      {messageRetour(sp.retour) ? (
        <p role="status" className="text-[color:var(--color-admin-success)]">
          {messageRetour(sp.retour)}
        </p>
      ) : null}
      {messageErreur(sp.erreur) ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {messageErreur(sp.erreur)}
        </p>
      ) : null}
      {tous.length === 0 ? <p>Aucun challenge pour l&apos;instant.</p> : null}
      {GROUPES.map(({ cle, titre }) => {
        const lignes = tous.filter((c) => etatDansLaListe(c, aujourdhui) === cle);
        if (lignes.length === 0) return null;
        return (
          <AdminCard as="section" key={cle}>
            <h2 className="mb-[var(--space-admin-3)] font-semibold">
              {titre} ({lignes.length})
            </h2>
            <ul className="flex flex-col gap-[var(--space-admin-3)]">
              {lignes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                  <Link href={`${base}/${c.id}`} className="underline">
                    {c.titre}
                  </Link>
                  <span>
                    {LIBELLE_PRODUIT[c.produit]} · du {dateFr(c.debutLe)} au {dateFr(c.finLe)} ·{" "}
                    {montantEnLettres(c.primeHtCents)} HT
                  </span>
                  {c.statut === "brouillon" ? (
                    <AdminBadge>Non visible des apporteurs</AdminBadge>
                  ) : null}
                </li>
              ))}
            </ul>
          </AdminCard>
        );
      })}
    </div>
  );
}
