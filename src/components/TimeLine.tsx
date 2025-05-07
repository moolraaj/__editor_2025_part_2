"use client";
import React, { useContext, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/store";
import { SeekPlayer } from "./timeline-related/SeekPlayer";
import { TimeFrameView } from "./timeline-related/TimeFrameView";
import type { SceneEditorElement } from "@/types";

export const TimeLine: React.FC = observer(() => {
  const store = useContext(StoreContext);
  const nowPct = (store.currentTimeInMs / store.maxTime) * 100;
  const [expandedScene, setExpandedScene] = useState<number | null>(null);

 
  useEffect(() => {
    const sceneCount = store.scenes.length;
    if (sceneCount === 0) return;
    const durationPerScene = store.maxTime / sceneCount;
    let idx = Math.floor(store.currentTimeInMs / durationPerScene);
    idx = Math.min(Math.max(idx, 0), sceneCount - 1);
    if (idx !== store.activeSceneIndex) {
      const sceneElem = store.editorElements.find(
        (e) =>
          e.type === "scene" &&
          (e as SceneEditorElement).properties.sceneIndex === idx
      ) as SceneEditorElement | undefined;
      if (sceneElem) {
        store.setActiveScene(idx);
        store.setSelectedElement(sceneElem);
      }
    }
  }, [store.currentTimeInMs, store.scenes.length, store.maxTime]);

 
  useEffect(() => {
    if (store.scenes.length > 0) {
      setExpandedScene(store.scenes.length - 1);
    }
  }, [store.scenes.length]);

  const handleSceneClick = (idx: number, sceneElem: SceneEditorElement) => {
    store.setActiveScene(idx);
    store.setSelectedElement(sceneElem);
  };

 
  const renderSceneLayers = (sceneElem: SceneEditorElement, idx: number) => {
   
    const isOpen = expandedScene === idx;
    const isActive = store.activeSceneIndex === idx;

    return (
      <div
        key={sceneElem.id}
        className={`bg-gray-800  p-2 ${
          isActive ? "ring-2 ring-blue-500" : ""
        }`}
        onClick={() => handleSceneClick(idx, sceneElem)}
      >
        <div className="flex justify-between items-center mb-2">
          <h3 className={`${isActive?'text-green':''} text-white font-semibold`}>
            Scene {idx + 1} {isActive && "(Active)"}
          </h3>
          <button
            className="text-sm text-blue-400 underline"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedScene(isOpen ? null : idx);
            }}
          >
     
          </button>
        </div>

        <TimeFrameView element={sceneElem} />

      
      </div>
    );
  };

 
  const totalTime      = store.maxTime;            
  const sceneCount     = store.scenes.length;     
  const perSceneLength = sceneCount > 0 
    ? totalTime / sceneCount 
    : totalTime;     

  return (
    <div className="flex flex-col space-y-6">
      <SeekPlayer />

    
      <div
        className="relative h-48"
        onDragOver={(e) => e.preventDefault()}
      >
        {store.scenes.map((_, idx) => {
     
          const sceneStart    = idx * perSceneLength;
          const sceneDuration = perSceneLength;
          const leftPct  = (sceneStart  / totalTime) * 100;
          const widthPct = (sceneDuration / totalTime) * 100;

          const sceneElem = store.editorElements.find(
            (e) =>
              e.type === "scene" &&
              (e as SceneEditorElement).properties.sceneIndex === idx
          ) as SceneEditorElement | undefined;

          if (!sceneElem) {
            console.warn(`Missing scene element for scene ${idx}`);
            return null;
          }

       
          return (
            <div
              key={sceneElem.id}
              className="absolute top-0"
              style={{
                left:  `${leftPct}%`,
                width: `${widthPct}%`,
              }}
            >
              {renderSceneLayers(sceneElem, idx)}
            </div>
          );
        })}

    
        {store.editorElements.filter((e) => e.type !== "scene").length > 0 && (
          <div className="space-y-4">
            {store.editorElements
              .filter((e) => e.type !== "scene")
              .map((el) => (
                <div
                  key={el.id}
                  className="bg-gray-800 rounded-lg"
                  onClick={() => store.setSelectedElement(el)}
                >
                  <TimeFrameView element={el} />
                  <div className="text-xs text-gray-400" />
                </div>
              ))}
          </div>
        )}

        
        <div
          className="w-[2px] bg-[#f87171] absolute top-0 bottom-0 z-20"
          style={{ left: `${nowPct}%` }}
        />
      </div>
    </div>
  );
});
