# audio report
## What I built
src/audio/audio.js (createAudio({bus,settings}) -> {resume,setVolume(v,kind),play(name|{name,x},x),music(name|null),muted}), sfx.js (all 20 defs.SFX), music.js (5 defs.MUSIC synthwave songs, 16 bars, lookahead scheduler; gameover plays once). Pan from x/W. Subscribes to bus sfx/music/pause. Offline stub when no AudioContext.
## Verification evidence
node test/audio.test.mjs -> "audio ok" (stub + fake-ctx run of every SFX and 400 scheduler ticks per song). No real audible/browser check done.
## Deviations
None. Music event payload assumed {name}; string also accepted.
## Mistakes and fixes
None.
## Learnings
Fake AudioContext lets Node exercise synth graph code.
## Requests
Call audio.resume() on first user gesture (main). Emit music {name:null} to stop.
