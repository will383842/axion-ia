// Les règlements des challenges passés : titre et période seulement. Aucun chiffre personnel,
// aucun compteur, aucun classement, aucun nombre de participants. Mêmes gardes que le règlement :
// apporteur SIGNÉ, lien personnel valide, hors mode restreint ; tout autre cas : 404 neutre.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { jourParis } from "@/features/apporteurs-reseau/autofacture-donnees";
import {
  listerReglementsPasses,
  type LigneReglementPasse,
} from "@/features/apporteurs-reseau/challenge-donnees";
import { lireDossierParLien } from "@/features/apporteurs-reseau/donnees";
import { challengesEspaceActifs } from "@/features/apporteurs-reseau/interrupteur-challenges-espace";
import { ID_DOSSIER_EXEMPLE } from "@/features/apporteurs-reseau/jeton";
import { etatDeLaPage } from "@/features/apporteurs-reseau/signature";

import { Coquille } from "../../Coquille";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Règlements des challenges passés — Axion-IA" },
  robots: { index: false, follow: false, nocache: true },
};

interface PageProps {
  params: Promise<{ id: string; jeton: string }>;
}

const jourFr = (j: string): string => {
  const [a, m, d] = j.split("-");
  return `${d}/${m}/${a}`;
};

export default async function ReglementsPassesPage({ params }: PageProps) {
  const { id, jeton } = await params;
  if (!challengesEspaceActifs()) notFound();
  if (id.toLowerCase() === ID_DOSSIER_EXEMPLE) notFound();
  const dossier = await lireDossierParLien(id, jeton);
  if (!dossier || dossier.restreint || etatDeLaPage(dossier.statut) !== "signe") notFound();
  let lignes: LigneReglementPasse[] = [];
  try {
    lignes = await listerReglementsPasses(jourParis(new Date()));
  } catch {
    notFound();
  }
  return (
    <Coquille titre="Règlements des challenges passés">
      {lignes.length === 0 ? (
        <p className="text-fg-soft mt-5 text-[17px]">Aucun règlement de challenge passé.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {lignes.map((l) => (
            <li key={l.id}>
              <a
                href={`/apporteur/dossier/${id}/${jeton}/challenge/reglement/${l.id}`}
                className="border-border bg-paper text-terracotta-deep block min-h-[48px] rounded-2xl border p-4 text-[17px] font-bold underline underline-offset-4"
              >
                {l.titre}
                <span className="text-fg-soft block font-normal no-underline">
                  Du {jourFr(l.debutLe)} au {jourFr(l.finLe)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <a
        href={`/apporteur/dossier/${id}/${jeton}`}
        className="text-terracotta-deep mt-5 inline-flex min-h-[48px] items-center gap-2 font-bold underline underline-offset-4"
      >
        ← Retour à mon espace
      </a>
    </Coquille>
  );
}
