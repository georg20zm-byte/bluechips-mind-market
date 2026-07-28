/* ═════════════ КАРТЫ / КОЛОДА ═════════════ */
const CARD_DB={
  fomo:   {t:'unit', ico:'🌀', nm:'FOMO-СПАМ',    fn:'ТОЛПА · БЫСТРЫЕ',  cost:25, count:4, hp:1,  spd:88, shift:.05, r:4},
  report: {t:'unit', ico:'🐋', nm:'АНАЛИТ. ОТЧЁТ',fn:'ТАНК · МОЩНЫЙ',    cost:45, count:1, hp:14, spd:40, shift:.30, r:10},
  leak:   {t:'unit', ico:'🕵️', nm:'ИНСАЙД. СЛИВ', fn:'НЕВИДИМКА',        cost:35, count:1, hp:5,  spd:62, shift:.18, r:6, stealth:true},
  sniper: {t:'tower',ico:'⌖',  nm:'ОПРОВЕРЖЕНИЕ', fn:'БЬЁТ СИЛЬНЫХ',     cost:40, dmg:6, rate:1.6, range:125, life:22},
  ban:    {t:'tower',ico:'🔨', nm:'БАН-ХАММЕР',   fn:'БЬЁТ ТОЛПУ',       cost:40, dmg:1, rate:0.8, range:88, splash:60, life:22},
  paywall:{t:'wall', ico:'🧱', nm:'PAYWALL',       fn:'СТЕНА-ПРЕГРАДА',   cost:30, hp:24},
  halt:   {t:'spell',ico:'🧊', nm:'ЗАМОРОЗКА',    fn:'СТОП-ЗОНА 3С',     cost:30, radius:90, dur:3, target:'point'},
  lever:  {t:'spell',ico:'📈', nm:'КРЕД. ПЛЕЧО',  fn:'+40 ЭНЕРГИИ',      cost:20, target:'none'},
  ddos:   {t:'spell',ico:'💻', nm:'DDOS-АТАКА',   fn:'ГЛУШИТ ЗАЩИТУ',    cost:35, radius:100, dur:4, target:'point'},
};
const CHAMPS={
  musk: {ico:'🚀', nm:'ВИЗИОНЕР',  desc:'Кликбейт-твит: твои юниты ×1.7 скорости на 3с', cost:30, cd:15},
  fed:  {ico:'🏛', nm:'РЕГУЛЯТОР', desc:'Ставка: AP оппонента заморожен на 5с, штраф −Око', cost:35, cd:18},
  whale:{ico:'🐳', nm:'ХЕДЖ-ФОНД', desc:'Жертвует твою башню — превращает её в голема 20HP', cost:40, cd:20},
};
/* новые карты: средняя атака и замедляющая защита */
CARD_DB.meme   ={t:'unit', ico:'🔥', nm:'ВИРУСНЫЙ МЕМ', fn:'ДВОЕ · ЖИВУЧИЕ',   cost:30, count:2, hp:4, spd:70, shift:.10, r:5};
CARD_DB.lawsuit={t:'tower',ico:'⚖️', nm:'СУДЕБНЫЙ ИСК', fn:'ЗАМЕДЛЯЕТ ВОЛНЫ',  cost:35, dmg:0, rate:999, range:110, life:18, slow:.55};

/* развёрнутые описания для страницы карты */
const CARD_DESC={
  fomo:'Стая из четырёх быстрых слухов. Дешёвая разведка и добивание — сгорает от факт-чека.',
  report:'Медленный тяжёлый аргумент с большим запасом прочности. Главный двигатель Ока.',
  leak:'Невидимка: официальное опровержение его не видит. Сбивается только бан-хаммером.',
  meme:'Двое живучих: переживают AoE-факт-чек, где толпа сгорает. Уязвимы для снайпера.',
  sniper:'Редкие мощные выстрелы по самой жирной цели. Контрит китов и големов, толпу пропускает.',
  ban:'Быстрый урон по площади. Выжигает стаи спама, против тяжей почти бесполезен.',
  paywall:'Стена: не бьёт, но задерживает волну, пока башни её добивают. Разрушается и тает.',
  lawsuit:'Замедляет все вражеские волны в радиусе на 45%. Урона нет — силён только в связке.',
  halt:'Мгновенно останавливает всех юнитов в зоне на 3 секунды. Окно для контратаки.',
  lever:'Мгновенно +40 AP, но прирост урезан вдвое на 5 секунд. Разгон перед большой волной.',
  ddos:'Отключает вражеский факт-чекинг в радиусе на 4 секунды.',
};
/* ── коллекция: анлоки и уровни (1..10) ── */
const META={
  fomo:   {unlocked:true, level:1},
  report: {unlocked:true, level:1},
  leak:   {unlocked:true, level:1},
  sniper: {unlocked:true, level:1},
  ban:    {unlocked:true, level:1},
  paywall:{unlocked:true, level:1},
  lever:  {unlocked:true, level:1},
  halt:   {unlocked:false,level:1, how:'Пройди обучение'},
  meme:   {unlocked:false,level:1, how:'Победа в 1-й живой битве'},
  lawsuit:{unlocked:false,level:1, how:'Победа во 2-й живой битве'},
  ddos:   {unlocked:false,level:1, how:'Скоро — сезонная награда'},
};
const lvlMult=(lvl,k)=>1+(k===undefined?0.08:k)*((lvl||1)-1);
const upCost=lvl=>15*lvl;
let playerDeck=['fomo','report','leak','sniper','ban','paywall','lever',null]; // 8-й слот пуст до онбординга
const FOE_DECK =['fomo','report','leak','sniper','ban','paywall','halt','ddos'];

/* ── сложность бота: первый бой почти гарантированная победа, дальше рост ── */
const DIFFS=[
  {nm:'ХОМЯК',   lbl:'НОВИЧОК',  tick:1.9, apMult:0.55, skip:.35, mode:'basic',  champP:0,   lvl:1},
  {nm:'СКАЛЬПЕР',lbl:'ЛЮБИТЕЛЬ', tick:1.4, apMult:0.7,  skip:.2,  mode:'basic2', champP:0,   lvl:1},
  {nm:'ТРЕЙДЕР', lbl:'ОПЫТНЫЙ',  tick:1.2, apMult:0.85, skip:.12, mode:'smart',  champP:.15, lvl:2, deck:['fomo','report','leak','sniper','ban','paywall','halt','meme']},
  {nm:'АКУЛА',   lbl:'ПРО',      tick:0.8, apMult:1.0,  skip:0,   mode:'smart',  champP:.3,  lvl:3, deck:['fomo','report','meme','sniper','ban','lawsuit','halt','ddos']},
];
let duelWins=0;
// плавная лестница: 1-й живой матч ХОМЯК, 2-й СКАЛЬПЕР, 3-4-й ТРЕЙДЕР, дальше АКУЛА
const curDiff=()=>DIFFS[liveMatches<=0?0:liveMatches===1?1:liveMatches<4?2:3];

