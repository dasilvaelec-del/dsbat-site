// =====================================================================
// js/choix-travaux.js — QUESTIONNAIRE DE CHOIX DE TRAVAUX v2 (moteur, non branché) — LOT33
// =====================================================================
// RÔLE : capturer les BESOINS client entre « Mes pièces » et « Configuration ».
//   Le questionnaire EXPRIME le besoin ; il ne calcule RIEN. La PROJECTION vers
//   les sources canoniques réellement consommées par les moteurs est faite par
//   l'adaptateur (js/choix-travaux-adapt.js), à la sortie du questionnaire.
//
// SOURCES CANONIQUES (verrouillées) :
//   • domotique/irve(=borneVE)/pv : chantier (rappel modifiable, écrit chantier).
//   • Chauffage : chantier.chauffage (electrique/gaz/pompe/fioul). Chiffrage réel
//     UNIQUEMENT electrique (radiateurs/fil pilote). La « solution » (radiateurs/
//     plancher) va dans piece.chauffageFonctions.solution (DESCRIPTIF). Sèche-serviette
//     -> ELEC_SECH_SERV (réel).
//   • VMC : chantier.intentionVentilation / chantier.solutionVentilation + projection.
//   • Revêtements/faïence : piece.solMateriau / piece.faienceMode (appliquerRevetements).
//   • Plomberie : piece.config.plomberie.*  • Volets : MEN_VOLET_ROULANT / ELEC_VOLET.
//   • Isolation/BA13 : piece.config.isolation.* est m²-piloté (non auto-semé) -> le
//     questionnaire ne capte QUE le besoin (DESCRIPTIF), signalé dans le rapport.
// =====================================================================

(function (global) {
  'use strict';

  var VERSION = 2;
  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; } }

  var PIECES_SDB = ['sdb'];          // salle de bain (baignoire + douche)
  var PIECES_SDE = ['sde'];          // salle d'eau (douche)
  var PIECES_EAU = ['sdb', 'sde'];
  var PIECES_WC = ['wc'];
  var PIECES_CUISINE = ['cuisine'];
  // Lave-linge : le moteur plomberie ne produit PLO_RACCORD_LV que dans ces pièces.
  var PIECES_LAVE_LINGE_CONSOMMEES = ['cuisine', 'cave'];

  var RAPPEL_CHANTIER = [
    { id: 'domotique', label: 'Domotique / Smart home', cleChantier: 'domotique',
      options: [{ v: 'non', l: 'Non' }, { v: 'basique', l: 'Basique' }, { v: 'complet', l: 'Complet' }] },
    { id: 'irve', label: 'Borne de recharge (IRVE)', cleChantier: 'borneVE',
      options: [{ v: 'non', l: 'Non' }, { v: 'oui', l: 'Oui' }] },
    { id: 'pv', label: 'Panneaux solaires', cleChantier: 'pv',
      options: [{ v: 'non', l: 'Non' }, { v: 'oui', l: 'Oui' }] }
  ];

  var SOL_MATERIAUX_FALLBACK = [
    { v: 'carrelage', l: 'Carrelage' }, { v: 'parq_flot', l: 'Parquet flottant' },
    { v: 'stratifie', l: 'Sol stratifié' }, { v: 'pvc', l: 'Sol PVC' },
    { v: 'moquette', l: 'Moquette' }, { v: 'lino', l: 'Linoléum' }
  ];

  var oui_non = [{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non' }];
  var oui_non_svp = [{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non' }, { v: 'a_conseiller', l: 'À conseiller' }];

  // Chauffage : types canoniques (chantier.chauffage) et solutions par type.
  // NB chiffrage réel : uniquement electrique + radiateurs (dimensionnementChauffage).
  var CHAUFFAGE_TYPES = [
    { v: 'electrique', l: 'Électricité' }, { v: 'gaz', l: 'Gaz' },
    { v: 'pompe', l: 'Pompe à chaleur' }, { v: 'fioul', l: 'Fioul' }
  ];
  var CHAUFFAGE_SOLUTIONS = {
    electrique: [{ v: 'radiateurs', l: 'Radiateurs électriques' }, { v: 'chauffage_sol', l: 'Chauffage au sol électrique' }],
    gaz: [{ v: 'radiateurs', l: 'Radiateurs' }, { v: 'chauffage_sol', l: 'Plancher chauffant' }],
    pompe: [{ v: 'radiateurs', l: 'Radiateurs' }, { v: 'chauffage_sol', l: 'Plancher chauffant' }],
    fioul: [{ v: 'radiateurs', l: 'Radiateurs' }]
  };

  function clePiece(p) { return String(p && p.id) + '#' + String(p && (p.numero != null ? p.numero : 1)); }
  function estNeuf(ch) { return ch && (ch.typeProjet === 'neuf' || ch.typeProjet === 'extension'); }
  function actif(m, x) { return Array.isArray(m) && m.indexOf(x) !== -1; }
  function filtrer(pieces, ids) { return (pieces || []).filter(function (p) { return ids.indexOf(String(p.id)) !== -1; }); }

  function choixTravauxVide() {
    return {
      version: VERSION,
      electricite: { niveau: null, reseauMultimedia: null },
      plomberie: { sdb: {}, wc: {}, cuisine: {}, laveLinge: { piece: null } },
      chauffage: { type: null, solution: null, secheServiette: null },
      vmc: { intention: null, solution: null },
      revetementsSol: { uniforme: null, global: null, parPiece: {} },
      faience: { parPiece: {} },
      menuiserie: { volets: null, fenetres: null },
      isolation: { niveau: null, acoustique: null },       // DESCRIPTIF (voir rapport)
      ba13: { cloisons: null, fauxPlafond: null, acoustique: null } // DESCRIPTIF (voir rapport)
    };
  }

  function initChoix(chantier, pieces, metiersActifs) {
    var base = choixTravauxVide();
    var existant = chantier && chantier.choixTravaux;
    return existant ? fusionner(base, existant) : base;
  }

  function fusionner(base, patch) {
    var out = clone(base) || choixTravauxVide();
    if (!patch || typeof patch !== 'object') return out;
    out.version = VERSION;
    ['electricite', 'plomberie', 'chauffage', 'vmc', 'revetementsSol', 'faience', 'menuiserie', 'isolation', 'ba13'].forEach(function (k) {
      if (patch[k]) out[k] = fusionProfonde(out[k] || {}, patch[k]);
    });
    return out;
  }
  function fusionProfonde(a, b) {
    if (b === null || b === undefined) return a;
    if (typeof b !== 'object') return b;
    if (Array.isArray(b)) return clone(b);
    var out = (a && typeof a === 'object' && !Array.isArray(a)) ? clone(a) : {};
    Object.keys(b).forEach(function (k) {
      var vb = b[k];
      if (vb !== null && typeof vb === 'object' && !Array.isArray(vb)) out[k] = fusionProfonde(out[k] || {}, vb);
      else if (vb !== undefined) out[k] = vb;
    });
    return out;
  }

  function construireQuestionnaire(chantier, pieces, metiersActifs, catalogues) {
    chantier = chantier || {}; pieces = pieces || []; metiersActifs = metiersActifs || [];
    catalogues = catalogues || {};
    var solMats = catalogues.solMateriaux || SOL_MATERIAUX_FALLBACK;
    var faienceModes = catalogues.faienceModes || function () { return [{ v: 'non', l: 'Aucune' }, { v: 'murs', l: 'Murs entiers' }]; };

    var rappel = RAPPEL_CHANTIER.map(function (r) {
      var v = chantier[r.cleChantier];
      return { id: r.id, label: r.label, cleChantier: r.cleChantier, options: clone(r.options), valeur: (v == null ? 'non' : v) };
    });

    var sections = [];

    // ÉLECTRICITÉ
    if (actif(metiersActifs, 'electricite')) {
      sections.push({
        code: 'electricite', titre: '⚡ Électricité',
        questions: [
          { id: 'niveau', type: 'choix', label: 'Niveau de prestations électriques souhaité', options: [{ v: 'essentiel', l: 'Essentiel' }, { v: 'confort', l: 'Confort' }, { v: 'haut', l: 'Haut de gamme' }] },
          { id: 'reseauMultimedia', type: 'choix', label: 'Réseau multimédia (RJ45) renforcé ?', options: oui_non, note: 'Le socle RJ45 réglementaire est déjà inclus ; « oui » ajoute des prises réseau supplémentaires.' }
        ]
      });
    }

    // CHAUFFAGE (arborescence : type -> solution ; + sèche-serviette)
    if (actif(metiersActifs, 'chauffage')) {
      var piecesSS = filtrer(pieces, PIECES_EAU).map(function (p) { return { cle: clePiece(p), nom: p.nom || p.id, id: p.id }; });
      sections.push({
        code: 'chauffage', titre: '🔥 Chauffage',
        type: { label: 'Quel type de chauffage souhaitez-vous ?', options: clone(CHAUFFAGE_TYPES) },
        solutionsParType: clone(CHAUFFAGE_SOLUTIONS),
        secheServiette: piecesSS.length ? { label: 'Souhaitez-vous un sèche-serviettes dans vos salles de bain / salles d\'eau ?', options: oui_non, pieces: piecesSS } : null
      });
    }

    // PLOMBERIE
    if (actif(metiersActifs, 'plomberie')) {
      var sec = { code: 'plomberie', titre: '🚰 Plomberie', sdb: [], sde: [], wc: [], cuisine: [], laveLinge: null };
      filtrer(pieces, PIECES_SDB).forEach(function (p) {
        sec.sdb.push({ cle: clePiece(p), nom: p.nom || p.id, id: p.id,
          equipements: [{ v: 'baignoire', l: 'Baignoire' }, { v: 'douche_ital', l: 'Douche à l\'italienne' }],
          lavabo: { label: 'Type de lavabo', options: [{ v: 'simple', l: 'Simple vasque' }, { v: 'double', l: 'Double vasque' }] } });
      });
      filtrer(pieces, PIECES_SDE).forEach(function (p) {
        sec.sde.push({ cle: clePiece(p), nom: p.nom || p.id, id: p.id,
          equipements: [{ v: 'douche_ital', l: 'Douche à l\'italienne' }, { v: 'cabine', l: 'Cabine de douche' }],
          lavabo: { label: 'Type de lavabo', options: [{ v: 'simple', l: 'Simple vasque' }, { v: 'double', l: 'Double vasque' }] } });
      });
      filtrer(pieces, PIECES_WC).forEach(function (p) {
        sec.wc.push({ cle: clePiece(p), nom: p.nom || p.id, id: p.id,
          type: { label: 'Type de WC', options: [{ v: 'sol', l: 'WC au sol' }, { v: 'suspendu', l: 'WC suspendu' }] },
          laveMains: { label: 'Lave-mains ?', options: oui_non } });
      });
      filtrer(pieces, PIECES_CUISINE).forEach(function (p) {
        sec.cuisine.push({ cle: clePiece(p), nom: p.nom || p.id, id: p.id,
          evier: { label: 'Style d\'évier', options: [{ v: 'simple', l: '1 bac' }, { v: 'double', l: '2 bacs' }] },
          laveVaisselle: { label: 'Arrivée + évacuation lave-vaisselle ?', options: oui_non } });
      });
      // Lave-linge : liste DYNAMIQUE de toutes les pièces réelles pertinentes.
      var llPieces = pieces.filter(function (p) { return PIECES_EAU.indexOf(p.id) !== -1 || p.id === 'cuisine' || p.id === 'buanderie' || p.id === 'cave' || p.id === 'cellier'; });
      if (llPieces.length) {
        sec.laveLinge = {
          label: 'Dans quelle pièce prévoir l\'arrivée + évacuation du lave-linge ?',
          options: [{ v: 'aucun', l: 'Aucun' }].concat(llPieces.map(function (p) {
            return { v: clePiece(p), l: p.nom || p.id, consomme: PIECES_LAVE_LINGE_CONSOMMEES.indexOf(p.id) !== -1 };
          }))
        };
      }
      sections.push(sec);
    }

    // VMC (neuf : choix DIRECT du système ; réno : intention + solution)
    if (actif(metiersActifs, 'vmc')) {
      var solutions = [{ v: 'simple_flux', l: 'VMC simple flux' }, { v: 'hygro', l: 'VMC simple flux hygroréglable' }, { v: 'double_flux', l: 'VMC double flux' }];
      var sv = { code: 'vmc', titre: '💨 Ventilation (VMC)', questions: [] };
      if (!estNeuf(chantier)) {
        sv.questions.push({ id: 'intention', type: 'choix', label: 'Que souhaitez-vous pour la ventilation existante ?', options: [{ v: 'conserver', l: 'Conserver' }, { v: 'remplacer', l: 'Remplacer' }, { v: 'creer', l: 'Créer' }] });
      }
      sv.questions.push({ id: 'solution', type: 'choix', label: 'Quel type de ventilation souhaitez-vous ?', options: solutions, note: estNeuf(chantier) ? 'En construction neuve, une ventilation est obligatoire : choisissez directement le système.' : null });
      sections.push(sv);
    }

    // REVÊTEMENTS DE SOL
    if (actif(metiersActifs, 'sols') || actif(metiersActifs, 'carrelage')) {
      var recos = {};
      pieces.forEach(function (p) {
        if (PIECES_EAU.indexOf(p.id) !== -1 || p.id === 'wc' || p.id === 'cuisine') recos[clePiece(p)] = 'Pièce humide : carrelage recommandé';
        else if (p.id === 'chambre' || p.id === 'bureau') recos[clePiece(p)] = 'Parquet / stratifié possible';
      });
      sections.push({
        code: 'revetements', titre: '🪵 Revêtements de sol',
        uniforme: { label: 'Même revêtement dans toutes les pièces ?', options: oui_non },
        materiaux: clone(solMats),
        pieces: pieces.map(function (p) { return { cle: clePiece(p), nom: p.nom || p.id, id: p.id, reco: recos[clePiece(p)] || null }; })
      });
    }

    // FAÏENCE (métier carrelage)
    if (actif(metiersActifs, 'carrelage')) {
      var pf = pieces.filter(function (p) { return PIECES_EAU.indexOf(p.id) !== -1 || p.id === 'cuisine'; });
      if (pf.length) sections.push({ code: 'faience', titre: '🧱 Faïence', pieces: pf.map(function (p) { return { cle: clePiece(p), nom: p.nom || p.id, id: p.id, options: clone(faienceModes(p.id)) }; }) });
    }

    // MENUISERIE (volets : une seule question tri-état)
    if (actif(metiersActifs, 'menuiserie')) {
      sections.push({
        code: 'menuiserie', titre: '🚪 Menuiserie',
        questions: [
          { id: 'volets', type: 'choix', label: 'Voulez-vous des volets roulants ?', options: [{ v: 'non', l: 'Non' }, { v: 'manuel', l: 'Oui, manuels' }, { v: 'motorise', l: 'Oui, motorisés' }] },
          { id: 'fenetres', type: 'choix', label: 'Remplacement des fenêtres ?', options: oui_non }
        ]
      });
    }

    // ISOLATION (DESCRIPTIF : voir rapport ; piece.config.isolation est m²-piloté)
    if (actif(metiersActifs, 'isolation')) {
      sections.push({
        code: 'isolation', titre: '🧣 Isolation',
        questions: [
          { id: 'niveau', type: 'choix', label: 'Niveau de performance d\'isolation souhaité', options: [{ v: 'reglementaire', l: 'Réglementaire / standard' }, { v: 'renforce', l: 'Performance renforcée' }, { v: 'a_conseiller', l: 'Je ne sais pas, à conseiller' }], note: 'Besoin exprimé ; l\'épaisseur et les m² restent calculés par le moteur en Configuration.' },
          { id: 'acoustique', type: 'choix', label: 'Attention particulière à l\'isolation acoustique ?', options: oui_non_svp }
        ]
      });

      // BA13 / PLACO (DESCRIPTIF : besoins fonctionnels, aucune quantité)
      sections.push({
        code: 'ba13', titre: '🧱 Cloisons / BA13 (placo)',
        questions: [
          { id: 'cloisons', type: 'choix', label: 'Création / modification de cloisons ?', options: oui_non },
          { id: 'fauxPlafond', type: 'choix', label: 'Faux plafonds ?', options: oui_non },
          { id: 'acoustique', type: 'choix', label: 'Besoin acoustique renforcé (cloisons/doublages) ?', options: oui_non }
        ]
      });
    }

    return { version: VERSION, rappel: rappel, sections: sections };
  }

  function projeter(chantier) {
    var ct = (chantier && chantier.choixTravaux) || choixTravauxVide();
    return {
      version: VERSION,
      domotique: (chantier && chantier.domotique != null) ? chantier.domotique : null,
      irve: (chantier && chantier.borneVE != null) ? chantier.borneVE : null,
      pv: (chantier && chantier.pv != null) ? chantier.pv : null,
      chauffage: (chantier && chantier.chauffage != null) ? chantier.chauffage : null,
      intentionVentilation: (chantier && chantier.intentionVentilation != null) ? chantier.intentionVentilation : null,
      solutionVentilation: (chantier && chantier.solutionVentilation != null) ? chantier.solutionVentilation : null,
      choix: clone(ct)
    };
  }

  var API = {
    VERSION: VERSION,
    RAPPEL_CHANTIER: RAPPEL_CHANTIER,
    PIECES_SDB: PIECES_SDB, PIECES_SDE: PIECES_SDE, PIECES_EAU: PIECES_EAU, PIECES_WC: PIECES_WC, PIECES_CUISINE: PIECES_CUISINE,
    PIECES_LAVE_LINGE_CONSOMMEES: PIECES_LAVE_LINGE_CONSOMMEES,
    CHAUFFAGE_TYPES: CHAUFFAGE_TYPES, CHAUFFAGE_SOLUTIONS: CHAUFFAGE_SOLUTIONS,
    choixTravauxVide: choixTravauxVide, clePiece: clePiece, estNeuf: estNeuf,
    initChoix: initChoix, fusionner: fusionner, construireQuestionnaire: construireQuestionnaire, projeter: projeter
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ChoixTravauxDSBAT = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
