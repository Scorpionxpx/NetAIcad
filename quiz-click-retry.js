async function retryConfirmedAnswerClick({click,verify,validate,check,notify,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
  async function pause(ms) {for(let elapsed=0;elapsed<ms;elapsed+=100){check();await sleep(Math.min(100,ms-elapsed));}check();}
  for(let attempt=0;attempt<=3;attempt++){
    check();
    if(attempt>0){notify(attempt);await pause(800);}
    await validate();check();
    if(verify())return true;
    await click();check();
    await validate();check();
    for(let elapsed=0;elapsed<=500;elapsed+=100){
      check();if(verify())return true;
      if(elapsed<500)await pause(100);
    }
  }
  throw new Error('Clic de reponse non confirme apres 3 nouvelles tentatives. Aucun envoi effectue.');
}
if(typeof module!=='undefined')module.exports={retryConfirmedAnswerClick};
