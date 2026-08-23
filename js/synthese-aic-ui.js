// =====================================================================
// js/synthese-aic-ui.js — Restitution écran de l'objet AIC (AIC-001 / M9-A)
// =====================================================================
// RÔLE : rendre en HTML (chaîne) l'objet AIC produit par construireAIC() (M8).
//   6 sections dans l'ordre : Votre projet · Ce que nous avons compris ·
//   Ce que vous avez confirmé · Configuration retenue · Prestations retenues ·
//   À vérifier en visite (4 catégories M8, visuellement distinctes).
//
// GARANTIES (impératives) :
//   • PUR : aucune manipulation du DOM, aucun sessionStorage, aucun Runtime.
//   • NE reconstruit PAS l'AIC : reçoit l'objet de M8 et le restitue tel quel.
//   • NE mute PAS l'objet fourni. Ne calcule AUCUN prix, n'ajoute AUCUN montant.
//   • Ne fabrique aucune donnée : ce qui n'est pas dans l'AIC n'est pas affiché.
//   • Échappement HTML systématique de tout texte issu de l'AIC (accents,
//     apostrophes, balises, guillemets, retours ligne).
//   • Un « € » éventuellement présent dans un texte source (ex. alerte) est
//     restitué comme texte ; M9 n'en produit jamais un nouveau.
//
// ENTRÉE : aic = objet renvoyé par SyntheseAICDSBAT.construireAIC(...).
//   options : { } (réservé ; aucune option requise).
// SORTIE : chaîne HTML (jamais de DOM).
// =====================================================================

(function (global) {
  'use strict';

  var VERSION = '0.1.0';

  var ACTION_LABELS = {
    remplacement: 'Remplacer', depose: 'Déposer / enlever', suppression: 'Supprimer',
    demolition: 'Démolir', installation: 'Installer / poser', renovation: 'Rénover / refaire',
    deplacement: 'Déplacer', conservation: 'Conserver', modification: 'Modifier'
  };
  var METIER_LABELS = {
    electricite: 'Électricité', plomberie: 'Plomberie', vmc: 'VMC', isolation: 'Isolation',
    menuiserie: 'Menuiserie', carrelage: 'Carrelage', peinture: 'Peinture', sols: 'Sols'
  };
  var ROLE_LABELS = { pose: 'Pose', depose: 'Dépose' };
  // Champs « chantier » restitués (whitelist : rien d'inventé, uniquement si présent)
  var CHANTIER_LABELS = {
    typeBien: 'Type de bien', typeProjet: 'Type de projet', surface: 'Surface',
    etatLieux: 'État des lieux', qualiteMateriaux: 'Qualité des matériaux',
    tableauExistant: 'Tableau électrique', chauffage: 'Chauffage',
    eauChaude: 'Eau chaude sanitaire', vmc: 'VMC'
  };
  var CHANTIER_ORDRE = ['typeBien', 'typeProjet', 'surface', 'etatLieux', 'qualiteMateriaux', 'tableauExistant', 'chauffage', 'eauChaude', 'vmc'];
  // Catégories « à vérifier en visite » — libellés + ordre stables (les 4 M8)
  var CAT_LABELS = {
    depose_non_couverte: 'Dépose non couverte',
    info_technique_inconnue: 'Information technique à préciser',
    dimension_manquante: 'Dimension manquante',
    ecart_coherence: 'Écart de cohérence'
  };
  var CAT_ORDRE = ['depose_non_couverte', 'info_technique_inconnue', 'dimension_manquante', 'ecart_coherence'];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      .replace(/\r\n|\r|\n/g, '<br>');
  }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function metierLbl(m) { return m ? (METIER_LABELS[m] || esc(m)) : '—'; }
  function roleLbl(r) { return r ? (ROLE_LABELS[r] || esc(r)) : '—'; }

  // ---- styles inline (réutilisent les variables CSS existantes, avec repli
  //      pour un aperçu hors application). Layout sûr : pas de débordement. ----
  var S_WRAP = 'max-width:820px;margin:0 auto 20px;color:var(--text,#0f172a);line-height:1.55;box-sizing:border-box;';
  var S_TITRE = 'margin:0 0 14px;color:var(--accent,#16a34a);font-size:1.3rem;font-weight:800;';
  var S_CARD = 'background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:14px;padding:16px 18px;margin:0 0 14px;box-shadow:0 2px 10px rgba(0,0,0,0.04);box-sizing:border-box;overflow-wrap:anywhere;word-break:break-word;';
  var S_H = 'margin:0 0 10px;font-size:1.02rem;font-weight:700;color:var(--text,#0f172a);display:flex;align-items:center;gap:8px;';
  var S_LI = 'padding:7px 0;border-top:1px solid var(--border,#e2e8f0);';
  var S_MUTE = 'color:var(--text-light,#334155);';
  var S_TAG = 'display:inline-block;font-size:.72rem;font-weight:700;padding:1px 8px;border-radius:999px;border:1px solid var(--border,#e2e8f0);color:var(--text-light,#334155);margin-left:6px;';
  var S_AVCARD = 'background:var(--surface-2,#f8fafc);border:1px solid var(--border,#e2e8f0);border-left:4px solid var(--accent,#16a34a);border-radius:10px;padding:12px 14px;margin:0 0 10px;box-sizing:border-box;overflow-wrap:anywhere;';
  var S_ACTION_TAG = 'display:inline-block;font-size:.72rem;font-weight:700;padding:2px 9px;border-radius:999px;background:var(--surface-2,#f8fafc);border:1px solid var(--border,#e2e8f0);color:var(--text-light,#334155);';
  var S_BADGE_OK = 'display:inline-block;font-size:.74rem;font-weight:700;padding:2px 9px;border-radius:999px;background:rgba(22,163,74,.12);border:1px solid var(--accent,#16a34a);color:var(--accent,#16a34a);';
  var S_WARN = 'display:inline-block;font-size:.74rem;font-weight:700;padding:2px 9px;border-radius:999px;background:#fff7ed;border:1px solid #f59e0b;color:#b45309;';
  var S_META = 'font-size:.82rem;color:var(--text-light,#334155);margin-top:3px;';
  var STATUT_BADGE = { confirme: '✓ Confirmé', incertain: '≈ À préciser', a_confirmer: '⏳ À confirmer' };

  function statutBadge(s) {
    if (!s) return '';
    if (s === 'confirme') return '<span style="' + S_BADGE_OK + '">' + STATUT_BADGE.confirme + '</span>';
    var lbl = STATUT_BADGE[s] || esc(s);
    return '<span style="' + S_TAG + 'margin-left:0;">' + lbl + '</span>';
  }

  function card(titreHtml, corpsHtml) {
    return '<section style="' + S_CARD + '"><h3 style="' + S_H + '">' + titreHtml + '</h3>' + corpsHtml + '</section>';
  }

  // ---------- 1. VOTRE PROJET ----------
  function sectionProjet(aic) {
    var declare = aic.declare || {};
    var ch = declare.chantier || {};
    var parts = [];
    var desc = declare.description;
    if (desc != null && String(desc).length) {
      parts.push('<div style="' + S_LI + 'border-top:none;padding-top:0;"><div style="' + S_MUTE + 'font-size:.85rem;margin-bottom:2px;">Description</div><div>' + esc(desc) + '</div></div>');
    }
    var infos = [];
    CHANTIER_ORDRE.forEach(function (k) {
      var v = ch[k];
      if (v == null || v === '' || (typeof v === 'object')) return;
      infos.push('<div style="' + S_LI + '"><span style="' + S_MUTE + '">' + esc(CHANTIER_LABELS[k]) + ' : </span>' + esc(v) + '</div>');
    });
    if (infos.length) parts.push(infos.join(''));
    if (!parts.length) return '';
    return card('🏠 Votre projet', parts.join(''));
  }

  // ---------- 2. CE QUE NOUS AVONS COMPRIS ----------
  function sectionCompris(aic) {
    var it = aic.interprete || {};
    var els = arr(it.elements), qs = arr(it.questions);
    if (!els.length && !qs.length) return '';
    var corps = '';
    if (els.length) {
      corps += els.map(function (e) {
        var verbe = e.action ? (ACTION_LABELS[e.action] || '') : '';
        var actionTag = verbe ? '<span style="' + S_ACTION_TAG + '">' + esc(verbe) + '</span>' : '';
        var incert = (e.statut && e.statut !== 'confirme') ? ' ' + statutBadge(e.statut) : '';
        var meta = [];
        if (e.pieceId) meta.push('Pièce : ' + esc(e.pieceId));
        if (e.metier) meta.push('Métier : ' + metierLbl(e.metier));
        return '<div style="' + S_LI + '">'
          + (actionTag ? '<div style="margin-bottom:5px;">' + actionTag + incert + '</div>' : (incert ? '<div style="margin-bottom:5px;">' + incert + '</div>' : ''))
          + '<div style="font-weight:600;">' + esc(e.element || '') + '</div>'
          + (meta.length ? '<div style="' + S_META + '">' + meta.join(' · ') + '</div>' : '')
          + '</div>';
      }).join('');
    }
    if (qs.length) {
      corps += '<div style="' + S_LI + S_MUTE + 'font-weight:600;">Questions à clarifier</div>';
      corps += qs.map(function (q) {
        return '<div style="' + S_LI + '">❓ ' + esc(q.texte || '') + '</div>';
      }).join('');
    }
    return card('💡 Ce que nous avons compris', corps);
  }

  // ---------- 3. CE QUE VOUS AVEZ CONFIRMÉ ----------
  function sectionConfirme(aic) {
    var decisions = arr((aic.confirme || {}).decisions);
    if (!decisions.length) return '';
    var corps = decisions.map(function (d) {
      var val = (d.valeurConfirmee != null && String(d.valeurConfirmee).length)
        ? '<div style="font-weight:600;">' + esc(d.valeurConfirmee) + '</div>'
        : '<div style="' + S_MUTE + '">Décision enregistrée</div>';
      var badge = statutBadge(d.statut);
      return '<div style="' + S_LI + '">' + val + (badge ? '<div style="margin-top:5px;">' + badge + '</div>' : '') + '</div>';
    }).join('');
    return card('✅ Ce que vous avez confirmé', corps);
  }

  // ---------- 4. CONFIGURATION RETENUE ----------
  function sectionConfigure(aic) {
    var cfg = aic.configure || {};
    var pieces = arr(cfg.pieces), metiers = arr(cfg.metiers), modifs = arr(cfg.modifications);
    if (!pieces.length && !metiers.length && !modifs.length) return '';
    var corps = '';
    if (pieces.length) {
      corps += pieces.map(function (p) {
        var d = p.dims || {};
        // Afficher UNIQUEMENT les cotes réellement présentes (jamais de valeur inventée)
        var cotes = [];
        if (d.l) cotes.push('L ' + esc(d.l) + ' m');
        if (d.la) cotes.push('l ' + esc(d.la) + ' m');
        if (d.h != null && d.h !== '') cotes.push('H ' + esc(d.h) + ' m');
        // Repérer les cotes de base manquantes (longueur / largeur) — sans les fabriquer
        var manquantes = [];
        if (!d.l) manquantes.push('longueur');
        if (!d.la) manquantes.push('largeur');
        var mc = arr(p.metiersConfigures).map(metierLbl).join(', ');
        var nom = p.nom || p.type || p.ref || '—';
        return '<div style="' + S_LI + '">'
          + '<div><strong>' + esc(nom) + '</strong>'
          + (manquantes.length ? ' <span style="' + S_WARN + '">⚠ Dimensions incomplètes</span>' : '')
          + '</div>'
          + (cotes.length ? '<div style="' + S_META + '">' + cotes.join(' · ') + '</div>' : '')
          + (manquantes.length ? '<div style="' + S_META + '">À compléter : ' + manquantes.join(', ') + '</div>' : '')
          + (mc ? '<div style="' + S_META + '">Métiers : ' + mc + '</div>' : '')
          + '</div>';
      }).join('');
    }
    if (metiers.length) {
      corps += '<div style="' + S_LI + '"><span style="' + S_MUTE + '">Métiers actifs : </span>' + metiers.map(metierLbl).join(', ') + '</div>';
    }
    if (modifs.length) {
      corps += '<div style="' + S_LI + S_MUTE + 'font-weight:600;">Modifications appliquées</div>';
      corps += modifs.map(function (m) {
        var cible = m.cible ? (' — ' + esc(m.cible)) : '';
        var av = (m.avant != null ? esc(m.avant) : null), ap = (m.apres != null ? esc(m.apres) : null);
        var delta = (av != null || ap != null) ? ' <span style="' + S_MUTE + 'font-size:.85rem;">(' + (av != null ? av : '?') + ' → ' + (ap != null ? ap : '?') + ')</span>' : '';
        return '<div style="' + S_LI + '">' + esc(m.type || 'modification') + cible + delta + '</div>';
      }).join('');
    }
    return card('🧩 Configuration retenue', corps);
  }

  // ---------- 5. PRESTATIONS RETENUES ----------
  function sectionPrestations(aic) {
    var retenues = arr((aic.prestations || {}).retenues);
    if (!retenues.length) return '';
    var lignes = retenues.map(function (p) {
      var nom = (p.label != null && String(p.label).length) ? esc(p.label) : esc(p.code || '—');
      var qte = (p.quantite != null && p.quantite !== '') ? esc(p.quantite) : '—';
      return '<tr>'
        + '<td style="padding:6px 8px;border-top:1px solid var(--border,#e2e8f0);">' + esc(p.pieceRef || '—') + '</td>'
        + '<td style="padding:6px 8px;border-top:1px solid var(--border,#e2e8f0);">' + metierLbl(p.metier) + '</td>'
        + '<td style="padding:6px 8px;border-top:1px solid var(--border,#e2e8f0);">' + nom + '</td>'
        + '<td style="padding:6px 8px;border-top:1px solid var(--border,#e2e8f0);text-align:right;">' + qte + '</td>'
        + '<td style="padding:6px 8px;border-top:1px solid var(--border,#e2e8f0);">' + roleLbl(p.role) + '</td>'
        + '</tr>';
    }).join('');
    var head = '<thead><tr style="' + S_MUTE + 'font-size:.8rem;text-align:left;">'
      + '<th style="padding:4px 8px;">Pièce</th><th style="padding:4px 8px;">Métier</th><th style="padding:4px 8px;">Prestation</th><th style="padding:4px 8px;text-align:right;">Qté</th><th style="padding:4px 8px;">Rôle</th>'
      + '</tr></thead>';
    var corps = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:.92rem;">' + head + '<tbody>' + lignes + '</tbody></table></div>';
    return card('🛠️ Prestations retenues', corps);
  }

  // ---------- 6. À VÉRIFIER EN VISITE (4 catégories M8, distinctes) ----------
  function sectionAVerifier(aic) {
    var items = arr(aic.aVerifierVisite);
    if (!items.length) return '';
    var groupes = {};
    items.forEach(function (x) {
      var c = x && x.categorie; if (!c) return;
      (groupes[c] = groupes[c] || []).push(x);
    });
    var blocs = [];
    CAT_ORDRE.forEach(function (c) {
      var liste = groupes[c]; if (!liste || !liste.length) return;
      var cartes = liste.map(function (x) {
        var lignes = [];
        lignes.push('<div><strong>' + esc(x.element || '—') + '</strong></div>');
        if (x.pourquoi) lignes.push('<div style="' + S_MUTE + 'font-size:.88rem;margin-top:2px;">' + esc(x.pourquoi) + '</div>');
        var meta = [];
        if (x.pieceRef) meta.push(esc(x.pieceRef));
        if (x.metier) meta.push(metierLbl(x.metier));
        if (x.source) meta.push('source : ' + esc(x.source));
        if (meta.length) lignes.push('<div style="' + S_MUTE + 'font-size:.82rem;margin-top:3px;">' + meta.join(' · ') + '</div>');
        if (x.impactDevis) lignes.push('<div style="' + S_MUTE + 'font-size:.82rem;font-style:italic;margin-top:3px;">Impact : ' + esc(x.impactDevis) + '</div>');
        return '<div style="' + S_AVCARD + '">' + lignes.join('') + '</div>';
      }).join('');
      blocs.push('<div style="margin:0 0 4px;"><div style="font-weight:700;margin:6px 0 8px;">🔎 ' + esc(CAT_LABELS[c] || c) + '</div>' + cartes + '</div>');
    });
    if (!blocs.length) return '';
    var intro = '<p style="' + S_MUTE + 'font-size:.9rem;margin:0 0 12px;">Ces points ne sont pas des prestations chiffrées : ils seront relevés et précisés lors de la visite technique.</p>';
    return card('📋 À vérifier en visite', intro + blocs.join(''));
  }

  // ---------- Assemblage ----------
  function rendre(aic, options) {
    aic = aic || {};
    var sections = [
      sectionProjet(aic),
      sectionCompris(aic),
      sectionConfirme(aic),
      sectionConfigure(aic),
      sectionPrestations(aic),
      sectionAVerifier(aic)
    ].filter(function (s) { return s; });

    var titre = '<h2 style="' + S_TITRE + '">Synthèse de votre projet</h2>';
    var corps = sections.length
      ? sections.join('')
      : '<section style="' + S_CARD + '"><p style="' + S_MUTE + 'margin:0;">Votre synthèse apparaîtra ici au fur et à mesure de votre configuration.</p></section>';
    return '<div class="aic-synthese" style="' + S_WRAP + '">' + titre + corps + '</div>';
  }

  var API = { VERSION: VERSION, rendre: rendre, echapperHtml: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (global) global.SyntheseAICUIDSBAT = API;

})(typeof globalThis !== 'undefined' ? globalThis : this);
