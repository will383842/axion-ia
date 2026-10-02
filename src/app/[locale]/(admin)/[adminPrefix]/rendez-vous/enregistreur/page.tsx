// « Enregistreur » — le jeton de l'extension Meet et l'état du circuit (PR 5).
//
// Sous l'onglet « Rendez-vous » (aucune entrée de menu nouvelle). Régime REFUS
// (décision A2) : garde en PREMIÈRE instruction, avant toute lecture.
//
// Ce que Will fait ici : créer le jeton (affiché une fois), le coller dans les
// options de l'extension ; le révoquer si le poste est perdu (le jeton n'expire
// pas : révision du 02/10, décision de Williams — il vaut jusqu'à sa révocation). Et voir d'un coup d'œil si tout est prêt : mode, clé de
// chiffrement, dernier signe de l'extension.
//
// Composant serveur ; un seul petit îlot client (le jeton montré une fois).

import Link from "next/link";

import { AdminBadge, AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { EtatEnregistreur } from "@/components/admin/visio/EtatEnregistreur";
import { JetonAppareilForm } from "@/components/admin/visio/JetonAppareilForm";
import { gardeLectureEchanges } from "@/features/dossier-client/acces";
import { motifSansAccesEnregistreur } from "@/features/admin-enregistreur/motif";
import {
  creerJetonAction,
  renouvelerJetonAction,
  revoquerJetonAction,
} from "@/features/admin-enregistreur/actions";
import { lireEtatEnregistreur } from "@/features/admin-enregistreur/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
}

function dateCourte(d: Date | null): string {
  if (!d) return "jamais";
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function PageEnregistreur({ params }: PageProps): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  const acces = await gardeLectureEchanges(
    `/${locale}/${adminPrefix}/login`,
    motifSansAccesEnregistreur,
  );
  const retour = `/${locale}/${adminPrefix}/rendez-vous`;
  const ici = `${retour}/enregistreur`;
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={retour} />;

  const etat = await lireEtatEnregistreur();
  const actifs = etat.appareils.filter((a) => a.revoqueLe === null);

  return (
    <div className="space-y-[var(--space-admin-6)]">
      <AdminPageHeader
        title="Enregistreur des visios"
        description="L'extension Chrome qui enregistre les rendez-vous Meet, avec l'accord oral du client."
        breadcrumbs={<Link href={retour}>← Rendez-vous</Link>}
      />

      <AdminCard>
        <h2 className="mb-[var(--space-admin-3)] text-lg font-semibold">Est-ce prêt ?</h2>
        <EtatEnregistreur etat={etat} />
      </AdminCard>

      <AdminCard>
        <h2 className="mb-[var(--space-admin-3)] text-lg font-semibold">
          Jeton de l&apos;extension
        </h2>
        {/* TOUJOURS affiché, AVANT la liste (constat du 02/10) : un jeton par profil
            Chrome, et un formulaire rendu sous condition était démonté au
            re-rendu, avec le jeton qu'il venait de créer. */}
        <div className="space-y-[var(--space-admin-3)]">
          <h3 className="font-semibold">Ajouter un poste</h3>
          <p>
            {actifs.length === 0 ? "Aucun jeton valide. " : null}
            Un jeton par profil Chrome : créez-le, puis collez-le dans les options de
            l&apos;extension (clic droit sur l&apos;icône → Options).
          </p>
          <JetonAppareilForm
            action={creerJetonAction}
            libelle="Créer un jeton"
            avecNom
            actualiserHref={ici}
          />
        </div>

        <ul className="mt-[var(--space-admin-3)] space-y-[var(--space-admin-4)]">
          {etat.appareils.map((a) => {
            const revoque = a.revoqueLe !== null;
            return (
              <li
                key={a.id}
                className="border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)]"
              >
                <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                  <span className="font-medium">{a.nom}</span>
                  {revoque ? (
                    <AdminBadge tone="neutral">révoqué</AdminBadge>
                  ) : (
                    <AdminBadge tone="success">Sans expiration</AdminBadge>
                  )}
                  {!revoque && a.silencieux ? (
                    <AdminBadge tone="warning">extension silencieuse</AdminBadge>
                  ) : null}
                </div>
                <p className="text-sm text-[color:var(--color-admin-fg-soft)]">
                  Créé le {dateCourte(a.creeLe)} · valable jusqu&apos;à sa révocation · dernier
                  signe de l&apos;extension : {dateCourte(a.dernierBattementLe)} · version :{" "}
                  {a.versionExtension ?? "inconnue"}
                </p>
                {!revoque ? (
                  <div className="mt-[var(--space-admin-2)] flex flex-wrap gap-[var(--space-admin-3)]">
                    <JetonAppareilForm
                      action={renouvelerJetonAction}
                      libelle="Renouveler"
                      appareilId={a.id}
                      actualiserHref={ici}
                    />
                    <form action={revoquerJetonAction}>
                      <input type="hidden" name="appareilId" value={a.id} />
                      <button type="submit" className="admin-button-refuse min-h-[44px]">
                        Révoquer
                      </button>
                    </form>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </AdminCard>

      <AdminCard>
        <h2 className="mb-[var(--space-admin-3)] text-lg font-semibold">
          Installer l&apos;extension (une fois)
        </h2>
        <ol className="list-decimal space-y-[var(--space-admin-1)] pl-[var(--space-admin-5)]">
          <li>Dans Chrome, ouvrez chrome://extensions et activez « Mode développeur ».</li>
          <li>« Charger l&apos;extension non empaquetée » → le dossier C:\AxionVisio\extension.</li>
          <li>Créez le jeton ci-dessus et collez-le dans les options de l&apos;extension.</li>
          <li>Dans les options, autorisez le micro puis lancez le test de 5 secondes.</li>
        </ol>
      </AdminCard>
    </div>
  );
}
