// Fiche apporteur (décision de Will, 10/10) : « Le nom correspond-il à l'entreprise ? ».
// Composant SERVEUR : relit le registre à l'affichage (délai déjà borné par `annuaire.ts`) et
// compare le nom du contrat aux personnes rattachées. Rendu dans un <Suspense> : la fiche
// s'affiche sans attendre le registre.

import { lireRegistre } from "@/features/apporteurs-reseau/annuaire";
import { verdictNomRegistre, type NiveauNom } from "@/features/apporteurs-reseau/nom-registre";

const STYLE: Record<NiveauNom, string> = {
  correspond:
    "border-[color:var(--color-admin-success)] bg-[color:var(--color-admin-success-soft)] text-[color:var(--color-admin-success-fg)]",
  alerte:
    "border-[color:var(--color-admin-danger-border)] bg-[color:var(--color-admin-danger-bg)] text-[color:var(--color-admin-danger-fg)] font-semibold",
  impossible:
    "border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-sunken)] text-[color:var(--color-admin-fg-muted)]",
  registre_muet:
    "border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-sunken)] text-[color:var(--color-admin-fg-muted)]",
};

const ICONE: Record<NiveauNom, string> = {
  correspond: "✅",
  alerte: "⚠️",
  impossible: "ℹ️",
  registre_muet: "⏳",
};

function Cadre({ niveau, children }: { niveau: NiveauNom | null; children: React.ReactNode }) {
  return (
    <section
      aria-label="Le nom correspond-il à l'entreprise ?"
      className={`flex flex-col gap-[var(--space-admin-1)] rounded-[var(--radius-admin-md)] border p-[var(--space-admin-3)] ${niveau ? STYLE[niveau] : STYLE.impossible}`}
    >
      <h2 className="font-semibold">Le nom correspond-il à l&apos;entreprise ?</h2>
      {children}
    </section>
  );
}

export async function NomEtEntreprise({
  prenom,
  nom,
  siren,
  siret,
}: {
  prenom: string;
  nom: string;
  siren: string | null;
  siret: string | null;
}) {
  const identifiant = siret ?? siren;
  const v = verdictNomRegistre(
    { prenom, nom },
    identifiant ? await lireRegistre(identifiant) : null,
  );
  return (
    <Cadre niveau={v.niveau}>
      <p role={v.niveau === "alerte" ? "alert" : undefined}>
        {ICONE[v.niveau]} {v.message}
      </p>
    </Cadre>
  );
}

/** Pendant la lecture du registre. */
export function NomEtEntrepriseEnCours() {
  return (
    <Cadre niveau={null}>
      <p>Lecture du registre de l&apos;État…</p>
    </Cadre>
  );
}
