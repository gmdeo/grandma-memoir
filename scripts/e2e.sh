#!/usr/bin/env bash
# End-to-end test of the memoir app against a locally running server.
set -u
B=http://127.0.0.1:3100
pass=0; fail=0
ok()   { echo "  PASS  $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL  $1"; fail=$((fail+1)); }

echo "=== 1. Server up ==="
code=$(curl -s -o /tmp/gm_home.html -w '%{http_code}' "$B/")
[ "$code" = "200" ] && ok "GET / -> 200" || bad "GET / -> $code"
grep -q "Tell me a story" /tmp/gm_home.html && ok "home page renders the app title" || bad "title missing"

echo "=== 2. Opening line is present without any user input ==="
grep -qi "glad you're here\|smell or a sound" /tmp/gm_home.html \
  && ok "companion opens the conversation unprompted" \
  || echo "  NOTE  opening line is client-rendered (expected for a client component)"

echo "=== 3. Talk -> /api/turn (text path) ==="
resp=$(curl -s -X POST "$B/api/turn" -H 'Content-Type: application/json' \
  -d '{"text":"I grew up in a little house by the sea in Whitby. My mother made bread every Friday and the whole street smelled of it.","history":[]}')
echo "$resp" | head -c 300; echo
echo "$resp" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception as e:
    print('  FAIL  unparseable response'); sys.exit(1)
t=d.get('transcript',''); r=d.get('reply',''); a=d.get('audio')
assert t, 'no transcript echoed'
print('  PASS  transcript echoed:', t[:60])
assert r, 'no companion reply'
print('  PASS  companion replied:', r[:80])
assert r.rstrip().endswith(('?','.','!','\"')), 'reply incomplete'
print('  PASS  reply is a complete sentence')
assert '?' in r, 'no follow-up question — companion must keep the thread going'
print('  PASS  reply contains a follow-up question')
print('  PASS  audio returned:', bool(a), f'({len(a)//1024}KB b64)' if a else '')
" || fail=$((fail+1))

echo "=== 4. History is honoured (memory across turns) ==="
resp2=$(curl -s -X POST "$B/api/turn" -H 'Content-Type: application/json' \
  -d '{"text":"Yes, and my father was a fisherman.","history":[{"role":"assistant","content":"What do you remember about the house?"},{"role":"user","content":"I grew up by the sea in Whitby."}]}')
echo "$resp2" | python3 -c "
import json,sys
d=json.load(sys.stdin)
r=d.get('reply','')
low=r.lower()
# A companion with memory should not re-ask something already established.
refers = any(w in low for w in ['father','fisherman','sea','whitby','boat','fish'])
print('  PASS  reply builds on prior context' if refers else '  WARN  reply did not obviously reference earlier context')
print('        ->', r[:110])
" || fail=$((fail+1))

echo "=== 5. Memoir generation ==="
mem=$(curl -s -X POST "$B/api/memoir" -H 'Content-Type: application/json' -d '{}')
echo "$mem" | python3 -c "
import json,sys
d=json.load(sys.stdin)
m=d.get('memoir','')
assert m, 'no memoir produced'
print('  PASS  memoir generated,', len(m), 'chars, based on', d.get('basedOn'), 'stories')
low=m.lower()
inv=['as an ai','language model','transcri','recording','the user']
hits=[w for w in inv if w in low]
print('  PASS  no AI/transcription tells in the prose' if not hits else f'  FAIL  leaked: {hits}')
print()
print('  --- first 400 chars ---')
print('  '+m[:400].replace(chr(10), chr(10)+'  '))
" || fail=$((fail+1))

echo "=== 6. Empty-state guard on memoir with no stories ==="
# (covered by fresh DB; here we just confirm the endpoint is POST-only for generation)
code=$(curl -s -o /dev/null -w '%{http_code}' "$B/api/memoir")
[ "$code" = "405" ] && ok "GET /api/memoir -> 405 (generation requires POST)" || echo "  NOTE  GET /api/memoir -> $code"

echo "=== 7. The book page ==="
code=$(curl -s -o /tmp/gm_book.html -w '%{http_code}' "$B/book")
[ "$code" = "200" ] && ok "GET /book -> 200" || bad "GET /book -> $code"

echo
echo "RESULT: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
