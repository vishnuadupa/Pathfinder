import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MetricsState } from '../types/state';
import type { RunRecord } from '../types/algorithm';

const initialState: MetricsState = { runs: [] };

const metricsSlice = createSlice({
  name: 'metrics',
  initialState,
  reducers: {
    appendRun(state, action: PayloadAction<RunRecord>) {
      state.runs.push(action.payload);
    },
    clearMetrics(state) {
      state.runs = [];
    },
  },
});

export const { appendRun, clearMetrics } = metricsSlice.actions;
export default metricsSlice.reducer;
