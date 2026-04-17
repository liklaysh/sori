import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

export const useHardwareTest = (activeMicId?: string) => {
  const [testStream, setTestStream] = useState<MediaStream | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const stopHardwareTest = () => {
    if (testStream) {
      testStream.getTracks().forEach(track => track.stop());
      setTestStream(null);
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn("[HardwareTest] Error closing AudioContext", e);
      }
    }
    setIsTesting(false);
    setAudioLevel(0);
  };

  const startHardwareTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { deviceId: activeMicId ? { exact: activeMicId } : undefined }
      });
      setTestStream(stream);
      setIsTesting(true);
      
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) throw new Error("AudioContext not supported");
      
      if (stream.getAudioTracks().length === 0) throw new Error("No audio tracks");
      
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') await ctx.resume();
      
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const updateLevel = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        setAudioLevel(Math.min(100, average * 1.5));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch (err) {
      console.error("[HardwareTest] Failed", err);
      toast.error("Could not access camera or microphone.");
    }
  };

  useEffect(() => {
    if (isTesting && testStream && videoRef.current) {
      videoRef.current.srcObject = testStream;
    }
  }, [isTesting, testStream]);

  useEffect(() => {
    return () => stopHardwareTest();
  }, []);

  return {
    isTesting,
    testStream,
    audioLevel,
    videoRef,
    startHardwareTest,
    stopHardwareTest
  };
};
