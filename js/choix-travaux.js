// =====================================================================
// js/choix-travaux.js — QUESTIONNAIRE DE CHOIX DE TRAVAUX v2 (moteur, non branché)
// =====================================================================
// RÔLE : capturer les BESOINS client entre « Mes pièces » et « Configuration ».
//   Le questionnaire EXPRIME le besoin ; il ne calcule RIEN (ni quantité, ni
//   surface, ni prix, ni produit, ni règle normative). La PROJECTION vers les
//   sources canoniques réellement consommées par les moteurs est faite par
//   l'adaptateur (js/choix-travaux-adapt.js), à la sortie du questionnaire.
//
// SOURCE UNIQUE (règles verrouillées) :
//   • domotique / irve(=borneVE) / pv : source = chantier. Le questionnaire
//     les affiche et permet de les MODIFIER, mais la modification retourne
//     dans chantier.domotique / chantier.borneVE / chantier.pv (pas de copie).
//   • VMC : source = chantier.intentionVentilation / chantier.solutionVentilation
//     puis projection existante -> piece.ventilationFonctions. Rien de neuf.
//   • Chauffage au sol : source canonique = piece.chauffageFonctions.solution
//     (technologie 'plancher_chauffant'). Descriptif : AUCUN moteur ne le chiffre
//     aujourd'hui -> signalé « non chiffré » (futur lot chauffage).
//   • Revêtements sol/faïence : sources = piece.solMateriau / piece.faienceMode
//     (consommées par appliquerRevetements). Plomberie : piece.config.plomberie.
//   • Électricité niveau : source = objectifProjet (levier existant recoDSBAT).
// =====================================================================

(function (global) {
  'use strict';

  var VERSION = 2;

  function clone(x) { try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; } }

  // Pièces cibles (ciblage UI, NON normatif — les moteurs restent seuls juges).
  var PIECES_SDB = ['sdb', 'sde'];
  var PIECES_WC = ['wc'];
  var PIECES_CUISINE = ['cuisine'];
  // Lave-linge : SEULES les pièces où le moteur plomberie produit PLO_RACCORD_LV.
  var PIECES_LAVE_LINGE_SUPPORTEES = ['cuisine', 'cave'];
  // Buanderie : présente dans le programme mais NON modélisée en plomberie -> évolution future.
  var PIECES_LAVE_LINGE_FUTUR = ['buanderie'];

  // Transverses référencés (source = chantier), désormais MODIFIABLES ici.
  var RAPPEL_CHANTIER = [
    { id: 'domotique', label: 'Domotique / Smart home', cleChantier: 'domotique',
      options: [{ v: 'non', l: 'Non' }, { v: 'basique', l: 'Basique' }, { v: 'complet', l: 'Complet' }] },
    { id: 'irve', label: 'Borne de recharge (IRVE)', cleChantier: 'borneVE',
      options: [{ v: 'non', l: 'Non' }, { v: 'oui', l: 'Oui' }] },
    { id: 'pv', label: 'Panneaux solaires', cleChantier: 'pv',
      options: [{ v: 'non', l: 'Non' }, { v: 'oui', l: 'Oui' }] }
  ];

  // Matériaux de sol par défaut (labels UI). Le mapping réel (solType / carrelage)
  // est possédé par moteur-revetements.js (SOL_MATERIAUX) ; on peut le lui injecter.
  var SOL_MATERIAUX_FALLBACK = [
    { v: 'carrelage', l: 'Carrelage' },
    { v: 'parq_flot', l: 'Parquet flottant' },
    { v: 'stratifie', l: 'Sol stratifié' },
    { v: 'pvc', l: 'Sol PVC' },
    { v: 'moquette', l: 'Moquette' },
    { v: 'lino', l: 'Linoléum' }
  ];

  var oui_non = [{ v: 'oui', l: 'Oui' }, { v: 'non', l: 'Non' }];

  function clePiece(p) { return String(p && p.id) + '#' + String(p && (p.numero != null ? p.numero : 1)); }
  function estNeuf(ch) { return ch && (ch.typeProjet === 'neuf' || ch.typeProjet === 'extension'); }
  function actif(metiers, m) { return Array.isArray(metiers) && metiers.indexOf(m) !== -1; }
  function filtrer(pieces, ids) { return (pieces || []).filter(function (p) { return ids.indexOf(String(p.id)) !== -1; }); }

  // ------------------------------------------------------------------
  // choixTravauxVide() — squelette v2 (les transverses référencés NE sont PAS
  //   stockés ici : ils vivent dans chantier).
  // ------------------------------------------------------------------
  function choixTravauxVide() {
    return {
      version: VERSION,
      electricite: { niveau: null, reseauMultimedia: null },
      plomberie: { sdb: {}, wc: {}, cuisine: {}, laveLinge: { piece: null } },
      chauffage: { chauffageAuSol: null },
      vmc: { intention: null, solution: null },
      revetementsSol: { uniforme: null, global: null, parPiece: {} },
      faience: { parPiece: {} },
      menuiserie: { volets: null, motoriser: null, fenetres: null }
    };
  }

  // ------------------------------------------------------------------
  // initChoix — squelette complété + fusion non destructive avec l'existant.
  // ------------------------------------------------------------------
  function initChoix(chantier, pieces, metiersActifs) {
    var base = choixTravauxVide();
    var existant = chantier && chantier.choixTravaux;
    return existant ? fusionner(base, existant) : base;
  }

  function fusionner(base, patch) {
    var out = clone(base) || choixTravauxVide();
    if (!patch || typeof patch !== 'object') return out;
    out.version = VERSION;
    ['electricite', 'plomberie', 'chauffage', 'vmc', 'revetementsSol', 'faience', 'menuiserie'].forEach(function (k) {
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

  // ------------------------------------------------------------------
  // construireQuestionnaire — description PURE de l'écran (dynamique).
  //   catalogues (optionnel) : { solMateriaux:[{v,l}], faienceModes:fn(id)->[{v,l}] }
  // ------------------------------------------------------------------
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

    // --- ÉLECTRICITÉ ---
    if (actif(metiersActifs, 'electricite')) {
      sections.push({
        code: 'electricite', titre: '⚡ Électricité',
        questions: [
          { id: 'niveau', type: 'choix', label: 'Niveau de prestations électriques souhaité', options: [{ v: 'essentiel', l: 'Essentiel' }, { v: 'confort', l: 'Confort' }, { v: 'haut', l: 'Haut de gamme' }] },
          { id: 'reseauMultimedia', type: 'choix', label: 'Réseau multimédia (RJ45) renforcé ?', options: oui_non, note: 'Le socle RJ45 réglementaire (séjour, chambres) est déjà inclus ; « oui » ajoute des prises réseau supplémentaires.' }
        ]
      });
    }

    // --- PLOMBERIE ---
    if (actif(metiersActifs, 'plomberie')) {
      var sec = { code: 'plomberie', titre: '🚰 Plomberie', sdb: [], wc: [], cuisine: [], laveLinge: null };
      filtrer(pieces, PIECES_SDB).forEach(function (p) {
        var eq = [{ v: 'douche_ital', l: 'Douche à l\'italienne' }, { v: 'baignoire', l: 'Baignoire' }];
        if (p.id === 'sde') eq = [{ v: 'douche_ital', l: 'Douche à l\'italienne' }, { v: 'cabine', l: 'Cabine de douche' }];
        sec.sdb.push({
          cle: clePiece(p), nom: p.nom || p.id, id: p.id,
          equipements: eq,
          lavabo: { label: 'Type de lavabo', options: [{ v: 'simple', l: 'Simple vasque' }, { v: 'double', l: 'Double vasque' }] }
        });
      });
      filtrer(pieces, PIECES_WC).forEach(function (p) {
        sec.wc.push({
          cle: clePiece(p), nom: p.nom || p.id, id: p.id,
          type: { label: 'Type de WC', options: [{ v: 'sol', l: 'WC au sol' }, { v: 'suspendu', l: 'WC suspendu' }] },
          laveMains: { label: 'Lave-mains ?', options: oui_non }
        });
      });
      filtrer(pieces, PIECES_CUISINE).forEach(function (p) {
        sec.cuisine.push({
          cle: clePiece(p), nom: p.nom || p.id, id: p.id,
          evier: { label: 'Style d\'évier', options: [{ v: 'simple', l: '1 bac' }, { v: 'double', l: '2 bacs' }] },
          laveVaisselle: { label: 'Arrivée + évacuation lave-vaisselle ?', options: oui_non }
        });
      });
      // Lave-linge : question globale, seulement pièces réellement exploitables.
      var llSupportees = filtrer(pieces, PIECES_LAVE_LINGE_SUPPORTEES).map(function (p) { return { v: clePiece(p), l: p.nom || p.id }; });
      var llFutur = filtrer(pieces, PIECES_LAVE_LINGE_FUTUR).map(function (p) { return { nom: p.nom || p.id }; });
      if (llSupportees.length || llFutur.length) {
        sec.laveLinge = {
          label: 'Dans quelle pièce prévoir l\'arrivée + évacuation du lave-linge ?',
          options: [{ v: 'aucun', l: 'Aucun' }].concat(llSupportees),
          futur: llFutur // pièces présentes mais non modélisées par le moteur (évolution)
        };
      }
      sections.push(sec);
    }

    // --- CHAUFFAGE (chauffage au sol : canonique mais non chiffré) ---
    if (actif(metiersActifs, 'chauffage')) {
      sections.push({
        code: 'chauffage', titre: '🔥 Chauffage',
        questions: [{ id: 'chauffageAuSol', type: 'choix', label: 'Souhaitez-vous un chauffage au sol ?', options: oui_non, note: 'Enregistré dans le descriptif chauffage. Non chiffré à ce stade (chiffrage prévu dans un lot chauffage ultérieur).' }]
      });
    }

    // --- VMC (déplacée depuis le funnel) ---
    if (actif(metiersActifs, 'vmc')) {
      var intentionOptions = estNeuf(chantier)
        ? [{ v: 'creer', l: 'Créer une ventilation' }, { v: 'inconnu', l: 'Je ne sais pas encore' }]
        : [{ v: 'conserver', l: 'Conserver l\'existant' }, { v: 'remplacer', l: 'Remplacer' }, { v: 'creer', l: 'Créer' }, { v: 'inconnu', l: 'Je ne sais pas encore' }];
      sections.push({
        code: 'vmc', titre: '💨 Ventilation (VMC)',
        questions: [
          { id: 'intention', type: 'choix', label: 'Que souhaitez-vous pour la ventilation ?', options: intentionOptions },
          { id: 'solution', type: 'choix', label: 'Type de VMC souhaité', options: [{ v: 'simple_flux', l: 'Simple flux' }, { v: 'hygro', l: 'Simple flux hygroréglable' }, { v: 'double_flux', l: 'Double flux' }, { v: 'inconnue', l: 'Je ne sais pas encore' }] }
        ]
      });
    }

    // --- REVÊTEMENTS DE SOL (sols + carrelage unifiés) ---
    if (actif(metiersActifs, 'sols') || actif(metiersActifs, 'carrelage')) {
      var mats = clone(solMats);
      var recos = {};
      pieces.forEach(function (p) {
        if (PIECES_SDB.indexOf(p.id) !== -1 || p.id === 'wc' || p.id === 'cuisine') recos[clePiece(p)] = 'Pièce humide : carrelage recommandé';
        else if (p.id === 'chambre' || p.id === 'bureau') recos[clePiece(p)] = 'Parquet / stratifié possible';
      });
      sections.push({
        code: 'revetements', titre: '🪵 Revêtements de sol',
        uniforme: { label: 'Même revêtement dans toutes les pièces ?', options: oui_non },
        materiaux: mats,
        pieces: pieces.map(function (p) { return { cle: clePiece(p), nom: p.nom || p.id, id: p.id, reco: recos[clePiece(p)] || null }; })
      });
    }

    // --- FAÏENCE (métier carrelage ; pièces humides + cuisine) ---
    if (actif(metiersActifs, 'carrelage')) {
      var piecesFaience = pieces.filter(function (p) { return PIECES_SDB.indexOf(p.id) !== -1 || p.id === 'cuisine'; });
      if (piecesFaience.length) {
        sections.push({
          code: 'faience', titre: '🧱 Faïence',
          pieces: piecesFaience.map(function (p) { return { cle: clePiece(p), nom: p.nom || p.id, id: p.id, options: clone(faienceModes(p.id)) }; })
        });
      }
    }

    // --- MENUISERIE ---
    if (actif(metiersActifs, 'menuiserie')) {
      sections.push({
        code: 'menuiserie', titre: '🚪 Menuiserie',
        questions: [
          { id: 'volets', type: 'choix', label: 'Voulez-vous des volets roulants ?', options: oui_non },
          { id: 'motoriser', type: 'choix', label: 'Souhaitez-vous les motoriser ?', options: oui_non, dependDe: 'volets' },
          { id: 'fenetres', type: 'choix', label: 'Remplacement des fenêtres ?', options: oui_non }
        ]
      });
    }

    return { version: VERSION, rappel: rappel, sections: sections };
  }

  // ------------------------------------------------------------------
  // projeter(chantier) — vue LECTURE SEULE (transverses référencés + choix).
  // ------------------------------------------------------------------
  function projeter(chantier) {
    var ct = (chantier && chantier.choixTravaux) || choixTravauxVide();
    return {
      version: VERSION,
      domotique: (chantier && chantier.domotique != null) ? chantier.domotique : null,
      irve: (chantier && chantier.borneVE != null) ? chantier.borneVE : null,
      pv: (chantier && chantier.pv != null) ? chantier.pv : null,
      choix: clone(ct)
    };
  }

  var API = {
    VERSION: VERSION,
    RAPPEL_CHANTIER: RAPPEL_CHANTIER,
    PIECES_SDB: PIECES_SDB, PIECES_WC: PIECES_WC, PIECES_CUISINE: PIECES_CUISINE,
    PIECES_LAVE_LINGE_SUPPORTEES: PIECES_LAVE_LINGE_SUPPORTEES,
    choixTravauxVide: choixTravauxVide,
    clePiece: clePiece,
    estNeuf: estNeuf,
    initChoix: initChoix,
    fusionner: fusionner,
    construireQuestionnaire: construireQuestionnaire,
    projeter: projeter
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.ChoixTravauxDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
