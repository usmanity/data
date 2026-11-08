#!/usr/bin/env bash
# Boots cf dev against local D1 and asserts the core routes respond.
set -euo pipefail

cd "$(dirname "$0")"
PORT=8796
BASE="http://localhost:$PORT"
LOG="$(mktemp)"

if lsof -ti :"$PORT" >/dev/null 2>&1; then
	echo "port $PORT is already in use; stop that process first"
	exit 1
fi

npm run migrate:local --silent >/dev/null

# Job control gives the dev server its own process group, so cleanup stops
# cf, Vite, and workerd together.
set -m
(cd packages/hub && PORT=$PORT exec npx cf dev >"$LOG" 2>&1) &
DEV_PID=$!
set +m
trap 'kill -- -$DEV_PID 2>/dev/null || true; rm -f "$LOG"' EXIT

for _ in $(seq 1 60); do
	curl -s -o /dev/null "$BASE/" && break
	sleep 1
done

fail=0
check() {
	local path=$1 want_status=$2 want_body=$3
	local body status
	body=$(curl -s -w '\n%{http_code}' "$BASE$path")
	status=${body##*$'\n'}
	body=${body%$'\n'*}
	if [[ $status == "$want_status" && $body == *"$want_body"* ]]; then
		echo "ok   $path → $status"
	else
		echo "FAIL $path → $status (wanted $want_status containing '$want_body')"
		fail=1
	fi
}

check /api/health 200 '"ok":true'
check / 200 '<div id="root">'
check /music 200 '<div id="root">'
check /api/nope 404 'not_found'
check /fonts/iosevka/iosevka.css 200 'font-family: "Iosevka"'

if [[ $fail -ne 0 ]]; then
	echo "--- dev server log ---"
	cat "$LOG"
fi
exit $fail
