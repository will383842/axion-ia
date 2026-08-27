/**
 * Admin — Qualiopi · Création d&apos;une session de formation (T19 Cluster L2).
 *
 * Charge la liste des formations publiées et actives + la liste des clients
 * depuis la base, puis monte SessionForm (Client Component).
 *
 * Server Component. Force-dynamic. Robots noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { SessionForm } from "@/components/admin/qualiopi/SessionForm";
import { prisma } from "@/lib/prisma";
import { listTrainers, isTrainerHabilite } from "@/server/qualiopi/trainers/trainers";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Nouvelle session | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function NouvelleSessionPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  // Charger les formations publiées et actives
  let formations: Array<{ id: string; titre: string; numero: string }> = [];
  try {
    formations = await prisma.formation.findMany({
      where: { statut: "actif", statutGeneration: "publie" },
      select: { id: true, titre: true, numero: true },
      orderBy: { titre: "asc" },
    });
  } catch {
    formations = [];
  }

  // Charger les clients (optionnel, fail-soft)
  let clients: Array<{ id: string; raisonSociale: string; numero: string }> = [];
  try {
    clients = await prisma.client.findMany({
      select: { id: true, raisonSociale: true, numero: true },
      orderBy: { raisonSociale: "asc" },
    });
  } catch {
    clients = [];
  }

  // 🔴 F8 — le devis et la session ne pouvaient PAS être reliés.
  //
  // La colonne `training_sessions.devis_id` existe, et `createSessionAction`
  // sait l'écrire — mais AUCUN écran ne permettait de choisir le devis. Le lien
  // était donc inatteignable en pratique, et depuis F7 c'est bloquant :
  // « Transformer en convention » EXIGE une session rattachée, donc le bouton
  // refusait systématiquement. Les deux correctifs se bloquaient l'un l'autre.
  //
  // On ne propose que les devis ACCEPTÉS : un devis en brouillon, envoyé ou
  // refusé n'a pas à engendrer de session, et un devis déjà transformé a la
  // sienne. Le client est embarqué pour que le formulaire puisse filtrer — un
  // devis n'est pertinent que pour SON client, sinon on fabriquerait des
  // rattachements incohérents que rien ne rattraperait ensuite.
  let devis: Array<{
    id: string;
    numero: string;
    clientId: string;
    clientNom: string;
    montantHtCents: number;
  }> = [];
  try {
    const lignes = await prisma.devis.findMany({
      where: { statut: "accepte" },
      select: {
        id: true,
        numero: true,
        clientId: true,
        montantTotalHtCents: true,
        client: { select: { raisonSociale: true } },
      },
      orderBy: { numero: "desc" },
    });
    devis = lignes.map((d) => ({
      id: d.id,
      numero: d.numero,
      clientId: d.clientId,
      clientNom: d.client.raisonSociale,
      montantHtCents: d.montantTotalHtCents,
    }));
  } catch {
    devis = [];
  }

  // 🔴 Le formateur n'était choisissable qu'APRÈS la création, depuis la fiche.
  //
  // On projette ici, pour CHAQUE formation, la liste des formateurs réellement
  // assignables. Le calcul est fait côté serveur parce que l'habilitation se lit
  // en base — et surtout parce qu'elle doit être calculée par
  // `isTrainerHabilite`, la fonction que la garde de l'action appelle elle aussi.
  // Réécrire la règle dans le composant client la ferait diverger au premier
  // amendement : l'écran proposerait alors des formateurs que l'action refuse,
  // ou masquerait des formateurs qu'elle accepte.
  //
  // Deux conséquences directes de cette réutilisation, voulues :
  //   - un formateur INACTIF n'apparaît nulle part (`actifOnly` + la garde) ;
  //   - un SOUS-TRAITANT sans `sousTraitantVerifieAt` n'est pas proposé, parce
  //     que `isTrainerHabilite` le refuse déjà. Le proposer reviendrait à faire
  //     échouer la création sur une case que l'écran venait d'offrir.
  //
  // Les habilitations viennent de la relation `TrainerHabilitation` (portée par
  // `listTrainers` sous le nom `formationIdsHabilites`), jamais de la colonne
  // legacy `formationsHabilitees` qui contient des slugs en production.
  let formateursParFormation: Record<string, Array<{ id: string; label: string }>> = {};
  try {
    const formateursActifs = await listTrainers({ actifOnly: true });
    const projection: Record<string, Array<{ id: string; label: string }>> = {};
    for (const f of formations) {
      projection[f.id] = formateursActifs
        .filter((t) => isTrainerHabilite(t, f.id).ok)
        .map((t) => ({
          id: t.id,
          // Le libellé EXACT de la fiche session. Deux écrans qui nomment la même
          // personne différemment obligent à vérifier qu'il s'agit bien d'elle.
          label: `${t.prenom} ${t.nom}${t.statut === "sous_traitant" ? " (sous-traitant)" : ""}`,
        }));
    }
    formateursParFormation = projection;
  } catch {
    formateursParFormation = {};
  }

  const sessionsListUrl = `/${locale}/${adminPrefix}/qualiopi/sessions`;

  return (
    <AdminPageShell width="narrow">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={sessionsListUrl}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Sessions
        </Link>
      </div>

      <AdminPageHeader
        title="Nouvelle session"
        description="Planifiez une session de formation simple ou créez une série récurrente."
      />

      <SessionForm
        formations={formations}
        clients={clients}
        devis={devis}
        formateursParFormation={formateursParFormation}
        redirectAfterCreate={sessionsListUrl}
        // Lot 1bis — les URLs sont construites ICI parce que seul le serveur
        // connaît le `locale` et le préfixe d'administration (secret injecté
        // par Coolify). Les laisser deviner au composant client produirait un
        // lien mort le jour où le préfixe change.
        liensPrerequis={{
          formations: `/${locale}/${adminPrefix}/qualiopi/formations/new`,
          clients: `/${locale}/${adminPrefix}/qualiopi/clients/new`,
          // Vers la LISTE, et non vers « créer un formateur » : quand aucun
          // formateur n'est habilité sur la formation choisie, le geste qui lève
          // le blocage est le plus souvent d'ajouter cette formation aux
          // habilitations d'un formateur qui existe déjà — ce qui se fait depuis
          // sa fiche, atteignable depuis la liste. Un lien « Créer un formateur »
          // enverrait créer un doublon.
          formateurs: `/${locale}/${adminPrefix}/qualiopi/formateurs`,
        }}
      />
    </AdminPageShell>
  );
}
