// File: components/TimeLine.tsx
"use client";

import React, { useContext, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { toJS } from "mobx";
import { StoreContext } from "@/store";
import { SeekPlayer } from "./timeline-related/SeekPlayer";
import { TimeFrameView } from "./timeline-related/TimeFrameView";
import type { SceneEditorElement } from "@/types";

export const TimeLine: React.FC = observer(() => {
  const store = useContext(StoreContext);
  const [viewMode, setViewMode] = useState<"master" | "scene">("master");
  const [viewingScene, setViewingScene] = useState<number>(0);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);

  // 1) Compute total master timeline length from store.maxTime (updates on scene drag)
  const totalTime = store.maxTime;

  // 2) For each scene, gather its { start, duration, end }
  const sceneTimings = store.scenes.map((scene) => {
    const start = scene.timeFrame.start;
    const end = scene.timeFrame.end;
    return { start, end, duration: end - start };
  });

  // 3) Pull out each SceneEditorElement by sceneIndex
  const sceneElements = store.scenes.map((_, idx) =>
    store.editorElements.find(
      (e) => e.type === "scene" && (e as SceneEditorElement).properties.sceneIndex === idx
    ) as SceneEditorElement | undefined
  );

  // on clicking scene header, jump playhead and set active scene
  const handleSceneClick = (idx: number) => {
    const { start } = sceneTimings[idx];
    store.setCurrentTimeInMs(start);
    store.setActiveScene(idx);
    setCurrentSceneIndex(idx);
  };

  // auto-select scene by playhead in master view
  useEffect(() => {
    if (sceneTimings.length === 0) return;
    const ct = store.currentTimeInMs;
    const found = sceneTimings.findIndex(({ start, end }) => ct >= start && ct < end);
    const idx = found === -1 ? sceneTimings.length - 1 : found;
    if (viewMode === "master") {
      store.setActiveScene(idx);
      setCurrentSceneIndex(idx);
    }
  }, [store.currentTimeInMs, sceneTimings, viewMode, store]);

  // loop within scene in scene view
  useEffect(() => {
    if (viewMode !== "scene") return;
    const { start, end } = sceneTimings[viewingScene] || { start: 0, end: 0 };
    if (store.currentTimeInMs >= end) {
      store.setCurrentTimeInMs(start);
      store.setPlaying(false);
    }
  }, [store.currentTimeInMs, viewingScene, viewMode, sceneTimings, store]);

  // compute playhead percentage
  let nowPct = 0;
  if (totalTime > 0) {
    nowPct = (store.currentTimeInMs / (viewMode === "master" ? totalTime : sceneTimings[viewingScene]?.duration || totalTime)) * 100;
    nowPct = Math.max(0, Math.min(nowPct, 100));
  }

  // render master view: containers adjust width from sceneTimings & totalTime updates on drag in TimeFrameView
  const renderMasterView = () => (
    <div className="relative h-48" onDragOver={(e) => e.preventDefault()}>
      {sceneElements.map((sceneElem, idx) => {
        if (!sceneElem) return null;
        const { start, duration } = sceneTimings[idx];
        const leftPct = (start / totalTime) * 100;
        const widthPct = (duration / totalTime) * 100;
        const isActive = store.activeSceneIndex === idx;

        return (
          <div
            key={`scene-container-${idx}`}
            className="absolute top-0"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          >
            <div className={`rounded p-2 transition-all h-64 ${isActive ? "bg-gray-600" : "bg-gray-700"}`}>
              <div className="flex justify-between items-center mb-2">
                <h3
                  className={`text-lg font-semibold ${isActive ? "text-green-400" : "text-white"} cursor-pointer`}
                  onClick={() => handleSceneClick(idx)}
                >
                  Scene {idx + 1} {isActive && "(Active)"}
                </h3>
              </div>
              <TimeFrameView
                key={`frame-${sceneElem.id}`}
                element={sceneElem}
                setCurrentSceneIndex={setCurrentSceneIndex}
                handleSceneClick={handleSceneClick}
              />
            </div>
          </div>
        );
      })}

      {store.editorElements.some((e) => e.type !== "scene") && (
        <div className="space-y-4 mt-4">
          {store.editorElements
            .filter((e) => e.type !== "scene")
            .map((el) => (
              <div key={el.id} className="rounded-lg">
                <TimeFrameView
                  key={`frame-non-scene-${el.id}`}
                  element={el}
                  setCurrentSceneIndex={setCurrentSceneIndex}
                  handleSceneClick={handleSceneClick}
                />
              </div>
            ))}
        </div>
      )}

      <div
        className="w-[2px] bg-[#f87171] absolute top-0 bottom-0 z-20"
        style={{ left: `${nowPct}%` }}
      />
    </div>
  );

  // render single scene view (scene-level)
  const renderSceneView = () => {
    const sceneElem = sceneElements[viewingScene];
    if (!sceneElem) return null;
    const isActive = store.activeSceneIndex === viewingScene;
    return (
      <div className="relative h-48" onDragOver={(e) => e.preventDefault()}>
        <div className="absolute top-0 left-0 w-full">
          <div className="rounded p-2 transition-all h-64 bg-gray-700">
            <div className="flex justify-between items-center mb-2">
              <h3
                className={`text-lg font-semibold ${isActive ? "text-green-400" : "text-white"} cursor-pointer`}
                onClick={() => handleSceneClick(viewingScene)}
              >
                Scene {viewingScene + 1} {isActive && "(Active)"}
              </h3>
            </div>
            <TimeFrameView
              key={`frame-${sceneElem.id}`}
              element={sceneElem}
              setCurrentSceneIndex={setCurrentSceneIndex}
              handleSceneClick={handleSceneClick}
            />
          </div>
        </div>
        <div
          className="w-[2px] bg-[#f87171] absolute top-0 bottom-0 z-20"
          style={{ left: `${nowPct}%` }}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col space-y-6">
      <SeekPlayer
        viewMode={viewMode}
        sceneIndex={viewingScene}
        perSceneLength={
          viewMode === "scene" ? sceneTimings[viewingScene]?.duration || 0 : totalTime
        }
      />

      {sceneElements.length > 0 && (
        <div className="flex border-b border-gray-600">
          <button
            className={`text-white px-4 py-2 ${viewMode === "master" ? "bg-gray-700" : "hover:bg-gray-800"}`}
            onClick={() => setViewMode("master")}
          >
            All Scenes
          </button>
          <button
            className={`text-white px-4 py-2 ${viewMode === "scene" ? "bg-gray-700" : "hover:bg-gray-800"}`}
            onClick={() => {
              setViewMode("scene");
              setViewingScene(currentSceneIndex);
              handleSceneClick(currentSceneIndex);
            }}
          >
            Scene {currentSceneIndex + 1}
          </button>
        </div>
      )}

      {viewMode === "master" ? renderMasterView() : renderSceneView()}
    </div>
  );
});
