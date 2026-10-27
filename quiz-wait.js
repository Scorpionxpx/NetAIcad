async function waitForStableQuiz({read,key,check,finished,notify,transient,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
  async function delay(ms) {
    const end=now()+ms;
    while(now()<end){check();await sleep(Math.min(100,end-now()));}
    check();
  }
  notify('Pause de 1,5 s avant analyse...');
  await delay(1500);
  const deadline=now()+15000;
  let previous=null,stableSince=0;
  while(now()<deadline){
    check();
    if(finished())return null;
    let data=null;
    try{data=await read();}catch(error){if(!transient(error))throw error;}
    check();
    if(data){
      const fingerprint=key(data);
      if(fingerprint!==previous){previous=fingerprint;stableSince=now();}
      else if(now()-stableSince>=800)return data;
      notify('Attente de stabilisation de la question...');
    }else{previous=null;stableSince=0;notify('Transition du quiz : attente de la question visible...');}
    await delay(200);
  }
  throw new Error('La question reste instable ou plusieurs questions restent visibles apres 15 s. Aucun nouvel appel IA.');
}
if(typeof module!=='undefined')module.exports={waitForStableQuiz};
