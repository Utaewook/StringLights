# Log Summary Script

This document tells how to make a daily or weekly summary of the logs.
The script is `scripts/log_summary.py`. It uses only the Python standard library.

The script reads each log file line by line. It calls no external service.
It does not read or write a model file name, a model content, or a tensor name.

---

## 1. Input formats

The script needs the formats below. The monitoring tasks that write these logs are not in the repository yet.
If a task writes a different format, change the field names in `log_summary.py`.

### 1.1 nginx log

nginx writes one JSON object on each line. The script reads these fields:

| Field | Meaning |
| --- | --- |
| `time` | The time in ISO 8601 format. `time_iso8601` also works. |
| `status` | The HTTP status code. |
| `method` | The HTTP method. `request_method` also works. |
| `uri` | The path of the request, without the query string. |
| `request_length` | The size of the request in bytes. It includes the headers. |

The script counts only `POST /api/surgery`. A line that is not valid JSON is skipped and counted.

### 1.2 Backend log

The backend writes one line for each surgery. The line contains `event=surgery` and `key=value` pairs:

| Key | Meaning |
| --- | --- |
| `status` | `ok` for a success. Any other value is a failure. |
| `duration_ms` | The time of the surgery, without the wait. |
| `wait_ms` | The time that the request waited for the semaphore. |
| `queue_depth` | The number of requests in the queue at the start. |
| `ts` | Optional. The time of the event. |

If `ts` is absent, the script reads the time at the start of the line. It accepts `2026-11-02 10:00:05,123` and `2026-11-02T10:00:05Z`.
A time without a zone is UTC.

### 1.3 Docker inspect

Save the output of `docker inspect` in a JSON file. The script reads `RestartCount`, `State.OOMKilled`, and `State.Status`.
These values are totals since the creation of the container. They are not values for one period.
`State.OOMKilled` shows only the last stop.

---

## 2. Run the script

All times are UTC. `--date` is the last day of the period. The default is yesterday.

1. Run a daily summary:
   ```bash
   python3 scripts/log_summary.py --nginx access.log --backend backend.log --inspect inspect.json --date 2026-11-02
   ```
2. Run a weekly summary. The period is the 7 days that end on `--date`:
   ```bash
   python3 scripts/log_summary.py --period week --nginx access.log access.log.1.gz --backend backend.log
   ```
3. Write `summary.md` and `summary.json` to a directory. Add `--out-dir DIR`.

Use `--format markdown`, `--format json`, or `--format both` to select the output on the screen.
A file that ends in `.gz` is read as gzip. The name `-` means standard input.

---

## 3. Output

The first five lines of the Markdown are the short summary for a phone:

1. Uploads and requests.
2. Failures by status code.
3. Surgery time: average, p95, and maximum.
4. Wait time and the maximum queue depth.
5. Container restarts and OOM kills.

The details follow. They give the upload size distribution, the failure rate for 400, 413, 429, 500, and 504, and the containers.
The failure rate is the count of a status code divided by the count of `POST /api/surgery` requests.

The script keeps the size and time values in arrays of numbers. The memory use is about 8 bytes for each surgery request.

---

## 4. Example for cron

This example is not installed. An administrator must decide where the logs are.

```cron
10 0 * * * docker inspect string_lights_backend string_lights_nginx > /var/tmp/inspect.json && docker logs --since 24h string_lights_backend > /var/tmp/backend.log 2>&1 && python3 /home/ubuntu/string_lights/scripts/log_summary.py --nginx /var/log/nginx/access.log --backend /var/tmp/backend.log --inspect /var/tmp/inspect.json --out-dir /var/tmp/string_lights_summary
```

The nginx log is inside the nginx container unless the host mounts it. Mount the log directory, or run `docker logs` for the nginx container.
Rotate the log files. The script ignores lines outside the period.

---

## 5. Test

Run the tests from the repository root:

```bash
python3 -m unittest discover -s scripts/tests
```
