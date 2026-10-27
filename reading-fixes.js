// Experimental current-page reader. Loaded after content.js; no progress writes.
function netaiReadingControl(m) {
  if(m.blocked || m.disabled || m.href || m.type==='submit' || m.tag==='A' || m.expanded==='true' || m.selected==='true')return false;
  if(/(?:envoyer|submit|delete|supprimer|reset|reinitialiser|next|suivant|precedent|previous|play|lecture|quiz|assessment)/i.test(m.label||''))return false;
  return m.role==='tab' && m.selected==='false' ||
    m.expanded==='false' && m.controls ||
    /(?:accordion|reveal|flipcard|hotgraphic__pin)/i.test(m.classes||'');
}
function netaiReadingDecision({video,quiz,embedded,button,bottom,stableBottom}) {
  if(video)return 'video';
  if(quiz)return 'quiz';
  if(embedded)return 'embedded';
  if(button)return 'click';
  return bottom && stableBottom ? 'finished' : 'scroll';
}
if(typeof module!=='undefined')module.exports={netaiReadingControl,netaiReadingDecision};
else (()=>{
  let active=false, originalDoc=null;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const excluded='nav,header,footer,aside,[role="navigation"],form,mcq-view,.mcq__widget,.matching__widget,video-view,.video__player';
  const controls='button,[role="button"],[role="tab"]';
  const all=(selector,root)=>[...new Set(findInShadowDOM(selector,root))];
  function parents(el){const result=[];for(let node=el;node;node=node.parentElement||node.getRootNode?.().host)result.push(node);return result;}
  function visible(el){
    if(!el?.isConnected)return false;
    const view=el.ownerDocument.defaultView, r=el.getBoundingClientRect();
    if(r.width<=4||r.height<=4||r.bottom<=0||r.top>=view.innerHeight||r.right<=0||r.left>=view.innerWidth)return false;
    for(const p of parents(el)){
      const s=view.getComputedStyle(p);
      if(s.display==='none'||s.visibility==='hidden'||s.opacity==='0')return false;
      if(p!==el && /(hidden|clip|auto|scroll)/.test(s.overflowY)){
        const b=p.getBoundingClientRect();if(r.bottom<=b.top||r.top>=b.bottom)return false;
      }
    }
    return true;
  }
  function courseDocument(){
    const frame=typeof getContentIframe==='function'?getContentIframe():null;
    if(frame){try{if(frame.contentDocument?.body)return frame.contentDocument;}catch(_){}throw new Error('Contenu du cours inaccessible.');}
    if(all('.js-heading',document).length)return document;
    throw new Error('Ouvre une page de cours avant de lancer Livre.');
  }
  function notice(message){
    let panel=document.getElementById('netacad-book-status');
    if(!panel){panel=document.createElement('div');panel.id='netacad-book-status';panel.setAttribute('role','status');panel.style.cssText='position:fixed;bottom:150px;right:12px;z-index:2147483647;max-width:340px;padding:12px;background:#15202b;color:white;border-radius:8px;font:13px system-ui';document.body.append(panel);}
    panel.textContent=message;
    console.info('[NetAIcad livre]',message);
  }
  function check(){
    if(moduleWalkState.stopRequested)throw new Error('Parcours arrete.');
    if(courseDocument()!==originalDoc)throw new Error('Page modifiee : parcours arrete.');
  }
  function blockers(){
    check();
    const video=all('video,video-view,.video__player',originalDoc).find(visible);
    const quiz=all('mcq-view,.mcq__widget,.matching__widget',originalDoc).find(visible);
    const embedded=all('iframe,object,embed',originalDoc).find(visible);
    return {video,quiz,embedded};
  }
  function protect(){
    const b=blockers();
    if(b.video)throw new Error('Video detectee : parcours arrete, sans lancer la lecture.');
    if(b.quiz)throw new Error('Quiz detecte : parcours arrete sans reponse ni envoi.');
    if(b.embedded)throw new Error('Contenu integre detecte : parcours arrete pour verification manuelle.');
  }
  async function pause(ms){for(let elapsed=0;elapsed<ms;elapsed+=100){protect();await sleep(100);}protect();}
  function scroller(doc){
    const root=doc.scrollingElement;
    if(root && root.scrollHeight>root.clientHeight+4)return root;
    return all('*',doc).filter(el=>{
      if(!visible(el)||parents(el).some(p=>p.matches?.(excluded)))return false;
      const s=doc.defaultView.getComputedStyle(el),r=el.getBoundingClientRect();
      return /(auto|scroll)/.test(s.overflowY)&&el.scrollHeight>el.clientHeight+4&&r.height>=120&&r.width>=doc.defaultView.innerWidth*0.5;
    }).sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0]||root;
  }
  function allowed(el){
    const blocked=parents(el).some(p=>p.matches?.(excluded)||p.id?.startsWith('netacad-')||p.id?.startsWith('netai'));
    return netaiReadingControl({blocked,disabled:el.disabled||el.getAttribute('aria-disabled')==='true',href:el.getAttribute('href'),tag:el.tagName,type:el.getAttribute('type'),role:el.getAttribute('role'),expanded:el.getAttribute('aria-expanded'),controls:el.hasAttribute('aria-controls'),selected:el.getAttribute('aria-selected'),classes:el.className,label:el.getAttribute('aria-label')||el.textContent});
  }
  async function run(button){
    if(active){moduleWalkState.stopRequested=true;return;}
    if(moduleWalkState.running){notice('Un autre mode est actif. Arrete-le avant Livre.');return;}
    let previousTitle=button.title;
    try{
      originalDoc=courseDocument();active=true;moduleWalkState.running=true;moduleWalkState.stopRequested=false;
      button.title='Arreter le defilement du cours';button.setAttribute('aria-pressed','true');
      notice('Lecture de la page : defilement et ouverture des contenus. Clique sur Livre pour arreter.');
      const clicked=new WeakSet();let bottomSince=0,bottomKey='',stalls=0,clickCount=0;
      for(let step=0;step<1000;step++){
        protect();
        const target=all(controls,originalDoc).find(el=>visible(el)&&!clicked.has(el)&&allowed(el));
        const scroll=scroller(originalDoc);
        if(!scroll)throw new Error('Conteneur de defilement introuvable.');
        const bottom=scroll.scrollHeight-scroll.clientHeight-scroll.scrollTop<=4;
        const key=scroll.scrollHeight+':'+scroll.clientHeight;
        if(!bottom||key!==bottomKey)bottomSince=Date.now();
        if(!bottomSince)bottomSince=Date.now();bottomKey=key;
        const decision=netaiReadingDecision({button:target,bottom,stableBottom:Date.now()-bottomSince>=2000});
        if(decision==='finished'){notice('Fin de la page atteinte. Aucun changement de chapitre ni validation forcee.');return;}
        if(decision==='click'){
          protect();if(!visible(target)||!allowed(target))continue;
          if(++clickCount>100)throw new Error('Limite de 100 ouvertures atteinte.');
          clicked.add(target);target.click();await pause(800);bottomSince=Date.now();continue;
        }
        const before=scroll.scrollTop;
        scroll.scrollBy({top:Math.max(40,Math.min(220,scroll.clientHeight*0.35)),behavior:'instant'});
        await pause(800);
        if(!bottom&&Math.abs(scroll.scrollTop-before)<1){if(++stalls>=3)throw new Error('Defilement bloque : verification manuelle requise.');}else stalls=0;
      }
      throw new Error('Limite du parcours atteinte.');
    }catch(error){notice(error.message||'Parcours interrompu.');}
    finally{
      if(active){active=false;moduleWalkState.running=false;button.title=previousTitle;button.setAttribute('aria-pressed','false');originalDoc=null;}
    }
  }
  document.addEventListener('click',event=>{
    const button=event.composedPath().find(el=>el?.id==='netacad-ai-walker-btn');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();void run(button);
  },true);
})();
