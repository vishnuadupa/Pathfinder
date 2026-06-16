import { configureStore } from '@reduxjs/toolkit';
import staticReducer from './staticSlice';
import dynamicReducer from './dynamicSlice';
import metricsReducer from './metricsSlice';

export const store = configureStore({
  reducer: {
    static: staticReducer,
    dynamic: dynamicReducer,
    metrics: metricsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
