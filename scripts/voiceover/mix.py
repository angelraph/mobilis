"""Lay each narration clip onto the recorded video at the moment its caption
appeared (vo/marks.json), and encode an MP4 anyone can play."""
import glob
import json
import os
import subprocess
import sys

import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser("~"), "Desktop", "Mobilis-demo-voiceover.mp4")

video = max(glob.glob(os.path.join(HERE, "video", "*.webm")), key=os.path.getmtime)
marks = json.load(open(os.path.join(HERE, "vo", "marks.json"), encoding="utf-8"))

cmd = [FFMPEG, "-y", "-i", video]
filters = []
for i, m in enumerate(marks, start=1):
    cmd += ["-i", os.path.join(HERE, "vo", f"{m['id']}.wav")]
    delay = int(m["t"] * 1000) + 150
    filters.append(f"[{i}:a]aresample=48000,adelay={delay}|{delay}[a{i}]")
labels = "".join(f"[a{i}]" for i in range(1, len(marks) + 1))
filters.append(f"{labels}amix=inputs={len(marks)}:normalize=0,volume=1.6[voice]")

cmd += [
    "-filter_complex", ";".join(filters),
    "-map", "0:v", "-map", "[voice]",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    OUT,
]
subprocess.run(cmd, check=True)
print("WROTE", OUT)
