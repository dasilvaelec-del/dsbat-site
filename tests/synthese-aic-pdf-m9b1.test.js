// =====================================================================
// tests/synthese-aic-pdf-m9b1.test.js — Preuves M9-B1 (PDF de la synthèse AIC)
// =====================================================================
// Le PDF AIC consomme UNIQUEMENT l'objet AIC de M8 (construireAIC) rendu par
// SyntheseAICUIDSBAT.rendre(). html2pdf exige un navigateur → les tests couvrent
// la couche déterministe (objet AIC → HTML du PDF) + des preuves STATIQUES sur la
// glue réelle extraite du HTML (aucun prix, aucun Runtime, aucun e-mail, PDF devis
// intact, nom de fichier, chemin html2pdf/save). Couvre A→T.
// =====================================================================

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const S = require(path.join(ROOT, 'js', 'synthese-aic.js'));
const UI = require(path.join(ROOT, 'js', 'synthese-aic-ui.js'));
const html = fs.readFileSync(path.join(ROOT, 'devis-configurateur.html'), 'utf8');
let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
const NOW = '2026-01-01T00:00:00Z';

// L'en-tête PDF réel (tel qu'assemblé par genererPDFAIC) : titre + date genereLe.
// On reproduit fidèlement le corps = SyntheseAICUIDSBAT.rendre(aic) pour tester le
// contenu produit par M9-B1 (le PDF = en-tête + ce corps).
function htmlPdf(aic) {
  var dateStr = '';
  try { if (aic.genereLe) dateStr = new Date(aic.genereLe).toLocaleDateString('fr-FR'); } catch (e) {}
  var entete = '<div><div>DS.BAT — Synthèse de votre projet</div>' + (dateStr ? '<div>Générée le ' + dateStr + '</div>' : '') + '</div>';
  return entete + UI.rendre(aic);
}

// ---- Cas AIC complet représentatif ----
const input = {
  chantier: { typeBien: 'maison', surface: 70, tableauExistant: 'inconnu', chauffage: 'autre', eauChaude: 'ballon', vmc: 'defaillante',
    description: "Rénover la SDB : remplacer la baignoire par une douche à l'italienne, refaire le carrelage & repeindre <le> \"plafond\".\nPrévoir mise aux normes du tableau." },
  interpretation: { elementsDetectes: [
    { id: 'el_1', pieceId: 'sdb', metier: 'plomberie', action: 'installation', element: "douche à l'italienne", quantite: null, statut: 'a_confirmer' },
    { id: 'el_2', pieceId: 'sdb', metier: 'carrelage', action: 'renovation', element: 'carrelage mural', statut: 'a_confirmer' }
  ], questionsAConfirmer: [{ id: 'q_1', type: 'gamme_a_clarifier', texte: 'Quelle <gamme> ?' }] },
  confirmations: { confirmations: [{ id: 'cf_1', refElement: 'el_1', statut: 'confirme', valeurConfirmee: "douche à l'italienne" }] },
  piecesSelectionnees: [
    { id: 'sdb', numero: 1, nom: 'Salle de bain', dims: { l: 2.4, la: 2, h: 2.5 }, config: { plomberie: { PLO_DOUCHE_ITAL: 1 }, carrelage: { CAR_MUR: 12 } } },
    { id: 'chambre', numero: 1, nom: 'Chambre 1', dims: { l: 0, la: 0, h: 2.5 }, config: {} }
  ],
  metiersActifs: ['plomberie', 'carrelage', 'peinture'],
  modifications: [
    { type: 'ajout_piece', cible: 'sdb', avant: 0, apres: 1, horodatage: NOW },
    { type: 'prestation', code: 'PLO_DOUCHE_ITAL', quantite: 1, horodatage: NOW }
  ],
  prestationsDecisions: {
    'el_1|PLO_DOUCHE_ITAL': { decision: 'appliquee', pieceRef: 'sdb#1', metier: 'plomberie', code: 'PLO_DOUCHE_ITAL', quantite: 1, role: 'pose' },
    'el_1|PLO_BAIGNOIRE': { decision: 'a_verifier', code: 'PLO_BAIGNOIRE', role: 'depose', pieceRef: 'sdb#1', metier: 'plomberie' }
  },
  alertesCoherence: [{ niveau: 'attention', texte: 'Chambre 1 : dimensions non renseignées — comptées à 0 €.' }]
};
const resolveLabel = (c) => ({ PLO_DOUCHE_ITAL: "Douche à l'italienne", PLO_BAIGNOIRE: 'Baignoire', CAR_MUR: 'Carrelage mural' }[c] || null);
const aic = S.construireAIC(input, { now: NOW, resolveLabel });
const gel = JSON.stringify(aic);
const P = htmlPdf(aic);

// ---- A : AIC vide → PDF générable sans erreur ----
let Pvide = htmlPdf(S.construireAIC({}, { now: NOW }));
A(typeof Pvide === 'string' && Pvide.indexOf('Synthèse de votre projet') !== -1 && Pvide.indexOf('undefined') === -1, 'A: AIC vide → HTML PDF valide, sans erreur');

// ---- B : description restituée (échappée) ----
A(P.indexOf('Votre projet') !== -1 && P.indexOf('&lt;le&gt;') !== -1 && P.indexOf('<le>') === -1, 'B: description restituée et échappée');

// ---- C : éléments M4 (action/élément/pièce/métier/statut) ----
A(/douche.*italienne/i.test(P) && P.indexOf('Installer / poser') !== -1 && P.indexOf('Pièce : sdb') !== -1 && P.indexOf('Métier : Plomberie') !== -1, 'C: éléments M4 (action/élément/pièce/métier) restitués');

// ---- D : confirmations M5 (valeur + statut) ----
A(P.indexOf('Ce que vous avez confirmé') !== -1 && P.indexOf('✓ Confirmé') !== -1 && P.indexOf("douche à l&#39;italienne") !== -1, 'D: confirmation M5 (valeur + badge) restituée');

// ---- E : configuration M6 (dims présentes + incomplètes signalées + métiers + modifs) ----
A(P.indexOf('Configuration retenue') !== -1 && /L 2\.4 m/.test(P) && P.indexOf('⚠ Dimensions incomplètes') !== -1 && P.indexOf('À compléter : longueur, largeur') !== -1, 'E: configuration M6 (cotes présentes + incomplètes signalées)');
A(/ajout_piece/.test(P) && /0 → 1/.test(P), 'E: modification M6 pertinente restituée');

// ---- F : prestations M7 (pièce/métier/prestation/quantité/rôle) ----
A(P.indexOf('Prestations retenues') !== -1 && P.indexOf('sdb#1') !== -1 && P.indexOf("Douche à l&#39;italienne") !== -1 && /Pose/.test(P), 'F: prestations M7 restituées (pièce/label/rôle)');

// ---- G : 4 catégories « À vérifier » séparées ----
A(P.indexOf('À vérifier en visite') !== -1 && P.indexOf('Dépose non couverte') !== -1 && P.indexOf('Information technique à préciser') !== -1 && P.indexOf('Dimension manquante') !== -1 && P.indexOf('Écart de cohérence') !== -1, 'G: 4 catégories M8 séparées');

// ---- H : aucune donnée inventée (dépose « à vérifier » hors prestations) ----
const idxPrest = P.indexOf('Prestations retenues'), idxAV = P.indexOf('À vérifier en visite');
A(P.slice(idxPrest, idxAV).indexOf('Baignoire') === -1 && P.slice(idxAV).indexOf('Baignoire') !== -1, 'H: dépose « à vérifier » hors tableau prestations');
let sansLabel = htmlPdf(S.construireAIC(input, { now: NOW }));
A(sansLabel.indexOf("Douche à l'italienne") === -1 && sansLabel.indexOf('PLO_DOUCHE_ITAL') !== -1, 'H: sans resolver → code brut, aucun label inventé');

// ---- I : aucune quantité inventée ----
A(/PLO_BAIGNOIRE|Baignoire/.test(P.slice(idxAV)) && !/Baignoire[^<]*\b\d+\b/.test(P.slice(idxAV)), 'I: dépose sans quantité fabriquée');

// ---- J : aucun prix produit par M9-B1 ----
A(!/totalht|getmoyenprix|prixtotal|\bttc\b|formateuro/i.test(P), 'J: aucun artefact de prix produit');
const sansAlerte = P.split('comptées à 0 €').join('');
A(sansAlerte.indexOf('€') === -1, 'J: le seul « € » provient du texte d\'alerte source (aucun montant fabriqué)');

// ---- M : textes longs / accents / apostrophes / caractères français ----
A(P.indexOf('&quot;plafond&quot;') !== -1 && P.indexOf('&amp;') !== -1 && P.indexOf('<br>') !== -1, 'M: accents/apostrophes/guillemets/retours ligne corrects');
let Plong = htmlPdf(S.construireAIC({ chantier: { description: 'ÉÀÇùœ '.repeat(300) } }, { now: NOW }));
A(Plong.indexOf('ÉÀÇùœ') !== -1 && (Plong.match(/<div/g) || []).length === (Plong.match(/<\/div>/g) || []).length, 'N: texte long + caractères spéciaux → structure équilibrée');

// ---- O/Q : objet AIC non muté avant/après ----
htmlPdf(aic);
A(JSON.stringify(aic) === gel, 'O/Q: objet AIC identique avant/après génération (non muté)');

// ---- Date injectée dans l'en-tête (déterminisme) ----
A(P.indexOf('Générée le 01/01/2026') !== -1, 'Date genereLe injectée et formatée (déterministe)');

// ================= Preuves STATIQUES sur la glue réelle (HTML) =================
// M9-B2 : le pipeline PDF est factorisé dans __executerPDFAIC (save + blob) ; genererPDFAIC
// y délègue en mode 'save'. On vérifie le pipeline réel, hors commentaires (qui citent
// volontairement « Runtime/genererPDFConfig » pour dire qu'ils sont évités).
const iFn = html.indexOf('function __executerPDFAIC(');
const fnPDF = html.slice(iFn, html.indexOf('// ===== AIC-001 / M9-B2', iFn)).replace(/\/\/[^\n]*/g, '');
// Le téléchargement M9-B1 délègue bien au pipeline en mode save
A(/function genererPDFAIC\(\) \{ __executerPDFAIC\('save'\); \}/.test(html), 'S: genererPDFAIC() délègue à __executerPDFAIC(save)');

// ---- K : aucun appel Runtime ----
A(iFn !== -1 && !/__obtenirDevisRuntime|Runtime|coefZone|calculerDevis|calculerPiece/.test(fnPDF), 'K: genererPDFAIC n\'appelle aucun Runtime/calcul');

// ---- L : aucune lecture du catalogue tarifaire / prix ----
A(!/getMoyenPrix|pricing|prix\.js|vue-tarifaire|formatEuro/.test(fnPDF), 'L: aucun accès prix / catalogue tarifaire');

// ---- e-mail / WhatsApp / notifications absents ----
A(!/envoyerEmail|envoyerNotifications|wa\.me|MAIL_URL/.test(fnPDF), 'K/L: aucun e-mail / WhatsApp / notification');

// ---- R : nom de fichier ----
A(/filename:\s*'Synthese_AIC_DSBAT\.pdf'/.test(fnPDF), 'R: nom de fichier = Synthese_AIC_DSBAT.pdf');

// ---- S : Blob / téléchargement via le mécanisme html2pdf existant (.save) ----
A(/html2pdf\(\)\.from\(div\)/.test(fnPDF) && /\.save\(\)/.test(fnPDF), 'S: génération via html2pdf().from(div).save() (mécanisme existant)');
A(/SyntheseAICUIDSBAT\.rendre\(aic\)/.test(fnPDF) && /__construireAICCourant\(\)/.test(fnPDF), 'S: consomme construireAIC (helper) + rendre() — source unique AIC');

// ---- P : PDF de devis financier existant inchangé ----
A(html.indexOf('function genererPDFConfig()') !== -1 && /Devis_DSBAT_\$\{numero\}\.pdf/.test(html), 'P: genererPDFConfig (PDF devis) toujours présent et inchangé');
A(html.indexOf('function envoyerEmail(') !== -1 && html.indexOf("MAIL_URL = 'https://formsubmit.co/ajax/contact@dsbat.fr'") !== -1, 'P: envoyerEmail / MAIL_URL du devis inchangés');

// ---- Bouton présent sous #recapAIC, hors Runtime ----
const iBtn = html.indexOf('onclick="genererPDFAIC()"');
const iRecapAIC = html.indexOf('<div id="recapAIC">');
const iRecapGlobal = html.indexOf('id="recapGlobal"');
A(iBtn !== -1 && iRecapAIC < iBtn && iBtn < iRecapGlobal, 'Bouton « synthèse PDF » entre #recapAIC et #recapGlobal (hors zone Runtime)');
A(html.indexOf('Télécharger la synthèse PDF') !== -1, 'Bouton libellé « Télécharger la synthèse PDF »');

const total = ok + ko;
if (ko === 0) console.log('✅ PDF Synthèse AIC (M9-B1) : ' + ok + '/' + total + ' — source AIC unique, sans prix/Runtime/e-mail, PDF devis intact');
else console.error('❌ M9-B1 : ' + ok + '/' + total);
process.exit(ko === 0 ? 0 : 1);
