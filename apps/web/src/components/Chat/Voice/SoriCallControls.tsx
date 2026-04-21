import React from "react";
import { 
  useLocalParticipant, 
  useMediaDeviceSelect,
} from "@livekit/components-react";
import { cn, Popover, PopoverTrigger, PopoverContent, Slider, Switch } from "@sori/ui";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  ScreenShare, 
  StopCircle, 
  PhoneOff, 
  ChevronDown,
  Volume2,
  Waves
} from "lucide-react";
import { NoiseSuppressionPopup } from "../Modals/NoiseSuppressionPopup";
import { VideoPresets } from "livekit-client";

// Internal component for camera selection
const CameraDeviceSelector = () => {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind: 'videoinput' });
  
  return (
    <>
      {devices.map(device => (
        <div 
          key={device.deviceId} 
          onClick={() => setActiveMediaDevice(device.deviceId)}
          className={cn(
            "px-3 py-2 text-[11px] rounded-xl cursor-pointer transition-all flex items-center justify-between",
            activeDeviceId === device.deviceId 
              ? 'bg-muted text-primary font-bold' 
              : 'text-on-surface-variant hover:bg-sori-surface-panel hover:text-white'
          )}
        >
          <span className="truncate flex-1 font-bold">{device.label || 'Camera'}</span>
        </div>
      ))}
    </>
  );
};

interface SoriCallControlsProps {
  onHangUp: () => void;
  noiseSuppression: boolean;
  toggleNoiseSuppression: () => void;
  hideSelfCamera: boolean;
  setHideSelfCamera: (val: boolean) => void;
  className?: string;
  micDevices: MediaDeviceInfo[];
  activeMicId?: string;
  setActiveMic: (id: string) => void;
  outputDevices: MediaDeviceInfo[];
  activeOutputId?: string;
  setActiveOutput: (id: string) => void;
  outputVolume: number;
  micGain: number;
  setMicGain: (val: number) => void;
  setOutputVolume: (val: number) => void;
}

export const SoriCallControls: React.FC<SoriCallControlsProps> = ({
  onHangUp,
  noiseSuppression,
  toggleNoiseSuppression,
  hideSelfCamera,
  setHideSelfCamera,
  className,
  micDevices,
  activeMicId,
  setActiveMic,
  outputDevices,
  activeOutputId,
  setActiveOutput,
  outputVolume,
  micGain,
  setMicGain,
  setOutputVolume
}) => {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();

  return (
    <div className={cn(
      "h-24 flex items-center justify-center gap-3 bg-sori-surface-base border-t border-muted shrink-0 px-8 w-full z-50",
      className
    )}>
      {/* Mic & Audio Menu (Unified) */}
      <div className="flex items-center gap-0.5 bg-sori-surface-panel rounded-2xl p-1 border border-muted relative">
        <button 
          onClick={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
            !isMicrophoneEnabled ? 'bg-sori-accent-danger text-white' : 'text-on-surface-variant hover:bg-sori-surface-panel'
          )}
        >
          {isMicrophoneEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </button>
        
        <Popover>
          <PopoverTrigger asChild>
            <button 
              className="w-5 h-12 text-on-surface-variant hover:text-primary transition-all flex items-center justify-center group"
            >
              <ChevronDown className="h-4 w-4 group-data-[state=open]:rotate-180 transition-transform" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-64 p-4 border-muted shadow-2xl rounded-2xl mb-4">
            <div className="space-y-4">
              {/* INPUT SECTION */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Input Device</p>
                
                <div className="space-y-1 max-h-[120px] overflow-y-auto no-scrollbar">
                   {micDevices.map(device => (
                      <div 
                        key={device.deviceId} 
                        onClick={() => setActiveMic(device.deviceId)}
                        className={cn(
                          "px-3 py-2 text-[11px] rounded-xl cursor-pointer transition-all flex items-center justify-between",
                          activeMicId === device.deviceId ? 'bg-muted text-primary font-bold' : 'text-on-surface-variant hover:bg-sori-surface-panel hover:text-white'
                        )}
                      >
                        <span className="truncate flex-1">{device.label || 'Microphone'}</span>
                      </div>
                   ))}
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Input Volume</p>
                    <span className="text-[11px] text-primary font-bold">{micGain}%</span>
                  </div>
                  <Slider 
                    value={[micGain]} 
                    onValueChange={([val]: number[]) => setMicGain(val)} 
                    max={100} 
                    step={1}
                    className="py-1"
                  />
                </div>
              </div>

              <div className="h-px bg-sori-surface-panel" />

              {/* OUTPUT SECTION */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Output Device</p>

                <div className="space-y-1 max-h-[120px] overflow-y-auto no-scrollbar">
                   {outputDevices.map(device => (
                      <div 
                        key={device.deviceId} 
                        onClick={() => setActiveOutput(device.deviceId)}
                        className={cn(
                          "px-3 py-2 text-[11px] rounded-xl cursor-pointer transition-all flex items-center justify-between",
                          activeOutputId === device.deviceId ? 'bg-muted text-secondary font-bold' : 'text-on-surface-variant hover:bg-sori-surface-panel hover:text-white'
                        )}
                      >
                        <span className="truncate flex-1">{device.label || 'Speaker'}</span>
                      </div>
                   ))}
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <p className="text-[10px] font-black uppercase text-secondary tracking-widest">Output Volume</p>
                    <span className="text-[11px] text-secondary font-bold">{outputVolume}%</span>
                  </div>
                  <Slider 
                     value={[outputVolume]} 
                     onValueChange={([val]: number[]) => setOutputVolume(val)} 
                     max={200} 
                     step={1}
                     className="py-1"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Camera Menu */}
      <div className="flex items-center gap-0.5 bg-sori-surface-panel rounded-2xl p-1 border border-muted relative">
        <button 
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
            isCameraEnabled ? 'bg-primary text-white shadow-lg shadow-primary' : 'text-on-surface-variant hover:bg-sori-surface-panel'
          )}
        >
          {isCameraEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </button>
        
        <Popover>
          <PopoverTrigger asChild>
            <button 
              className="w-5 h-12 text-on-surface-variant hover:text-primary transition-all flex items-center justify-center group"
            >
              <ChevronDown className="h-4 w-4 group-data-[state=open]:rotate-180 transition-transform" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-64 p-4 border-muted shadow-2xl rounded-2xl mb-4">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-3 ml-1">Video Device</p>
                <div className="space-y-1 max-h-[200px] overflow-y-auto no-scrollbar">
                  <CameraDeviceSelector />
                </div>
              </div>

              <div className="h-px bg-muted" />

              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-black uppercase text-on-surface-variant tracking-widest">Hide My Camera</p>
                <Switch 
                  checked={hideSelfCamera} 
                  onCheckedChange={setHideSelfCamera}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Screen Share */}
      <button 
        onClick={() => {
          if (isScreenShareEnabled) {
            localParticipant.setScreenShareEnabled(false);
          } else {
            localParticipant.setScreenShareEnabled(true).catch(err => console.error("Failed to start screen share:", err));
          }
        }}
        className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
          isScreenShareEnabled 
            ? 'bg-secondary text-black shadow-lg' 
            : 'bg-sori-surface-panel text-on-surface-variant hover:bg-sori-surface-base'
        )}
        title="Present Screen"
      >
        {isScreenShareEnabled ? <StopCircle className="h-7 w-7" /> : <ScreenShare className="h-7 w-7" />}
      </button>

      {/* Noise Suppression Popup */}
      <NoiseSuppressionPopup isEnabled={noiseSuppression} onToggle={toggleNoiseSuppression}>
        <button 
          className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
            noiseSuppression 
              ? 'bg-muted text-primary border border-primary' 
              : 'bg-sori-surface-panel text-on-surface-variant hover:bg-sori-surface-base border border-transparent'
          )}
          title="Noise Suppression"
        >
          <Waves className="h-7 w-7" />
        </button>
      </NoiseSuppressionPopup>

      {/* Hang Up */}
      <button 
        onClick={onHangUp}
        className="w-14 h-14 bg-sori-accent-danger text-white rounded-2xl flex items-center justify-center shadow-lg hover:brightness-110 active:scale-95 transition-all duration-300"
      >
        <PhoneOff className="h-7 w-7" />
      </button>
    </div>
  );
};
