/* ── champion select & переходы ── */
function openChampSelect(){
  const keys=Object.keys(CHAMPS);
  foeChamp=keys[Math.floor(Math.random()*keys.length)];
  $('champFoeInfo').innerHTML='Оппонент взял: <b>'+CHAMPS[foeChamp].ico+' '+CHAMPS[foeChamp].nm+'</b> — готовься к этому';
  const row=$('champRow');row.innerHTML='';
  keys.forEach(k=>{
    const c=CHAMPS[k];
    const el=document.createElement('div');el.className='champCard';
    el.innerHTML=`<div class="ci">${c.ico}</div><div class="cn">${c.nm}</div><div class="cdsc">${c.desc}</div><div class="cn" style="margin-top:6px;color:var(--dim)">${c.cost} AP · КД ${c.cd}с</div>`;
    el.addEventListener('pointerdown',()=>{myChamp=k;$('champWrap').classList.add('hidden');enterBattle();});
    row.appendChild(el);
  });
  $('champWrap').classList.remove('hidden');
}
function enterBattle(){
  battleCtx={ev:duelEv,mySide:duelMySide};
  $('scrMarket').classList.add('hidden');
  $('scrBattle').classList.remove('hidden');
  $('handRow').classList.toggle('nochamp',!myChamp);
  $('meLbl').textContent='ТЫ · ур.'+PLVL.lvl;
  if(TUT.on){
    $('foeLbl').textContent='БОТ-ТРЕНЕР';
    $('foeChampIco').textContent='';$('meChampIco').textContent='';
    $('bQuestion').textContent='ОБУЧАЮЩИЙ МАТЧ · освой защиту, атаку и магию за 60 секунд';
  }else{
    $('foeLbl').textContent=$('duelFoeName').textContent+' · ур.'+foeLvl();
    $('foeChampIco').textContent=foeChamp?CHAMPS[foeChamp].ico:'';
    $('meChampIco').textContent=myChamp?CHAMPS[myChamp].ico:'';
    $('bQuestion').textContent='«'+duelEv.q+'» · ты: '+(duelMySide==='yes'?'ДА':'НЕТ')+' vs оппонент: '+(duelMySide==='yes'?'НЕТ':'ДА');
  }
  if(myChamp){
    $('champIco').textContent=CHAMPS[myChamp].ico;
    $('champNm').textContent=CHAMPS[myChamp].nm;
    $('champCost').textContent=CHAMPS[myChamp].cost;
  }
  resize();startMatch();
}
$('backBtn').addEventListener('pointerdown',()=>{
  $('scrBattle').classList.add('hidden');
  $('scrMarket').classList.remove('hidden');
  renderMarket();
});
/* ── input wiring ── */
/* ── драг как основной способ, тап-тап как запасной ── */
let dragP=null; // {slot,x0,y0,active,px,py}
document.querySelectorAll('#handRow .bigcard[data-slot]').forEach(el=>{
  el.addEventListener('pointerdown',e=>{
    try{el.setPointerCapture(e.pointerId);}catch(_){}
    dragP={slot:+el.dataset.slot,x0:e.clientX,y0:e.clientY,active:false,px:0,py:0};
  });
});
window.addEventListener('pointermove',e=>{
  if(!dragP)return;
  if(!dragP.active){
    if(Math.hypot(e.clientX-dragP.x0,e.clientY-dragP.y0)<=20)return;
    if(!canPick(dragP.slot)||S.ap.me<CARD_DB[S.hand[dragP.slot]].cost){dragP=null;return;}
    dragP.active=true;S.selected=-1;S.champSel=false;syncHand();
  }
  const r=cv.getBoundingClientRect();
  dragP.px=e.clientX-r.left;dragP.py=e.clientY-r.top;
},{passive:true});
window.addEventListener('pointerup',e=>{
  const dp=dragP;dragP=null;
  if(!dp)return;
  if(!dp.active){selectSlot(dp.slot);return;} // короткий тап — старое поведение
  const r=cv.getBoundingClientRect();
  const x=e.clientX-r.left,y=e.clientY-r.top;
  if(x>=-10&&x<=W+10&&y>=0&&y<=H+10)deployCard(dp.slot,clamp(x,0,W-1),clamp(y,0,H-1));
  syncHand();
});
window.addEventListener('pointercancel',()=>{dragP=null;});
$('champBtn').addEventListener('pointerdown',()=>{
  if(!S||!S.running||S.stunUntil>S.t)return;
  const c=CHAMPS[myChamp];
  if(S.champCd.me>0)return;
  if(S.ap.me<c.cost){flashAlert('НЕ ХВАТАЕТ AP','#F0BE3C',800);return;}
  S.selected=-1;
  if(useChamp('me'))syncHand();
});
$('scanBtn').addEventListener('pointerdown',useScan);
cv.addEventListener('pointerdown',e=>{
  const r=cv.getBoundingClientRect();
  arenaTap(e.clientX-r.left,e.clientY-r.top);
});

/* ── boot ── */
syncBalance();renderCats();renderMarket();renderShop();syncDeckTab();loadLiveEvents();
resize();requestAnimationFrame(ts=>{lastT=ts;loop(ts);});
