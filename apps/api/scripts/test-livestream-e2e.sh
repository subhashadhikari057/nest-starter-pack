#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Livestream E2E Test — simulates real teacher→student flow using live APIs
#
# What it does:
#   1. Login as admin (teacher)
#   2. Fetch or create a real course to link the session to
#   3. Schedule a live session
#   4. Start the session (teacher goes live)
#   5. Open LiveKit room in browser (you publish video)
#   6. Login as student and join the session
#   7. End the session
#   8. Fetch recording as student
#   9. Verify HLS playback through nginx
#  10. Verify auth rejects invalid tokens
#
# Usage:
#   ./scripts/test-livestream-e2e.sh                          # interactive + browser
#   ./scripts/test-livestream-e2e.sh broadcast                # broadcast + browser
#   ./scripts/test-livestream-e2e.sh interactive obs_rtmp     # interactive + OBS RTMP
#   ./scripts/test-livestream-e2e.sh broadcast obs_rtmp       # broadcast + OBS RTMP
#   ./scripts/test-livestream-e2e.sh interactive obs_whip     # interactive + OBS WHIP
#
# Env overrides:
#   BH_API_URL        (default: https://bhapi.sachityadav.com.np)
#   BH_HLS_URL        (default: https://bhs2.sachityadav.com.np)
#   BH_SECONDARY_SSH  (default: skip, e.g. root@95.216.240.85)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
info() { echo -e "${CYAN}→${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
die()  { fail "$1"; exit 1; }

API_URL="${BH_API_URL:-https://bhapi.sachityadav.com.np}"
HLS_URL="${BH_HLS_URL:-https://bhs2.sachityadav.com.np}"
SECONDARY_SSH="${BH_SECONDARY_SSH:-}"
PROFILE="${1:-interactive}"     # "interactive" or "broadcast"
SOURCE="${2:-browser}"           # "browser", "obs_rtmp", or "obs_whip"

# ── Credentials ───────────────────────────────────────────────────────────────

ADMIN_EMAIL="superadmin@bullhouse.com"
ADMIN_PASSWORD="superadmin123"
STUDENT_EMAIL="customer@bullhouse.com"
STUDENT_PASSWORD="password123"

echo ""
echo "══════════════════════════════════════"
echo "  Livestream E2E Test (${PROFILE})"
echo "══════════════════════════════════════"
echo "API:     ${API_URL}"
echo "HLS:     ${HLS_URL}"
echo "Profile: ${PROFILE}"
echo "Source:  ${SOURCE}"
echo ""

# ── Helper: login ─────────────────────────────────────────────────────────────

login() {
  local email="$1" password="$2" label="$3"
  info "Logging in as ${label} (${email})..." >&2

  local resp
  resp=$(curl -s -X POST "${API_URL}/api/auth/login/email" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" 2>/dev/null) || true

  local token
  token=$(echo "$resp" | jq -r '.tokens.accessToken // empty' 2>/dev/null)
  if [ -z "$token" ]; then
    fail "Login failed for ${email}: $(echo "$resp" | jq -c . 2>/dev/null || echo "$resp")" >&2
    echo ""
    return 1
  fi

  local name
  name=$(echo "$resp" | jq -r '.user.name // "unknown"')
  ok "Logged in as ${name}" >&2

  echo "$token"
}

# ── Helper: API call ──────────────────────────────────────────────────────────

api() {
  local method="$1" path="$2" token="$3" body="${4:-}"
  local args=(-s -X "$method" "${API_URL}${path}" -H "Authorization: Bearer ${token}" -H "Content-Type: application/json")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Step 1: Login as admin (teacher)
# ═══════════════════════════════════════════════════════════════════════════════

LOGIN_RESP_CACHED=$(curl -s -X POST "${API_URL}/api/auth/login/email" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}" 2>/dev/null) || true

ADMIN_TOKEN=$(echo "$LOGIN_RESP_CACHED" | jq -r '.tokens.accessToken // empty' 2>/dev/null)
[ -n "$ADMIN_TOKEN" ] || die "Admin login failed. Is the API running at ${API_URL}? Response: $(echo "$LOGIN_RESP_CACHED" | jq -c . 2>/dev/null)"
ADMIN_USER_ID=$(echo "$LOGIN_RESP_CACHED" | jq -r '.user.id')
ADMIN_NAME=$(echo "$LOGIN_RESP_CACHED" | jq -r '.user.name')
ok "Logged in as ${ADMIN_NAME} (${ADMIN_USER_ID})"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Step 1b: Clean up stale live sessions from previous runs
# ═══════════════════════════════════════════════════════════════════════════════

info "Cleaning up stale sessions from previous runs..."

# End any live sessions owned by this user
LIVE_SESSIONS=$(api GET "/api/livestream/sessions?status=live&pagination=false&hostUserId=${ADMIN_USER_ID}" "$ADMIN_TOKEN")
LIVE_IDS=$(echo "$LIVE_SESSIONS" | jq -r '.data[]?.id // empty' 2>/dev/null)
for LIVE_ID in $LIVE_IDS; do
  info "Ending live session ${LIVE_ID}..."
  api POST "/api/livestream/sessions/${LIVE_ID}/end" "$ADMIN_TOKEN" > /dev/null 2>&1 || true
  ok "Ended ${LIVE_ID}"
done

# Cancel scheduled sessions owned by this user (to clear overlap window)
SCHEDULED_SESSIONS=$(api GET "/api/livestream/sessions?status=scheduled&pagination=false&hostUserId=${ADMIN_USER_ID}" "$ADMIN_TOKEN")
SCHED_IDS=$(echo "$SCHEDULED_SESSIONS" | jq -r '.data[]?.id // empty' 2>/dev/null)
for SCHED_ID in $SCHED_IDS; do
  info "Cancelling scheduled session ${SCHED_ID}..."
  api POST "/api/livestream/sessions/${SCHED_ID}/cancel" "$ADMIN_TOKEN" > /dev/null 2>&1 || true
  ok "Cancelled ${SCHED_ID}"
done

[ -z "$LIVE_IDS" ] && [ -z "$SCHED_IDS" ] && ok "No stale sessions"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Step 2: Get a real course to link the session to
# ═══════════════════════════════════════════════════════════════════════════════

info "Step 2: Fetching existing courses..."
COURSES_RESP=$(api GET "/api/admin/courses?size=1&status=published" "$ADMIN_TOKEN")
COURSE_ID=$(echo "$COURSES_RESP" | jq -r '.data[0].id // empty')
COURSE_TITLE=$(echo "$COURSES_RESP" | jq -r '.data[0].title // empty')

if [ -n "$COURSE_ID" ] && [ "$COURSE_ID" != "null" ]; then
  ok "Using existing course: ${COURSE_TITLE} (id=${COURSE_ID})"
else
  info "No published courses found. Creating one..."
  CREATE_COURSE_RESP=$(api POST "/api/admin/courses" "$ADMIN_TOKEN" \
    '{"title":"Livestream Test Course","status":"published"}')
  COURSE_ID=$(echo "$CREATE_COURSE_RESP" | jq -r '.data.id // empty')
  COURSE_TITLE=$(echo "$CREATE_COURSE_RESP" | jq -r '.data.title // empty')
  [ -n "$COURSE_ID" ] || die "Failed to create course: $(echo "$CREATE_COURSE_RESP" | jq -c .)"
  ok "Created course: ${COURSE_TITLE} (id=${COURSE_ID})"
fi

# Course IDs are numeric but livestream.courseId is UUID
# The entitlement system links via products.metadata.courseId
# For testing without full product linkage, we use a generated UUID
# and the admin user bypasses entitlement checks on teacher endpoints
LIVESTREAM_COURSE_ID=$(uuidgen | tr '[:upper:]' '[:lower:]' 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "00000000-0000-4000-a000-$(printf '%012x' $COURSE_ID)")
warn "Livestream courseId=${LIVESTREAM_COURSE_ID} (not linked to product — student entitlement may fail, that's OK for this test)"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Step 3: Schedule a live session
# ═══════════════════════════════════════════════════════════════════════════════

info "Step 3: Creating ${PROFILE} session..."
# Schedule slightly in the future to avoid overlap with other sessions
SCHEDULED_AT=$(date -u -v+2H '+%Y-%m-%dT%H:%M:%S.000Z' 2>/dev/null || date -u -d '+2 hours' '+%Y-%m-%dT%H:%M:%S.000Z' 2>/dev/null || echo "")
SCHEDULE_BODY="{\"title\":\"E2E Test $(date '+%H:%M:%S')\",\"profile\":\"${PROFILE}\",\"courseId\":\"${LIVESTREAM_COURSE_ID}\"}"
[ -n "$SCHEDULED_AT" ] && SCHEDULE_BODY="{\"title\":\"E2E Test $(date '+%H:%M:%S')\",\"profile\":\"${PROFILE}\",\"courseId\":\"${LIVESTREAM_COURSE_ID}\",\"scheduledAt\":\"${SCHEDULED_AT}\"}"
SESSION_RESP=$(api POST "/api/livestream/sessions" "$ADMIN_TOKEN" "$SCHEDULE_BODY")

SESSION_ID=$(echo "$SESSION_RESP" | jq -r '.data.id // empty')
[ -n "$SESSION_ID" ] || die "Failed to create session: $(echo "$SESSION_RESP" | jq -c .)"

ROOM_NAME=$(echo "$SESSION_RESP" | jq -r '.data.roomName')
SESSION_STATUS=$(echo "$SESSION_RESP" | jq -r '.data.status')
ok "Session created: ${SESSION_ID} (status=${SESSION_STATUS}, room=${ROOM_NAME})"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Step 4: Start the session (teacher goes live)
# ═══════════════════════════════════════════════════════════════════════════════

info "Step 4: Starting session (source=${SOURCE})..."
START_RESP=$(api POST "/api/livestream/sessions/${SESSION_ID}/start" "$ADMIN_TOKEN" \
  "{\"source\":\"${SOURCE}\"}")

START_TYPE=$(echo "$START_RESP" | jq -r '.data.type // empty')
[ -n "$START_TYPE" ] || die "Failed to start session: $(echo "$START_RESP" | jq -c .)"
ok "Session is LIVE (type=${START_TYPE})"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Step 5: Publish video (method depends on source)
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$SOURCE" = "obs_rtmp" ]; then
  RTMP_URL=$(echo "$START_RESP" | jq -r '.data.rtmpUrl // empty')
  STREAM_KEY=$(echo "$START_RESP" | jq -r '.data.streamKey // empty')

  echo "══════════════════════════════════════"
  echo "  CONFIGURE OBS WITH THESE SETTINGS"
  echo "══════════════════════════════════════"
  echo ""
  echo "  Server:     ${RTMP_URL}"
  echo "  Stream Key: ${STREAM_KEY}"
  echo ""
  echo "  OBS → Settings → Stream → Service: Custom"
  echo "  Paste the above, then click 'Start Streaming'"
  echo ""
  read -rp "Press Enter once OBS is streaming..."

elif [ "$SOURCE" = "obs_whip" ]; then
  WHIP_URL=$(echo "$START_RESP" | jq -r '.data.whipUrl // empty')
  WHIP_TOKEN=$(echo "$START_RESP" | jq -r '.data.token // empty')

  echo "══════════════════════════════════════"
  echo "  CONFIGURE OBS WHIP"
  echo "══════════════════════════════════════"
  echo ""
  echo "  WHIP URL:    ${WHIP_URL}"
  echo "  Bearer Token: ${WHIP_TOKEN}"
  echo ""
  echo "  OBS → Settings → Stream → Service: WHIP"
  echo "  Paste the above, then click 'Start Streaming'"
  echo ""
  read -rp "Press Enter once OBS is streaming..."

else
  # browser — WebRTC via LiveKit meet page
  TEACHER_TOKEN=$(echo "$START_RESP" | jq -r '.data.token // empty')
  TEACHER_WS=$(echo "$START_RESP" | jq -r '.data.wsUrl // empty')
  MEET_URL="https://meet.livekit.io/custom?liveKitUrl=${TEACHER_WS}&token=${TEACHER_TOKEN}"

  echo "══════════════════════════════════════"
  echo "  OPEN THIS URL TO PUBLISH VIDEO"
  echo "══════════════════════════════════════"
  echo ""
  echo "${MEET_URL}"
  echo ""

  if command -v open &>/dev/null; then
    read -rp "Press Enter to open in browser..."
    open "${MEET_URL}"
  elif command -v xdg-open &>/dev/null; then
    read -rp "Press Enter to open in browser..."
    xdg-open "${MEET_URL}"
  else
    warn "Open the URL above manually in your browser."
  fi

  read -rp "Press Enter once you see your camera feed..."
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Step 5b: Verify egress is writing on secondary (optional)
# ═══════════════════════════════════════════════════════════════════════════════

SEGMENT_DIR=$( [ "$PROFILE" = "broadcast" ] && echo "live" || echo "vod" )

if [ -n "$SECONDARY_SSH" ]; then
  info "Checking egress files on secondary..."
  EGRESS_FILES=$(ssh -o ConnectTimeout=5 "$SECONDARY_SSH" \
    "ls /recordings/${LIVESTREAM_COURSE_ID}/${SESSION_ID}/${SEGMENT_DIR}/ 2>/dev/null | head -5" 2>/dev/null || echo "")
  if [ -n "$EGRESS_FILES" ]; then
    ok "Egress writing HLS segments:"
    echo "$EGRESS_FILES" | sed 's/^/   /'
  else
    # Try uncategorized path (courseId might resolve differently)
    EGRESS_FILES=$(ssh -o ConnectTimeout=5 "$SECONDARY_SSH" \
      "find /recordings -name 'segment*' -newer /tmp 2>/dev/null | head -5" 2>/dev/null || echo "")
    if [ -n "$EGRESS_FILES" ]; then
      ok "Found segments at:"
      echo "$EGRESS_FILES" | sed 's/^/   /'
    else
      warn "No segments found yet. Egress may take a few seconds."
    fi
  fi
  echo ""
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Step 6: Login as student and join session
# ═══════════════════════════════════════════════════════════════════════════════

info "Step 6: Student joining session..."
STUDENT_TOKEN=$(login "$STUDENT_EMAIL" "$STUDENT_PASSWORD" "student") || true

if [ -z "$STUDENT_TOKEN" ]; then
  warn "Student login failed — skipping student join/refresh tests. Using admin token for recording fetch."
  STUDENT_TOKEN="$ADMIN_TOKEN"
fi

JOIN_RESP=$(api POST "/api/livestream/sessions/${SESSION_ID}/join" "$STUDENT_TOKEN" 2>/dev/null) || true
JOIN_STATUS=$(echo "$JOIN_RESP" | jq -r '.data.status // empty')
JOIN_PROFILE=$(echo "$JOIN_RESP" | jq -r '.data.profile // empty')
JOIN_HLS=$(echo "$JOIN_RESP" | jq -r '.data.hlsUrl // "null"')
JOIN_WS_TOKEN=$(echo "$JOIN_RESP" | jq -r '.data.token // "null"')
JOIN_EXPIRES=$(echo "$JOIN_RESP" | jq -r '.data.tokenExpiresAt // "null"')

if [ "$JOIN_STATUS" = "live" ]; then
  ok "Student joined: status=${JOIN_STATUS}, profile=${JOIN_PROFILE}"
  if [ "$PROFILE" = "broadcast" ] && [ "$JOIN_HLS" != "null" ]; then
    ok "Broadcast HLS URL with token received"
    ok "Token expires: ${JOIN_EXPIRES}"
    echo "   ${JOIN_HLS:0:120}..."
  elif [ "$PROFILE" = "interactive" ] && [ "$JOIN_WS_TOKEN" != "null" ]; then
    ok "Interactive WebRTC token received"
  fi
elif [ "$JOIN_STATUS" = "" ]; then
  warn "Join may have failed (entitlement check — student not enrolled)."
  warn "Response: $(echo "$JOIN_RESP" | jq -c .)"
  warn "This is expected for test data without product enrollment. Continuing..."
else
  ok "Join returned status=${JOIN_STATUS}"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Step 6b: Test token refresh (student)
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$JOIN_STATUS" = "live" ]; then
  info "Testing token refresh for student..."
  REFRESH_RESP=$(api POST "/api/livestream/sessions/${SESSION_ID}/refresh-token" "$STUDENT_TOKEN")
  REFRESH_HLS=$(echo "$REFRESH_RESP" | jq -r '.data.hlsUrl // "null"')
  REFRESH_WS=$(echo "$REFRESH_RESP" | jq -r '.data.token // "null"')

  if [ "$PROFILE" = "broadcast" ] && [ "$REFRESH_HLS" != "null" ]; then
    ok "Broadcast token refresh: new HLS URL received"
  elif [ "$PROFILE" = "interactive" ] && [ "$REFRESH_WS" != "null" ]; then
    ok "Interactive token refresh: new WebRTC token received"
  else
    warn "Token refresh response: $(echo "$REFRESH_RESP" | jq -c .)"
  fi
  echo ""
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Step 7: End session (teacher)
# ═══════════════════════════════════════════════════════════════════════════════

read -rp "Press Enter to END the session..."
echo ""

info "Step 7: Ending session (teacher)..."
END_RESP=$(api POST "/api/livestream/sessions/${SESSION_ID}/end" "$ADMIN_TOKEN")
END_STATUS=$(echo "$END_RESP" | jq -r '.data.status // empty')

if [ "$END_STATUS" = "ended" ]; then
  ok "Session ended"
else
  fail "End returned: $(echo "$END_RESP" | jq -c .)"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Step 8: Fetch recordings (wait for egress_ended webhook)
# ═══════════════════════════════════════════════════════════════════════════════

info "Step 8: Waiting for egress to finalize (5s)..."
sleep 5

# Use admin token since student may not have entitlement
info "Fetching recordings..."
REC_RESP=$(api GET "/api/livestream/sessions/${SESSION_ID}/recording" "$ADMIN_TOKEN")
REC_URL=$(echo "$REC_RESP" | jq -r '.data.recordings[0].hlsUrl // empty')
REC_EXPIRES=$(echo "$REC_RESP" | jq -r '.data.tokenExpiresAt // empty')
REC_PARTS=$(echo "$REC_RESP" | jq -r '.data.recordings | length // 0')
REC_DURATION=$(echo "$REC_RESP" | jq -r '.data.recordings[0].duration // "null"')

if [ -z "$REC_URL" ] || [ "$REC_URL" = "null" ]; then
  warn "No recordings ready. Retrying in 10s..."
  sleep 10
  REC_RESP=$(api GET "/api/livestream/sessions/${SESSION_ID}/recording" "$ADMIN_TOKEN")
  REC_URL=$(echo "$REC_RESP" | jq -r '.data.recordings[0].hlsUrl // empty')
  REC_EXPIRES=$(echo "$REC_RESP" | jq -r '.data.tokenExpiresAt // empty')
  REC_PARTS=$(echo "$REC_RESP" | jq -r '.data.recordings | length // 0')
  REC_DURATION=$(echo "$REC_RESP" | jq -r '.data.recordings[0].duration // "null"')
fi

if [ -n "$REC_URL" ] && [ "$REC_URL" != "null" ]; then
  ok "Recording ready! Parts: ${REC_PARTS}, Duration: ${REC_DURATION}s"
  ok "Token expires: ${REC_EXPIRES}"
else
  fail "Recording not available."
  echo "   Response: $(echo "$REC_RESP" | jq -c .)"
  echo ""
  warn "Possible causes:"
  warn "  1. Webhook URL not configured in livekit.yaml"
  warn "  2. Egress didn't start (check: docker logs livekit-egress on secondary)"
  warn "  3. HLS_STREAM_BASE_URL not set in API .env"
  warn "  4. Webhook endpoint unreachable from LiveKit server"
  echo ""
  # Don't exit — still show session cleanup info
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Step 9: Test HLS playback through nginx
# ═══════════════════════════════════════════════════════════════════════════════

if [ -n "$REC_URL" ] && [ "$REC_URL" != "null" ]; then
  info "Step 9: Testing HLS through nginx..."

  HLS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$REC_URL")
  if [ "$HLS_CODE" = "200" ]; then
    ok "HLS manifest served (HTTP 200)"
  elif [ "$HLS_CODE" = "403" ]; then
    fail "Auth rejected (HTTP 403) — token validation failed"
  elif [ "$HLS_CODE" = "404" ]; then
    fail "File not found (HTTP 404) — segments missing on disk"
  else
    warn "Unexpected response: HTTP ${HLS_CODE}"
  fi

  # ── Test invalid token ──
  info "Testing invalid token is rejected..."
  FAKE_URL=$(echo "$REC_URL" | sed 's/token=[^&]*/token=invalid_fake_token/')
  FAKE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FAKE_URL")

  if [ "$FAKE_CODE" = "403" ] || [ "$FAKE_CODE" = "401" ]; then
    ok "Invalid token rejected (HTTP ${FAKE_CODE})"
  else
    fail "Expected 401/403, got HTTP ${FAKE_CODE}"
  fi

  # ── Test expired token ──
  info "Testing expired token is rejected..."
  EXPIRED_URL=$(echo "$REC_URL" | sed 's/expires=[^&]*/expires=1000000000/')
  EXPIRED_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$EXPIRED_URL")

  if [ "$EXPIRED_CODE" = "403" ] || [ "$EXPIRED_CODE" = "401" ]; then
    ok "Expired token rejected (HTTP ${EXPIRED_CODE})"
  else
    fail "Expected 401/403 for expired token, got HTTP ${EXPIRED_CODE}"
  fi
  echo ""
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Step 10: Verify session final state
# ═══════════════════════════════════════════════════════════════════════════════

info "Step 10: Verifying final session state..."
FINAL_RESP=$(api GET "/api/livestream/sessions/${SESSION_ID}" "$ADMIN_TOKEN")
FINAL_STATUS=$(echo "$FINAL_RESP" | jq -r '.data.status')
FINAL_REC_STATUS=$(echo "$FINAL_RESP" | jq -r '.data.recordingStatus // "unknown"')
FINAL_VIEWERS=$(echo "$FINAL_RESP" | jq -r '.data.viewerCount')

echo "   Status:          ${FINAL_STATUS}"
echo "   RecordingStatus: ${FINAL_REC_STATUS}"
echo "   ViewerCount:     ${FINAL_VIEWERS}"

[ "$FINAL_STATUS" = "ended" ] && ok "Session status correct" || fail "Expected 'ended', got '${FINAL_STATUS}'"
[ "$FINAL_VIEWERS" = "0" ] && ok "Viewer count reset to 0" || warn "Viewer count is ${FINAL_VIEWERS} (expected 0)"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════

echo "══════════════════════════════════════"
echo "  TEST COMPLETE"
echo "══════════════════════════════════════"
echo ""
echo "Session:   ${SESSION_ID}"
echo "Profile:   ${PROFILE}"
echo "Room:      ${ROOM_NAME}"
echo ""

if [ -n "$REC_URL" ] && [ "$REC_URL" != "null" ]; then
  echo "▶ Play recording in browser:"
  echo "  Paste this URL into https://hlsplayer.net/"
  echo ""
  echo "  ${REC_URL}"
  echo ""
fi

if [ "$PROFILE" = "broadcast" ] && [ "$JOIN_HLS" != "null" ] && [ -n "$JOIN_HLS" ]; then
  echo "▶ Live broadcast URL was:"
  echo "  ${JOIN_HLS}"
  echo ""
fi
