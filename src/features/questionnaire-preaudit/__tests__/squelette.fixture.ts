/**
 * HTML SYNTHÉTIQUE (jamais celui d'un client) qui reprend les formes que le lecteur de squelette
 * doit savoir lire : sections par parcours, niveaux, conditions, assistants, ternaire MODE,
 * chaînes et regex piégeuses. Le signe « § » tient la place de l'accent grave (modèle JS).
 */
export const HTML_SYNTHETIQUE = String.raw`<html><body><script>
const LVL1 = new Set(["a_nom", "a_cond", "b_1", "m_1", "t_1"]);
const commun = () => [
  F("text", "c_un", "Un commun [avec crochet // et guillemet \" ]"),
  F("head", "c_titre", "Titre"),
  F("deleg", "c_deleg", "Déléguer"),
];
const sansParen = [
  F("text", "s_un", "Un sans parenthèses"),
];
const avecParams = (x) => [ F("text", "p_un", x) ];
const SECTIONS = [
  /* commentaire de tête avec , virgule */
  { id: "a", title: "Dirigeant", only: "main", fields: [
    F("text", "a_nom", "Nom"),
    F("text", "a_cond", "Conditionnelle niveau 1", { show: (d) => /[?#]/.test(d.a_nom) }),
    F("text", "a_court", "Forme courte", { show, lvl3: 1 }),
    F("text", "a_plus", "Niveau 2 simple", { w: "half" }),
    F("rep", "equipe", "Liste", { fields: [ F("text", "prenom", "P"), F("text", "nom", "N") ] }),
    ...commun(),
    ...sansParen,
    ...avecParams("x"),
    ...(MODE === "main" ? [ F("text", "a_mode_main", "Pour main") ] : [ F("text", "a_mode_autre", "Pour autre") ]),
    F("text", "a_pour_emp", "Pas pour main", { only: "emp" }),
    F("text", §a_gabarit§, "id non littéral"),
    F("text", "a_modele", §un modèle avec ¤{"]"} dedans§),
  ]},
  { id: "b", title: "Collaborateur", only: "emp", fields: [
    F("text", "b_1", "Un"),
    F("text", "b_2", "Deux", { show: (d) => d.b_1 }),
    F("text", "b_it", "Réservé au référent", { only: "it" }),
  ]},
  { id: "m", title: "Tous", lvl: 1, fields: [
    F("text", "m_1", "Commun un"),
    F("text", "m_2", "Commun deux"),
  ]},
  { id: "t", title: "Référent", it: true, fields: [
    F("text", "t_1", "T un"),
    F("text", "t_2", "T deux", { show: () => true }),
    F("text", "t_3", "T trois", { lvl3: 1 }),
  ]},
  { id: "u", only: "it", title: "Seulement référent", fields: [ F("text", "u_1", "U") ]},
  { id: "send", title: "Envoi", fields: [ F("text", "z_envoi", "Ne compte pas") ]},
];
</script></body></html>`.replaceAll("§", "`").replaceAll("¤", "$");
