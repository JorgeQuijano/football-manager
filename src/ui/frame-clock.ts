/**
 * The match board's frame clock (v0.42.1).
 *
 * Pause used to stop the ball but not the men: the stroke machine was gated on
 * the clock while `stepPlayer` integrated the bodies on every animation frame.
 * One decision in one place now drives the whole board, and `last` is refreshed
 * on every frame either way — so a resume picks up a normal-sized step instead
 * of jumping forward by however long the pause lasted.
 */
export interface FrameStep {
  /** seconds the board advances this frame; 0 means "frozen" */
  dt: number;
  /** the timestamp the next frame compares against */
  last: number;
}

export const FRAME_MAX_DT = 0.1;

export function frameStep(now: number, last: number, playing: boolean): FrameStep {
  if (!playing) return { dt: 0, last: now };
  return { dt: Math.min(FRAME_MAX_DT, Math.max(0, (now - last) / 1000)), last: now };
}
