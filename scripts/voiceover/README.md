# Narrated demo video

How `ui/media/mobilis-demo.mp4` is made. Each step of the recording waits
for its narration line to finish, so the voice and the screen stay in sync.

1. `powershell -File tts.ps1` speaks `narration.json` into `vo/*.wav` (Windows voice) and writes `vo/durations.json`.
2. Start a fresh ledger: `sh scripts/demo-ledger.sh`.
3. `node record.js` (needs `npm i playwright`) drives all four roles in `demo-wall.html` and writes `video/*.webm` plus `vo/marks.json` (when each caption appeared).
4. `python mix.py <out.mp4>` (needs `pip install imageio-ffmpeg`) lays each clip onto the video at its mark and encodes an MP4.
