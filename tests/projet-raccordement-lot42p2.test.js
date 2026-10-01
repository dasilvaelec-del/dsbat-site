// tests/projet-raccordement-lot42p2.test.js — LOT42 P2.
// Raccordement PASSIF/IDEMPOTENT du socle existant/cible/transformation.
// Le modèle (normaliserPieceSocle) est la source unique ; le configurateur passe seulement
// le contexte (typeProjet). Aucun moteur ne lit piece.projet. LOT39 inchangé.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const M = require(path.join(RACINE, 'js', 'modele-projet.js'));
const HTML = fs.readFileSync(path.join(RACINE, 'devis-configurateur.html'), 'utf8');
const SRCMOD = fs.readFileSync(path.join(RACINE, 'js', 'modele-projet.js'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const mk = (id, cat, extra) => Object.assign({ id: id, nom: id, dims: { l: 3, la: 3, h: 2.5 }, config: {}, categorieSurface: cat }, extra || {});
const norm = (p, tp) => M.normaliserPieceSocle(p, tp === undefined ? undefined : { typeProjet: tp });

// ===== 1. pièce créée avec projet absent -> conteneur posé =====
{
  const p = mk('chambre', 'logement'); norm(p);
  A(p.projet && p.projet.existant && p.projet.cible && ('transformation' in p.projet), '1. conteneur projet complet posé (projet absent au départ)');
  A(p.projet.existant.usage === null && p.projet.cible.usage === null && p.projet.transformation === null, '1b. sans contexte : tout reste null (aucune projection)');
}

// ===== 2. pièce rénovation -> existant renseigné, cible non fabriquée =====
{
  const p = mk('garage', 'annexe'); norm(p, 'renov');
  A(p.projet.existant.usage === 'garage' && p.projet.existant.categorieSurface === 'annexe', '2. rénovation : existant = usage/categorieSurface actuels');
  A(p.projet.cible.usage === null && p.projet.cible.categorieSurface === null, '2b. rénovation : cible NON fabriquée (reste null)');
  A(p.projet.transformation === null, '2c. rénovation : transformation null (jamais déduite)');
}

// ===== 3. pièce neuf -> cible renseignée, existant null =====
{
  const p = mk('salon', 'logement'); norm(p, 'neuf');
  A(p.projet.existant.usage === null && p.projet.existant.categorieSurface === null, '3. neuf : existant reste null (pas d\'existant)');
  A(p.projet.cible.usage === 'sejour' && p.projet.cible.categorieSurface === 'logement', '3b. neuf : cible = usage canonique (salon->sejour) + categorieSurface');
  A(p.projet.transformation === null, '3c. neuf : transformation null (pas de creation)');
}

// ===== 4. projet partiellement renseigné -> complété sans écraser =====
{
  const p = mk('cave', 'annexe', { projet: { existant: { usage: 'cave' }, cible: {}, transformation: null } });
  norm(p, 'renov');
  A(p.projet.existant.usage === 'cave', '4. valeur explicite existant.usage préservée');
  A(p.projet.existant.categorieSurface === 'annexe', '4b. sous-champ manquant existant.categorieSurface complété (renov)');
  A(p.projet.cible.usage === null && p.projet.cible.categorieSurface === null, '4c. cible complétée en forme, non fabriquée (renov)');
}

// ===== 5. projet entièrement renseigné -> inchangé =====
{
  const full = { existant: { usage: 'garage', categorieSurface: 'annexe' }, cible: { usage: 'chambre', categorieSurface: 'logement' }, transformation: 'vers_logement' };
  const p = mk('garage', 'annexe', { projet: JSON.parse(JSON.stringify(full)) });
  norm(p, 'renov');
  A(JSON.stringify(p.projet) === JSON.stringify(full), '5. projet entièrement renseigné : strictement inchangé');
}

// ===== 6. transformation explicite conservée =====
{
  const p = mk('cave', 'annexe', { projet: { existant: { usage: null, categorieSurface: null }, cible: { usage: null, categorieSurface: null }, transformation: 'conserver' } });
  norm(p, 'renov');
  A(p.projet.transformation === 'conserver', '6. transformation explicite conservée');
}

// ===== 7. transformation absente reste null =====
{
  const pN = mk('chambre', 'logement'); norm(pN, 'neuf');
  const pR = mk('chambre', 'logement'); norm(pR, 'renov');
  A(pN.projet.transformation === null && pR.projet.transformation === null, '7. transformation absente -> reste null (neuf & renov)');
}

// ===== 8. usage inconnu reste null =====
{
  const p = mk('zone_inconnue_zzz', 'annexe'); norm(p, 'renov');
  A(p.projet.existant.usage === null, '8. id hors vocabulaire -> usage null (aucune invention)');
  const pv = mk('veranda', null); norm(pv, 'renov'); // veranda categorieSurface indéterminée
  A(pv.projet.existant.usage === 'veranda' && pv.projet.existant.categorieSurface === null, '8b. veranda : usage canonique ok, categorieSurface indéterminée -> null');
}

// ===== 9. categorieSurface LOT39 inchangée =====
{
  const p = mk('cuisine', 'logement'); const avant = p.categorieSurface; norm(p, 'neuf');
  A(p.categorieSurface === avant && p.categorieSurface === 'logement', '9. piece.categorieSurface (LOT39) inchangée');
}

// ===== 10. double passage idempotent =====
{
  const p = mk('garage', 'annexe'); norm(p, 'renov');
  const s1 = JSON.stringify(p.projet); norm(p, 'renov'); const s2 = JSON.stringify(p.projet);
  A(s1 === s2, '10. normaliser(normaliser(piece)) === normaliser(piece)');
}

// ===== 11. restauration d'un ancien état sans piece.projet =====
{
  const restauréLegacy = mk('chambre', 'logement'); delete restauréLegacy.projet;
  norm(restauréLegacy, 'neuf');
  A(restauréLegacy.projet && restauréLegacy.projet.cible.usage === 'chambre', '11. restauration legacy (sans projet) -> conteneur posé + projection');
}

// ===== 12. restauration d'un projet LOT42 existant =====
{
  const p = mk('cave', 'annexe', { projet: { existant: { usage: 'cave', categorieSurface: 'annexe' }, cible: { usage: null, categorieSurface: null }, transformation: null } });
  const refExist = p.projet; norm(p, 'renov');
  A(p.projet === refExist, '12. projet restauré : même référence (non remplacé)');
  A(p.projet.existant.usage === 'cave', '12b. valeurs explicites préservées');
}

// ===== 13. plusieurs pièces simultanément (via _appliquerSocleLot39 réel) =====
{
  const vm = require('vm');
  const start = HTML.indexOf('function _appliquerSocleLot39(');
  const next = HTML.indexOf('\nfunction ', start + 1);
  const src = HTML.slice(start, next === -1 ? undefined : next);
  const sandbox = { ModeleProjetDSBAT: M, chantier: { typeProjet: 'neuf' } };
  vm.createContext(sandbox);
  vm.runInContext(src + '\nthis.__ap = _appliquerSocleLot39;', sandbox);
  const lot = [mk('salon', 'logement'), mk('garage', 'annexe'), mk('terrasse', 'exterieur'), mk('chambre', 'logement')];
  sandbox.__ap(lot);
  A(lot.every(p => p.projet && p.projet.cible), '13. plusieurs pièces reçoivent le socle via _appliquerSocleLot39');
  A(lot[0].projet.cible.usage === 'sejour' && lot[3].projet.cible.usage === 'chambre', '13b. neuf : cible.usage projeté par pièce');
}

// ===== 14. garage/cave/terrasse/chambre : LOT39 inchangé =====
{
  [['garage', 'annexe'], ['cave', 'annexe'], ['terrasse', 'exterieur'], ['chambre', 'logement']].forEach(([id, cat]) => {
    const p = mk(id, cat); const dimsAvant = JSON.stringify(p.dims), cfgAvant = JSON.stringify(p.config);
    norm(p, 'neuf');
    A(p.categorieSurface === cat && JSON.stringify(p.dims) === dimsAvant && JSON.stringify(p.config) === cfgAvant && !('surface' in p),
      '14. ' + id + ' : id/categorieSurface/dims/config inchangés, pas de piece.surface');
  });
}

// ===== 15. aucun moteur ne lit piece.projet =====
{
  const moteurs = ['electricite', 'plomberie', 'peinture', 'sols', 'carrelage', 'isolation', 'menuiserie', 'vmc', 'chauffage'];
  let lit = [];
  // code hors commentaires uniquement (les commentaires peuvent mentionner piece.projet)
  const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  moteurs.forEach(m => {
    const f = path.join(RACINE, 'js', 'moteurs', m + '.js');
    if (fs.existsSync(f) && /\.projet\b/.test(codeOnly(fs.readFileSync(f, 'utf8')))) lit.push(m);
  });
  // moteur-piece / moteur-revetements / applicabilite / coherence : ne doivent pas lire piece.projet
  ['moteur-piece.js', 'moteur-revetements.js', 'applicabilite-metiers.js', 'coherence.js'].forEach(f => {
    const fp = path.join(RACINE, 'js', f);
    if (fs.existsSync(fp) && /\.projet\b/.test(codeOnly(fs.readFileSync(fp, 'utf8')))) lit.push(f);
  });
  A(lit.length === 0, '15. aucun moteur/applicabilité/surface ne lit piece.projet (' + (lit.join(',') || 'aucun') + ')');
}

console.log('projet-raccordement-lot42p2 : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
