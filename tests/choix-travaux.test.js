// =====================================================================
// tests/choix-travaux.test.js — Questionnaire de CHOIX DE TRAVAUX (moteur pur)
// =====================================================================
// Vérifie le CONTRAT de js/choix-travaux.js (module non branché) :
//   (A) squelette v1 ; (B) dynamique métiers actifs + pièces réelles ;
//   (C) VMC exclue ; (D) adaptateurs (carrelageFaience->carrelage, placo->isolation) ;
//   (E) SOURCE UNIQUE (domotique/irve/pv référencés ; chauffageAuSol/volets transverses ;
//       douche italienne = plomberie ; acoustique = isolation) ; (F) fusion non destructive ;
//       (G) projection lecture seule sans calcul ; (H) garde-fou verifierSourceUnique.
// =====================================================================
const path = require('path');
const CT = require(path.join(__dirname, '..', 'js', 'choix-travaux.js'));

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };

const PIECES = [
  { id: 'salon', numero: 1, nom: 'Salon' },
  { id: 'chambre', numero: 1, nom: 'Chambre 1' },
  { id: 'chambre', numero: 2, nom: 'Chambre 2' },
  { id: 'cuisine', numero: 1, nom: 'Cuisine' },
  { id: 'sdb', numero: 1, nom: 'Salle de bain' },
  { id: 'wc', numero: 1, nom: 'WC' }
];
const METIERS = ['electricite', 'plomberie', 'chauffage', 'carrelage', 'sols', 'peinture', 'menuiserie', 'isolation', 'vmc'];

// ---------- (A) squelette v1 ----------
const vide = CT.choixTravauxVide();
A(vide.version === 1, 'A1 version = 1');
A(vide.transverse && Object.prototype.hasOwnProperty.call(vide.transverse, 'chauffageAuSol'), 'A2 transverse.chauffageAuSol présent');
A(vide.transverse && Object.prototype.hasOwnProperty.call(vide.transverse, 'voletsMotorises'), 'A3 transverse.voletsMotorises présent');
A(vide.transverse.chauffageAuSol === null && vide.transverse.voletsMotorises === null, 'A4 valeurs initiales null');
A(!('domotique' in vide.transverse) && !('irve' in vide.transverse) && !('pv' in vide.transverse), 'A5 aucun transverse référencé re-déclaré');

// ---------- (B) dynamique + (C) VMC exclue ----------
const q = CT.construireQuestionnaire({ domotique: 'complet', borneVE: 'oui', pv: 'non' }, PIECES, METIERS);
A(q.version === 1, 'B1 questionnaire v1');
A(q.metiers.every(m => m.code !== 'vmc'), 'C1 VMC absente des sections métier');
A(q.metiers.some(m => m.code === 'electricite') && q.metiers.some(m => m.code === 'plomberie'), 'B2 sections métiers actifs présentes');
const qReduit = CT.construireQuestionnaire({}, PIECES, ['electricite']);
A(qReduit.metiers.length === 1 && qReduit.metiers[0].code === 'electricite', 'B3 métiers inactifs exclus');

// per-piece plomberie ciblé pièces d'eau uniquement (cuisine, sdb, wc — pas salon/chambre)
const plo = q.metiers.find(m => m.code === 'plomberie');
const clesPP = plo.parPiece.pieces.map(p => p.id);
A(clesPP.indexOf('sdb') !== -1 && clesPP.indexOf('cuisine') !== -1 && clesPP.indexOf('wc') !== -1, 'B4 plomberie parPiece cible pièces d\'eau');
A(clesPP.indexOf('salon') === -1 && clesPP.indexOf('chambre') === -1, 'B5 plomberie parPiece exclut salon/chambre');
// cuisine/buanderie bloc
A(plo.cuisineBuanderie && plo.cuisineBuanderie.pieces.some(p => p.id === 'cuisine'), 'B6 bloc cuisine/buanderie ciblé cuisine');
// per-piece sols s'applique à toutes les pièces
const sols = q.metiers.find(m => m.code === 'sols');
A(sols.parPiece.pieces.length === PIECES.length, 'B7 sols parPiece sur toutes les pièces');

// clé de pièce = id#numero (aligne dimKey du configurateur)
A(CT.clePiece({ id: 'chambre', numero: 2 }) === 'chambre#2', 'B8 clePiece = id#numero');

// ---------- (D) adaptateurs ----------
A(CT.codeMetier('carrelageFaience') === 'carrelage', 'D1 carrelageFaience -> carrelage');
A(CT.codeMetier('placo') === 'isolation', 'D2 placo -> isolation');
A(CT.codeMetier('electricite') === 'electricite', 'D3 code réel inchangé');

// ---------- (E) SOURCE UNIQUE : transverses référencés ----------
const refs = {}; q.referencesTransverse.forEach(r => refs[r.id] = r);
A(refs.domotique && refs.domotique.source === 'chantier' && refs.domotique.lectureSeule === true, 'E1 domotique référencé (chantier, lecture seule)');
A(refs.domotique.valeur === 'complet', 'E2 domotique lit chantier.domotique');
A(refs.irve && refs.irve.cleChantier === 'borneVE' && refs.irve.valeur === 'oui', 'E3 irve <- chantier.borneVE');
A(refs.pv && refs.pv.valeur === 'non', 'E4 pv <- chantier.pv');
// chauffageAuSol/volets sont des transverses NOUVEAUX (source choixTravaux), pas des questions métier
A(q.transverse.some(t => t.id === 'chauffageAuSol' && t.source === 'choixTravaux'), 'E5 chauffageAuSol transverse nouveau');
A(q.transverse.some(t => t.id === 'voletsMotorises' && t.source === 'choixTravaux'), 'E6 voletsMotorises transverse nouveau');
// chauffage EXCLU du questionnaire V1 : source canonique = piece.chauffageFonctions (phase 2)
A(!q.metiers.some(m => m.code === 'chauffage'), 'E7 chauffage absent du questionnaire V1 (aucun champ mort)');
A(q.transverse.some(t => t.id === 'chauffageAuSol'), 'E7b chauffage au sol reste un transverse dédié');
// menuiserie n'expose PAS les volets motorisés
const men = q.metiers.find(m => m.code === 'menuiserie');
A(!/voletsmotorises/i.test(JSON.stringify(men)), 'E8 menuiserie ne re-saisit pas les volets motorisés');
// douche italienne uniquement en plomberie
A(/doucheItalienne/i.test(JSON.stringify(plo)), 'E9 douche italienne captée en plomberie');
A(!/doucheItalienne/i.test(JSON.stringify(q.metiers.filter(m => m.code !== 'plomberie'))), 'E10 douche italienne absente hors plomberie');
// acoustique uniquement en isolation
const iso = q.metiers.find(m => m.code === 'isolation');
A(/acoustique/i.test(JSON.stringify(iso)), 'E11 acoustique captée en isolation');
A(!/acoustique/i.test(JSON.stringify(q.metiers.filter(m => m.code !== 'isolation'))), 'E12 acoustique absente hors isolation');

// ---------- (F) initChoix + fusion non destructive ----------
const init = CT.initChoix({}, PIECES, METIERS);
A(init.version === 1 && init.parMetier.electricite && !init.parMetier.vmc && !init.parMetier.chauffage, 'F1 initChoix structure sans VMC ni chauffage');
const patch = { transverse: { chauffageAuSol: 'complet', domotique: 'oui' /* doit être ignoré */ }, parMetier: { plomberie: { parPiece: { 'sdb#1': { doucheItalienne: 'oui' } } } } };
const fus = CT.fusionner(init, patch);
A(fus.transverse.chauffageAuSol === 'complet', 'F2 fusion applique chauffageAuSol');
A(!('domotique' in fus.transverse), 'F3 fusion ignore un transverse référencé injecté');
A(fus.parMetier.plomberie.parPiece['sdb#1'].doucheItalienne === 'oui', 'F4 fusion profonde par pièce');
A(init.transverse.chauffageAuSol === null, 'F5 fusion non destructive (source intacte)');
// initChoix préserve les réponses existantes de chantier.choixTravaux
const init2 = CT.initChoix({ choixTravaux: fus }, PIECES, METIERS);
A(init2.parMetier.plomberie.parPiece['sdb#1'].doucheItalienne === 'oui', 'F6 initChoix préserve les réponses existantes');

// ---------- (G) projection lecture seule ----------
const proj = CT.projeter({ choixTravaux: fus, domotique: 'basique', borneVE: 'oui', pv: 'non' });
A(proj.transverse.chauffageAuSol === 'complet', 'G1 projection expose transverse nouveau');
A(proj.transverse.domotique === 'basique' && proj.transverse.irve === 'oui' && proj.transverse.pv === 'non', 'G2 projection fusionne les référencés depuis chantier');
A(JSON.stringify(proj).indexOf('PLO_DOUCHE_ITAL') === -1 && !/prix|montant|quantite|surface/i.test(JSON.stringify(proj)), 'G3 projection ne calcule rien (aucun produit/prix/quantité)');

// ---------- (H) garde-fou verifierSourceUnique ----------
A(CT.verifierSourceUnique({ choixTravaux: fus }).length === 0, 'H1 conforme => aucune violation');
const mauvais = { choixTravaux: { version: 1, transverse: { chauffageAuSol: 'non', domotique: 'oui' }, parMetier: { chauffage: { _metier: { chauffageAuSol: 'oui' } }, carrelage: { parPiece: { 'sdb#1': { acoustique: 'oui' } } } } } };
const viol = CT.verifierSourceUnique(mauvais);
A(viol.length >= 3, 'H2 détecte les secondes sources (domotique+chauffageAuSol+acoustique)');
A(viol.some(v => /domotique/.test(v)) && viol.some(v => /chauffageAuSol/.test(v)) && viol.some(v => /acoustique/.test(v)), 'H3 messages ciblent chaque violation');

// ---------- bilan ----------
const total = ok + ko;
if (ko === 0) console.log('✅ Questionnaire choix de travaux (moteur) : ' + ok + '/' + total);
else { console.error('❌ Questionnaire choix de travaux : ' + ok + '/' + total); process.exit(1); }
