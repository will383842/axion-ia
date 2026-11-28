interface ChiffreCleProps {
  /** Valeur telle que publiée (jamais devinée) : « 45 % », « 12 h ». */
  readonly valeur: string;
  readonly libelle: string;
}

/** Un chiffre mis en avant (`.chiffres__valeur`), à poser dans une `RangeeChiffres`. */
export function ChiffreCle({ valeur, libelle }: ChiffreCleProps) {
  return (
    <li>
      <span className="chiffres__valeur">{valeur}</span>
      <span className="chiffres__libelle">{libelle}</span>
    </li>
  );
}
