// MES DOCUMENTS (2026-11-25).
//
// `/apporteur/dossier/<apporteurId>/<jeton>/documents` : tout ce qui a été remis à l'apporteur,
// au même endroit — son contrat signé, son guide de démarrage, la fiche des commissions, le livret d'accueil, la charte
// de marque, ses outils de communication. Une ligne et une phrase simple par document.
//
// Même contrôle que son espace (`lireDossierParLien` : jeton et version du lien) ; AUCUN
// contrôle d'accès écrit ici, et chaque adresse listée refait le sien. Sinon — lien invalide,
// fiche retirée, dossier refusé ou résilié, lien d'exemple — un message sobre, sans 404 brutal,
// comme la grille de référence et les outils.
//
// La liste vient du registre `documents-remis.ts` (pur). Seule chose constatée ici, côté
// serveur : la présence du livret dans `public/` — le fichier n'est pas encore livré, sa ligne
// apparaîtra d'elle-même le jour où il le sera.
//
// Composant SERVEUR : aucun JavaScript envoyé au navigateur.

import { existsSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";

import {
  CHEMIN_LIVRET,
  DOCUMENTS_INTRO,
  DOCUMENTS_NON_SIGNE,
  DOCUMENTS_RESERVES,
  DOCUMENTS_TITRE,
  documentsRemis,
} from "@/features/apporteurs-reseau/documents-remis";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature-regles";

import { Coquille, EcranEtat } from "../Coquille";
import { TEXTES } from "../textes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Mes documents — Axion-IA" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "same-origin",
};

interface PageProps {
  params: Promise<{ id: string; jeton: string }>;
}

/** Le livret est-il livré ? Lu à chaque demande, sur le disque du serveur. */
function livretPresent(): boolean {
  try {
    return existsSync(path.join(process.cwd(), "public", ...CHEMIN_LIVRET.split("/")));
  } catch {
    return false;
  }
}

const LIEN =
  "text-terracotta-deep inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline underline-offset-4";

export default async function MesDocumentsPage({ params }: PageProps) {
  const { id, jeton } = await params;
  const dossier =
    id.toLowerCase() === ID_DOSSIER_EXEMPLE ? null : await lireDossierParLien(id, jeton);
  const etat = dossier && !dossier.restreint ? etatDeLaPage(dossier.statut) : "neutre";
  if (!dossier || etat === "neutre") {
    return (
      <Coquille>
        <EcranEtat
          pastilleTexte="Réservé"
          titre={DOCUMENTS_RESERVES.titre}
          ligne={DOCUMENTS_RESERVES.texte}
        />
      </Coquille>
    );
  }
  const espace = `/apporteur/dossier/${dossier.id}/${jeton}`;
  const sousContrat = etat === "signe";
  const documents = documentsRemis({
    espace,
    sousContrat,
    contratSigneDisponible: dossier.aContratSigne,
    livretDisponible: livretPresent(),
  });

  return (
    <Coquille titre={TEXTES.bonjour(dossier.prenom)}>
      <h1 className="mt-6 font-serif text-[28px] leading-tight font-medium">{DOCUMENTS_TITRE}</h1>
      <p className="text-fg-soft mt-3 text-[16px] leading-relaxed">{DOCUMENTS_INTRO}</p>

      <ul className="mt-6 grid gap-4">
        {documents.map((d) => (
          <li key={d.cle} className="border-border bg-paper rounded-2xl border p-5">
            <h2 className="font-serif text-[22px] font-medium">{d.titre}</h2>
            <p className="text-fg-soft mt-1 text-[16px] leading-relaxed">{d.description}</p>
            <a
              href={d.href}
              className={`${LIEN} mt-1`}
              {...(d.nouvelOnglet ? { target: "_blank", rel: "noopener" } : {})}
            >
              {d.nouvelOnglet ? "↓" : null} {d.action}
              {d.nouvelOnglet ? null : " →"}
            </a>
            {d.telechargement ? (
              <a href={d.telechargement} download className={`${LIEN} mt-1 ml-6`}>
                ↓ {d.actionTelechargement}
              </a>
            ) : null}
          </li>
        ))}
      </ul>

      {sousContrat ? null : (
        <p className="text-fg-muted mt-5 text-[14px] leading-relaxed">{DOCUMENTS_NON_SIGNE}</p>
      )}

      <a href={espace} className={`${LIEN} mt-8`}>
        ← Retour à mon espace
      </a>
    </Coquille>
  );
}
