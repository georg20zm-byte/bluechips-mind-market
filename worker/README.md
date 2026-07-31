# events-parser · воркер событий Polymarket

Тянет открытые события из публичного Gamma API Polymarket, раскладывает
по категориям (топ-20 по объёму в каждой) и пишет `../data/events.json`,
который читает клиент. Ключ/кошелёк НЕ нужны — только чтение.

## Проверить локально

```bash
cd bluechips-mind-market
node worker/events-parser.js
```

Успех выглядит так:
```
✓ events.json обновлён · 118 событий · finance:20 economy:14 politics:20 sports:20 culture:20
```

Затем открой `data/events.json` — увидишь реальные события. Обнови игру в
браузере: категории наполнятся живыми вопросами Polymarket. Если воркер не
запускать — игра работает на встроенном фолбэк-наборе, ничего не ломается.

> Тестировать в Telegram НЕ нужно: воркер живёт на сервере и к клиенту
> отношения не имеет. Он просто генерит JSON-файл.

## Автозапуск раз в час (systemd, для VPS)

`/etc/systemd/system/bc-events.service`
```ini
[Unit]
Description=Blue Chips events parser
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/path/to/bluechips-mind-market
ExecStart=/usr/bin/node worker/events-parser.js
```

`/etc/systemd/system/bc-events.timer`
```ini
[Unit]
Description=Run BC events parser hourly

[Timer]
OnBootSec=2min
OnUnitActiveSec=1h
Persistent=true

[Install]
WantedBy=timers.target
```

Включить:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bc-events.timer
sudo systemctl start bc-events.service   # разовый прогон сейчас
systemctl list-timers bc-events.timer    # проверить расписание
```

## Нюансы Gamma API (уже учтены в коде)

- `outcomePrices` приходит JSON-строкой внутри JSON — парсится дважды.
- Категории берутся из `tags` события, с фолбэком на regex по заголовку.
- `volume` и цены приходят строками — приводятся к числу.
- Эндпоint и поля сверены с docs.polymarket.com (июль 2026). Если Polymarket
  сменит схему — воркер отработает с фолбэками, а клиент останется на своём
  встроенном наборе, игра не сломается.

## Где хостить бесплатно, если нет VPS

Cloudflare Workers + Cron Triggers, GitHub Actions (schedule) с коммитом
`events.json` в репо, либо любой мелкий VPS. Файл маленький, трафик копеечный.
