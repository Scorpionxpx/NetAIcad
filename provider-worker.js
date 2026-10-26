// Keep the existing listener and route GPT requests to the selected provider.
importScripts('background.js');
(() => {
  const originalAnswer = handleGetAnswer;
  const originalMatching = handleGetMatchingAnswer;
  const settings = () => chrome.storage.local.get(['quizProvider', 'mistralApiKey', 'mistralModel']);
  async function complete(config, prompt, system) {
    if (!config.mistralApiKey) throw new Error('Mistral API key not configured. Open extension Options.');
    const model = (config.mistralModel || 'mistral-small-latest').trim();
    if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(model)) throw new Error('Invalid Mistral model.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST', signal: controller.signal, credentials: 'omit', redirect: 'error',
        headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + config.mistralApiKey},
        body: JSON.stringify({model, messages: [{role: 'system', content: system}, {role: 'user', content: prompt}], temperature: 0, max_tokens: 1000, stream: false})
      });
      if (!response.ok) throw new Error('Mistral API HTTP ' + response.status);
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || !text.trim()) throw new Error('Mistral returned an empty response.');
      return text.trim();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Mistral timeout.');
      if (/^(Mistral API HTTP \d{3}|Mistral returned an empty response\.)$/.test(error.message)) throw error;
      throw new Error('Mistral request failed. Check network and model configuration.');
    } finally { clearTimeout(timeout); }
  }
  handleGetAnswer = async function(question, options, modelType, multiple = false, required = 1, windowId, originTabId) {
    try {
      const config = await settings();
      if (modelType !== 'gpt' || config.quizProvider !== 'mistral') return originalAnswer(question, options, modelType, multiple, required, windowId, originTabId);
      if (!Array.isArray(options) || !options.length || options.length > 26 || !Number.isInteger(required) || required < 1 || required > options.length) throw new Error('Invalid question options.');
      const text = await complete(config, buildPrompt(question, options, multiple, required), SYSTEM_PROMPT);
      if (!/^[A-Z](?:\s*,\s*[A-Z])*$/i.test(text)) throw new Error('Invalid Mistral answer format.');
      const indices = text.toUpperCase().split(',').map(s => s.trim().charCodeAt(0) - 65);
      if (new Set(indices).size !== indices.length || indices.length !== (multiple ? required : 1) || indices.some(i => i < 0 || i >= options.length)) throw new Error('Invalid Mistral answer count.');
      return {success: true, answerIndex: multiple ? indices : indices[0]};
    } catch (error) { return {success: false, error: error.message}; }
  };
  handleGetMatchingAnswer = async function(rows, modelType, windowId, originTabId) {
    try {
      const config = await settings();
      if (modelType !== 'gpt' || config.quizProvider !== 'mistral') return originalMatching(rows, modelType, windowId, originTabId);
      if (!Array.isArray(rows) || !rows.length) throw new Error('Invalid matching rows.');
      const text = await complete(config, buildMatchingPrompt(rows), MATCHING_SYSTEM_PROMPT);
      const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length !== rows.length) throw new Error('Invalid Mistral matching answer count.');
      const rowAnswers = rows.map((row, index) => {
        const pattern = new RegExp('^Row\\s*' + (index + 1) + '\\s*:\\s*(.+)$', 'i');
        const matches = lines.map(line => line.match(pattern)).filter(Boolean);
        if (matches.length !== 1) throw new Error('Invalid Mistral matching format.');
        const option = row.options.find(value => value === matches[0][1].trim());
        if (option === undefined) throw new Error('Invalid Mistral matching option.');
        return {index, option};
      });
      return {success: true, rowAnswers};
    } catch (error) { return {success: false, error: error.message}; }
  };
})();
