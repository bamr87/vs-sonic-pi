#!/usr/bin/env bash
set -euo pipefail

AUDIO_STREAM_PORT="${AUDIO_STREAM_PORT:-8080}"
AUDIO_STREAM_ENABLED="${AUDIO_STREAM_ENABLED:-true}"
SAMPLE_RATE=44100
CHANNELS=2

log() { echo "[start-audio] $*"; }

# ── Clean stale shared-memory from previous runs ─────────────────────
log "Cleaning stale shared-memory files..."
rm -f /dev/shm/jack-* /dev/shm/SuperCollider* 2>/dev/null || true
rm -rf /dev/shm/jack_db-* 2>/dev/null || true

# ── PulseAudio ───────────────────────────────────────────────────────
if ! pulseaudio --check 2>/dev/null; then
  log "Starting PulseAudio daemon..."
  pulseaudio --start --exit-idle-time=-1 --daemonize=yes \
    --log-target=stderr --log-level=warning 2>&1 || true
  sleep 1
fi

if pulseaudio --check 2>/dev/null; then
  log "PulseAudio running"
  pactl load-module module-null-sink \
    sink_name=virtual_output \
    sink_properties=device.description="Virtual_Output" 2>/dev/null || true
  pactl set-default-sink virtual_output 2>/dev/null || true
else
  log "WARNING: PulseAudio failed to start. Audio may not work."
fi

# ── JACK (dummy driver) ─────────────────────────────────────────────
if command -v jackd >/dev/null 2>&1; then
  if ! pgrep -x jackd >/dev/null 2>&1; then
    log "Starting JACK with dummy driver..."
    jackd -d dummy -r "$SAMPLE_RATE" -p 1024 &
    disown
    sleep 1
    log "JACK started"
  else
    log "JACK already running"
  fi
fi

# ── Audio streaming (ffmpeg: PulseAudio monitor -> HTTP MP3) ─────────
if [ "$AUDIO_STREAM_ENABLED" = "true" ] && command -v ffmpeg >/dev/null 2>&1; then
  if ! pgrep -f "ffmpeg.*listen" >/dev/null 2>&1; then
    log "Starting audio stream on port $AUDIO_STREAM_PORT..."
    ffmpeg -hide_banner -loglevel warning \
      -f pulse -i virtual_output.monitor \
      -ac "$CHANNELS" -ar "$SAMPLE_RATE" \
      -f mp3 -b:a 128k \
      -listen 1 "http://0.0.0.0:${AUDIO_STREAM_PORT}" &
    disown
    log "Audio stream available at http://localhost:${AUDIO_STREAM_PORT}"
  else
    log "Audio stream already running"
  fi
else
  if [ "$AUDIO_STREAM_ENABLED" != "true" ]; then
    log "Audio streaming disabled (AUDIO_STREAM_ENABLED=$AUDIO_STREAM_ENABLED)"
  else
    log "ffmpeg not found, audio streaming unavailable"
  fi
fi

log "Audio subsystem ready"
