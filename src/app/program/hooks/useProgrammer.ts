"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export interface Board {
  id: string;
  name: string;
  fpgaFamily: string;
  boardType: string;
  status: string;
  capabilities: string[];
}

export interface JobItem {
  id: string;
  boardId: string;
  bitstreamName: string;
  status: string;
  createdAt: string;
}

export function useProgrammer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedBoardId = searchParams.get("boardId");

  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState(preSelectedBoardId || "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logConnected, setLogConnected] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [recentJobs, setRecentJobs] = useState<JobItem[]>([]);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Fetch registered boards
  const fetchBoards = useCallback(async () => {
    try {
      const res = await fetch("/api/boards");
      const data = await res.json();
      if (data.boards) setBoards(data.boards);
    } catch {}
  }, []);

  // Fetch recent jobs
  const fetchRecentJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (data.jobs) setRecentJobs(data.jobs.slice(0, 5));
    } catch {}
  }, []);

  useEffect(() => {
    fetchBoards();
    fetchRecentJobs();
  }, [fetchBoards, fetchRecentJobs]);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;
    let redirected = false;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        if (data.job) {
          setJobStatus(data.job.status);
          if (data.job.status === "success") {
            clearInterval(interval);
            if (data.job.logs && !logs.includes(data.job.logs)) {
              setLogs((prev) => [...prev, "\n" + data.job.logs]);
            }
            if (!redirected && selectedBoardId) {
              redirected = true;
              setIsRedirecting(true);
              fetchRecentJobs();
              setTimeout(() => {
                router.push(`/monitor/${selectedBoardId}`);
              }, 1500);
            }
          } else if (data.job.status === "failed") {
            clearInterval(interval);
            if (data.job.logs && !logs.includes(data.job.logs)) {
              setLogs((prev) => [...prev, "\n" + data.job.logs]);
            }
            fetchRecentJobs();
          }
        }
      } catch {
        // keep polling
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId, selectedBoardId, router, fetchRecentJobs, logs]);

  // WebSocket for real-time logs
  useEffect(() => {
    if (!jobId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(
      `${protocol}//${window.location.host}/ws/logs/${jobId}`
    );

    setLogConnected(false);
    setLogError(null);

    ws.onopen = () => {
      setLogConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "job-log") {
          setLogs((prev) => [...prev, msg.data]);
        } else if (msg.type === "job-complete") {
          setJobStatus(msg.success ? "success" : "failed");
          fetchRecentJobs();
          if (msg.success && selectedBoardId) {
            setIsRedirecting(true);
            setTimeout(() => {
              router.push(`/monitor/${selectedBoardId}`);
            }, 1500);
          }
        }
      } catch {
        // ignore
      }
    };

    ws.onerror = () => {
      setLogError("Live logs unavailable");
    };

    ws.onclose = () => {
      setLogConnected(false);
    };

    return () => ws.close();
  }, [jobId, selectedBoardId, router, fetchRecentJobs]);

  const handleFileSelected = useCallback((f: File) => {
    setFile(f);
    setError("");
    setDemoLoaded(false);
  }, []);

  const loadDemoBitstream = useCallback(async () => {
    try {
      const res = await fetch("/demo/blinky.bit");
      const blob = await res.blob();
      const demoFile = new File([blob], "blinky.bit", {
        type: "application/octet-stream",
      });
      setFile(demoFile);
      setDemoLoaded(true);
      setError("");
    } catch {
      setError("Failed to load demo bitstream");
    }
  }, []);

  const removeSelectedFile = useCallback(() => {
    setDemoLoaded(false);
    setFile(null);
  }, []);

  const resetProgrammerState = useCallback(() => {
    setFile(null);
    setJobId(null);
    setJobStatus(null);
    setLogs([]);
    setError("");
    setDemoLoaded(false);
    setIsRedirecting(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedBoardId || !file) {
      setError("Please select a board and upload a bitstream file");
      return;
    }

    setError("");
    setUploading(true);
    setLogs([]);
    setJobStatus(null);
    setJobId(null);
    setLogConnected(false);
    setLogError(null);
    setIsRedirecting(false);

    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append("bitstream", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setError(uploadData.error || "Upload failed");
        setUploading(false);
        return;
      }

      // Step 2: Create job
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId: selectedBoardId,
          bitstreamPath: uploadData.filePath,
          bitstreamName: uploadData.fileName,
        }),
      });

      const jobData = await jobRes.json();

      if (!jobRes.ok) {
        setError(jobData.error || "Failed to create job");
        setUploading(false);
        return;
      }

      setJobId(jobData.id);
      setJobStatus(jobData.status);
      setLogs([`Job ${jobData.id} created — status: ${jobData.status}\n`]);
      fetchRecentJobs();
    } catch {
      setError("Failed to submit job. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [selectedBoardId, file, fetchRecentJobs]);

  const availableBoards = boards.filter(
    (b) => b.status !== "offline" || b.id === selectedBoardId
  );

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  return {
    boards,
    availableBoards,
    selectedBoard,
    selectedBoardId,
    setSelectedBoardId,
    file,
    uploading,
    jobStatus,
    jobId,
    logs,
    logConnected,
    logError,
    error,
    demoLoaded,
    recentJobs,
    isRedirecting,
    handleFileSelected,
    loadDemoBitstream,
    removeSelectedFile,
    resetProgrammerState,
    handleSubmit,
  };
}
