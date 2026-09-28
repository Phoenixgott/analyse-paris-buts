import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/composants.css';
import { registerSW } from 'virtual:pwa-register';
import { installerNavigation } from './composants/navigation.js';
import { installerInfoBulles } from './composants/info-bulle.js';
import { installerTableaux } from './composants/tableau-triable.js';
import { demarrerRouteur } from './router.js';

installerNavigation();
installerInfoBulles();
installerTableaux();
demarrerRouteur();

// Installation sur Android (Chrome) : bouton dans la sidebar quand le navigateur le propose.
let invite = null;
const boutonInstaller = document.getElementById('bouton-installer');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  invite = e;
  boutonInstaller.hidden = false;
});
boutonInstaller.addEventListener('click', async () => {
  if (!invite) return;
  invite.prompt();
  await invite.userChoice;
  invite = null;
  boutonInstaller.hidden = true;
});
window.addEventListener('appinstalled', () => {
  boutonInstaller.hidden = true;
});

registerSW({ immediate: true });
