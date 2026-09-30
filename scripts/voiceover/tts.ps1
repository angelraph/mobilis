# Speaks each line of narration.json into vo/<id>.wav with the built-in
# Windows voice, and records each clip's length in vo/durations.json.
$dir = $PSScriptRoot
New-Item -ItemType Directory -Force "$dir\vo" | Out-Null
Add-Type -AssemblyName System.Speech
$items = Get-Content "$dir\narration.json" -Raw | ConvertFrom-Json
$out = @{}
foreach ($it in $items) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice("Microsoft David Desktop")
  $s.Rate = 1
  $wav = "$dir\vo\$($it.id).wav"
  $s.SetOutputToWaveFile($wav)
  $s.Speak($it.text)
  $s.Dispose()
  $bytes = (Get-Item $wav).Length
  $fs = [System.IO.File]::OpenRead($wav)
  $br = New-Object System.IO.BinaryReader($fs)
  $fs.Seek(28, 'Begin') | Out-Null
  $byteRate = $br.ReadInt32()
  $br.Close()
  $out[$it.id] = [math]::Round(($bytes - 44) / $byteRate, 2)
}
$out | ConvertTo-Json | Out-File -Encoding utf8 "$dir\vo\durations.json"
Get-Content "$dir\vo\durations.json"
