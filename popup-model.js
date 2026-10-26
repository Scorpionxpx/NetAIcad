document.addEventListener('DOMContentLoaded', async () => {
  const provider = document.getElementById('provider');
  const group = document.getElementById('openAiModelGroup');
  const model = document.getElementById('openAiModel');
  const effort = document.getElementById('openAiEffort');
  const status = document.getElementById('openAiModelStatus');
  const hint = document.getElementById('hint');
  const save = document.getElementById('saveOpenAiModel');
  let savedModel = '';
  function update() {
    const isOpenAi = provider.value === 'openai';
    group.hidden = !isOpenAi;
    if (isOpenAi) {
      const text = 'OpenAI : modele enregistre ' + (savedModel || 'gpt-4o-mini (historique)') + '. Le modele et la cle ont des boutons d enregistrement distincts.';
      if (hint.textContent !== text) hint.textContent = text;
    }
  }
  new MutationObserver(update).observe(hint, {childList: true});
  provider.addEventListener('change', update);
  try {
    const config = await chrome.storage.local.get(['openAiModel', 'openAiReasoning']);
    savedModel = config.openAiModel || ''; model.value = savedModel;
    effort.value = ['low', 'medium', 'high'].includes(config.openAiReasoning) ? config.openAiReasoning : '';
    update();
  } catch (_) { status.textContent = 'Lecture du modele impossible.'; }
  save.onclick = async () => {
    const chosen = model.value.trim();
    if (chosen && !/^[a-zA-Z0-9._:-]{1,120}$/.test(chosen)) { status.textContent = 'Identifiant de modele invalide.'; return; }
    if (!chosen && effort.value) { status.textContent = 'Choisis un modele Responses pour utiliser ce reglage de raisonnement.'; return; }
    save.disabled = true;
    try {
      await chrome.storage.local.set({openAiModel: chosen, openAiReasoning: effort.value});
      savedModel = chosen; update();
      status.textContent = 'Modele enregistre. Aucun appel API ni test de disponibilite effectue. Le fournisseur actif reste inchange.';
    } catch (_) { status.textContent = 'Enregistrement du modele impossible.'; }
    finally { save.disabled = false; }
  };
});
