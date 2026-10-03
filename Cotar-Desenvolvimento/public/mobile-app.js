const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', {scope: '/'}).catch(() => {});
if (!standalone) {
  const panel = document.createElement('section');
  panel.className = 'cotar-install';
  panel.setAttribute('aria-label', 'Instalar o Cotar');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Instalar Cotar no celular';
  const instructions = document.createElement('p');
  instructions.hidden = true;
  instructions.id = 'cotar-install-help';
  button.setAttribute('aria-controls', instructions.id);
  button.setAttribute('aria-expanded', 'false');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  instructions.textContent = ios
    ? 'No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início. Se estiver em outro navegador, abra este site no Safari.'
    : 'Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial. No computador, use a opção de instalação na barra de endereço.';
  let prompt;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    prompt = event;
  });
  button.addEventListener('click', async () => {
    if (prompt) {
      const pending = prompt;
      prompt = undefined;
      await pending.prompt();
      const choice = await pending.userChoice;
      if (choice.outcome === 'accepted') panel.remove();
    } else {
      instructions.hidden = !instructions.hidden;
      button.setAttribute('aria-expanded', String(!instructions.hidden));
    }
  });
  window.addEventListener('appinstalled', () => panel.remove());
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = 'Agora não';
  dismiss.className = 'cotar-install-dismiss';
  dismiss.addEventListener('click', () => panel.remove());
  panel.append(button, instructions, dismiss);
  document.body.append(panel);
}
