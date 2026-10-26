document.addEventListener('DOMContentLoaded', () => {
  const state = document.getElementById('state');
  const boxes = [...document.querySelectorAll('input[data-key]')];
  const read = async () => (await chrome.storage.local.get('uiVisibility')).uiVisibility || {};
  async function load() {
    const saved = await read();
    boxes.forEach(box => { box.checked = saved[box.dataset.key] !== false; });
    state.textContent = 'Preferences chargees. Les modifications sont enregistrees automatiquement.';
  }
  boxes.forEach(box => box.addEventListener('change', async () => {
    const current = await read();
    current[box.dataset.key] = box.checked;
    await chrome.storage.local.set({uiVisibility: current});
    state.textContent = 'Preference enregistree : ' + box.closest('tr').querySelector('td').textContent + ' ' + (box.checked ? 'affiche' : 'masque') + '.';
  }));
  load();
});
