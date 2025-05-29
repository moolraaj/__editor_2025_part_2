"use client";

import { StoreContext } from "@/store";
import { formatTimeToMinSecMili } from "@/utils";
import { observer } from "mobx-react-lite";
import { useContext } from "react";
import { ScaleRangeInput } from "./ScaleRangeInput";
import play from '../../../public/play.png';
import pause from '../../../public/pause.png';
import { MARKINGS } from "@/utils/constants";

export type SeekPlayerProps = {
  viewMode?: "master" | "scene";
  sceneIndex?: number;
  perSceneLength?: number;
};

export const SeekPlayer = observer(({ 
  viewMode = "master", 
  sceneIndex = 0, 
  perSceneLength = 0 
}: SeekPlayerProps) => {
  const store = useContext(StoreContext);
  const Icon = store.playing ? <img src={pause.src} width={40}/> : <img src={play.src} width={40}/>;
  
  // Calculate time values based on view mode
  const currentTime = viewMode === "scene" 
    ? store.currentTimeInMs - (sceneIndex * perSceneLength)
    : store.currentTimeInMs;
  
  const maxTime = viewMode === "scene" 
    ? perSceneLength 
    : store.maxTime;

  const formattedTime = formatTimeToMinSecMili(currentTime);
  const formattedMaxTime = formatTimeToMinSecMili(maxTime);

  // Handle seek based on view mode
  const handleSeek = (value: number) => {
    if (viewMode === "scene") {
      const sceneStartTime = sceneIndex * perSceneLength;
      const newTime = Math.min(sceneStartTime + value, sceneStartTime + perSceneLength);
      store.handleSeek(newTime);
    } else {
      store.handleSeek(value);
    }
  };

  return (
    <div className="seek-player flex flex-col text-white">
      <div className="flex flex-row items-center px-2">
        <button
          className="w-[80px] rounded px-2 py-2"
          onClick={() => {
            store.setPlaying(!store.playing);
          }}
        >
          {Icon}
        </button>
        <span className="font-mono">{formattedTime}</span>
        <div className="w-[1px] h-[25px] bg-slate-300 mx-[10px]"></div>
        <span className="font-mono">{formattedMaxTime}</span>
      </div>
      <ScaleRangeInput
        max={maxTime}
        value={currentTime}
        onChange={handleSeek}
        height={30}
        markings={MARKINGS}
        backgroundColor="white"
      />
    </div>
  );
});