export type AnimationMode = 'replay' | 'realtime';

export interface AnimationFrame {
  exploredEdges: [string, string][];
  frontierNodes: string[];
  pathNodes: string[];
  parents: Record<string, string | null>;
  currentStep: number;
  totalSteps: number;
  done: boolean;
}

type FrameCallback = (frame: AnimationFrame) => void;

export class AnimationEngine {
  private visitedOrder: string[] = [];
  private path: string[] = [];
  private parents: Record<string, string | null> = {};
  private stepIndex = 0;
  private rafId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onFrame: FrameCallback;
  private mode: AnimationMode;
  // Speed multiplier: 1 = normal, 2 = double speed, 0.5 = half speed
  speedMultiplier = 1;

  constructor(onFrame: FrameCallback, mode: AnimationMode = 'replay') {
    this.onFrame = onFrame;
    this.mode = mode;
  }

  load(visitedOrder: string[], path: string[], parents: Record<string, string | null>) {
    this.visitedOrder = visitedOrder;
    this.path = path;
    this.parents = parents;
    this.stepIndex = 0;
  }

  play() {
    this.stop();
    if (this.mode === 'replay') this._replayLoop();
    else this._realtimeLoop();
  }

  stop() {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.intervalId !== null) { clearInterval(this.intervalId); this.intervalId = null; }
  }

  reset() {
    this.stop();
    this.stepIndex = 0;
    this.visitedOrder = [];
    this.path = [];
    this.parents = {};
  }

  setMode(mode: AnimationMode) { this.mode = mode; }

  /** Adjust playback speed. multiplier > 1 = faster, < 1 = slower. */
  setSpeed(multiplier: number) {
    this.speedMultiplier = Math.max(0.25, multiplier);
  }

  private _emit(done = false) {
    const explored = this.visitedOrder.slice(0, this.stepIndex);

    // Wavefront consists of the last few nodes added in the current batch
    const wavefrontSize = Math.max(1, Math.min(12, Math.ceil(this.visitedOrder.length / 100)));
    const startIdx = Math.max(0, this.stepIndex - wavefrontSize);
    const frontierNodes = this.visitedOrder.slice(startIdx, this.stepIndex);

    // ISSUE 2 FIX: Removed `this.parents[n]` truthy-check from filter so the
    // start node (parent === null) is included. A null-guard inside the map
    // body prevents the non-null assertion from throwing; start node is simply
    // dropped (it has no incoming edge to draw), while all other explored
    // nodes that are NOT on the final path still produce an edge.
    const exploredEdges: [string, string][] = explored
      .map(n => {
        const p = this.parents[n];
        return p != null ? [p, n] as [string, string] : null;
      })
      .filter((e): e is [string, string] => e !== null);

    this.onFrame({
      exploredEdges,
      frontierNodes: done ? [] : frontierNodes,
      pathNodes: done ? this.path : [],
      parents: this.parents,
      currentStep: this.stepIndex,
      totalSteps: this.visitedOrder.length,
      done,
    });
  }

  // ISSUE 1 FIX: "Fast (2s)" mode — uses rAF, targets ~2s total playback.
  private _replayLoop() {
    const total = this.visitedOrder.length;

    // Edge case: nothing to animate (no path found or 0 nodes visited)
    if (total === 0) { this._emit(true); return; }

    // Target ~2s total. At 60fps = 120 frames → batch = ceil(total/120).
    // speedMultiplier scales batch size: higher multiplier = larger batch per frame = faster.
    const BATCH = Math.min(80, Math.max(1, Math.ceil(total / 120))) * this.speedMultiplier;

    const tick = () => {
      if (this.stepIndex >= total) { this._emit(true); return; }
      this.stepIndex = Math.min(this.stepIndex + Math.ceil(BATCH), total);
      this._emit(false);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  // ISSUE 1 FIX: "Slow (4s)" mode — uses rAF with a timestamp accumulator
  // to fire one step every ~33ms (≈30fps feel), giving a noticeably slower
  // playback than the fast mode. Replaces the old setInterval(16ms) approach.
  private _realtimeLoop() {
    const total = this.visitedOrder.length;

    // Edge case: nothing to animate
    if (total === 0) { this._emit(true); return; }

    // Target ~4s total. Fire one batch every ~33ms (30fps feel for slow mode).
    // speedMultiplier scales the batch: larger batch = completes faster.
    const STEP_INTERVAL_MS = 33; // ~30fps feel
    const STEPS = Math.max(1, Math.ceil(total / (4000 / STEP_INTERVAL_MS))) * this.speedMultiplier;

    let lastTime: number | null = null;
    let accumulator = 0;

    const tick = (timestamp: number) => {
      if (lastTime !== null) {
        accumulator += timestamp - lastTime;
      }
      lastTime = timestamp;

      // Advance one batch for every STEP_INTERVAL_MS elapsed
      while (accumulator >= STEP_INTERVAL_MS) {
        accumulator -= STEP_INTERVAL_MS;
        if (this.stepIndex >= total) {
          this._emit(true);
          return; // stop rAF loop
        }
        this.stepIndex = Math.min(this.stepIndex + Math.ceil(STEPS), total);
        this._emit(false);
      }

      if (this.stepIndex < total) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this._emit(true);
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }
}
