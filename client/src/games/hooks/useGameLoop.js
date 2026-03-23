import { useRef, useEffect, useCallback } from 'react';

export const useGameLoop = (calculateNextState, render, isRunning = true) => {
  const requestRef = useRef();
  const previousTimeRef = useRef();
  const calculateRef = useRef(calculateNextState);
  const renderRef = useRef(render);

  useEffect(() => {
    calculateRef.current = calculateNextState;
  }, [calculateNextState]);

  useEffect(() => {
    renderRef.current = render;
  }, [render]);

  const animate = useCallback((currentTime) => {
    if (previousTimeRef.current === undefined) {
      previousTimeRef.current = currentTime;
    }

    const deltaTime = (currentTime - previousTimeRef.current) / 1000;
    previousTimeRef.current = currentTime;

    const clampedDelta = Math.min(deltaTime, 0.1);

    if (calculateRef.current) {
      calculateRef.current(clampedDelta);
    }

    if (renderRef.current) {
      renderRef.current();
    }

    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (isRunning) {
      previousTimeRef.current = undefined;
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isRunning, animate]);

  const start = useCallback(() => {
    previousTimeRef.current = undefined;
    requestRef.current = requestAnimationFrame(animate);
  }, [animate]);

  const stop = useCallback(() => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    previousTimeRef.current = undefined;
  }, []);

  return { start, stop, reset };
};

export default useGameLoop;
