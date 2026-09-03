// =====================================================================
// tests/questionnaire-perimetre-ux.test.js — M56 : questionnaire adapté au périmètre
// =====================================================================
// M56 = UX UNIQUEMENT. Vérifie : libellés clarifiés (surface/pieces), contexte
// « logement entier » visible seulement en partiel, ET surtout AUCUNE donnée métier
// perdue (tous les champs chantier conservés, ids/validation inchangés, dépannage
// intact, pas de nouveau champ chantier.perimetre). Aucune modification de fichier ici.
// =====================================================================
const fs = require('fs');
const path = require('path');
const DEVIS = fs.readFileSync(path.join(__dirname, '..', 'devis.html'), 'utf8');

let ok = 0, ko = 0;
const A = (c, m) => { if (c) ok++; else { ko++; console.error('  ❌ ' + m); } };
function extraire(src, sig) {
  const s = src.indexOf(sig); if (s < 0) throw new Error('introuvable: ' + sig);
  let i = src.indexOf('{', s), d = 0, e = -1;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { e = i + 1; break; } } }
  return src.slice(s, e);
}

// ---- Libellés clarifiés (UX) ---------------------------------------
A(/<label>Surface totale du logement \(m²\) \*<\/label>/.test(DEVIS), 'label surface clarifié « du logement »');
A(/<label>Combien de pièces principales compte votre logement \? \*<\/label>/.test(DEVIS), 'label pièces clarifié « votre logement »');
A(/🏠 Informations sur votre logement/.test(DEVIS), 'titre de section « Informations sur votre logement »');
A(/id="ctxLogementPartiel"[^>]*display:none/.test(DEVIS), 'contexte partiel présent, masqué par défaut');
A(/Vous sélectionnerez les pièces concernées par les travaux à l'étape suivante\./.test(DEVIS), 'texte « pièces choisies ensuite » présent');

// ---- Données internes INCHANGÉES -----------------------------------
A(/id="surface"[^>]*min="10"[^>]*max="1000"/.test(DEVIS), 'surface : id + validation min/max inchangés');
A(/id="pieces"/.test(DEVIS) && ['1','2','3','4','5','6'].every(v => new RegExp('<option value="' + v + '"').test(DEVIS)), 'pieces : id + options T1..T6 (valeurs 1..6) inchangés');
// pas de transformation de sens de `pieces`
A(!/nombre de pièces rénovées/i.test(DEVIS), 'pieces NON transformé en « pièces rénovées »');

// ---- AUCUN champ chantier perdu (bloc de collecte intact) ----------
const chBlock = extraire(DEVIS, 'chantier: {');
['codePostal', 'ville', 'typeBien', 'typeLogement', 'etage', 'ascenseur', 'surface', 'pieces',
 'ageBati', 'etatLieux', 'typeProjet', 'hauteurPlafond', 'accessibilite', 'accessSup',
 'qualiteMateriaux', 'chauffage', 'vmc', 'eauChaude', 'tableauExistant', 'borneVE', 'pv',
 'domotique', 'anneeConstruction', 'contraintes', 'contraintePrecision']
  .forEach(f => A(new RegExp('\\b' + f + ':').test(chBlock), 'chantier conserve le champ « ' + f + ' »'));

// pénibilité / contraintes / existant explicitement préservés
['accessibilite', 'accessSup', 'contraintes', 'chauffage', 'vmc', 'eauChaude', 'tableauExistant', 'borneVE', 'pv', 'domotique']
  .forEach(f => A(new RegExp('\\b' + f + ':').test(chBlock), 'donnée métier préservée (pénibilité/existant) : ' + f));

// pas de nouveau champ chantier.perimetre
A(!/\bperimetre:/.test(chBlock), 'aucun nouveau champ chantier.perimetre ajouté');

// ---- Dépannage inchangé (routage) ----------------------------------
A(/window\.location\.href = 'depannage\.html'/.test(DEVIS), 'parcours dépannage inchangé (→ depannage.html)');

// ---- Comportement : contexte visible seulement en partiel ----------
const SRC = extraire(DEVIS, 'function majContexteLogement()');
function run(prm) {
  const ctx = { style: {} };
  const els = { ctxLogementPartiel: ctx, perimetreTravaux: { value: prm } };
  const document = { getElementById: (id) => els[id] || null };
  new Function('document', SRC + ';majContexteLogement();')(document);
  return ctx.style.display;
}
A(run('partiel') === 'block', 'contexte affiché en périmètre partiel');
A(run('complet') === 'none', 'contexte masqué en périmètre complet');
A(run('') === 'none', 'périmètre absent → défaut complet → contexte masqué (sessions anciennes)');

const total = ok + ko;
if (ko === 0) console.log('✅ Questionnaire périmètre UX (M56) : ' + ok + '/' + total + ' — libellés clarifiés, 100% des données métier conservées, dépannage intact');
else { console.error('❌ Questionnaire périmètre UX : ' + ok + '/' + total); process.exit(1); }
