// Read platform state; never manufacture completion or persist progress.
(() => {
  function snapshot(elements) {
    const headings = [...new Set(elements.filter(Boolean).flatMap(el => findInShadowDOM('.js-heading', el)))];
    return headings.map(node => ({node, wasIncomplete: node.classList.contains('is-incomplete')}));
  }
  function completed(states) {
    return states.length > 0 && states.every(({node, wasIncomplete}) =>
      node.isConnected && !node.classList.contains('is-incomplete') &&
      (wasIncomplete || node.classList.contains('is-complete'))
    );
  }
  function guard(handler, recoverLateReadingError = false) {
    return async function(elements) {
      if (moduleWalkState.stopRequested) throw new Error('Parcours interrompu.');
      const states = snapshot(elements);
      if (!states.length) throw new Error('Etat inconnu : aucun indicateur de section reconnu. Verification manuelle requise.');
      if (completed(states)) return true;
      if (!states.some(state => state.wasIncomplete)) {
        throw new Error('Etat inconnu : les indicateurs ne confirment ni section incomplete ni section terminee.');
      }
      try {
        const handled = await handler(elements);
        if (moduleWalkState.stopRequested) throw new Error('Parcours interrompu.');
        const confirmed = await waitFor(() => {
          if (moduleWalkState.stopRequested) throw new Error('Parcours interrompu.');
          return completed(states);
        }, 15000, 100);
        if (!confirmed) throw new Error('Progression non confirmee : verifier les interactions ou recharger la page si ses indicateurs ont ete remplaces.');
        return handled !== false;
      } catch (error) {
        // The previous reading patch snapshots too late. Recover only its
        // two completion errors, never video, navigation or cancellation failures.
        const lateError = error.message === 'Impossible de confirmer la progression de cette section : verification manuelle requise.' ||
          error.message === 'La section reste incomplete : verifier les videos et interactions manuellement.';
        if (recoverLateReadingError && lateError && !moduleWalkState.stopRequested && completed(states)) return true;
        throw error;
      }
    };
  }
  handleReadingSection = guard(handleReadingSection, true);
  handleClickToRevealSection = guard(handleClickToRevealSection);
  handleSelfCheckSection = guard(handleSelfCheckSection);
})();
