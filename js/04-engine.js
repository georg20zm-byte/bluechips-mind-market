/* ═════════════ BATTLER v0.8 ═════════════ */
const MATCH_T=60, OT_T=20, LANES=3, MAX_AP=100, TOWER_CAP=4;
const PHASES=[
  {until:20,mult:1,lbl:'АДАПТАЦИЯ · ×1'},
  {until:40,mult:2,lbl:'РАЗГОН · ×2'},
  {until:60,mult:3,lbl:'РАЗВЯЗКА · ×3'},
];
const AP_BASE=10; // AP/сек в фазе ×1
const SCAN_COST=15,SCAN_CD=8,SCAN_DUR=1.5;
const HEAT_LIMIT=4,HEAT_DECAY=.9,STUN_T=2.0;
const REWARD_WIN=40,REWARD_LOSE=0;
const UNIT_WALL_DPS={fomo:1.5,report:4,leak:2.5,golem:6};

let S=null,battleCtx=null,myChamp=null,foeChamp=null;
function freshMatch(){
  return {running:false,paused:false,timeScale:1,t:0,phase:0,overtime:false,otT:0,
    ap:{me:20,foe:20},apSlow:{me:0,foe:0},apFrozen:{me:0,foe:0},
    hand:[],queue:[],foeHand:[],foeQueue:[],
    champCd:{me:0,foe:0},boostUntil:{me:0,foe:0},
    units:[],towers:[],shots:[],floats:[],zones:[],pulses:[],
    line:[],lineT:0,streak:{side:null,hits:0},
    oko:0,selected:-1,champSel:false,
    scanUntil:0,scanCd:0,stunUntil:0,heat:0,
    aiTick:0,hints:{}};
}
const cv=$('cv'),ctx=cv.getContext('2d');
let W=0,H=0;
function resize(){
  const d=Math.min(2,window.devicePixelRatio||1);
  const r=cv.parentElement.getBoundingClientRect();
  W=r.width;H=r.height;cv.width=W*d;cv.height=H*d;ctx.setTransform(d,0,0,d,0,0);
}
window.addEventListener('resize',resize);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const laneX=l=>W*(l+0.5)/LANES;
const shuffle=a=>a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(p=>p[1]);

function flashAlert(txt,color='#FF3B4E',ms=1500,glitch=false){
  const a=$('alert');a.textContent=txt;a.style.color=color;
  a.style.textShadow=`0 0 18px ${color}88`;
  a.classList.toggle('glitch',glitch);a.classList.add('show');
  clearTimeout(a._t);a._t=setTimeout(()=>a.classList.remove('show','glitch'),ms);
}
function hint(key,txt,ms=3400){
  if(S.hints[key])return;S.hints[key]=1;
  const h=$('hintTip');h.textContent=txt;h.classList.add('show');
  clearTimeout(h._t);h._t=setTimeout(()=>h.classList.remove('show'),ms);
}
function addFloat(x,y,txt,color){S.floats.push({x,y,txt,color,life:1.4});}

/* ── spawn / place ── */
function spawnUnits(side,key,lane){
  const d=CARD_DB[key];
  const lvl=side==='me'?META[key].level:foeLvl();
  const hp=Math.round(d.hp*lvlMult(lvl));
  const shiftLvl=d.shift*lvlMult(lvl,0.04);
  const dir=side==='me'?-1:1;
  const y0=side==='me'?H-14:14;
  for(let i=0;i<d.count;i++){
    S.units.push({side,key,lane,lvl,shiftLvl,
      x:laneX(lane)+(d.count>1?(i-(d.count-1)/2)*13:0)+(Math.random()*8-4),
      y:y0-dir*i*10,
      hp,maxHp:hp,spd:d.spd*(0.92+Math.random()*.16),dir,r:d.r,
      stealth:!!d.stealth,shift:d.shift,frozenUntil:0,blocked:false});
  }
  addFloat(laneX(lane),side==='me'?H-40:40,d.nm,side==='me'?'56,225,234':'255,59,78');
}
function spawnGolem(side,x,y){
  const dir=side==='me'?-1:1;
  S.units.push({side,key:'golem',lane:clamp(Math.floor(x/W*LANES),0,LANES-1),
    x,y,hp:20,maxHp:20,spd:34,dir,r:12,stealth:false,shift:.4,frozenUntil:0,blocked:false});
  addFloat(x,y-20,'ГОЛЕМ КАПИТАЛА',side==='me'?'56,225,234':'255,59,78');
}
const SEEN={}; // подсказки один раз за сессию
function ghint(key,txt,ms=4200){
  if(SEEN[key])return;SEEN[key]=1;
  const h=document.getElementById('hintTip');h.textContent=txt;h.classList.add('show');
  clearTimeout(h._t);h._t=setTimeout(()=>h.classList.remove('show'),ms);
}
function placeTower(side,key,x,y){
  const d=CARD_DB[key];
  const lvl=side==='me'?META[key].level:foeLvl();
  const tw={side,key,x,y,cd:.3,disabledUntil:0,lvl};
  if(key==='paywall'){tw.hp=Math.round(d.hp*lvlMult(lvl));tw.maxHp=tw.hp;}
  else tw.dieAt=S.t+d.life;
  S.towers.push(tw);
  if(side==='me'){
    addFloat(x,y-18,d.nm,'240,190,60');
    if(key==='ban')ghint('tw_ban','🔨 Эта башня выжигает ТОЛПУ — стаи 🌀 спама. Против 🐋 кита почти бесполезна');
    if(key==='sniper')ghint('tw_sniper','⌖ Эта башня валит КРУПНЫХ — 🐋 кита, голема. Толпу 🌀 не успевает отстреливать');
    if(key==='paywall')ghint('tw_wall','🧱 Стена не бьёт — она задерживает волну, пока твои башни её добивают');
  }
}
const towersOf=s=>S.towers.filter(t=>t.side===s);

/* ── spells ── */
function castSpell(side,key,x,y){
  const d=CARD_DB[key];
  if(key==='halt'){
    S.zones.push({kind:'halt',x,y,r:d.radius,until:S.t+d.dur});
    S.units.forEach(u=>{if(Math.hypot(u.x-x,u.y-y)<=d.radius)u.frozenUntil=Math.max(u.frozenUntil,S.t+d.dur);});
    flashAlert('🧊 ЗАМОРОЗКА ТОРГОВ · HALT',side==='me'?'#38E1EA':'#FF3B4E',1200);
  }
  if(key==='ddos'){
    S.zones.push({kind:'ddos',x,y,r:d.radius,until:S.t+d.dur});
    S.towers.forEach(t=>{if(t.side!==side&&Math.hypot(t.x-x,t.y-y)<=d.radius)t.disabledUntil=Math.max(t.disabledUntil,S.t+d.dur);});
    flashAlert('💻 DDOS: ФАКТ-ЧЕКИНГ ОТКЛЮЧЁН',side==='me'?'#F050C8':'#FF3B4E',1300);
  }
  if(key==='lever'){
    S.ap[side]=Math.min(MAX_AP,S.ap[side]+40);
    S.apSlow[side]=S.t+5;
    if(side==='me'){flashAlert('📈 КРЕДИТНОЕ ПЛЕЧО · +40 AP','#F0BE3C',1200);
      hint('lever','Прирост AP урезан вдвое на 5 секунд — плечо не бесплатно');}
  }
}
/* ── чемпионы ── */
function useChamp(side){
  const ch=side==='me'?myChamp:foeChamp;
  if(!ch)return false;
  const c=CHAMPS[ch];
  if(S.champCd[side]>0||S.ap[side]<c.cost)return false;
  if(ch==='whale'){
    const mine=towersOf(side).filter(t=>t.key!=='paywall');
    if(!mine.length){if(side==='me')flashAlert('НУЖНА БАШНЯ ДЛЯ ЖЕРТВЫ','#F0BE3C',1100);return false;}
    const t=mine[0];
    S.towers.splice(S.towers.indexOf(t),1);
    spawnGolem(side,t.x,t.y);
  }
  S.ap[side]-=c.cost;S.champCd[side]=c.cd;
  if(ch==='musk'){
    S.boostUntil[side]=S.t+3;
    flashAlert('🚀 КЛИКБЕЙТ-ТВИТ · СКОРОСТЬ ×1.7',side==='me'?'#38E1EA':'#FF3B4E',1300);
  }
  if(ch==='fed'){
    const other=side==='me'?'foe':'me';
    S.apFrozen[other]=S.t+5;
    S.oko=clamp(S.oko+(side==='me'?-0.06:0.06),-1,1);
    checkOtWin();
    flashAlert('🏛 СТАВКА ИЗМЕНЕНА · AP ОППОНЕНТА ЗАМОРОЖЕН',side==='me'?'#F0BE3C':'#FF3B4E',1500);
  }
  return true;
}

/* ── рука/колода: в руке всегда ≥1 атака и ≥1 защита ── */
const isAtkCard=k=>CARD_DB[k].t==='unit';
const isDefCard=k=>CARD_DB[k].t==='tower'||CARD_DB[k].t==='wall';
function drawGuaranteed(queue,hand){
  let need=null;
  if(!hand.some(isAtkCard))need=isAtkCard;
  else if(!hand.some(isDefCard))need=isDefCard;
  let idx=0;
  if(need){const f=queue.findIndex(need);if(f>=0)idx=f;}
  return queue.splice(idx,1)[0];
}
function buildHand(queue){
  const hand=[];
  for(let i=0;i<4;i++)hand.push(drawGuaranteed(queue,hand));
  return shuffle(hand);
}
function initDecks(){
  if(TUT.on){
    S.hand=['fomo','ban','report','paywall'];
    S.queue=['leak','sniper','lever'];
    S.foeQueue=shuffle(FOE_DECK.slice());S.foeHand=buildHand(S.foeQueue);
    renderHand();return;
  }
  S.queue=shuffle(playerDeck.filter(Boolean));S.hand=buildHand(S.queue);
  S.foeQueue=shuffle((curDiff().deck||FOE_DECK).slice());S.foeHand=buildHand(S.foeQueue);
  renderHand();
}
function cycleCard(slot){ // моя рука
  const played=S.hand[slot];
  const rest=S.hand.filter((_,i)=>i!==slot);
  S.queue.push(played);
  S.hand[slot]=drawGuaranteed(S.queue,rest);
  renderHand();
}
function foeCycle(idx){
  const played=S.foeHand[idx];
  const rest=S.foeHand.filter((_,i)=>i!==idx);
  S.foeQueue.push(played);
  S.foeHand[idx]=drawGuaranteed(S.foeQueue,rest);
}
const TYPE_BAND={unit:'⚔ АТАКА',tower:'🛡 ЗАЩИТА',wall:'🛡 ЗАЩИТА',spell:'⚡ МАГИЯ'};
function renderHand(){
  document.querySelectorAll('#handRow .bigcard[data-slot]').forEach(el=>{
    const slot=+el.dataset.slot,key=S.hand[slot],d=CARD_DB[key];
    el.className='bigcard '+(d.t==='unit'?'tUnit':d.t==='spell'?'tSpell':'tTower');
    el.innerHTML=`<div class="cost">${d.cost}</div><div class="lv">ур.${META[key].level}</div><div class="ico">${d.ico}</div><div class="fn">${d.fn}</div><div class="band">${TYPE_BAND[d.t]}</div>`;
  });
  $('nextIco').textContent=CARD_DB[S.queue[0]].ico;
  syncHand();
}
function syncHand(){
  document.querySelectorAll('#handRow .bigcard[data-slot]').forEach(el=>{
    const slot=+el.dataset.slot,d=CARD_DB[S.hand[slot]];
    el.classList.toggle('selected',S.selected===slot);
    el.classList.toggle('poor',S.ap.me<d.cost);
    el.classList.toggle('locked',S.stunUntil>S.t);
  });
  if(myChamp){
    const c=CHAMPS[myChamp];
    const cb=$('champBtn');
    cb.classList.toggle('selected',S.champSel);
    cb.classList.toggle('poor',S.ap.me<c.cost);
    cb.classList.toggle('locked',S.stunUntil>S.t);
    cb.querySelector('.cd').style.height=(S.champCd.me/c.cd*100||0)+'%';
  }
  $('scanBtn').querySelector('.cd').style.height=(S.scanCd/SCAN_CD*100||0)+'%';
}

/* ── ввод ── */
function selectSlot(slot){
  if(!S.running||S.stunUntil>S.t)return;
  if(TUT.on){
    if(TUT.allow===null)return; // до первого урока рука заблокирована
    if(S.paused&&S.hand[slot]!==TUT.allow)return; // во время урока — только нужная карта
  }
  const d=CARD_DB[S.hand[slot]];
  if(S.ap.me<d.cost){flashAlert('НЕ ХВАТАЕТ AP','#F0BE3C',800);return;}
  S.champSel=false;
  if(d.target==='none'){ // мгновенный спелл без цели
    S.ap.me-=d.cost;castSpell('me',S.hand[slot],0,0);cycleCard(slot);S.selected=-1;syncHand();return;
  }
  S.selected=S.selected===slot?-1:slot;syncHand();
  if(S.selected>=0){
    if(d.t==='unit')hint('selU','Тапни полосу — волна пойдёт по ней');
    else if(d.t==='tower'||d.t==='wall')hint('selT','Тапни точку на своей половине');
    else hint('selS','Тапни точку применения — радиус сработает там');
  }
}
/* ── общее размещение: используется тапом и драгом ── */
function canPick(slot){
  if(!S||!S.running||S.stunUntil>S.t)return false;
  if(TUT.on){
    if(TUT.allow===null)return false;
    if(S.paused&&S.hand[slot]!==TUT.allow)return false;
  }
  return true;
}
function addPulse(x,y,color){S.pulses.push({x,y,r:10,life:.4,color});}
function deployCard(slot,x,y){
  if(!canPick(slot))return false;
  const key=S.hand[slot],d=CARD_DB[key];
  if(S.ap.me<d.cost){flashAlert('НЕ ХВАТАЕТ AP','#F0BE3C',800);return false;}
  /* снапы туториала: действие гарантированно срабатывает эффектно */
  if(TUT.on&&S.paused){
    if(TUT.step===1&&key==='ban'){x=laneX(1);y=H*0.72;}
    
  }
  if(d.t==='unit'){
    const lane=clamp(Math.floor(x/W*LANES),0,LANES-1);
    S.ap.me-=d.cost;spawnUnits('me',key,lane);registerHeat();
    addPulse(laneX(lane),H-20,'56,225,234');
  }else if(d.t==='tower'||d.t==='wall'){
    if(y<H*0.52){flashAlert('ЗАЩИТА — ТОЛЬКО НА СВОЕЙ ПОЛОВИНЕ','#F0BE3C',1000);return false;}
    if(towersOf('me').length>=TOWER_CAP){flashAlert('ЛИМИТ ПОСТРОЕК','#F0BE3C',900);return false;}
    const px=clamp(x,20,W-20),py=clamp(y,H*0.55,H-30);
    S.ap.me-=d.cost;placeTower('me',key,px,py);
    addPulse(px,py,'240,190,60');
  }else{ // spell
    S.ap.me-=d.cost;castSpell('me',key,x,y);
    if(d.target==='point')addPulse(x,y,'240,80,200');
  }
  cycleCard(slot);S.selected=-1;syncHand();
  /* прогресс туториала */
  if(TUT.on&&S.paused){
    if(TUT.step===1&&key==='ban'){tutResume();TUT.step=2;
      S.timeScale=0.45;flashAlert('⏱ ЗАМЕДЛЕНИЕ · СМОТРИ, КАК ФИЛЬТР СЖИГАЕТ СЛУХИ','#F0BE3C',2600);
      setTimeout(()=>{if(S)S.timeScale=1;},3800);}
    else if(TUT.step===3&&key==='report'){tutResume();TUT.step=4;
      hint('tut2','Кит дойдёт до края — смотри на линию: она нальётся голубым');}
    else if(TUT.step===5&&key==='fomo'){tutResume();TUT.step=6;
      hint('tut5','Каждый добежавший утолщает голубую линию');}
  }
  return true;
}
function arenaTap(x,y){
  if(!S.running||S.stunUntil>S.t)return;
  if(TUT.on&&S.paused&&TUT.allow==='tap'){tutResume();TUT.step=3;return;} // урок Ока: тап продолжает
  if(S.champSel){S.champSel=false;if(useChamp('me'))syncHand();return;}
  if(S.selected<0)return;
  deployCard(S.selected,x,y);
}
function useScan(){
  if(TUT.on&&TUT.allow!=='scan')return; // в обучении скан открыт только в своём уроке
  if(!S.running||S.scanCd>0||S.ap.me<SCAN_COST||S.stunUntil>S.t)return;
  S.ap.me-=SCAN_COST;S.scanUntil=S.t+SCAN_DUR;S.scanCd=SCAN_CD;
  flashAlert('👁 ИНСАЙДЕРСКИЙ СКАН','#F050C8',900);
  if(TUT.on&&S.paused&&TUT.step===4){
    setTimeout(()=>{tutResume();TUT.step=5;
      hint('tut3','Скрытая башня вскрыта. Скан стоит 15 AP — трать его перед атакой');},1600);
  }
}
function registerHeat(){
  S.heat+=1;
  if(S.phase===2&&S.heat>=HEAT_LIMIT)shortSqueeze();
}
function shortSqueeze(){
  S.heat=0;
  S.units=S.units.filter(u=>u.side!=='me');
  S.stunUntil=S.t+STUN_T;S.selected=-1;S.champSel=false;
  S.oko=clamp(S.oko-.1,-1,1);checkOtWin();
  flashAlert('💥 ШОРТ-СКВИЗ · УЗЕЛ ВЗОРВАН · ПОЗИЦИЯ ОБНУЛЕНА','#FF3B4E',2000,true);
  $('stunOverlay').classList.add('show');
  setTimeout(()=>$('stunOverlay').classList.remove('show'),STUN_T*1000);
  hint('squeeze','В панике на бирже резкий сброс волн рвёт узел. Дозируй');
}

/* ── AI ── */
function aiThink(dt){
  if(TUT.on)return; // в туториале бот полностью заскриптован
  S.aiTick-=dt;if(S.aiTick>0)return;
  const D=curDiff();
  S.aiTick=D.tick;
  if(Math.random()<D.skip)return; // слабый бот часто «думает» вхолостую
  const ap=S.ap.foe;
  const handIdx=k=>S.foeHand.indexOf(k);
  const tryPlay=(k,fn)=>{
    const i=handIdx(k);if(i<0)return false;
    const d=CARD_DB[k];if(ap<d.cost)return false;
    S.ap.foe-=d.cost;fn(d);foeCycle(i);return true;
  };
  /* ── базовый режим: медленный бот, чередующий атаку и защиту ──
     basic2 (СКАЛЬПЕР) в 30% тиков подключает умную контр-логику — разнообразнее */
  const useSmart = D.mode==='smart' || (D.mode==='basic2'&&Math.random()<.3);
  if(!useSmart){
    const lane=Math.floor(Math.random()*LANES);
    const atk=S.foeHand.filter(k=>CARD_DB[k].t==='unit'&&ap>=CARD_DB[k].cost);
    const def=S.foeHand.filter(k=>(CARD_DB[k].t==='tower'||CARD_DB[k].t==='wall')&&ap>=CARD_DB[k].cost);
    if(Math.random()<.65&&atk.length){ // приоритет атаки — бот обязан давить
      const k=atk[Math.floor(Math.random()*atk.length)];
      tryPlay(k,()=>spawnUnits('foe',k,lane));return;
    }
    if(def.length&&towersOf('foe').length<TOWER_CAP){
      const k=def[Math.floor(Math.random()*def.length)];
      tryPlay(k,()=>placeTower('foe',k,laneX(lane)+(Math.random()*40-20),H*(0.14+Math.random()*.26)));return;
    }
    if(atk.length){ // защита недоступна — всё равно атакуем
      const k=atk[Math.floor(Math.random()*atk.length)];
      tryPlay(k,()=>spawnUnits('foe',k,lane));
    }
    return;
  }
  /* ── умный режим ── */
  const meUnits=S.units.filter(u=>u.side==='me');
  const threats=meUnits.filter(u=>u.y<H*0.6);
  const smallT=threats.filter(u=>u.key==='fomo').length;
  const bigT=threats.filter(u=>u.key==='report'||u.key==='golem').length;
  const myT=towersOf('foe');
  // чемпион
  if(S.champCd.foe<=0&&S.phase>=1&&Math.random()<D.champP){if(useChamp('foe'))return;}
  // защита
  if(myT.length<TOWER_CAP){
    if(smallT>=3&&tryPlay('ban',()=>placeTower('foe','ban',laneX(threats[0]?clamp(Math.floor(threats[0].x/W*LANES),0,2):1)+(Math.random()*24-12),H*(0.16+Math.random()*.2))))return;
    if(bigT>=1&&tryPlay('sniper',()=>placeTower('foe','sniper',threats[0].x+(Math.random()*24-12),H*(0.15+Math.random()*.2))))return;
    if(bigT>=1&&tryPlay('paywall',()=>placeTower('foe','paywall',threats[0].x,H*0.3)))return;
    if(bigT>=1&&tryPlay('lawsuit',()=>placeTower('foe','lawsuit',threats[0].x,H*(0.2+Math.random()*.15))))return;
  }
  // спеллы
  if(threats.length>=3&&tryPlay('halt',d=>castSpell('foe','halt',threats[0].x,threats[0].y)))return;
  const meTowers=towersOf('me');
  if(meTowers.length>=2&&S.phase>=1&&tryPlay('ddos',d=>castSpell('foe','ddos',meTowers[0].x,meTowers[0].y)))return;
  if(S.phase>=1&&ap<50&&Math.random()<.25&&tryPlay('lever',()=>castSpell('foe','lever',0,0)))return;
  // атака — слабозащищённая полоса
  const laneDef=[0,0,0];
  towersOf('me').forEach(t=>{laneDef[clamp(Math.floor(t.x/W*LANES),0,2)]++;});
  let lane=0;for(let i=1;i<LANES;i++)if(laneDef[i]<laneDef[lane])lane=i;
  if(Math.random()<.3)lane=Math.floor(Math.random()*LANES);
  const wantBig=S.phase===2?.6:S.phase===1?.4:.12;
  if(Math.random()<wantBig){
    if(tryPlay('report',()=>spawnUnits('foe','report',lane)))return;
    if(tryPlay('meme',()=>spawnUnits('foe','meme',lane)))return;
    if(tryPlay('leak',()=>spawnUnits('foe','leak',lane)))return;
  }else{
    if(Math.random()<.7&&tryPlay('fomo',()=>spawnUnits('foe','fomo',lane)))return;
    if(tryPlay('meme',()=>spawnUnits('foe','meme',lane)))return;
    if(tryPlay('leak',()=>spawnUnits('foe','leak',lane)))return;
  }
}

/* ── win check ── */
function checkOtWin(){
  if(S.overtime&&Math.abs(S.oko)>0.001)endMatch(S.oko>0?'me':'foe','ВНЕЗАПНАЯ СМЕРТЬ · ПЕРВАЯ СВЕЧА ТВОЯ');
}
function okoShift(side,amt){
  S.oko=clamp(S.oko+(side==='me'?amt:-amt),-1,1);
  S.okoFlash={side,until:S.t+1.3};
  if(S.streak.side===side)S.streak.hits++;      // серия успешных атак — линия толстеет
  else S.streak={side,hits:1};                   // смена лидера — толщина сброшена
  if(TUT.on&&TUT.step<6)S.oko=clamp(S.oko,-0.85,0.85); // до финала досрочной победы нет
  if(TUT.on&&TUT.step>=6&&side==='me'&&S.oko>0){
    setTimeout(()=>endMatch('me','ТВОЙ ПРОРЫВ ЗАКРЫЛ РЫНОК'),900); // победа заработана атакой
    return;
  }
  checkOtWin();
}

/* ── sim step ── */
function step(dt){
  if(S.paused)return; // хард-лок туториала: время стоит
  S.t+=dt;
  if(TUT.on)tutScript();
  if(!S.overtime){
    let ph=0;for(let i=0;i<PHASES.length;i++)if(S.t>PHASES[i].until)ph=Math.min(2,i+1);
    if(ph!==S.phase){
      S.phase=ph;
      $('phaseLbl').textContent=PHASES[ph].lbl;
      $('phaseLbl').style.color=ph===2?'var(--foe)':ph===1?'var(--me)':'var(--gold)';
      if(ph===1)flashAlert('ВЫСОКАЯ ВОЛАТИЛЬНОСТЬ · AP ×2','#38E1EA',1300);
      if(ph===2){flashAlert('ПАНИКА НА БИРЖЕ · AP ×3','#FF3B4E',1700);
        hint('panic','Ресурсы льются рекой — но узел рвётся от жадности');}
    }
  }
  // AP
  ['me','foe'].forEach(s=>{
    if(S.t<S.apFrozen[s])return;
    let g=AP_BASE*PHASES[S.phase].mult*dt;
    if(s==='foe')g*=curDiff().apMult; // хэндикап слабого бота
    if(S.t<S.apSlow[s])g*=0.5;
    S.ap[s]=Math.min(MAX_AP,S.ap[s]+g);
  });
  // линия-лента: семпл каждые 0.25с — кто доминирует и множитель серии
  S.lineT+=dt;
  while(S.lineT>=0.25){
    S.lineT-=0.25;
    const dom=S.oko>0.005?1:S.oko<-0.005?-1:0;
    const mult=S.streak.hits>=2?Math.min(6,S.streak.hits):1; // утолщение после 2 атак подряд, потолок ×6
    S.line.push({t:S.t,dom,mult});
  }
  S.champCd.me=Math.max(0,S.champCd.me-dt);
  S.champCd.foe=Math.max(0,S.champCd.foe-dt);
  S.scanCd=Math.max(0,S.scanCd-dt);
  S.heat=Math.max(0,S.heat-HEAT_DECAY*dt);
  aiThink(dt);
  // юниты: движение + стены
  S.units.forEach(u=>{
    u.blocked=false;
    if(S.t<u.frozenUntil)return;
    // стена на пути?
    const wall=S.towers.find(t=>t.key==='paywall'&&t.side!==u.side
      &&Math.abs(t.x-u.x)<W/LANES*0.45
      &&(u.dir<0? (u.y>t.y&&u.y-t.y<18) : (u.y<t.y&&t.y-u.y<18)));
    if(wall){
      u.blocked=true;
      wall.hp-=(UNIT_WALL_DPS[u.key]||2)*dt;
      return;
    }
    let spd=u.spd;
    if(S.t<S.boostUntil[u.side])spd*=1.7;
    if(S.towers.some(tw=>tw.key==='lawsuit'&&tw.side!==u.side&&S.t>=tw.disabledUntil&&Math.hypot(tw.x-u.x,tw.y-u.y)<=CARD_DB.lawsuit.range))spd*=CARD_DB.lawsuit.slow;
    u.y+=u.dir*spd*dt;
  });
  // стены: распад
  S.towers=S.towers.filter(t=>{
    if(t.key==='paywall'){t.hp-=0.8*dt;return t.hp>0;}
    return S.t<t.dieAt;
  });
  // прорывы
  const edgeTop=6,edgeBot=H-6;
  S.units=S.units.filter(u=>{
    if(u.side==='me'&&u.y<=edgeTop){okoShift('me',u.shiftLvl||u.shift);addFloat(u.x,20,'+ВЛИЯНИЕ','56,225,234');
      if(TUT.on&&u.key==='report'&&!TUT.reportDone){TUT.reportDone=true;TUT.reportAt=S.t;}
      return false;}
    if(u.side==='foe'&&u.y>=edgeBot){okoShift('foe',u.shiftLvl||u.shift);
      if(u.shift>=.28)flashAlert('⚠ ПРОРЫВ: ТЯЖЁЛЫЙ АРГУМЕНТ ДОШЁЛ','#FF3B4E',1300);return false;}
    return true;
  });
  if(!S.running)return; // мог закончиться в okoShift
  // башни
  S.towers.forEach(t=>{
    if(t.key==='paywall')return;
    if(S.t<t.disabledUntil)return;
    if(t.key==='lawsuit')return; // иск не стреляет — только замедляет
    t.cd-=dt;if(t.cd>0)return;
    const d=CARD_DB[t.key];
    let foes=S.units.filter(u=>u.side!==t.side&&Math.hypot(u.x-t.x,u.y-t.y)<=d.range);
    if(t.key==='sniper')foes=foes.filter(u=>!u.stealth); // слив невидим для снайпера
    if(!foes.length)return;
    let target;
    if(t.key==='sniper')target=foes.reduce((a,b)=>b.hp>a.hp?b:a);
    else target=foes.reduce((a,b)=>Math.hypot(b.x-t.x,b.y-t.y)<Math.hypot(a.x-t.x,a.y-t.y)?b:a);
    t.cd=d.rate;
    S.shots.push({x1:t.x,y1:t.y,x2:target.x,y2:target.y,life:.22,splash:d.splash||0,color:t.side==='me'?'240,190,60':'255,59,78'});
    const dmg=d.dmg*lvlMult(t.lvl);
    if(d.splash){S.units.forEach(u=>{if(u.side!==t.side&&Math.hypot(u.x-target.x,u.y-target.y)<=d.splash)u.hp-=dmg;});}
    else target.hp-=dmg;
  });
  S.units.forEach(u=>{if(u.hp<=0){
    addPulse(u.x,u.y,u.side==='me'?'56,225,234':'255,59,78');
    if(TUT.on)addFloat(u.x,u.y,'ОПРОВЕРГНУТО','240,190,60');
  }});
  S.units=S.units.filter(u=>u.hp>0);
  S.zones=S.zones.filter(z=>S.t<z.until);
  S.shots.forEach(s=>s.life-=dt);S.shots=S.shots.filter(s=>s.life>0);
  S.pulses.forEach(p=>{p.life-=dt;p.r+=140*dt;});S.pulses=S.pulses.filter(p=>p.life>0);
  S.floats.forEach(f=>{f.life-=dt;f.y-=12*dt;});S.floats=S.floats.filter(f=>f.life>0);
  // таймер / овертайм
  if(!S.overtime&&S.t>=MATCH_T){
    if(Math.abs(S.oko)>0.02)return endMatch(S.oko>0?'me':'foe','ПО ЗАКРЫТИЮ ГРАФИКА');
    S.overtime=true;S.otT=S.t;
    $('timer').classList.add('ot');
    $('phaseLbl').textContent='ОВЕРТАЙМ · ВНЕЗАПНАЯ СМЕРТЬ';
    $('phaseLbl').style.color='var(--foe)';
    flashAlert('⚡ ОВЕРТАЙМ: ПЕРВАЯ СВЕЧА РЕШАЕТ','#F0BE3C',2200,true);
  }
  if(S.overtime&&S.t-S.otT>=OT_T){
    const w=TUT.on?'me':(Math.random()<.5?'me':'foe');
    return endMatch(w,TUT.on?'ОБУЧЕНИЕ ПРОЙДЕНО':'РЫНОК ЗАМЕР · СЛУЧАЙНЫЙ ТИК');
  }
}

/* ── match flow ── */
function startMatch(){
  S=freshMatch();initDecks();
  $('timer').classList.remove('ot');
  $('matchRes').classList.add('hidden');
  $('countdown').classList.remove('hidden');
  let c=3;$('countNum').textContent=c;
  const iv=setInterval(()=>{
    c--;if(c>0)$('countNum').textContent=c;
    else{clearInterval(iv);$('countdown').classList.add('hidden');S.running=true;
      $('phaseLbl').textContent=PHASES[0].lbl;$('phaseLbl').style.color='var(--gold)';
      if(!TUT.on)hint('start','Перетаскивай карты на поле: ⚔ атака — на врага, 🛡 защита — к себе, ⚡ магия — в точку');}
  },800);
}
function endMatch(winner,how){
  if(!S.running)return;
  S.running=false;
  const wasTut=TUT.on;
  const win=winner==='me';
  if(!wasTut){
    if(win)duelWins++;
    liveMatches++;
    if(battleCtx&&battleCtx.ev){battleCtx.ev.duels.n++;if(win)battleCtx.ev.duels.w++;}
  }
  const reward=wasTut?100:(win?REWARD_WIN:REWARD_LOSE);
  quants+=reward;
  const xp=wasTut?30:(win?25:10);
  const leveled=addXP(xp);
  $('matchXP').textContent='+'+xp+' XP'+(leveled?' · 🎉 УРОВЕНЬ '+PLVL.lvl+'! Потолок карт: ур.'+cardCap():'');
  $('matchXP').style.color=leveled?'var(--gold)':'var(--me)';
  syncBalance();
  $('unlockRow').classList.add('hidden');
  if(wasTut)unlockCard('halt','<div class="usep"></div><div class="ut">В ИГРЕ ТРИ ВИДА КАРТ</div><div class="ulist"><div>⚔️ — атака</div><div>🛡️ — защита</div><div>⚡️ — магия</div></div>');
  else if(win&&duelWins===1)unlockCard('meme','<div class="ud">Переживают факт-чек, где толпа сгорает</div>');
  else if(win&&duelWins===2)unlockCard('lawsuit','<div class="ud">Урона нет — комбинируй с башнями</div>');
  if(wasTut){
    tutorialDone=true;TUT.on=false;syncDeckTab();
    $('matchTitle').textContent='ПЕРВАЯ ПОБЕДА';
    $('matchTitle').style.color='var(--me)';
    $('matchOko').textContent=how;
    $('matchSub').textContent='СТАРТОВЫЙ КАПИТАЛ · ЗАЩИТА, АТАКА И МАГИЯ ОСВОЕНЫ';
    $('matchReward').textContent='+'+reward+' ⟠ КВАНТОВ';
    $('matchReward').style.color='var(--gold)';
    $('matchRes').classList.remove('hidden');
    return;
  }
  $('matchTitle').textContent=win?'МНЕНИЕ ОТСТОЯНО':'ОППОНЕНТ ПЕРЕУБЕДИЛ РЫНОК';
  $('matchTitle').style.color=win?'var(--me)':'var(--foe)';
  $('matchOko').textContent=how;
  let sub=win?'ТВОЙ НАРРАТИВ ПОБЕДИЛ В ИНФОПОЛЕ':'ФАКТ-ЧЕКИНГ ОППОНЕНТА ОКАЗАЛСЯ СИЛЬНЕЕ';
  if(liveMatches===2)sub='⚠ ДАЛЬШЕ — РЕАЛЬНЫЕ БИТВЫ: МЕТКИ «?» ИСЧЕЗАЮТ, СОПЕРНИКИ ПРЯЧУТ ЗАЩИТУ. ВСКРЫВАЙ ЕЁ СКАНОМ 👁';
  if(liveMatches===CHAMP_UNLOCK_AT)sub='👑 НОВЫЙ ТИП КАРТ — ВИЗИОНЕРЫ (МАРКЕТМЕЙКЕРЫ): В СЛЕДУЮЩЕМ БОЮ ВЫБЕРЕШЬ СВОЕГО';
  $('matchSub').textContent=sub;
  $('matchReward').textContent=reward>0?'+'+reward+' ⟠ КВАНТОВ':'БЕЗ НАГРАДЫ · КВАНТЫ У ПОБЕДИТЕЛЯ';
  $('matchReward').style.color=reward>0?'var(--gold)':'var(--muted)';
  $('matchRes').classList.remove('hidden');
}

