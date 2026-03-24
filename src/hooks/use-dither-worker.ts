import { useRef, useCallback, useEffect } from "react";
import type { AlgorithmId, ImageParams } from "@/lib/types";
import type { WorkerResponse } from "@/workers/dither.worker";

interface UseDitherWorkerOptions {
  onResult: (result: ImageData, type: "process" | "thumbnail", algorithm: AlgorithmId, id: number) => void;
}

export function useDitherWorker({ onResult }: UseDitherWorkerOptions) {
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../workers/dither.worker.ts", import.meta.url),
      { type: "module" }
    );

    workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { type, result, algorithm, id } = e.data;
      onResult(result, type, algorithm, id);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [onResult]);

  const process = useCallback(
    (
      imageData: ImageData,
      params: ImageParams,
      algorithm: AlgorithmId,
      type: "process" | "thumbnail" = "process"
    ) => {
      if (!workerRef.current) return -1;
      idRef.current += 1;
      workerRef.current.postMessage({
        type,
        imageData,
        params,
        algorithm,
        id: idRef.current,
      });
      return idRef.current;
    },
    []
  );

  return { process };
}
