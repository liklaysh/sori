import React from "react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  Slider,
  Button,
  cn
} from "@sori/ui";
import { 
  Camera, 
  Waves 
} from "lucide-react";
import { useHardwareTest } from "../../../hooks/useHardwareTest";

interface VoiceVideoTabProps {
  micGain: number;
  setMicGain: (val: number) => void;
  outputVolume: number;
  setOutputVolume: (val: number) => void;
  micDevices: MediaDeviceInfo[];
  activeMicId?: string;
  setActiveMic: (id: string) => void;
  outputDevices: MediaDeviceInfo[];
  activeOutputId?: string;
  setActiveOutput: (id: string) => void;
  noiseSuppression: boolean;
  toggleNoiseSuppression: () => void;
}

export const VoiceVideoTab: React.FC<VoiceVideoTabProps> = ({
  micGain, setMicGain, outputVolume, setOutputVolume,
  micDevices, activeMicId, setActiveMic,
  outputDevices, activeOutputId, setActiveOutput,
  noiseSuppression, toggleNoiseSuppression
}) => {
  const hardware = useHardwareTest(activeMicId);

  return (
    <div className="space-y-8 md:space-y-12 animate-in slide-in-from-bottom-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white mb-2">Voice & Video</h1>
        <p className="text-sori-text-muted text-sm">Configure your hardware and audio quality.</p>
      </div>

      <div className="space-y-6 md:space-y-8 pb-12">
         {/* Input/Output Selectors */}
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-sori-primary tracking-widest ml-1">Input Device</label>
              <Select value={activeMicId} onValueChange={setActiveMic}>
                <SelectTrigger className="w-full bg-sori-surface-base border-sori-border-subtle font-bold text-sm">
                  <SelectValue placeholder="Select Microphone" />
                </SelectTrigger>
                <SelectContent className="bg-sori-surface-panel border-sori-border-medium text-white rounded-xl shadow-2xl z-[2001]">
                  {micDevices.map(d => (
                    <SelectItem key={d.deviceId} value={d.deviceId || "default"} className="py-3">
                      {d.label || "Microphone"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-sori-secondary tracking-widest ml-1">Output Device</label>
              <Select value={activeOutputId} onValueChange={setActiveOutput}>
                <SelectTrigger className="w-full bg-sori-surface-base border-sori-border-subtle font-bold text-sm">
                  <SelectValue placeholder="Select Speaker" />
                </SelectTrigger>
                <SelectContent className="bg-sori-surface-panel border-sori-border-medium text-white rounded-xl shadow-2xl z-[2001]">
                  {outputDevices.map(d => (
                    <SelectItem key={d.deviceId} value={d.deviceId || "default"} className="py-3">
                      {d.label || "Speaker"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
         </div>

         {/* Volume Sliders */}
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
            <div className="bg-sori-surface-panel rounded-[2rem] p-6 border border-sori-border-subtle">
              <div className="flex justify-between items-center mb-6 px-2">
                 <span className="text-[10px] font-black uppercase text-sori-text-muted">Input Volume</span>
                 <span className="text-[11px] font-black text-white">{micGain}%</span>
              </div>
              <Slider value={[micGain]} onValueChange={([val]: number[]) => setMicGain(val)} max={100} step={1} />
            </div>
            <div className="bg-sori-surface-panel rounded-[2rem] p-6 border border-sori-border-subtle">
              <div className="flex justify-between items-center mb-6 px-2">
                 <span className="text-[10px] font-black uppercase text-sori-text-muted">Output Volume</span>
                 <span className="text-[11px] font-black text-white">{outputVolume}%</span>
              </div>
              <Slider value={[outputVolume]} onValueChange={([val]: number[]) => setOutputVolume(val)} max={200} step={1} />
            </div>
         </div>

          {/* Noise Suppression */}
          <div className="bg-sori-surface-panel rounded-[2rem] p-6 border border-sori-border-subtle flex items-center justify-between">
             <div className="flex items-center gap-5">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center border border-sori-border-subtle",
                  noiseSuppression ? 'bg-sori-surface-elevated text-sori-primary' : 'bg-sori-surface-base text-sori-text-muted'
                )}>
                   <Waves className="h-6 w-6" />
                </div>
                <div>
                   <h3 className="text-white font-bold text-base mb-1">Noise Suppression</h3>
                   <p className="text-sori-text-dim text-[10px] font-medium">AI-powered background noise removal.</p>
                </div>
             </div>
               <button 
                onClick={toggleNoiseSuppression}
                className={cn("w-14 h-8 rounded-full relative transition-all duration-500", noiseSuppression ? 'bg-sori-primary' : 'bg-sori-surface-hover')}
              >
                 <div className={cn("absolute top-1 w-6 h-6 rounded-full bg-white transition-all duration-500", noiseSuppression ? 'left-7' : 'left-1')} />
              </button>
          </div>

          {/* Hardware Test */}
          <div className="bg-sori-surface-panel rounded-[2rem] p-6 md:p-10 border border-sori-border-subtle space-y-8">
             <div className="flex items-center justify-between">
                <div>
                   <h3 className="text-white font-bold text-lg mb-1">Hardware Test</h3>
                   <p className="text-sori-text-muted text-xs">Verify your camera and microphone.</p>
                </div>
                <Button 
                  onClick={hardware.isTesting ? hardware.stopHardwareTest : hardware.startHardwareTest}
                  className={cn("rounded-xl font-bold px-6", !hardware.isTesting && "bg-sori-primary text-white")}
                >
                  {hardware.isTesting ? "Stop Test" : "Start Test"}
                </Button>
             </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-sori-text-muted tracking-widest ml-1">Camera Preview</label>
                    <div className="aspect-video bg-sori-surface-base rounded-2xl border border-sori-border-subtle overflow-hidden flex items-center justify-center relative">
                       {hardware.isTesting ? (
                          <video ref={hardware.videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                       ) : (
                          <Camera className="h-10 w-10 opacity-20" />
                       )}
                    </div>
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase text-sori-text-muted tracking-widest ml-1">Mic Level</label>
                    <div className="h-full flex flex-col justify-center gap-6">
                       <div className="h-3 bg-sori-surface-base rounded-full overflow-hidden border border-sori-border-subtle">
                          <div className="h-full bg-sori-primary transition-all duration-75" style={{ width: `${hardware.audioLevel}%` }} />
                       </div>
                       <p className="text-[10px] text-sori-text-muted italic">Check permissions if no activity is shown.</p>
                    </div>
                 </div>
              </div>
          </div>
      </div>
    </div>
  );
};
