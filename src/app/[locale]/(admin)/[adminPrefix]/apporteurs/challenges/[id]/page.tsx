// Challenges d'apporteurs — la fiche d'un challenge : brouillon (modifiable, publiable), publié
// (règlement figé, archivable) ou archivé. Aucune donnée d'apporteur n'est lue ici.

import Link from "next/link";
import { notFound } from "next/navigation";

import { ChallengesEteints } from "@/components/admin/apporteurs/challenges/ChallengesEteints";
import { EncartApercu } from "@/components/admin/apporteurs/challenges/EncartApercu";
import { FormulaireChallenge } from "@/components/admin/apporteurs/challenges/FormulaireChallenge";
import { AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import {
  archiverChallengeAction,
  publierChallengeAction,
} from "@/features/apporteurs-reseau/actions-challenges-console";
import { lireChallenge } from "@/features/apporteurs-reseau/challenge-donnees";
import {
  LIBELLE_CRITERE,
  LIBELLE_PRODUIT,
  montantEnLettres,
} from "@/features/apporteurs-reseau/challenge-regles";
import { challengesConsoleActifs } from "@/features/apporteurs-reseau/interrupteur-challenges-console";
import { peutEngager } from "@/server/auth/habilitations";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateFr = (iso: string) => iso.split("-").reverse().join("/");

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ChallengePage({ params, searchParams }: PageProps) {
  const { adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  if (!challengesConsoleActifs()) return <ChallengesEteints />;
  if (!UUID.test(id)) notFound();
  const c = await lireChallenge(id);
  if (!c) notFound();
  const peutEcrire = peutEngager(acces.role, "facturer");
  const sp = await searchParams;
  const retour = `/fr/${adminPrefix}/apporteurs/challenges`;

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title={c.titre}
        description={`${LIBELLE_PRODUIT[c.produit]} · du ${dateFr(c.debutLe)} au ${dateFr(c.finLe)} · ${montantEnLettres(c.primeHtCents)} HT`}
        actions={
          <Link href={retour} className="admin-button-secondary">
            ← Les challenges
          </Link>
        }
      />
      {sp.retour ? (
        <p role="status" className="text-[color:var(--color-admin-success)]">
          {sp.retour.slice(0, 300)}
        </p>
      ) : null}
      {sp.erreur ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {sp.erreur.slice(0, 300)}
        </p>
      ) : null}

      {c.statut === "brouillon" && peutEcrire ? (
        <>
          <AdminCard as="section">
            <h2 className="mb-[var(--space-admin-3)] font-semibold">Brouillon</h2>
            <FormulaireChallenge
              initial={{
                id: c.id,
                titre: c.titre,
                debutLe: c.debutLe,
                finLe: c.finLe,
                paiementJusquAu: c.paiementJusquAu ?? "",
                produit: c.produit,
                critere: c.critere,
                seuil: String(c.seuil),
                primeHt: String(c.primeHtCents / 100),
                reglement: c.reglement,
              }}
            />
          </AdminCard>
          <AdminCard as="section">
            <h2 className="mb-[var(--space-admin-3)] font-semibold">Publier</h2>
            <p className="mb-[var(--space-admin-3)]">
              Voici ce que verront les apporteurs. Enregistrez d&apos;abord toute modification.
            </p>
            <EncartApercu
              vue={{
                titre: c.titre,
                produit: c.produit,
                seuil: c.seuil,
                primeHtCents: c.primeHtCents,
                debutLe: c.debutLe,
                finLe: c.finLe,
              }}
            />
            <pre className="mt-[var(--space-admin-3)] max-h-80 overflow-auto rounded-lg border p-3 whitespace-pre-wrap">
              {c.reglement}
            </pre>
            <form
              action={publierChallengeAction}
              className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-2)]"
            >
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="version" value={c.version} />
              <label className="flex items-start gap-2">
                <input type="checkbox" name="case1" value="oui" required />
                <span>J&apos;ai relu la règle et le règlement.</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" name="case2" value="oui" required />
                <span>Je sais qu&apos;ils ne pourront plus être modifiés.</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" name="case3" value="oui" required />
                <span>Les conditions sont les mêmes pour tous les apporteurs.</span>
              </label>
              <div>
                <button type="submit" className="admin-button-primary">
                  Publier le challenge
                </button>
              </div>
            </form>
          </AdminCard>
        </>
      ) : (
        <AdminCard as="section">
          <p>
            {c.statut === "publie"
              ? "Ce challenge est publié. Son règlement ne peut plus être modifié. Pour corriger une erreur, archivez-le et créez-en un nouveau."
              : c.statut === "archive"
                ? "Ce challenge est archivé : il n'est plus visible des apporteurs. Les droits déjà nés restent acquis."
                : "Ce challenge est un brouillon : seul un administrateur peut le modifier."}
          </p>
          <dl className="mt-[var(--space-admin-3)] grid gap-1">
            <dt className="font-semibold">Condition</dt>
            <dd>
              {LIBELLE_CRITERE[c.critere]}, seuil : {c.seuil}
            </dd>
            {c.paiementJusquAu ? (
              <>
                <dt className="font-semibold">Dernier jour de paiement client</dt>
                <dd>{dateFr(c.paiementJusquAu)}</dd>
              </>
            ) : null}
            {c.reglementSha256 ? (
              <>
                <dt className="font-semibold">Empreinte du règlement (SHA-256)</dt>
                <dd className="break-all">{c.reglementSha256}</dd>
              </>
            ) : null}
          </dl>
          <pre className="mt-[var(--space-admin-3)] max-h-80 overflow-auto rounded-lg border p-3 whitespace-pre-wrap">
            {c.reglement}
          </pre>
          {c.statut === "publie" && peutEcrire ? (
            <form
              action={archiverChallengeAction}
              className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-2)]"
            >
              <input type="hidden" name="id" value={c.id} />
              <label className="flex items-start gap-2">
                <input type="checkbox" name="confirmer" value="oui" required />
                <span>
                  Je confirme l&apos;archivage : le challenge disparaît de l&apos;espace des
                  apporteurs.
                </span>
              </label>
              <div>
                <button type="submit" className="admin-button-secondary">
                  Archiver
                </button>
              </div>
            </form>
          ) : null}
        </AdminCard>
      )}
    </div>
  );
}
