# Log Summary Script

This document tells how to make a daily or weekly summary of the logs.
The script is `scripts/log_summary.py`. It uses only the Python standard library.

The script reads each log file line by line. It calls no external service.
It does not read or write a model file name, a model content, or a tensor name.

---

## 1. Input formats

The script reads the formats below. They match the code in `build/nginx/nginx.conf` and `apps/backend/app/metrics.py`.

### 1.1 nginx log

nginx writes one JSON object on each line. [08_monitoring_nginx.md](./08_monitoring_nginx.md) gives the full format. The script reads these fields:

| Field | Meaning |
| --- | --- |
| `time` | The time in ISO 8601 format. `time_iso8601` also works. |
| `status` | The HTTP status code. |
| `method` | The HTTP method. `request_method` also works. |
| `uri` | The path of the request, without the query string. |

The script counts only `POST /api/surgery`. A line that is not valid JSON is skipped and counted.
The script does not read the other fields. It does not use `request_length` for the upload size, because that value includes the headers.

### 1.2 Backend log

The backend writes one line for each surgery request. The line contains `event=surgery` and `key=value` pairs:

| Key | Meaning |
| --- | --- |
| `ts` | The time of the event, in UTC, for example `2026-11-02T10:00:05Z`. |
| `outcome` | `ok`, `rejected`, `bad_zip`, `too_large`, `timeout`, `failed`, or `abandoned`. |
| `status` | The HTTP status code. The script does not read it. |
| `upload_mb_bucket` | The upload size range in MB: `<1`, `1-5`, `5-10`, `10-25`, `25-50`, `>=50`, or `unknown`. |
| `queue_depth_on_arrival` | The number of requests ahead of this request when it arrived. |
| `queue_wait_ms` | The time that the request waited for the semaphore. |
| `surgery_ms` | The time of the surgery, without the wait. |
| `total_ms` | The time of the whole request. The script does not read it. |
| `node_count_bucket` | The node count range: `<10`, `10-49`, `50-199`, `200-999`, `>=1000`, or `unknown`. |

The script ignores a line without `event=surgery`. A line without a valid `ts` is skipped and counted.
The script keeps a value that it does not know, for example a new `outcome`, and shows it in the output.

The backend writes this line to the error stream of the container. Run `docker logs string_lights_backend 2>&1` to get it.

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

1. Uploads and requests, from the nginx log.
2. Failures by status code, from the nginx log.
3. Surgery time of the requests with `outcome=ok`: average, p95, and maximum.
4. Wait time and the maximum `queue_depth_on_arrival`. Only a request that reached the semaphore has a wait time.
5. Container restarts and OOM kills.

The details follow. They give these items:

- The count of each backend `outcome`.
- The distribution of `upload_mb_bucket` and `node_count_bucket`. The script counts the bucket labels. It does not know the exact sizes.
- The failure rate for 400, 413, 429, 500, and 504. It is the count of a status code divided by the count of `POST /api/surgery` requests in the nginx log.
- The containers.

The backend log does not contain a request that nginx rejects before it reaches the backend, for example a 413. The nginx log has these requests.

The script keeps the time values in arrays of numbers. The memory use is about 8 bytes for each surgery request.

### 3.1 Limit of the Docker log

Docker keeps up to 30MB of log for each container (`max-size: 10m`, `max-file: 3`). When the limit is full, Docker removes the oldest lines.
A weekly summary can miss the first days of the week. Run the script each day, or save the logs before they rotate.

---

## 4. Example for cron

This example is not installed. An administrator must decide where the logs are.

```cron
10 0 * * * docker inspect string_lights_backend string_lights_nginx > /var/tmp/inspect.json && docker logs --since 24h string_lights_backend > /var/tmp/backend.log 2>&1 && docker logs --since 24h string_lights_nginx 2>/dev/null > /var/tmp/access.log && python3 /home/ubuntu/string_lights/scripts/log_summary.py --nginx /var/tmp/access.log --backend /var/tmp/backend.log --inspect /var/tmp/inspect.json --out-dir /var/tmp/string_lights_summary
```

The nginx log is not a file on the host. The container sends it to Docker. Use `docker logs string_lights_nginx 2>/dev/null`, as the example does. See [08_monitoring_nginx.md](./08_monitoring_nginx.md).
The script ignores lines outside the period.

---

## 5. Test

Run the tests from the repository root:

```bash
python3 -m unittest discover -s scripts/tests
```
