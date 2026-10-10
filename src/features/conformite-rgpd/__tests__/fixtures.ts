// Registre FICTIF et neutre, pour les tests seulement — aucun contenu réel.
export const registreFictif = {
  misAJourLe: "2000-01-01",
  champInconnu: "ignoré",
  traitements: [
    {
      id: "activite-a",
      nom: "Activité A",
      personnes: ["Personnes A"],
      donnees: "Donnée A",
      destinataires: [{ nom: "Prestataire Exemple", pays: "Pays X", horsUE: true }],
      ecarts: [
        { code: "A-1", gravite: "faible", constat: "Constat A1", correction: "Correction A1" },
        { code: "A-2", gravite: "critique", constat: "Constat A2", correction: "Correction A2" },
      ],
    },
    {
      id: "activite-b",
      nom: "Activité B",
      ecarts: [{ gravite: "eleve", statut: "corrige" }],
    },
    {
      id: "activite-c",
      nom: "Activité C",
      ecarts: [{ gravite: "moyen" }, { gravite: "eleve" }],
    },
  ],
};
