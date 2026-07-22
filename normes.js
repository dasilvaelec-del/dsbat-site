// normes.js – Références normatives par corps de métier
// Utilisation : inclusion dans les pages de devis ou dans la page "engagements"

const NORMES = {
  electricite: {
    titre: "⚡ Électricité",
    normes: [
      { ref: "NF C 15-100", description: "Installations électriques basse tension – sécurité des personnes et des biens." },
      { ref: "RE2020 / RT Existant", description: "Performance énergétique des systèmes d'éclairage et auxiliaires." }
    ]
  },
  plomberie: {
    titre: "🔩 Plomberie / Sanitaire",
    normes: [
      { ref: "NF DTU 60.1", description: "Plomberie sanitaire – mise en œuvre des réseaux d'eau." },
      { ref: "NF DTU 60.11", description: "Règles de calcul pour les installations sanitaires." },
      { ref: "RE2020 / RT Existant", description: "Exigences sur la production d'eau chaude sanitaire et isolation des réseaux." }
    ]
  },
  maconnerie: {
    titre: "🧱 Maçonnerie / Gros œuvre",
    normes: [
      { ref: "NF DTU 20.1", description: "Ouvrages en maçonnerie de petits éléments – conception et exécution." },
      { ref: "RE2020 / RT Existant", description: "Prise en compte de l'inertie thermique et du besoin bioclimatique." }
    ]
  },
  peinture: {
    titre: "🎨 Peinture / Finitions",
    normes: [
      { ref: "NF DTU 59.1", description: "Peinture des bâtiments – préparation des supports et application." },
      { ref: "RE2020 / RT Existant", description: "Confort d'été (albédo des peintures)." }
    ]
  },
  sols: {
    titre: "🪵 Revêtements de sol",
    normes: [
      { ref: "NF DTU 51.2", description: "Parquets collés – pose et supports admissibles." },
      { ref: "NF DTU 51.11", description: "Pose flottante des parquets contrecollés et sols stratifiés." },
      { ref: "NF DTU 53.2", description: "Revêtements de sol PVC (sols souples) collés." }
    ]
  },
  carrelage: {
    titre: "🧱 Carrelage / Faïence",
    normes: [
      { ref: "NF DTU 52.2", description: "Pose collée des revêtements céramiques – étanchéité des pièces humides." }
    ]
  },
  isolation: {
    titre: "🧱 Isolation & BA13 (Plâtrerie)",
    normes: [
      { ref: "NF DTU 25.41", description: "Ouvrages en plaques de plâtre – cloisons, doublages, plafonds." },
      { ref: "NF DTU 45.10", description: "Isolation des combles par soufflage." },
      { ref: "RE2020 / RT Existant", description: "Résistance thermique, traitement des ponts thermiques, étanchéité à l'air." }
    ]
  },
  menuiserie: {
    titre: "🪟 Menuiseries",
    normes: [
      { ref: "NF DTU 36.5", description: "Fenêtres et portes extérieures – pose." },
      { ref: "NF DTU 36.2", description: "Menuiserie intérieure – portes et habillages." },
      { ref: "NF DTU 36.3", description: "Escaliers en bois – conception et pose." },
      { ref: "RE2020 / RT Existant", description: "Performance thermique des fenêtres, surface vitrée minimale." }
    ]
  },
  couverture: {
    titre: "🏠 Couverture / Zinguerie / Étanchéité",
    normes: [
      { ref: "NF DTU 40.24", description: "Couverture en tuiles béton." },
      { ref: "NF DTU 40.36", description: "Plaques nervurées." },
      { ref: "NF DTU 43.1", description: "Étanchéité des toitures-terrasses." },
      { ref: "RE2020 / RT Existant", description: "Isolation de la toiture, étanchéité à l'air." }
    ]
  },
  vmc: {
    titre: "🌬️ VMC",
    normes: [
      { ref: "NF DTU 68.3", description: "Installations de ventilation mécanique – conception et installation." },
      { ref: "RE2020 / RT Existant", description: "Performance de la ventilation, récupération de chaleur." }
    ]
  },
  exterieur: {
    titre: "🌳 Aménagement extérieur / Terrasse bois",
    normes: [
      { ref: "Règles de l'art", description: "Structures bois, fixation, drainage – sans DTU spécifique." }
    ]
  }
};