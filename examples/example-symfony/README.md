# Example Symfony

Minimal Symfony 7 API that exercises every ErrorWatch SDK capability so the
dashboard gets populated with realistic data: exceptions with structured
frames, HTTP client spans, cache operations, correlated logs and W3C trace
propagation.

## Quick start

```bash
# From the repository root:
make example-symfony-setup    # composer install + .env + sdk-symfony worktree
#  ↳ edit examples/example-symfony/.env and paste your ERRORWATCH_API_KEY
make example-symfony-start    # php -S on :8088 (foreground)
# in another terminal:
make example-symfony-trigger  # curls every /trigger/* route
```

Then open the dashboard — you should see the events land within a few seconds.

## Routes

| Route              | What it exercises                                                     |
|--------------------|-----------------------------------------------------------------------|
| `/`                | Lists all trigger routes                                              |
| `/trigger/error`   | `throw RuntimeException` → frames[] + fingerprint + trace_id/span_id  |
| `/trigger/http-call` | Outbound HTTP → http.client span + outbound traceparent header      |
| `/trigger/cache`   | `cache.get` / `cache.set` spans with `cache.hit`                      |
| `/trigger/log`     | Monolog info + warning → trace-correlated application_logs            |
| `/trigger/slow-query` | Stall 400ms → raise p95 latency                                    |
| `/trigger/db-list` | Doctrine SELECT → single `db.sql.query` span                          |
| `/trigger/db-n-plus-one` | 10 sequential SELECTs → N+1 detection                           |
| `/trigger/queue`   | Dispatch a Messenger message → `queue.publish` span                   |

### Consuming the queue

`/trigger/queue` publishes on the `async` transport (backed by Doctrine).
Start a worker to process it — the consume produces an independent
`queue.process` transaction:

```bash
bin/console messenger:consume async -vv
```


## Background server

```bash
make example-symfony-start-bg   # daemonised on :8088, PID in var/run.pid
make example-symfony-logs       # tail var/server.log
make example-symfony-stop       # kill the background server
```

## Reset

```bash
make example-symfony-reset      # wipes vendor/, var/, composer.lock
make example-symfony-setup      # reinstall from scratch
```

## Wiring note — local SDK

`composer.json` declares a path repository to `../../packages/sdk-symfony` so
the example uses the local checkout (or worktree) of the SDK. If
`packages/sdk-symfony` is missing, the setup target runs `sdk-symfony-init`
automatically.
