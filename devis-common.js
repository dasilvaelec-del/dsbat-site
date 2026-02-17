// devis-common.js – Fonctions partagées pour les pages de devis

// Protection numéro de téléphone (base64)
function initPhoneProtection() {
  document.querySelectorAll('[data-phone-base64]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const phone = atob(link.dataset.phoneBase64);
      window.location.href = `tel:${phone}`;
    });
  });
}

// Génération d'un numéro de devis unique
function genererNumeroDevis(prefix = 'DEV') {
  let compteur = localStorage.getItem('dsbat-devis-compteur') || 1000;
  compteur = parseInt(compteur) + 1;
  localStorage.setItem('dsbat-devis-compteur', compteur);
  const annee = new Date().getFullYear();
  return `${prefix}‑${annee}‑${compteur}`;
}

// Affichage de la date du jour
function afficherDate(elementId = 'devisDate') {
  const d = new Date();
  const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const dateSpan = document.getElementById(elementId);
  if (dateSpan) dateSpan.innerText = d.toLocaleDateString('fr-FR', options);
}

// Chargement différé de html2pdf
function loadPDF(callback) {
  if (window.html2pdf) {
    callback();
  } else {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = callback;
    document.head.appendChild(script);
  }
}

// Fonction générique pour générer un PDF (à appeler avec l'ID du conteneur)
function genererPDF(elementId, filenamePrefix) {
  loadPDF(() => {
    const element = document.getElementById(elementId);
    if (!element) return;
    const numero = document.getElementById('devisNumero')?.innerText.replace(/[^0-9]/g, '') || '0001';
    html2pdf().from(element).set({
      margin: 15,
      filename: `${filenamePrefix}_${numero}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).save();
  });
}

// Fonction générique pour envoyer sur WhatsApp (à personnaliser)
function envoyerWhatsApp(totalTTC, messagePrefix) {
  const total = document.getElementById(totalTTC)?.innerText || '0 €';
  const message = `*${messagePrefix}*%0A%0ATotal TTC : ${total}%0A%0APouvez-vous me rappeler ?`;
  window.open(`https://wa.me/${CONFIG.telephone}?text=${encodeURIComponent(message)}`);
}

// Initialisation commune pour les pages de devis
function initDevisPage(prefix) {
  afficherDate();
  const numeroSpan = document.getElementById('devisNumero');
  if (numeroSpan) numeroSpan.innerText = genererNumeroDevis(prefix);
  initPhoneProtection();
}