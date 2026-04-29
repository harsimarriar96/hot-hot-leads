## ADDED Requirements

### Requirement: Schedules list endpoint

The API SHALL expose `GET /api/schedules` returning all schedules joined with product name and channel info:

```
[ {
    id: string,
    name: string,
    productId: string,
    productName: string,
    cron: string,
    enabled: boolean,
    lastRunAt: string | null,
    nextRunAt: string | null,
    deliveryChannel: 'telegram' | 'whatsapp' | null,
    deliveryRef: string | null,
  }, ... ]
```

`nextRunAt` MUST be computed from the cron expression at request time (not stored). When `enabled = false`, `nextRunAt` MUST be `null`.

#### Scenario: Disabled schedule has no next run
- **WHEN** a schedule has `enabled = false`
- **THEN** the list response carries `nextRunAt: null` for that row regardless of cron expression

### Requirement: Toggle schedule live

The API SHALL expose `PATCH /api/schedules/:id` accepting body `{ enabled?: boolean }`. Toggling MUST take effect within `SchedulerService` immediately — no application restart required. Disabling a running cron MUST stop further fires; enabling MUST register the cron with the configured expression and start firing at the next boundary.

#### Scenario: Disable stops cron live
- **WHEN** an enabled schedule is disabled via PATCH
- **THEN** subsequent cron boundaries do not invoke the schedule handler

#### Scenario: Enable starts firing on next boundary
- **WHEN** a disabled schedule is enabled via PATCH at 14:00:30 with cron `* * * * *`
- **THEN** the handler fires at 14:01:00

### Requirement: Run-now is fire-and-forget

The API SHALL expose `POST /api/schedules/:id/run` returning `202 Accepted` immediately. The actual execution MUST run in a detached promise via `SchedulerService.runOnce(schedule)`. Results MUST land in the product chat thread (when `sync_channel_chats` is enabled) and/or the configured delivery channel.

The endpoint MUST NOT block on completion and MUST NOT return the run output. The response body SHOULD be `{ ok: true }`.

#### Scenario: Caller does not wait for completion
- **WHEN** the operator clicks Run-now and the underlying schedule takes 90 seconds to complete
- **THEN** the HTTP response returns within 100ms with status 202

#### Scenario: Results land in chat
- **WHEN** Run-now is invoked for a schedule attached to product P with chat sync enabled
- **THEN** within the run's lifetime, new assistant message(s) appear in product P's chat thread

### Requirement: Schedules page in the operator UI

A `/schedules` route SHALL render a table of all schedules with columns: name · product · cron · last run (relative) · next run (relative) · enabled toggle · Run-now button. The toggle MUST call `PATCH /api/schedules/:id` and reflect optimistic UI; on failure it MUST roll back and surface a danger toast.

The Run-now button MUST be a `Play` icon button, MUST be disabled while the request is in flight, and on 202 MUST raise a toast "Run queued · check chat for results".

The route MUST be reachable from the sidebar and from the command palette. The empty state MUST guide the operator to ask the chat to create a recurring task — schedules MUST NOT be createable directly from this page in v1.

#### Scenario: Toggle reflects optimistic
- **WHEN** the operator flips an enabled toggle off
- **THEN** the toggle visually flips to off immediately, the PATCH is sent, and on success the state holds

#### Scenario: Run-now disables itself
- **WHEN** the operator clicks Run-now on a schedule
- **THEN** the button is disabled until the 202 response arrives, after which the toast is shown and the button re-enables

#### Scenario: Empty state directs to chat
- **WHEN** there are zero schedules
- **THEN** the page displays "No schedules yet — ask the chat to create a recurring task." with no `Create schedule` button
