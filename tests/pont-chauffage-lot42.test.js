// tests/pont-chauffage-lot42.test.js — Pont piece.chauffageFonctions -> params.piecesChauffees.
// Vérifie les helpers purs (chauffage.js) + le câblage fail-closed de moteur-devis.js.
// prix.js NON modifié ; chantier.chauffage NON écrit ; piece.chauffageFonctions NON muté.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const CH = require(path.join(RACINE, 'js', 'moteurs', 'chauffage.js'));
const DEVIS_SRC = fs.readFileSync(path.join(RACINE, 'js', 'moteur-devis.js'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

// fabrique de pièce avec chauffageFonctions
const mkF = (over) => ({ existant: { present: null, type: null, energie: null, etat: null },
  intention: { action: null, objectif: null }, solution: { technologie: null, systeme: null, statut: null } , ...(over || {}) });
const piece = (id, dims, f) => ({ id: id, nom: id, dims: dims || { l: 4, la: 3, h: 2.5 }, config: {}, chauffageFonctions: f || null });
// reproduit EXACTEMENT la décision de moteur-devis.js
const paramsDe = (pieces) => (CH.chauffageFonctionsUtilise(pieces)
  ? { piecesChauffees: CH.piecesChauffeesDepuisFonctions(pieces) }
  : undefined);

// ===== Legacy : aucune chauffageFonctions -> undefined (liste Runtime par défaut) =====
{
  const pieces = [piece('salon', { l: 5, la: 4 }, null), piece('chambre', { l: 3, la: 3 }, null)];
  A(CH.chauffageFonctionsUtilise(pieces) === false, 'legacy : chauffageFonctions non utilisé');
  A(paramsDe(pieces) === undefined, 'legacy : paramsChauffage = undefined (Golden Master inchangé)');
}

// ===== chauffageFonctionsUtilise : action seule OU technologie seule =====
A(CH.chauffageFonctionsUtilise([piece('salon', null, mkF({ intention: { action: 'installer', objectif: null } }))]) === true, 'utilisé si intention.action renseigné');
A(CH.chauffageFonctionsUtilise([piece('salon', null, mkF({ solution: { technologie: 'radiateur_electrique', systeme: null, statut: null } }))]) === true, 'utilisé si solution.technologie renseigné');
A(CH.chauffageFonctionsUtilise([piece('salon', null, mkF())]) === false, 'non utilisé si chauffageFonctions vierge');

// ===== Pièce qualifiée : radiateur électrique + installer + dims -> id projeté =====
{
  const f = mkF({ solution: { technologie: 'radiateur_electrique', systeme: null, statut: 'a_etudier' }, intention: { action: 'installer', objectif: null } });
  const pieces = [piece('chambre', { l: 4, la: 3 }, f)];
  A(CH.chauffageFonctionsUtilise(pieces) === true, 'qualifiée : utilisé');
  A(JSON.stringify(CH.piecesChauffeesDepuisFonctions(pieces)) === JSON.stringify(['chambre']), 'qualifiée : id projeté');
  A(JSON.stringify(paramsDe(pieces)) === JSON.stringify({ piecesChauffees: ['chambre'] }), 'qualifiée : params = {piecesChauffees:["chambre"]}');
}
// action 'remplacer' et 'ajouter' qualifient aussi
['remplacer', 'ajouter'].forEach(act => {
  const f = mkF({ solution: { technologie: 'radiateur_electrique', systeme: null, statut: null }, intention: { action: act, objectif: null } });
  A(CH.piecesChauffeesDepuisFonctions([piece('salon', { l: 5, la: 4 }, f)]).length === 1, 'action ' + act + ' : qualifiée');
});

// ===== Utilisé mais aucune pièce qualifiée -> {piecesChauffees: []} (fail-closed, PAS undefined) =====
{
  const f = mkF({ solution: { technologie: 'pompe_a_chaleur', systeme: null, statut: null }, intention: { action: 'installer', objectif: null } });
  const pieces = [piece('salon', { l: 5, la: 4 }, f)];
  A(CH.chauffageFonctionsUtilise(pieces) === true, 'PAC : utilisé');
  A(CH.piecesChauffeesDepuisFonctions(pieces).length === 0, 'PAC : non qualifiée (pas radiateur_electrique)');
  const pr = paramsDe(pieces);
  A(pr && Array.isArray(pr.piecesChauffees) && pr.piecesChauffees.length === 0, 'fail-closed : params = {piecesChauffees: []} (jamais undefined)');
}

// ===== Exclusions ciblées =====
const Q = (f, dims) => CH.piecesChauffeesDepuisFonctions([piece('salon', dims || { l: 5, la: 4 }, f)]).length;
A(Q(mkF({ solution: { technologie: 'radiateur_electrique', systeme: null, statut: null }, intention: { action: 'conserver', objectif: null } })) === 0, "action 'conserver' -> exclue");
A(Q(mkF({ solution: { technologie: 'radiateur_electrique', systeme: null, statut: 'devis_existant' }, intention: { action: 'installer', objectif: null } })) === 0, "statut 'devis_existant' -> exclue");
A(Q(mkF({ solution: { technologie: 'radiateur_electrique', systeme: null, statut: null }, intention: { action: 'installer', objectif: null } }), { l: 0, la: 4 }) === 0, 'dims l=0 -> exclue');
A(Q(mkF({ solution: { technologie: 'radiateur_electrique', systeme: null, statut: null }, intention: { action: 'installer', objectif: null } }), { la: 4 }) === 0, 'dims l absente -> exclue');
A(Q(mkF({ solution: { technologie: 'radiateur_electrique', systeme: null, statut: null }, intention: { action: 'installer', objectif: null } }), { l: 4 }) === 0, 'dims la absente -> exclue');

// ===== Pureté : aucun helper ne mute la pièce =====
{
  const f = mkF({ solution: { technologie: 'radiateur_electrique', systeme: null, statut: null }, intention: { action: 'installer', objectif: null } });
  const p = piece('chambre', { l: 4, la: 3 }, f);
  const avant = JSON.stringify(p);
  CH.chauffageFonctionsUtilise([p]); CH.piecesChauffeesDepuisFonctions([p]);
  A(JSON.stringify(p) === avant, 'pureté : piece/chauffageFonctions non mutés');
}

// ===== Câblage moteur-devis.js (statique) =====
A(/if \(chantier\.chauffage === 'electrique' && typeof dimensionnementChauffage === 'function'\)/.test(DEVIS_SRC), 'gate chantier.chauffage === electrique conservé');
A(/dimensionnementChauffage\(piecesSelectionnees, chantier, paramsChauffage\)/.test(DEVIS_SRC), 'appel : 3e argument paramsChauffage passé');
A(/chauffageFonctionsUtilise\(piecesSelectionnees\)/.test(DEVIS_SRC)
  && /\{ piecesChauffees: piecesChauffeesDepuisFonctions\(piecesSelectionnees\) \}/.test(DEVIS_SRC)
  && /:\s*undefined;/.test(DEVIS_SRC),
  'construction paramsChauffage conforme (gate utilisé -> {piecesChauffees:[...]} sinon undefined)');
A(!/chantier\.chauffage\s*=[^=]/.test(DEVIS_SRC), 'moteur-devis n\'écrit jamais chantier.chauffage');

console.log('pont-chauffage-lot42 : ' + ok + ' OK, ' + ko + ' KO');
process.exit(ko ? 1 : 0);
