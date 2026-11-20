# How to play

Goal: survive waves of mice and rats, score high, keep Colby alive. You start with 3 lives and 1 yarn bomb.

## Controls
- Rotate: Left/Right or A/D. Thrust: Up or W. Fire: Space (max 4 shots, 0.16 s cooldown). Yarn bomb: X or B. Pause: P or Esc. Mute: M. Confirm menus: Enter.
- Gamepad: left stick or d-pad steers; A, R1, R2 thrust; X, B, L2 fire; Y or L1 bomb; Start pauses. Touch: drag the left half to steer, FIRE / BOMB / THRUST buttons on the right.

## Flight
Colby keeps momentum (drag is low, top speed 330). Thrust along the nose, rotate to aim. The outer rail and the central Mouse Hole box are bouncy walls (speed kept at 88%). Shots bounce once.

## Enemies
| Enemy | HP | Points | Behaviour |
|---|---|---|---|
| Mouse | 1 | 100 | straight lines, bounces |
| Rat | 2 | 250 | homes on Colby |
| Commander | 3 | 500 | slow, fires cheese-pellet bursts, drops tuna |
| Cheese mine | 1 | 150 | drifts, bursts into 6 crumbs |
| Death Rat | unkillable | 0 | hunts you once a wave runs past 42 s |

Enemies launch out of the Mouse Hole. Clear all mice, rats, commanders and mines to finish the wave. Kill fast: the Death Rat is faster than you can outrun for long, so do not camp.

## Pickups and bombs
Tuna gives +500 and +1 yarn bomb (max 3); it vanishes after 8 s. A yarn bomb clears everything within a 170 unit blast radius.

## Lives and score
Extra lives at 10,000, 30,000 and every 30,000 after. After a death you are invulnerable for 2.5 s. High scores (arcade initials) are saved in your browser.

## Hull and difficulty
Colby has a hull per life. Any hit (enemy, pellet, mine, Death Rat) removes 1 hull point, knocks you back, and gives about 1 s of blinking invulnerability. The Death Rat removes 2 (but never takes your last point). At 0 hull you lose a life; hull refills on respawn. Hull pips sit beside the lives (green, amber, red). Pick difficulty on the title screen or in Options, or with `?difficulty=`:

| Level | Hull |
|---|---|
| hard | 3 |
| normal (default) | 5 |
| easy | 8 |
| kitten | 13 |
| classic (URL only) | 1, as in the 2D game |

## Tips
- Stay out of the far lane behind the box; enemies that bounce vertically there are hard to reach, so relocate.
- Over-dodging stalls kills. Dodge close threats only (bot tuning: radius 70 beat 95 and 130).
- Lower quality (`?quality=low`) if frame rate dips; the game also auto-downgrades.
