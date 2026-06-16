import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DynamicState } from '../types/state';

const initialState: DynamicState = {
  flags: { traffic: false, rain: false, closures: false },
  trafficMultipliers: {},
  floodedNodes: [],
  closedNodes: [],
};

const dynamicSlice = createSlice({
  name: 'dynamic',
  initialState,
  reducers: {
    setTraffic(state, action: PayloadAction<{ multipliers: Record<string, number>; enabled: boolean }>) {
      state.flags.traffic = action.payload.enabled;
      state.trafficMultipliers = action.payload.enabled ? action.payload.multipliers : {};
    },
    setRain(state, action: PayloadAction<{ floodedNodes: string[]; enabled: boolean }>) {
      state.flags.rain = action.payload.enabled;
      state.floodedNodes = action.payload.enabled ? action.payload.floodedNodes : [];
    },
    setClosures(state, action: PayloadAction<{ closedNodes: string[]; enabled: boolean }>) {
      state.flags.closures = action.payload.enabled;
      state.closedNodes = action.payload.enabled ? action.payload.closedNodes : [];
    },
    clearDynamic(state) {
      state.flags = { traffic: false, rain: false, closures: false };
      state.trafficMultipliers = {};
      state.floodedNodes = [];
      state.closedNodes = [];
    },
  },
});

export const { setTraffic, setRain, setClosures, clearDynamic } = dynamicSlice.actions;
export default dynamicSlice.reducer;
