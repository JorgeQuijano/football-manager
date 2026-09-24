
## v0.42.1 — one clock for the board, or pause isn't pause

Pausing a match stopped the ball but the players kept moving, because two clocks
disagreed: the stroke machine read the clock's `playing` flag, while `stepPlayer`
integrated the bodies off every animation frame's `dt`. Half a pause is worse than
no pause — it reads as a bug in the engine rather than a control.

One decision, one place: `frameStep(now, last, playing)` in `src/ui/frame-clock.ts`
returns the step the whole board takes this frame (0 when paused, clamped at 100 ms
otherwise). The loop feeds it to `tick`, and everything downstream — bodies,
intents, ball phases, flashes, the playhead, the persist timer — freezes together.

`last` is refreshed even when paused. That is the part worth keeping: the body
freezes, but the *timestamp* does not, so a resume takes a normal 16 ms step
instead of lurching forward by however long the pause lasted. A test simulates 15
seconds of pause frame by frame and asserts the resume step is normal-sized.
