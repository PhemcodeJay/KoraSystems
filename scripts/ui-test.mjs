import { useCallback, useEffect, useRef, useState } from "react";

export function useDebounce(callback, ms) {
  const timer = useRef(null);
  const fn = useRef(callback);
  fn.current = callback;

  const handler = useCallback(
    ((...args) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn.current(...args), ms);
    }),
    [ms]
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      fn.current();
    }
  }, []);

  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => () => cancel(), [cancel]);

  return { handler, flush, cancel };
}
