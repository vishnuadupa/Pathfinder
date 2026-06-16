import { useEffect, useRef, useState, useCallback } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { loadGraph } from './store/staticSlice';
import { appendRun, clearMetrics } from './store/metricsSlice';
import { ALGORITHMS } from './algorithms';
import { AnimationEngine, type AnimationMode, type AnimationFrame } from './animation/AnimationEngine';
import { MapView } from './components/Map/MapView';
import { Controls } from './components/Controls/Controls';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ComplexityPanel } from './components/Complexity/ComplexityPanel';
import type { AlgorithmId, RunRecord } from './types/algorithm';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing/Landing';
import './App.css';

function AppInner() {
  const dispatch = useAppDispatch();
  const { graph, loaded, error } = useAppSelector(s => s.static);
  const dynamicState = useAppSelector(s => s.dynamic);
  const runs = useAppSelector(s => s.metrics.runs);

  const [startNode, setStartNode] = useState<string | null>(null);
  const [endNode, setEndNode] = useState<string | null>(null);
  const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmId>('astar');
  const [animMode, setAnimMode] = useState<AnimationMode>('replay');
  const [animSpeed, setAnimSpeed] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [frame, setFrame] = useState<AnimationFrame | null>(null);
  const [showComplexity, setShowComplexity] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [noPathFound, setNoPathFound] = useState(false);
  const [isCapped, setIsCapped] = useState(false);

  const engineRef = useRef<AnimationEngine | null>(null);

  useEffect(() => { dispatch(loadGraph()); }, [dispatch]);

  const handleNodeSelect = useCallback((nodeId: string, type?: 'start' | 'end') => {
    if (isRunning) return;
    if (type === 'start') { setStartNode(nodeId); setFrame(null); return; }
    if (type === 'end') { setEndNode(nodeId); setFrame(null); return; }
    
    if (!startNode) { setStartNode(nodeId); return; }
    if (nodeId === startNode) return;
    if (!endNode || nodeId !== endNode) {
      setEndNode(nodeId);
      setFrame(null);
    }
  }, [startNode, endNode, isRunning]);

  const handleCalculate = useCallback(() => {
    if (!graph || !startNode || !endNode || isRunning) return;

    setIsRunning(true);
    setFrame(null);
    setCurrentStep(0);
    setNoPathFound(false);
    setIsCapped(false);

    // Run algorithm (synchronous — fast even at 15k nodes)
    const fastDs = {
      ...dynamicState,
      floodedSet: new Set(dynamicState.floodedNodes),
      closedSet: new Set(dynamicState.closedNodes)
    };
    const result = ALGORITHMS[selectedAlgo](graph, startNode, endNode, fastDs);

    const engine = new AnimationEngine((f) => {
      setFrame(f);
      setCurrentStep(f.currentStep);
      setTotalSteps(f.totalSteps);
      if (f.done) {
        setIsRunning(false);
        setIsCapped(result.capped || false);
        if (!result.found) setNoPathFound(true);
        const record: RunRecord = {
          ...result,
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          complexityFlags: { ...dynamicState.flags },
        };
        dispatch(appendRun(record));
      }
    }, animMode);

    engine.setSpeed(animSpeed);
    engine.load(result.visitedOrder, result.path, result.parents);
    engineRef.current?.stop();
    engineRef.current = engine;
    engine.play();
  }, [graph, startNode, endNode, isRunning, selectedAlgo, dynamicState, animMode, animSpeed, dispatch]);

  const handleSpeedChange = useCallback((s: number) => {
    setAnimSpeed(s);
    engineRef.current?.setSpeed(s);
  }, []);

  const handleReset = useCallback(() => {
    engineRef.current?.stop();
    engineRef.current = null;
    setStartNode(null);
    setEndNode(null);
    setFrame(null);
    setIsRunning(false);
    setCurrentStep(0);
    setTotalSteps(0);
    setNoPathFound(false);
    setIsCapped(false);
    dispatch(clearMetrics());
    // Note: complexity layers (traffic/rain/closures) are intentionally preserved between runs.
    // Use the Complexity panel's "Clear all" button to reset them.
  }, [dispatch]);

  const complexityActive = dynamicState.flags.traffic || dynamicState.flags.rain || dynamicState.flags.closures;

  if (!loaded) return (
    <div className="loading">
      <div className="loadingSpinner" />
      <p>Loading NYC graph…</p>
    </div>
  );

  if (error) return (
    <div className="error">
      <p>⚠ Failed to load graph: {error}</p>
      <p className="errorHint">Run <code>python build-graph/fetch_graph.py --manhattan</code> then restart the dev server.</p>
    </div>
  );

  return (
    <div className="app">
      <Controls
        selectedAlgo={selectedAlgo}
        onAlgoChange={a => { setSelectedAlgo(a); setFrame(null); setNoPathFound(false); }}
        animationMode={animMode}
        onModeChange={setAnimMode}
        animSpeed={animSpeed}
        onSpeedChange={handleSpeedChange}
        onCalculate={handleCalculate}
        onReset={handleReset}
        onComplexityOpen={() => setShowComplexity(true)}
        canCalculate={!!startNode && !!endNode}
        isRunning={isRunning}
        complexityActive={complexityActive}
      />

      <div className="content">
        <div className="mapArea">
          <MapView
            graph={graph}
            startNode={startNode}
            endNode={endNode}
            onNodeSelect={handleNodeSelect}
            animationFrame={frame}
            floodedNodes={dynamicState.floodedNodes}
            closedNodes={dynamicState.closedNodes}
            trafficEdges={dynamicState.trafficMultipliers}
            isRunning={isRunning}
          />
          {!startNode && (
            <div className="hint">Click the map to place your <strong>Start</strong> point</div>
          )}
          {startNode && !endNode && (
            <div className="hint">Now click to place your <strong>End</strong> point</div>
          )}
          {noPathFound && (
            <div className="hint hintError">
              {isCapped ? (
                <>⚠ Search limit reached (5,000 nodes). Try disabling complexity layers or choosing points closer together.</>
              ) : (
                <>⚠ No path found — try disabling some complexity layers or choosing different points</>
              )}
            </div>
          )}
        </div>
        <Sidebar
          algorithmId={selectedAlgo}
          currentStep={currentStep}
          totalSteps={totalSteps}
          isRunning={isRunning}
        />
      </div>

      <Dashboard runs={runs} />

      {showComplexity && graph && (
        <ComplexityPanel graph={graph} onClose={() => setShowComplexity(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<AppInner />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}
