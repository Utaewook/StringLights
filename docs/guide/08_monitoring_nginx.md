# nginx Real IP, JSON Log, and Log Rotation

This document describes how nginx reads the real user IP behind Cloudflare.
It also describes the access log format and the rotation of the container logs.
The configuration is in `build/nginx/nginx.conf` and `build/docker-compose.yml`.

---

## 1. Real user IP behind Cloudflare

The domain uses the Cloudflare proxy. Thus, every connection to nginx comes from a Cloudflare edge address.
Cloudflare puts the user IP in the `CF-Connecting-IP` header.

nginx uses `set_real_ip_from` and `real_ip_header CF-Connecting-IP`.
If the connection comes from a Cloudflare range, nginx replaces `$remote_addr` with the header value.
If the connection comes from any other address, nginx ignores the header. A direct request to the origin cannot forge the IP.

The ranges are in `build/nginx/cloudflare-ips.conf`. The frontend image copies this file to `/etc/nginx/`.

### 1.1 Effect on the rate limit

The zones `api_conn` and `api_req` use `$binary_remote_addr`. This variable now holds the real user IP.

- Before: all users behind one Cloudflare edge address shared one limit.
- After: each user IP has its own limit. The limits are the same as before (2 connections, 20 requests each minute, burst 5).
- The zones use the full IP. The anonymization applies only to the log.

The backend also receives the real IP in `X-Real-IP` and `X-Forwarded-For`.
The backend does not write these headers to its log.

---

## 2. Access log format

nginx writes one JSON object on each line to `/var/log/nginx/access.log`.

| Field | Meaning |
| --- | --- |
| `time` | The time in ISO 8601 format. |
| `ip_anon` | The truncated user IP. See section 2.1. |
| `method` | The HTTP method. |
| `uri` | The request path. The query string is removed. |
| `status` | The HTTP status code, as a number. |
| `request_length` | The request size in bytes, including the headers. |
| `bytes_sent` | The response size in bytes, including the headers. |
| `request_time` | The time to process the request, in seconds. |
| `upstream_response_time` | The time the backend needed, in seconds. It is empty for static files. |
| `ua` | The `User-Agent` header. |
| `referer` | The `Referer` header. |

The log never contains a model file name, a model content, or a tensor name.
The upload is in the request body, and the log has no body. The query string is removed from `uri` for the same reason.
The script `scripts/log_summary.py` reads this format. See [07_log_summary.md](./07_log_summary.md).

### 2.1 IP truncation

| Address type | Rule | Example |
| --- | --- | --- |
| IPv4 | Replace the last octet with `0`. | `203.0.113.77` becomes `203.0.113.0` |
| IPv6 | Keep the first 48 bits. Delete the rest. | `2001:db8:abcd:1234::5` becomes `2001:db8:abcd::` |
| Other | Write `-`. | |

---

## 3. Log rotation

The nginx image links `access.log` and `error.log` to the container output.
Thus, Docker stores both logs, and Docker rotates them.
Both services use the `json-file` driver with `max-size: 10m` and `max-file: 3`.
Each container keeps a maximum of 30 MB of logs.

Docker deletes the oldest file when the limit is reached.
If the site has more than about 100000 requests each day, a weekly summary can miss old lines.

To get the access log on the host, run this command:

```bash
docker logs string_lights_nginx 2>/dev/null > access.log
```

The `2>/dev/null` part removes the error log, which nginx writes to `stderr`.

---

## 4. Update the Cloudflare ranges

Cloudflare publishes the ranges at `https://www.cloudflare.com/ips-v4` and `https://www.cloudflare.com/ips-v6`.
They change rarely. Check them about every three months, or when Cloudflare announces a change.

1. Run `scripts/update_cloudflare_ips.sh` from the repository root.
2. Run `git diff build/nginx/cloudflare-ips.conf` and read the change.
3. Check the syntax. Use the command in section 5.
4. Commit the file. A deploy from `main` sends it to the host.

If a range is missing, the requests from that Cloudflare address show the Cloudflare address as the user IP.
The service continues to work.

---

## 5. Check the nginx syntax

Run `nginx -t` in the same image as production. The test needs a certificate, so use a temporary one.

```bash
T=$(mktemp -d) && mkdir -p $T/live/string-lights.dev
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=string-lights.dev \
  -keyout $T/live/string-lights.dev/privkey.pem -out $T/live/string-lights.dev/fullchain.pem
docker run --rm --add-host backend:127.0.0.1 \
  -v $PWD/build/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
  -v $PWD/build/nginx/cloudflare-ips.conf:/etc/nginx/cloudflare-ips.conf:ro \
  -v $T:/etc/letsencrypt:ro \
  nginx:alpine nginx -t
```

The result must show `test is successful`.

---

## 6. Check on the host after a deploy

1. Make sure that the Cloudflare proxy is on for the domain (orange cloud).
2. Open the site in a browser. Then run `docker logs --tail 5 string_lights_nginx 2>/dev/null`.
3. Make sure that `ip_anon` shows your own network and not `172.x.x.0` or a Cloudflare range.
4. If `ip_anon` shows a Cloudflare address, compare it with `cloudflare-ips.conf`.
