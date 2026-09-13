// ============================================================
// Ten-frame domain. Two frames of five-by-two, so 0–20.
// Backs the K counting stub and the G1 add/subtract stub.
// ============================================================

export const FRAME_SIZE = 10;
export const FRAME_COUNT = 2;
export const TEN_FRAME_CAPACITY = FRAME_SIZE * FRAME_COUNT;

export interface TenFrameState {
  filled: number; // 0..TEN_FRAME_CAPACITY
}

export const emptyTenFrame = (): TenFrameState => ({ filled: 0 });

export const tenFrameValue = (s: TenFrameState): number => s.filled;

export const clampTenFrame = (s: TenFrameState): TenFrameState => ({
  filled: Math.max(0, Math.min(TEN_FRAME_CAPACITY, Math.round(s.filled))),
});
