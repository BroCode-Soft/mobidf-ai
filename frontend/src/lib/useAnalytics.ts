"use client";
import { useEffect, useRef } from "react";
import { sendHeartbeat } from "./analytics";

export function useAnalytics(page: string) {
  const pageRef = useRef(page);
  pageRef.current = page;

  useEffect(() => {
    sendHeartbeat(pageRef.current);
    const interval = setInterval(() => sendHeartbeat(pageRef.current), 30_000);
    return () => clearInterval(interval);
  }, []);
}
