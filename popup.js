document.addEventListener('DOMContentLoaded', () => {
  const el = id => document.getElementById(id);
  const provider = el('provider'), key = el('key'), model = el('model'), status = el('status');
  const names = {openai: 'OpenAI', mistral: 'Mistral AI'};
  let busy = false;
  async function read(p) {
    return p === 'mistral' ? (await chrome.storage.local.get('mistralApiKey')).mistralApiKey : (await chrome.storage.sync.get('openAiApiKey')).openAiApiKey;
  }
  function lock(value) {
    busy = value;
    for (const control of document.querySelectorAll('button,input,select')) control.disabled = value;
  }
  async function refresh() {
    const p = provider.value;
    key.value = ''; status.textContent = '';
    el('keyLabel').textContent = 'Nouvelle cle API ' + names[p];
    key.placeholder = 'Laisser vide pour conserver la cle enregistree';
    el('modelGroup').hidden = p !== 'mistral';
    el('hint').textContent = p === 'mistral' ? 'Les demandes du bouton quiz seront envoyees a Mistral apres enregistrement.' : 'Les demandes du bouton quiz seront envoyees a OpenAI apres enregistrement. Modele actuel : gpt-4o-mini.';
    try {
      const saved = await read(p);
      if (provider.value === p) el('saved').textContent = saved ? 'Une cle ' + names[p] + ' est deja enregistree.' : 'Aucune cle ' + names[p] + ' enregistree.';
    } catch (_) { el('saved').textContent = 'Lecture des parametres impossible.'; }
  }
  provider.onchange = refresh;
  key.oninput = () => { status.textContent = key.value.trim() ? 'Nouvelle cle ' + names[provider.value] + ' saisie, pas encore enregistree ni testee.' : ''; };
  el('save').onclick = async () => {
    if (busy) return; lock(true);
    const p = provider.value;
    try {
      const entered = key.value.trim();
      const saved = await read(p);
      if (!entered && !saved) { status.textContent = 'Saisis une cle ' + names[p] + '.'; return; }
      if (p === 'mistral' && !/^[a-zA-Z0-9._:-]{1,120}$/.test(model.value.trim())) { status.textContent = 'Identifiant de modele Mistral invalide.'; return; }
      if (entered) {
        if (p === 'mistral') await chrome.storage.local.set({mistralApiKey: entered});
        else await chrome.storage.sync.set({openAiApiKey: entered});
      }
      const values = {quizProvider: p};
      if (p === 'mistral') values.mistralModel = model.value.trim();
      await chrome.storage.local.set(values);
      await refresh();
      status.textContent = names[p] + ' actif. Parametres enregistres. La cle n a pas ete validee par cet enregistrement.';
    } catch (_) { status.textContent = 'Echec de l enregistrement. Verifie les options avant de lancer un quiz.'; }
    finally { lock(false); }
  };
  el('test').onclick = async () => {
    if (busy) return; lock(true);
    const p = provider.value;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const secret = key.value.trim() || await read(p);
      if (!secret) { status.textContent = 'Saisis une cle ' + names[p] + ' avant le test.'; return; }
      status.textContent = 'Test aupres de ' + names[p] + ' uniquement...';
      const url = p === 'mistral' ? 'https://api.mistral.ai/v1/models' : 'https://api.openai.com/v1/models';
      const response = await fetch(url, {headers: {Authorization: 'Bearer ' + secret}, signal: controller.signal, credentials: 'omit', redirect: 'error'});
      status.textContent = response.ok ? names[p] + ' : acces a la liste des modeles confirme. Cela ne garantit pas le quota de generation. Clique sur Enregistrer pour activer cette configuration.' : names[p] + ' : HTTP ' + response.status + (response.status === 401 ? ' — cle refusee.' : response.status === 403 ? ' — autorisation insuffisante ; la cle n est pas necessairement invalide.' : response.status === 429 ? ' — limite de requetes atteinte.' : ' — verification necessaire.');
    } catch (error) { status.textContent = names[p] + (error.name === 'AbortError' ? ' : delai de test depasse.' : ' : test impossible (reseau ou permissions).'); }
    finally { clearTimeout(timeout); lock(false); }
  };
  el('remove').onclick = async () => {
    if (busy) return;
    const p = provider.value;
    if (!confirm('Supprimer la cle ' + names[p] + ' enregistree dans cette extension ?')) return;
    lock(true);
    try {
      if (p === 'mistral') await chrome.storage.local.remove('mistralApiKey');
      else await chrome.storage.sync.remove('openAiApiKey');
      await refresh(); status.textContent = 'Cle ' + names[p] + ' supprimee localement. Elle n est pas revoquee chez le fournisseur.';
    } catch (_) { status.textContent = 'Suppression impossible.'; }
    finally { lock(false); }
  };
  el('saveGemini').onclick = async () => {
    if (busy) return;
    const value = el('gemini').value.trim();
    if (!value) { status.textContent = 'Saisis une nouvelle cle Gemini ou conserve la configuration existante.'; return; }
    lock(true);
    try { await chrome.storage.sync.set({geminiApiKey: value}); el('gemini').value = ''; status.textContent = 'Cle Gemini enregistree. Fournisseur principal inchange.'; }
    catch (_) { status.textContent = 'Echec de l enregistrement Gemini.'; }
    finally { lock(false); }
  };
  el('advanced').onclick = () => chrome.runtime.openOptionsPage();
  (async () => {
    lock(true);
    try {
      const config = await chrome.storage.local.get(['quizProvider', 'mistralModel']);
      provider.value = config.quizProvider === 'mistral' ? 'mistral' : 'openai';
      model.value = config.mistralModel || 'mistral-small-latest';
      await refresh();
    } catch (_) { status.textContent = 'Chargement des parametres impossible.'; }
    finally { lock(false); }
  })();
});
