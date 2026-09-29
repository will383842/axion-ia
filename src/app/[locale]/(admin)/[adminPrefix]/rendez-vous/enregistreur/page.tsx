// « Enregistreur » — le jeton de l'extension Meet et l'état du circuit (PR 5).
//
// Sous l'onglet « Rendez-vous » (aucune entrée de menu nouvelle). Régime REFUS
// (décision A2) : garde en PREMIÈRE instruction, avant toute lecture.
//
// Ce que Will fait ici : créer le jeton (affiché une fois), le coller dans les
// options de l'extension ; le renouveler avant 90 jours ; le révoquer si le
// poste est perdu. Et voir d'un coup d'œil si tout est prêt : mode, clé de
// chiffrement, dernier signe de l'extension.
//
// Composant serveur ; un seul petit îlot client (le jeton montré une fois).

import Link from "next/link";

import { AdminBadge, AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { EtatEnregistreur } from "@/components/admin/visio/EtatEnregistreur";
import { JetonAppareilForm } from "@/components/admin/visio/JetonAppareilForm";
import { gardeLectureEnregistreur } from "@/features/admin-enregistreur/acces";
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
  const acces = await gardeLectureEnregistreur(`/${locale}/${adminPrefix}/login`);
  const retour = `/${locale}/${adminPrefix}/rendez-vous`;
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={retour} />;

  const etat = await lireEtatEnregistreur();
  const actifs = etat.appareils.filter((a) => a.revoqueLe === null && a.joursRestants >= 0);

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
        {actifs.length === 0 ? (
          <div className="space-y-[var(--space-admin-3)]">
            <p>
              Aucun jeton valide. Créez-en un, puis collez-le dans les options de l&apos;extension
              (clic droit sur l&apos;icône → Options).
            </p>
            <JetonAppareilForm action={creerJetonAction} libelle="Créer le jeton" avecNom />
          </div>
        ) : null}

        <ul className="mt-[var(--space-admin-3)] space-y-[var(--space-admin-4)]">
          {etat.appareils.map((a) => {
            const revoque = a.revoqueLe !== null;
            const expire = !revoque && a.joursRestants < 0;
            return (
              <li
                key={a.id}
                className="border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)]"
              >
                <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                  <span className="font-medium">{a.nom}</span>
                  {revoque ? (
                    <AdminBadge tone="neutral">révoqué</AdminBadge>
                  ) : expire ? (
                    <AdminBadge tone="destructive">expiré</AdminBadge>
                  ) : a.seuil === 3 ? (
                    <AdminBadge tone="destructive">expire dans {a.joursRestants} j</AdminBadge>
                  ) : a.seuil === 14 ? (
                    <AdminBadge tone="warning">expire dans {a.joursRestants} j</AdminBadge>
                  ) : (
                    <AdminBadge tone="success">valide {a.joursRestants} j</AdminBadge>
                  )}
                  {!revoque && !expire && a.silencieux ? (
                    <AdminBadge tone="warning">extension silencieuse</AdminBadge>
                  ) : null}
                </div>
                <p className="text-sm text-[color:var(--color-admin-fg-soft)]">
                  Créé le {dateCourte(a.creeLe)} · expire le {dateCourte(a.expireLe)} · dernier
                  signe de l&apos;extension : {dateCourte(a.dernierBattementLe)} · version :{" "}
                  {a.versionExtension ?? "inconnue"}
                </p>
                {!revoque ? (
                  <div className="mt-[var(--space-admin-2)] flex flex-wrap gap-[var(--space-admin-3)]">
                    <JetonAppareilForm
                      action={renouvelerJetonAction}
                      libelle="Renouveler"
                      appareilId={a.id}
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
