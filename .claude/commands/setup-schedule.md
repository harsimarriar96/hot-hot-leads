> **Coming soon.** Schedules are disabled unless `SCHEDULES_ENABLED=true`; the scheduler is single-instance in-process cron and not production-ready. The web UI shows a placeholder page.

Set up a recurring GTM task that fires on a schedule and delivers results to a chat.

Usage: /setup-schedule

Steps:
1. Ask: what should run? (e.g. "check signals daily", "generate 5 leads every Monday")
2. Ask: which product?
3. Ask: which channel to deliver to? (telegram / whatsapp)
4. Confirm the derived task_prompt, frequency, and cron expression with the user before saving
5. Save to Postgres (`schedules` table) via SchedulesRepository.saveSchedule()
6. Register with the SchedulerService (it auto-loads from Postgres (`schedules` table) on boot, but also registers live)
7. Confirm back: "✅ Schedule *[name]* created. Next run: [next_run_time]"

Common patterns:
- "Check signals daily at 9am" → cron: `0 9 * * *`
- "Generate 10 leads every Monday" → cron: `0 9 * * 1`
- "Weekly feedback review on Fridays" → cron: `0 16 * * 5`
- Custom time → ask for the cron expression
