document.addEventListener('DOMContentLoaded', async () => {
  const provider = document.getElementById('provider');
  const key = document.getElementById('key');
  const model = document.getElementById('model');
  const status = document.getElementById('status');
  try {
    const config = await chrome.storage.local.get(['quizProvider', 'mistralApiKey', 'mistralModel']);
    provider.value = config.quizProvider === 'mistral' ? 'mistral' : 'openai';
    model.value = config.mistralModel || 'mistral-small-latest';
    status.textContent = config.mistralApiKey ? 'Une cle Mistral est enregistree.' : 'Aucune cle Mistral enregistree.';
  } catch (_) { status.textContent = 'Impossible de lire les parametres.'; }
  document.getElementById('save').onclick = async () => {
    try {
      const chosenModel = model.value.trim();
      if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(chosenModel)) { status.textContent = 'Identifiant de modele invalide.'; return; }
      const existing = await chrome.storage.local.get('mistralApiKey');
      const entered = key.value.trim();
      if (provider.value === 'mistral' && !entered && !existing.mistralApiKey) { status.textContent = 'Saisis une cle Mistral avant de choisir ce fournisseur.'; return; }
      const values = {quizProvider: provider.value, mistralModel: chosenModel};
      if (entered) values.mistralApiKey = entered;
      await chrome.storage.local.set(values);
      key.value = ''; status.textContent = 'Parametres enregistres. Le prochain appel utilisera ' + (provider.value === 'mistral' ? 'Mistral.' : 'OpenAI.');
    } catch (_) { status.textContent = 'Echec de l enregistrement.'; }
  };
  document.getElementById('remove').onclick = async () => {
    try {
      await chrome.storage.local.remove('mistralApiKey');
      await chrome.storage.local.set({quizProvider: 'openai'});
      provider.value = 'openai'; key.value = '';
      status.textContent = 'Cle Mistral supprimee. Fournisseur remis sur OpenAI.';
    } catch (_) { status.textContent = 'Echec de la suppression.'; }
  };
});
