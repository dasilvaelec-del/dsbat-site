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

  // ----- RÉSEAUX SOCIAUX -----
  // Instagram : compte officiel DS.BAT
  social: {
    instagram: "https://www.instagram.com/ds.bat.fr",
    facebook: "https://www.facebook.com/profile.php?id=61590265183793",
    whatsapp: "https://wa.me/33629556627",
  },

  // ----- IMAGES (chemins relatifs) -----
  images: {
    hero: "image/uploads/chantier-verriere.webp",
    qrCode: "image/uploads/qrcode-site.webp",
  },

  // ----- OPTIONS GÉNÉRALES (TVAs, acomptes) -----
  options: {
    tvaRenov: 0.10,       // 10 % pour rénovation
    tvaNeuf: 0.20,        // 20 % pour neuf
    acomptes: [0.4, 0.3, 0.3],  // 40%, 30%, 30%
  },

  // ----- PRIX -----
  // ⚠️ Les tarifs vivent désormais EXCLUSIVEMENT côté Runtime privé
  // (runtime/moteur-prive/). Le navigateur ne reçoit plus le catalogue :
  //   • prix d'affichage par prestation → vue tarifaire auto-hébergée (R08/R09) ;
  //   • devis GLOBAL (tableau, VMC, plomberie, chauffage, zones) → Runtime (R10).

  // ----- RUNTIME DSBAT (R10) -----
  // Le devis global est calculé par le Runtime, désormais dépendance officielle.
  // ⚙️ Renseigner l'URL du Runtime DÉPLOYÉ (HTTPS + CORS autorisé pour ce domaine).
  // Repli local historique : mettre `sourceDevis: 'local'` (nécessite prix.js — voir retour arrière R10).
  runtime: {
    base: "http://127.0.0.1:8787",   // ⚠️ à remplacer par l'URL de production déployée
    sourceDevis: "runtime"           // 'runtime' (défaut R10) | 'local' (retour arrière)
  },
};

// ===== APPLICATION AUTOMATIQUE DE LA CONFIG =====
// Ce bloc s'exécute sur toutes les pages qui chargent config.js.
// Il met à jour les éléments dynamiques (WhatsApp, Instagram, Facebook, favicon).
(function () {
  function applyConfig() {
    // Favicon (injecté si absent)
    if (!document.querySelector('link[rel="icon"]')) {
      var lnk = document.createElement('link');
      lnk.rel = 'icon';
      lnk.type = 'image/svg+xml';
      lnk.href = 'favicon.svg';
      document.head.appendChild(lnk);
    }

    // Bouton WhatsApp flottant : URL depuis config + icône locale
    document.querySelectorAll('.whatsapp-float').forEach(function (el) {
      el.href = CONFIG.social.whatsapp;
      var img = el.querySelector('img');
      if (img) {
        img.src = 'image/whatsapp.svg';
        img.removeAttribute('loading');
      }
    });

    // Liens Instagram dans le menu
    document.querySelectorAll('a[href*="instagram.com"]').forEach(function (el) {
      el.href = CONFIG.social.instagram;
    });

    // Liens Facebook dans le menu
    document.querySelectorAll('a[href*="facebook.com"]').forEach(function (el) {
      el.href = CONFIG.social.facebook;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyConfig);
  } else {
    applyConfig();
  }
})();