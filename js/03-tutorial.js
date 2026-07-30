/* ── онбординг и разблокировка маркетмейкеров ── */
let tutorialDone=false, liveMatches=0;
const CHAMP_UNLOCK_AT=3;
const TUT={on:false,step:0,allow:null,spawned1:false,p1:false,p2:false,wave:false,p3:false};
function tutReset(){TUT.on=true;TUT.step=1;TUT.allow=null;TUT.spawned1=TUT.p1=TUT.p2=TUT.p3s=TUT.hidTower=TUT.wave=TUT.p3=false;}
function slotOf(key){return S.hand.indexOf(key);}
function ensureInHand(key){ // карта урока обязана быть в руке — иначе софтлок
  if(S.hand.includes(key))return;
  const qi=S.queue.indexOf(key);
  if(qi<0)return;
  const protect=['ban','report','fomo']; // карты будущих уроков не выбрасываем
  let slot=S.hand.findIndex(k=>!protect.includes(k));
  if(slot<0)slot=0;
  const swapped=S.hand[slot];
  S.hand[slot]=key;S.queue[qi]=swapped;
  renderHand();
}
function tutPause(allowKey,html,hiSlot,hiScan){
  if(allowKey&&allowKey!=='scan'&&allowKey!=='tap'){ensureInHand(allowKey);hiSlot=slotOf(allowKey);}
  S.paused=true;TUT.allow=allowKey;
  document.getElementById('tutShade').classList.remove('hidden');
  const tt=document.getElementById('tutText');tt.innerHTML=html;tt.classList.remove('hidden');
  document.querySelectorAll('#handRow .bigcard[data-slot]').forEach(el=>{
    el.classList.toggle('tutHi',+el.dataset.slot===hiSlot);
  });
  document.getElementById('scanBtn').classList.toggle('tutHi',!!hiScan);
}
function tutResume(){
  S.paused=false;TUT.allow='free';
  document.getElementById('tutShade').classList.add('hidden');
  document.getElementById('tutText').classList.add('hidden');
  document.querySelectorAll('.tutHi').forEach(el=>el.classList.remove('tutHi'));
}
function tutScript(){
  if(TUT.step===1){ // защита
    if(!TUT.spawned1&&S.t>=0.5){
      TUT.spawned1=true;spawnUnits('foe','fomo',1);
      S.units.filter(u=>u.side==='foe').forEach(u=>u.spd*=0.62); // медленнее для читаемости
    }
    if(S.t>=3&&!TUT.p1){TUT.p1=true;
      tutPause('ban','Паника! Перетащи <b>🔨 фильтр</b> на мишень — сбей волну',slotOf('ban'));}
  }else if(TUT.step===2){ // демонстрация Ока: тренер прорывается
    if(!TUT.demoSpawned&&S.t>=8){
      TUT.demoSpawned=true;
      S.units.push({side:'foe',key:'fomo',lane:0,x:laneX(0),y:14,hp:1,maxHp:1,spd:88,dir:1,r:4,stealth:false,shift:CARD_DB.fomo.shift,frozenUntil:0,blocked:false,tutDemo:true,seed:Math.random()*6.28});
      addFloat(laneX(0),40,'СЛУХ ПРОСОЧИЛСЯ','255,59,78');
    }
    if(TUT.demoSpawned&&!S.units.some(u=>u.tutDemo)&&!TUT.pOko){TUT.pOko=true;
      tutPause('tap','Слух дошёл до твоей границы — <b>линия горит красным</b> 📉.<br>Голубая линия — давишь ты, красная — давят тебя.<br>Серия атак делает её толще. Чей цвет на закрытии — тот победил. <b>Тапни</b>, чтобы продолжить');}
  }else if(TUT.step===3){ // атака
    if(S.t>=15&&!TUT.p2){TUT.p2=true;S.ap.me=Math.max(S.ap.me,50);
      tutPause('report','Ответь! Перетащи <b>🐋 кита</b> — его прорыв перекрасит линию в голубой 📈',slotOf('report'));}
  }else if(TUT.step===4){ // скан
    if(!TUT.hidTower&&S.t>=20){TUT.hidTower=true;placeTower('foe','sniper',W-36,H*0.22);}
    if(S.t>=24&&!TUT.p3s){TUT.p3s=true;S.ap.me=Math.max(S.ap.me,20);
      tutPause('scan','Серый «?» наверху — скрытая защита. Жми <b>👁 СКАН</b>',-1,true);}
  }else if(TUT.step===5){ // финальная атака — только после того, как кит дошёл (или страховка по времени)
    const ready = TUT.reportDone ? S.t>=TUT.reportAt+1.3 : S.t>=34;
    if(ready&&!TUT.p3){TUT.p3=true;S.ap.me=Math.max(S.ap.me,30);
      tutPause('fomo','Кит дошёл — линия голубая! Закрепи тренд: перетащи <b>🌀 толпу</b> и забери рынок',slotOf('fomo'));}
  }
}


