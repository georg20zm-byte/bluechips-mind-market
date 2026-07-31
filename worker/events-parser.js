#!/usr/bin/env node
/**
 * Blue Chips · events-parser
 * Тянет открытые события из Polymarket Gamma API, отбирает топ-N по объёму
 * в каждой категории и кладёт data/events.json для клиента.
 *
 * Gamma API публичный, ключ/кошелёк НЕ нужны (только чтение).
 * Запуск:  node worker/events-parser.js
 * Крон:    раз в час (systemd timer / cron / Cloudflare Workers Cron)
 *
 * Схема сверена с docs.polymarket.com и гайдами (июль 2026).
 * Три ключевых нюанса Gamma, учтённых ниже:
 *   1. outcomePrices приходит как JSON-СТРОКА внутри JSON: "[\"0.62\",\"0.38\"]" — парсить дважды.
 *   2. Категории берём из ev.tags (готовые теги), не из regex по тексту.
 *   3. Числа (volume, цены) приходят строками — приводим Number().
 */

const fs = require('fs');
const path = require('path');

const GAMMA = 'https://gamma-api.polymarket.com/events';
const TOP_PER_CATEGORY = 20;
const FETCH_LIMIT = 300; // сколько событий тянем до фильтрации
const OUT = path.join(__dirname, '..', 'data', 'events.json');

/* теги/слова Polymarket → категории Blue Chips (порядок = приоритет) */
const CATEGORY_MAP = [
  { id: 'sports',   match: /sport|nfl|nba|mlb|nhl|soccer|football|ufc|mma|tennis|golf|olympic|world cup|f1|formula/i },
  { id: 'finance',  match: /crypto|bitcoin|btc|ethereum|eth|solana|stock|nasdaq|s&p|earnings|ipo/i },
  { id: 'economy',  match: /econom|inflation|cpi|gdp|jobs|unemployment|fed|rate|recession|tariff/i },
  { id: 'politics', match: /politic|election|president|senate|congress|parliament|geopolit|war|policy|vote/i },
  { id: 'culture',  match: /culture|movie|film|music|oscar|grammy|award|celebrity|tv|show|game|entertainment/i },
];

function categorize(ev) {
  const tagText = (ev.tags || []).map(t => (t && (t.label || t.slug || t.name)) || '').join(' ');
  const hay = [ev.title, ev.slug, tagText].filter(Boolean).join(' ');
  for (const c of CATEGORY_MAP) if (c.match.test(hay)) return c.id;
  return 'culture'; // хвост — в культуру/прочее
}

/* outcomePrices: строка "[\"0.62\",\"0.38\"]" → вероятность YES (индекс 0) */
function parseYesPrice(ev) {
  try {
    const arr = JSON.parse(ev.outcomePrices);       // первый разбор: строка → массив строк
    const yes = Number(arr[0]);
    if (yes >= 0 && yes <= 1) return yes;
  } catch (_) {}
  // фолбэки, если поле пустое/другое
  if (ev.markets && ev.markets[0]) {
    try {
      const arr = JSON.parse(ev.markets[0].outcomePrices);
      const yes = Number(arr[0]);
      if (yes >= 0 && yes <= 1) return yes;
    } catch (_) {}
  }
  return 0.5;
}

function normalize(ev) {
  return {
    id: String(ev.id || ev.slug),
    q: ev.title,
    category: categorize(ev),
    priceYes: parseYesPrice(ev),
    volume: Number(ev.volume || ev.volumeNum || 0),
    dl: (ev.endDate || ev.end_date || '').slice(0, 10),  // YYYY-MM-DD; клиент сам обрежет
    url: ev.slug ? `https://polymarket.com/event/${ev.slug}` : null,
  };
}

async function run() {
  const url = `${GAMMA}?active=true&closed=false&archived=false&order=volume&ascending=false&limit=${FETCH_LIMIT}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gamma API ${res.status} ${res.statusText}`);
  const raw = await res.json();
  const events = Array.isArray(raw) ? raw : (raw.data || raw.events || []);

  const norm = events
    .map(normalize)
    .filter(e => e.q && e.volume > 0);

  // топ-N в каждой категории по объёму = метрика важности
  const byCat = {};
  for (const e of norm) (byCat[e.category] ??= []).push(e);
  for (const k of Object.keys(byCat)) {
    byCat[k] = byCat[k].sort((a, b) => b.volume - a.volume).slice(0, TOP_PER_CATEGORY);
  }

  const out = { generated: new Date().toISOString(), source: 'polymarket-gamma', categories: byCat };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  const summary = Object.entries(byCat).map(([k, v]) => `${k}:${v.length}`).join(' ') || '(пусто)';
  console.log(`✓ events.json обновлён · ${norm.length} событий · ${summary}`);
}

run().catch(e => { console.error('✗ ошибка:', e.message); process.exit(1); });
