#!/usr/bin/env node
/**
 * Blue Chips · events-parser
 * Тянет открытые рынки из Polymarket, отбирает топ-N по объёму
 * в каждой категории и кладёт data/events.json для клиента.
 *
 * Запуск:  node worker/events-parser.js
 * Крон:    каждый час (systemd timer / cron / Cloudflare Workers Cron)
 *
 * ВАЖНО: эндпоинт и имена полей сверить с актуальной докой
 * https://docs.polymarket.com — API открытый, ключ для чтения не нужен,
 * но схема ответа могла измениться с момента написания.
 */

const fs = require('fs');
const path = require('path');

const API = 'https://gamma-api.polymarket.com/events'; // TODO: сверить с докой
const TOP_PER_CATEGORY = 20;
const OUT = path.join(__dirname, '..', 'data', 'events.json');

/* Маппинг тегов/категорий Polymarket → категории Blue Chips */
const CATEGORY_MAP = [
  { id: 'sports',   match: /sport|nfl|nba|soccer|football|ufc|tennis|olymp/i },
  { id: 'finance',  match: /crypto|bitcoin|eth|stock|fed|rates|market/i },
  { id: 'economy',  match: /econom|inflation|gdp|jobs|trade/i },
  { id: 'politics', match: /politic|election|president|congress|geopolit/i },
  { id: 'culture',  match: /culture|movie|music|award|celebrity|tv|game/i },
];

function categorize(ev) {
  const hay = [ev.title, ev.category, ...(ev.tags || []).map(t => t.label || t)]
    .filter(Boolean).join(' ');
  for (const c of CATEGORY_MAP) if (c.match.test(hay)) return c.id;
  return 'culture'; // хвост — в культуру/прочее
}

/* Нормализация под формат клиента (см. EVENTS в js/00-state-market.js) */
function normalize(ev) {
  // TODO: сверить поля volume / endDate / outcomePrices с актуальной схемой
  const yesPrice = Number(ev.outcomePrices?.[0] ?? ev.bestAsk ?? 0.5);
  return {
    id: ev.id || ev.slug,
    q: ev.title,
    category: categorize(ev),
    priceYes: yesPrice,
    volume: Number(ev.volume ?? 0),
    dl: (ev.endDate || '').slice(0, 10), // YYYY-MM-DD; клиент сам обрежет до ММ.ДД
    url: ev.slug ? `https://polymarket.com/event/${ev.slug}` : null,
  };
}

async function run() {
  const res = await fetch(`${API}?closed=false&limit=300&order=volume&ascending=false`);
  if (!res.ok) throw new Error(`Polymarket API ${res.status}`);
  const raw = await res.json();

  const norm = (Array.isArray(raw) ? raw : raw.data || [])
    .map(normalize)
    .filter(e => e.q && e.volume > 0);

  // топ-N в каждой категории по объёму = метрика важности
  const byCat = {};
  for (const e of norm) {
    (byCat[e.category] ??= []).push(e);
  }
  for (const k of Object.keys(byCat)) {
    byCat[k] = byCat[k]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, TOP_PER_CATEGORY);
  }

  const out = {
    generated: new Date().toISOString(),
    source: 'polymarket',
    categories: byCat,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`events.json: ${Object.entries(byCat).map(([k, v]) => `${k}:${v.length}`).join(' ')}`);
}

run().catch(e => { console.error(e); process.exit(1); });
