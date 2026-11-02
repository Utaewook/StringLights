#!/bin/sh
# Rewrite build/nginx/cloudflare-ips.conf from the official Cloudflare lists.
# Usage: scripts/update_cloudflare_ips.sh
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/build/nginx/cloudflare-ips.conf"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

{
    echo "# Cloudflare edge ranges. Source: https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6"
    echo "# Fetched $(date -u +%Y-%m-%d). To refresh this file, see docs/guide/08_monitoring_nginx.md section 4."
    echo "# nginx trusts CF-Connecting-IP only when the connection comes from one of these ranges."
    for list in ips-v4 ips-v6; do
        # The lists have no final newline, so add one before the next list.
        curl -fsS -m 15 "https://www.cloudflare.com/$list"
        echo
    done | sed '/^$/d;s/.*/set_real_ip_from &;/'
} > "$tmp"

# Refuse an empty or broken download. An empty trust list turns real IP off.
[ "$(grep -c '^set_real_ip_from ' "$tmp")" -ge 10 ] || { echo "too few ranges, file not changed" >&2; exit 1; }
cp "$tmp" "$out"
echo "wrote $out"
