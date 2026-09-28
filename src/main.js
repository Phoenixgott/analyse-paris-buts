import './styles/base.css';
import { registerSW } from 'virtual:pwa-register';

const app = document.getElementById('app');

app.innerHTML = `
  <section class="carte">
    <h2>Matchs du jour</h2>
    <p class="date" id="date-du-jour"></p>
    <p>Le site est en construction (phase 0). Aucune donnée de match n'est encore publiée :
       la liste apparaîtra ici dès la phase 1.</p>
  </section>
  <section class="carte" id="carte-installation" hidden>
    <h2>Installer l'application</h2>
    <p>Ajoute Analyse Paris Buts à ton écran d'accueil pour l'ouvrir comme une application.</p>
    <button type="button" class="bouton" id="bouton-installer">Installer</button>
  </section>
`;

// Date affichée dans le fuseau Europe/Paris, quel que soit le fuseau du téléphone.
document.getElementById('date-du-jour').textContent = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(new Date());

// Installation (Android / Chrome).
let invite = null;
const carteInstallation = document.getElementById('carte-installation');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  invite = e;
  carteInstallation.hidden = false;
});
document.getElementById('bouton-installer').addEventListener('click', async () => {
  if (!invite) return;
  invite.prompt();
  await invite.userChoice;
  invite = null;
  carteInstallation.hidden = true;
});
window.addEventListener('appinstalled', () => {
  carteInstallation.hidden = true;
});

registerSW({ immediate: true });
