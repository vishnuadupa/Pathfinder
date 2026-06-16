import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { StaticState } from '../types/state';
import type { GraphData } from '../types/graph';

export const loadGraph = createAsyncThunk<GraphData>('static/loadGraph', async () => {
  const resp = await fetch('/graph.json');
  if (!resp.ok) throw new Error(`Failed to load graph: ${resp.status}`);
  return resp.json() as Promise<GraphData>;
});

const initialState: StaticState = { graph: null, loaded: false, error: null };

const staticSlice = createSlice({
  name: 'static',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadGraph.fulfilled, (state, action) => {
        state.graph = action.payload;
        state.loaded = true;
        state.error = null;
      })
      .addCase(loadGraph.rejected, (state, action) => {
        state.error = action.error.message ?? 'Unknown error';
        state.loaded = true;
      });
  },
});

export default staticSlice.reducer;
