/* ── конструктор колоды ── */
let deckSel=-1,deckIv=null,deckOnReady=null;
function cardMini(key,opts){
  const d=CARD_DB[key],m=META[key];
  const cls='mini '+(d.t==='unit'?'tUnit':d.t==='spell'?'tSpell':'tTower')
    +(opts.sel?' sel':'')+(opts.inDeck?' inDeck':'')+(opts.lock?' lock':'');
  let inner=`<div class="cost">${d.cost}</div><div class="lv">ур.${m.level}</div><div class="ico">${d.ico}</div><div class="band">${TYPE_BAND[d.t]}</div>`;
  if(opts.lock)inner+=`<div class="how">🔒 ${m.how||''}</div>`;
  if(opts.upA)inner+=`<div class="upA">⬆</div>`; // можно прокачать: стрелка под уровнем
  return `<div class="${cls}" data-k="${key}" data-where="${opts.where}">${inner}</div>`;
}
function renderDeckUI(){
  $('deckRow').innerHTML=playerDeck.map((k,i)=>k?cardMini(k,{where:'deck'}).replace('data-k','data-i="'+i+'" data-k'):'<div class="mini empty" data-i="'+i+'">+</div>').join('');
  const keys=Object.keys(META);
  $('collGrid').innerHTML=keys.map(k=>cardMini(k,{where:'coll',lock:!META[k].unlocked,inDeck:playerDeck.includes(k),
    upA:META[k].unlocked&&META[k].level<Math.min(10,cardCap())&&quants>=upCost(META[k].level)})).join('');
  // слот портфеля: тап = страница карты
  $('deckRow').querySelectorAll('.mini').forEach(el=>el.addEventListener('pointerdown',()=>{
    const k=playerDeck[+el.dataset.i];if(k)openCard(k);
  }));
  if(deckOB){ // онбординг: подсвечиваем карту-источник и пустой слот
    const src=$('collGrid').querySelector('.mini[data-k="halt"]');
    if(src)src.classList.add('obHi');
    const ei=playerDeck.indexOf(null);
    const tgt=$('deckRow').children[ei>=0?ei:playerDeck.length-1];
    if(tgt)tgt.classList.add('dropHi');
  }
  // коллекция: драг в слот = замена, тап = страница карты
  $('collGrid').querySelectorAll('.mini').forEach(el=>{
    el.addEventListener('pointerdown',e=>{
      try{el.setPointerCapture(e.pointerId);}catch(_){}
      collDrag={key:el.dataset.k,x0:e.clientX,y0:e.clientY,active:false,src:el};
    });
  });
}
/* ── драг из коллекции в портфель ── */
let collDrag=null;
function slotAt(x,y){
  let hit=-1;
  $('deckRow').querySelectorAll('.mini').forEach((el,i)=>{
    const r=el.getBoundingClientRect();
    if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)hit=i;
  });
  return hit;
}
window.addEventListener('pointermove',e=>{
  if(!collDrag)return;
  if(!collDrag.active){
    if(Math.hypot(e.clientX-collDrag.x0,e.clientY-collDrag.y0)<=15)return;
    if(!META[collDrag.key].unlocked){collDrag=null;return;} // закрытые не тащим
    collDrag.active=true;
    const g=document.createElement('div');g.id='dragGhost';
    g.innerHTML=cardMini(collDrag.key,{where:'ghost'});
    document.body.appendChild(g);collDrag.ghost=g;
  }
  collDrag.ghost.style.left=e.clientX+'px';collDrag.ghost.style.top=e.clientY+'px';
  const hit=slotAt(e.clientX,e.clientY);
  $('deckRow').querySelectorAll('.mini').forEach((el,i)=>el.classList.toggle('dropHi',i===hit));
},{passive:true});
window.addEventListener('pointerup',e=>{
  const cd=collDrag;collDrag=null;
  if(!cd)return;
  if(!cd.active){if(!deckOB)openCard(cd.key);return;} // короткий тап — страница карты (в онбординге ждём жест)
  if(cd.ghost)cd.ghost.remove();
  $('deckRow').querySelectorAll('.dropHi').forEach(el=>el.classList.remove('dropHi'));
  const idx=slotAt(e.clientX,e.clientY);
  if(idx<0)return;
  const k=cd.key,j=playerDeck.indexOf(k);
  if(j===idx)return;
  if(j>=0)playerDeck[j]=playerDeck[idx]; // карта уже в портфеле — меняем местами
  playerDeck[idx]=k;
  renderDeckUI();
  if(deckOB)finishDeckOB();
});
window.addEventListener('pointercancel',()=>{
  if(collDrag&&collDrag.ghost)collDrag.ghost.remove();
  collDrag=null;
  document.querySelectorAll('.dropHi').forEach(el=>el.classList.remove('dropHi'));
});
/* ── страница карты: описание, характеристики, прокачка ── */
function statRows(key){
  const d=CARD_DB[key],lv=META[key].level,rows=[['СТОИМОСТЬ',d.cost+' AP']];
  if(d.t==='unit'){
    rows.push(['БОЙЦОВ В ВОЛНЕ',d.count],['HP',Math.round(d.hp*lvlMult(lv))],
      ['СКОРОСТЬ',d.spd],['ВЛИЯНИЕ НА ОКО','+'+(d.shift*lvlMult(lv,0.04)*100).toFixed(1)+'%'+(d.stealth?' · 🕶':'')]);
  }else if(key==='paywall'){rows.push(['ПРОЧНОСТЬ',Math.round(d.hp*lvlMult(lv))]);}
  else if(key==='lawsuit'){rows.push(['ЗАМЕДЛЕНИЕ','45%'],['РАДИУС',d.range],['ВРЕМЯ ЖИЗНИ',d.life+'с']);}
  else if(d.t==='tower'){rows.push(['УРОН',+(d.dmg*lvlMult(lv)).toFixed(1)],['ТЕМП','выстрел / '+d.rate+'с'],['РАДИУС',d.range],['ВРЕМЯ ЖИЗНИ',d.life+'с']);}
  else if(key==='halt'){rows.push(['ЗОНА',d.radius],['СТОП','3с']);}
  else if(key==='lever'){rows.push(['ЭФФЕКТ','+40 AP'],['ШТРАФ','прирост ×0.5 · 5с']);}
  else if(key==='ddos'){rows.push(['ЗОНА',d.radius],['ОТКЛЮЧЕНИЕ','4с']);}
  return rows;
}
let cardKey=null;
function openCard(key){
  cardKey=key;
  const d=CARD_DB[key],m=META[key];
  const tc=d.t==='unit'?'var(--me)':d.t==='spell'?'var(--pink)':'var(--gold)';
  $('cbBand').textContent=TYPE_BAND[d.t];$('cbBand').style.background=tc;
  $('cbIco').textContent=d.ico;$('cbName').textContent=d.nm;
  $('cbLvl').textContent='УРОВЕНЬ '+m.level+' / 10';
  $('cbDesc').textContent=CARD_DESC[key]||d.fn;
  $('cbStats').innerHTML=statRows(key).map(r=>`<div class="cbRow"><span class="l">${r[0]}</span><span class="v">${r[1]}</span></div>`).join('');
  const lockEl=$('cbLock'),up=$('cbUp'),note=$('cbUpNote');
  if(!m.unlocked){
    lockEl.textContent='🔒 '+(m.how||'');lockEl.classList.remove('hidden');
    up.classList.add('off');up.textContent='ЗАКРЫТА';note.textContent='';
  }else{
    lockEl.classList.add('hidden');
    if(m.level>=10){up.classList.add('off');up.textContent='МАКСИМАЛЬНЫЙ УРОВЕНЬ';note.textContent='';}
    else if(m.level>=cardCap()){ // потолок по уровню игрока — контроль баланса
      up.classList.add('off');up.textContent='⬆ ПРОКАЧАТЬ ДО УР.'+(m.level+1);
      note.textContent='🔒 НУЖЕН УРОВЕНЬ ИГРОКА '+(m.level-1)+' · СЕЙЧАС УР.'+PLVL.lvl;
    }
    else{
      const c=upCost(m.level);
      up.textContent='⬆ ПРОКАЧАТЬ ДО УР.'+(m.level+1)+' · '+c+' ⟠';
      up.classList.toggle('off',quants<c);
      note.textContent=quants<c?'НЕ ХВАТАЕТ КВАНТОВ · У ТЕБЯ '+Math.floor(quants)+' ⟠':'HP И УРОН +8% · ВЛИЯНИЕ +4%';
    }
  }
  syncPlayerUI();
  $('cardWrap').classList.remove('hidden');
}
$('cbUp').addEventListener('pointerdown',e=>{
  const m=META[cardKey];if(!m||!m.unlocked||m.level>=10||m.level>=cardCap())return;
  const c=upCost(m.level);if(quants<c)return;
  const from=quants;m.level++;
  openCard(cardKey);renderDeckUI();
  // минималистичная анимация аппа: пульс уровня, вспышка статов, улетающее списание, плавный счётчик
  $('cbLvl').classList.remove('pop');void $('cbLvl').offsetWidth;$('cbLvl').classList.add('pop');
  $('cbStats').classList.remove('flash');void $('cbStats').offsetWidth;$('cbStats').classList.add('flash');
  const fly=document.createElement('div');fly.className='qfly';fly.textContent='−'+c+' ⟠';
  fly.style.left='50%';fly.style.top=($('cbUp').offsetTop-6)+'px';fly.style.transform='translateX(-50%)';
  $('cardBox').appendChild(fly);setTimeout(()=>fly.remove(),850);
  animateQ(from,from-c);
});
$('cbClose').addEventListener('pointerdown',()=>$('cardWrap').classList.add('hidden'));
$('cardWrap').addEventListener('pointerdown',e=>{if(e.target.id==='cardWrap')$('cardWrap').classList.add('hidden');});
let deckOB=false,deckOBPrematch=false,obRaf=null;
function startDeckTimer(){
  let left=10;$('deckTimer').textContent='0:'+String(left).padStart(2,'0');
  deckIv=setInterval(()=>{left--;
    $('deckTimer').textContent='0:'+String(Math.max(0,left)).padStart(2,'0');
    if(left<=0)deckReady();
  },1000);
}
function openDeck(prematch,onReady){
  deckOnReady=onReady||null;
  $('deckOpp').textContent=prematch?('VS '+$('duelFoeName').textContent+' · '+curDiff().lbl):'';
  $('deckIntro').style.display=SEEN.deckIntro?'none':'block';SEEN.deckIntro=1;
  renderDeckUI();syncPlayerUI();
  $('deckWrap').classList.remove('hidden');
  clearInterval(deckIv);
  $('deckReady').textContent=prematch?'ГОТОВ · В БОЙ':'ГОТОВО';
  if(!SEEN.deckOB){ // первый вход: онбординг драга, таймер и ГОТОВ ждут
    SEEN.deckOB=1;deckOB=true;deckOBPrematch=prematch;
    $('deckOB').innerHTML='🧊 <b>Заморозка</b> открыта! В наборе есть свободный слот.<br><b>Перетащи её</b> из коллекции в пустую ячейку';
    $('deckOB').classList.remove('hidden');
    $('deckReady').classList.add('off');
    $('deckTimer').textContent=prematch?'⏸':'';
    renderDeckUI();obHandStart();
    return;
  }
  if(prematch)startDeckTimer();else $('deckTimer').textContent='';
}
/* перчатка-демонстратор жеста (DOM) */
function obHandStart(){
  let hand=document.getElementById('obHand');
  if(!hand){
    hand=document.createElement('div');hand.id='obHand';
    hand.innerHTML='<svg viewBox="0 0 46 52"><ellipse cx="14" cy="18" rx="8" ry="16" fill="#F5F5F2" transform="rotate(-18 14 18)"/><ellipse cx="26" cy="34" rx="16" ry="13" fill="#F5F5F2" transform="rotate(-14 26 34)"/><ellipse cx="38" cy="44" rx="8" ry="10" fill="#D9DCE2" transform="rotate(-28 38 44)"/></svg>';
    document.body.appendChild(hand);
  }
  const CYCLE=1.9;let t0=performance.now();
  function frame(ts){
    if(!deckOB){hand.remove();obRaf=null;return;}
    obRaf=requestAnimationFrame(frame);
    const src=document.querySelector('#collGrid .mini[data-k="halt"]');
    const ei=playerDeck.indexOf(null);
    const dst=$('deckRow').children[ei>=0?ei:1];
    if(!src||!dst)return;
    const sr=src.getBoundingClientRect(),dr=dst.getBoundingClientRect();
    const sx=sr.left+sr.width/2,sy=sr.top+sr.height/2;
    const tx=dr.left+dr.width/2,ty=dr.top+dr.height/2;
    const ph=((ts-t0)/1000%CYCLE)/CYCLE;
    let x,y,sc=1;
    if(ph<0.6){const k=ph/0.6,e=k*k*(3-2*k);
      const cx=(sx+tx)/2+50,cy=(sy+ty)/2;
      x=(1-e)*(1-e)*sx+2*(1-e)*e*cx+e*e*tx;
      y=(1-e)*(1-e)*sy+2*(1-e)*e*cy+e*e*ty;
    }else{x=tx;y=ty;sc=1-Math.sin((ph-0.6)/0.4*Math.PI)*0.16;}
    hand.style.left=(x-10)+'px';hand.style.top=(y-4)+'px';
    hand.style.transform='scale('+sc+')';
  }
  obRaf=requestAnimationFrame(frame);
}
function finishDeckOB(){
  deckOB=false;
  $('deckOB').classList.add('hidden');
  $('deckReady').classList.remove('off');
  document.querySelectorAll('.obHi').forEach(el=>el.classList.remove('obHi'));
  $('deckRow').children[1]&&$('deckRow').children[1].classList.remove('dropHi');
  ghint('deckOBdone','Жест освоен! Так собирают портфель под соперника');
  if(deckOBPrematch)startDeckTimer();
}
function deckReady(){
  clearInterval(deckIv);deckIv=null;
  $('deckWrap').classList.add('hidden');
  if(deckOnReady){const f=deckOnReady;deckOnReady=null;f();}
}
$('deckReady').addEventListener('pointerdown',deckReady);

/* ── анлок карты: витрина на экране результата ── */
function unlockCard(key,extraHtml){
  META[key].unlocked=true;
  const d=CARD_DB[key];
  const TICO={unit:'⚔️',tower:'🛡️',wall:'🛡️',spell:'⚡️'};
  $('unlockRow').innerHTML=`<div class="ut">НОВАЯ КАРТА ОТКРЫТА</div>
    <div class="un">${TICO[d.t]} ${d.nm} ${d.ico}</div>
    <div class="ud">${d.fn}</div>${extraHtml||''}`;
  $('unlockRow').classList.remove('hidden');
}

let duelEv=null,duelMySide=null;
function openDuel(){
  duelEv=sheetEv;duelMySide=sheetSide;
  const D=curDiff();
  $('duelFoeName').textContent=D.nm+'_'+FOE_NAMES[Math.floor(Math.random()*FOE_NAMES.length)];
  $('duelFoeSide').textContent=(duelMySide==='yes'?'НЕТ':'ДА')+' · '+D.lbl+' · ур.'+foeLvl();
  $('duelWrap').classList.remove('hidden');
}
$('duelLater').addEventListener('pointerdown',()=>$('duelWrap').classList.add('hidden'));
$('duelGo').addEventListener('pointerdown',()=>{
  $('duelWrap').classList.add('hidden');
  if(!tutorialDone){tutReset();myChamp=null;foeChamp=null;enterBattle();return;}
  const start=()=>{
    if(liveMatches<CHAMP_UNLOCK_AT){myChamp=null;foeChamp=null;enterBattle();}
    else openChampSelect();
  };
  openDeck(true,start); // 10 секунд на пересборку колоды под соперника
});

