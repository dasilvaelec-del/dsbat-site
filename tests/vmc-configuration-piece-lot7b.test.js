// =====================================================================
// tests/vmc-configuration-piece-lot7b.test.js — M57 LOT7-B
// =====================================================================
// Configuration VMC PAR PIÈCE sous contraintes. La SOURCE DE VÉRITÉ des statuts
// reste obligationsVmc() (LOT7-A). Le configurateur ne stocke que le CHOIX CLIENT
// dans piece.ventilationFonctions (HORS piece.config → hors money-path).
// On teste la fonction PURE fonctionsVmcRetenues(obligations, choix) — même source
// que l'affichage ET la validation — combinée au vrai obligationsVmc().
// =====================================================================
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..');
const VMC = require(path.join(RACINE, 'js', 'moteurs', 'vmc.js'));
const CONFIG = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// Extraction d'une fonction pure du configurateur (brace-matching + new Function)
function extraire(sig) {
  const s = CONFIG.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = CONFIG.indexOf('{', s), d = 0, e = -1;
  for (; i < CONFIG.length; i++) { if (CONFIG[i] === '{') d++; else if (CONFIG[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return CONFIG.slice(s, e);
}
const fonctionsVmcRetenues = new Function(extraire('function fonctionsVmcRetenues(') + '\n;return fonctionsVmcRetenues;')();

// Contexte applicable (reprise + périmètre déterminé + en scope)
const CTX = { intention: 'creer', perimetre: 'complet', pieceEnScope: true };
const obl = (pieceId, extra) => VMC.obligationsVmc(pieceId, Object.assign({}, CTX, extra || {}));

// ---- 1. Pièce de service : SORTIE_AIR obligatoire → extraction présente/verrou --
{
  const e = fonctionsVmcRetenues(obl('sdb'), {});
  A(e.extraction && e.extraction.present === true && e.extraction.verrou === true, 'sdb : extraction présente + verrou (obligatoire)');
  // contournement impossible : un choix client false ne retire pas une obligation
  const e2 = fonctionsVmcRetenues(obl('sdb'), { extraction: false });
  A(e2.extraction.present === true && e2.extraction.verrou === true, 'sdb : choix client false NE contourne PAS l\'obligation (réimposée)');
}

// ---- 2. Pièce principale SF : ADMISSION_AIR obligatoire → non supprimable -------
{
  const e = fonctionsVmcRetenues(obl('chambre'), { entree_air: false });
  A(e.entree_air && e.entree_air.present === true && e.entree_air.verrou === true, 'chambre SF : entree_air obligatoire non supprimable');
  A(!e.insufflation, 'chambre SF : pas d\'insufflation');
}

// ---- 3. Double flux : INSUFFLATION obligatoire → non supprimable ----------------
{
  const e = fonctionsVmcRetenues(obl('chambre', { solution: 'double_flux' }), { insufflation: false });
  A(e.insufflation && e.insufflation.present === true && e.insufflation.verrou === true, 'chambre DF : insufflation obligatoire non supprimable');
  A(!e.entree_air, 'chambre DF : pas d\'admission (air par insufflation)');
}

// ---- 4/5/6. Recommandé supprimable / a_verifier non imposé / libre -------------
// (statuts simulés en entrée pour couvrir les 4 branches de la fonction pure)
{
  const reco = fonctionsVmcRetenues({ SORTIE_AIR: { statut: 'recommande' } }, {});
  A(reco.extraction.present === true && reco.extraction.verrou === false, 'recommande : proposé par défaut, pas de verrou');
  A(fonctionsVmcRetenues({ SORTIE_AIR: { statut: 'recommande' } }, { extraction: false }).extraction.present === false, 'recommande : retirable (choix false respecté)');
  A(fonctionsVmcRetenues({ ADMISSION_AIR: { statut: 'a_verifier' } }, {}).entree_air.present === false, 'a_verifier : jamais imposé (present=false)');
  A(fonctionsVmcRetenues({ ADMISSION_AIR: { statut: 'a_verifier' } }, { entree_air: true }).entree_air.present === false, 'a_verifier : ne se coche pas même avec un ancien choix');
  A(fonctionsVmcRetenues({ INSUFFLATION: { statut: 'libre' } }, {}).insufflation.present === false, 'libre : décoché par défaut');
  A(fonctionsVmcRetenues({ INSUFFLATION: { statut: 'libre' } }, { insufflation: true }).insufflation.present === true, 'libre : choix client respecté');
}

// ---- 7. Hors scope → aucune obligation imposée ---------------------------------
{
  const e = fonctionsVmcRetenues(obl('sdb', { pieceEnScope: false }), {});
  A(e.extraction.present === false && e.extraction.statut === 'a_verifier', 'hors scope → a_verifier, pas d\'obligation');
}
// ---- 8/9/10. conserver / inconnu / périmètre insuffisant → pas de durcissement --
A(fonctionsVmcRetenues(obl('sdb', { intention: 'conserver' }), {}).extraction.statut === 'a_verifier', 'conserver → a_verifier');
A(fonctionsVmcRetenues(obl('sdb', { intention: 'inconnu' }), {}).extraction.statut === 'a_verifier', 'inconnu → a_verifier');
A(fonctionsVmcRetenues(obl('sdb', { perimetre: 'indecis' }), {}).extraction.statut === 'a_verifier', 'périmètre indécis → a_verifier');

// ---- 11. Changement de solution → obligations recalculées ----------------------
{
  const sf = fonctionsVmcRetenues(obl('chambre'), {});
  const df = fonctionsVmcRetenues(obl('chambre', { solution: 'double_flux' }), {});
  A(sf.entree_air && !sf.insufflation && df.insufflation && !df.entree_air, 'changement SF→DF : ADMISSION_AIR → INSUFFLATION (recalcul)');
}

// ---- 12. Ancienne valeur client ne contourne jamais une nouvelle obligation -----
{
  // un choix libre stocké (false) devient sans effet si la fonction devient obligatoire
  const e = fonctionsVmcRetenues(obl('sdb'), { extraction: false });
  A(e.extraction.present === true, 'ancien choix false + obligation → present forcé (verrou)');
}

// ---- Statique : money-path intact + source unique ------------------------------
// Bloc LOT7-B = les 4 fonctions ajoutées (extraites précisément, pas un slice global).
const BLOC = ['function _contexteVmc(', 'function fonctionsVmcRetenues(', 'function fonctionsVmcHtml(', 'function toggleFonctionVmc(']
  .map(extraire).join('\n');
A(!/piece\.config|config\.vmc|VMC_BOUCHE|VMC_ENTREE_AIR/.test(BLOC), 'code LOT7-B n\'écrit pas dans piece.config / codes tarifaires');
A(!/getMoyenPrixFor|dimensionnementVMC|prixTotal|recalcPiece\(/.test(BLOC), 'code LOT7-B ne calcule aucun prix / ne déclenche pas recalcPiece');
A(/piece\.ventilationFonctions/.test(BLOC), 'stockage dans piece.ventilationFonctions (hors config)');
A(!/ventilationDeclaree/.test(CONFIG), 'chantier.ventilationDeclaree reste inerte (non alimenté par LOT7-B)');
A(/function toggleFonctionVmc[\s\S]{0,600}obligationsVmc\(/.test(CONFIG), 'toggle re-dérive via obligationsVmc (source unique)');
A(/function fonctionsVmcHtml[\s\S]{0,400}obligationsVmc\(/.test(CONFIG), 'affichage dérive via obligationsVmc (source unique)');
A(/function toggleFonctionVmc[\s\S]{0,900}saveEtat\(\)/.test(CONFIG), 'toggle persiste via saveEtat()');
// Le calcul (moteur-devis) n'utilise pas ventilationFonctions
const MOTEUR = fs.readFileSync(path.join(RACINE, 'js', 'moteur-devis.js'), 'utf8');
const PIECE = fs.readFileSync(path.join(RACINE, 'js', 'moteur-piece.js'), 'utf8');
A(!/ventilationFonctions/.test(MOTEUR), 'moteur-devis n\'utilise PAS ventilationFonctions');
A(!/ventilationFonctions/.test(PIECE), 'moteur-piece (calculerPiece) n\'utilise PAS ventilationFonctions');

const total = ok + ko;
if (ko === 0) console.log('✅ Configuration VMC par pièce (M57 LOT7-B) : ' + ok + '/' + total + ' — obligations réimposées, hors money-path, source unique obligationsVmc');
else { console.error('❌ Configuration VMC par pièce LOT7-B : ' + ok + '/' + total); process.exit(1); }
