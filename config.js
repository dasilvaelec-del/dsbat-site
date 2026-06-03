// config.js – Fichier de configuration centralisé pour DS.BAT
// Modifie uniquement les valeurs entre guillemets (ou les nombres).

const CONFIG = {
  // ----- INFORMATIONS ENTREPRISE -----
  entreprise: {
    nom: "DS.BAT Électricité & Rénovation",
    telephone: "06 29 55 66 27",
    telephoneBase64: "MDYyOTU1NjYyNw==",
    email: "contact@dsbat.fr",
    adresse: "58 Grande Rue, 77410 Villevaudé",
    siren: "978 281 970",
    siret: "97828197000019",
  },

  // ----- RÉSEAUX SOCIAUX (remplace "votrecompte") -----
  social: {
    instagram: "https://www.instagram.com/votrecompte",
    facebook: "https://www.facebook.com/profile.php?id=61590265183793",
  },

  // ----- IMAGES (chemins relatifs) -----
  images: {
    hero: "image/uploads/chantier-verriere.webp",
    qrCode: "image/qrcode-site.png",
  },

  // ----- OPTIONS GÉNÉRALES (TVAs, acomptes) -----
  options: {
    tvaRenov: 0.10,       // 10 % pour rénovation
    tvaNeuf: 0.20,        // 20 % pour neuf
    acomptes: [0.4, 0.3, 0.3],  // 40%, 30%, 30%
  },

  // ----- PRIX (à compléter avec tes tarifs) -----
  prix: {
    electricite: {
      priseSimple: 83.97,
      interrupteur: 89.20,
      tableau: 1210.10,
      // Ajoute ici toutes les autres prestations électricité
    },
    plomberie: {
      evier: 300,
      wc: 250,
      // etc.
    },
    // ... autres corps de métier
  }
};