/** Teintes de la chronologie, tirées des variables d'`AdminBloc` (un seul sens par couleur). */
import type { NuanceActivite } from "@/features/dossier-client/fiche/chronologie";

const t = (c: "terracotta" | "bleu" | "vert" | "ambre" | "gris"): string =>
  `border-[color:var(--color-admin-bloc-${c}-border)] bg-[color:var(--color-admin-bloc-${c}-bg)] text-[color:var(--color-admin-bloc-${c}-title)]`;

export const TEINTE_NUANCE: Readonly<Record<NuanceActivite, string>> = {
  prevu: t("bleu"),
  fait: t("vert"),
  a_valider: t("terracotta"),
  a_faire: t("terracotta"),
  probleme: t("terracotta"),
  en_retard: t("terracotta"),
  neutre: t("gris"),
  argent: t("ambre"),
};
