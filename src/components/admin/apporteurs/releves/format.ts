// Formats d'affichage des écrans « relevés » : purs, sur des centimes entiers.

export function eur(cents: number): string {
  const signe = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const entier = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${signe}${entier},${String(abs % 100).padStart(2, "0")} €`;
}

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** « 2026-10 » → « octobre 2026 ». */
export function moisLisible(periode: string): string {
  const [a, m] = periode.split("-");
  return `${MOIS[Number(m) - 1] ?? m} ${a}`;
}

export function dateHeureParis(d: Date): string {
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}
