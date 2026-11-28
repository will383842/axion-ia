/**
 * Noms des départements français (module PUR), pour écrire « l'Isère » et jamais « département 38 ».
 * 101 entrées : métropole (Corse comprise) et outre-mer (971, 972, 973, 974, 976), les mêmes codes
 * que les chefs-lieux de `geo.ts`. Un code inconnu n'est jamais deviné : `null`.
 */
export const NOMS_DEPARTEMENTS: Readonly<Record<string, string>> = {
  "01": "l'Ain",
  "02": "l'Aisne",
  "03": "l'Allier",
  "04": "les Alpes-de-Haute-Provence",
  "05": "les Hautes-Alpes",
  "06": "les Alpes-Maritimes",
  "07": "l'Ardèche",
  "08": "les Ardennes",
  "09": "l'Ariège",
  "10": "l'Aube",
  "11": "l'Aude",
  "12": "l'Aveyron",
  "13": "les Bouches-du-Rhône",
  "14": "le Calvados",
  "15": "le Cantal",
  "16": "la Charente",
  "17": "la Charente-Maritime",
  "18": "le Cher",
  "19": "la Corrèze",
  "21": "la Côte-d'Or",
  "22": "les Côtes-d'Armor",
  "23": "la Creuse",
  "24": "la Dordogne",
  "25": "le Doubs",
  "26": "la Drôme",
  "27": "l'Eure",
  "28": "l'Eure-et-Loir",
  "29": "le Finistère",
  "2A": "la Corse-du-Sud",
  "2B": "la Haute-Corse",
  "30": "le Gard",
  "31": "la Haute-Garonne",
  "32": "le Gers",
  "33": "la Gironde",
  "34": "l'Hérault",
  "35": "l'Ille-et-Vilaine",
  "36": "l'Indre",
  "37": "l'Indre-et-Loire",
  "38": "l'Isère",
  "39": "le Jura",
  "40": "les Landes",
  "41": "le Loir-et-Cher",
  "42": "la Loire",
  "43": "la Haute-Loire",
  "44": "la Loire-Atlantique",
  "45": "le Loiret",
  "46": "le Lot",
  "47": "le Lot-et-Garonne",
  "48": "la Lozère",
  "49": "le Maine-et-Loire",
  "50": "la Manche",
  "51": "la Marne",
  "52": "la Haute-Marne",
  "53": "la Mayenne",
  "54": "la Meurthe-et-Moselle",
  "55": "la Meuse",
  "56": "le Morbihan",
  "57": "la Moselle",
  "58": "la Nièvre",
  "59": "le Nord",
  "60": "l'Oise",
  "61": "l'Orne",
  "62": "le Pas-de-Calais",
  "63": "le Puy-de-Dôme",
  "64": "les Pyrénées-Atlantiques",
  "65": "les Hautes-Pyrénées",
  "66": "les Pyrénées-Orientales",
  "67": "le Bas-Rhin",
  "68": "le Haut-Rhin",
  "69": "le Rhône",
  "70": "la Haute-Saône",
  "71": "la Saône-et-Loire",
  "72": "la Sarthe",
  "73": "la Savoie",
  "74": "la Haute-Savoie",
  "75": "Paris",
  "76": "la Seine-Maritime",
  "77": "la Seine-et-Marne",
  "78": "les Yvelines",
  "79": "les Deux-Sèvres",
  "80": "la Somme",
  "81": "le Tarn",
  "82": "le Tarn-et-Garonne",
  "83": "le Var",
  "84": "le Vaucluse",
  "85": "la Vendée",
  "86": "la Vienne",
  "87": "la Haute-Vienne",
  "88": "les Vosges",
  "89": "l'Yonne",
  "90": "le Territoire de Belfort",
  "91": "l'Essonne",
  "92": "les Hauts-de-Seine",
  "93": "la Seine-Saint-Denis",
  "94": "le Val-de-Marne",
  "95": "le Val-d'Oise",
  "971": "la Guadeloupe",
  "972": "la Martinique",
  "973": "la Guyane",
  "974": "La Réunion",
  "976": "Mayotte",
};

/** Le nom (avec article : « l'Isère », « la Savoie », « Paris ») d'un code de département, sinon `null`. */
export function nomDepartement(code: string | null | undefined): string | null {
  const c = (code ?? "").trim().toUpperCase();
  const normal = /^\d$/.test(c) ? `0${c}` : c;
  return Object.prototype.hasOwnProperty.call(NOMS_DEPARTEMENTS, normal)
    ? (NOMS_DEPARTEMENTS[normal] ?? null)
    : null;
}

/** « dans l'Isère », « dans la Savoie », « à Paris », « en Guyane » ; code inconnu : `null`. */
export function localiserDansDepartement(code: string | null | undefined): string | null {
  const nom = nomDepartement(code);
  if (!nom) return null;
  if (nom === "Paris" || nom === "La Réunion" || nom === "Mayotte") return `à ${nom}`;
  if (nom === "la Guadeloupe" || nom === "la Martinique" || nom === "la Guyane") {
    return `en ${nom.slice(3)}`;
  }
  return `dans ${nom}`;
}
