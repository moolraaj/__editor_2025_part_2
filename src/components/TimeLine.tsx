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

  // 1) Compute total master timeline length
  const totalTime = store.maxTime;

  // 2) For each scene, gather its { start, duration, end }
  const sceneTimings = store.scenes.map((scene) => {
    const start = scene.timeFrame.start;
    const end = scene.timeFrame.end;
    const duration = end - start;
    return { start, duration, end };
  });

  // 3) Pull out each SceneEditorElement by sceneIndex
  const sceneElements = store.scenes.map((_, idx) =>
    store.editorElements.find(
      (e) =>
        e.type === "scene" &&
        (e as SceneEditorElement).properties.sceneIndex === idx
    ) as SceneEditorElement | undefined
  );

  // 4) When user clicks a scene header, jump to that scene + log its layers
  const handleSceneClick = (idx: number) => {
    // a) Use the scene’s actual start time from MobX store
    const sceneStartTime = sceneTimings[idx].start;
    store.setCurrentTimeInMs(sceneStartTime);
    store.setActiveScene(idx);
    setCurrentSceneIndex(idx);

    // 4.1) Grab the raw scene data (MobX proxy) and the SceneEditorElement
    const sceneData = store.scenes[idx];
    const sceneElement = store.editorElements.find(
      (e) =>
        e.type === "scene" &&
        (e as SceneEditorElement).properties.sceneIndex === idx
    ) as SceneEditorElement | undefined;

    // 4.2) Unwrap proxies so that `backgrounds`, `mainBackground`, etc. print as normal objects
    const backgroundsArray = toJS(sceneData.backgrounds);
    const mainBg = sceneElement?.properties.mainBackground
      ? toJS(sceneElement.properties.mainBackground)
      : undefined;

    // 4.3) Start a console.group for this scene
    console.group(`Active Scene ${idx}`);

    // 4.4) Log the “mainBackground” explicitly
    console.log("MAIN SCENE LAYER:", {
      id: sceneElement?.id,
      name: sceneElement?.name,
      timeFrame: toJS(sceneElement?.timeFrame),
      mainBackground: mainBg,
    });

    // 4.5) Then print the remaining backgrounds array (if any)
    console.group("• backgrounds (remaining)");
    backgroundsArray.forEach((bg) => {
      console.log({
        id: bg.id,
        name: bg.name,
        timeFrame: toJS(bg.timeFrame),
        background_url: bg.background_url,
      });
    });
    console.groupEnd(); // end backgrounds group

    // 4.6) Log GIFs
    console.group("• gifs");
    toJS(sceneData.gifs).forEach((gf) =>
      console.log({
        id: gf.id,
        tags: toJS(gf.tags),
        timeFrame: toJS(gf.timeFrame),
        svg_url: gf.svg_url,
        calculatedPosition: toJS(gf.calculatedPosition),
      })
    );
    console.groupEnd();

    // 4.7) Log animations
    console.group("• animations");
    toJS(sceneData.animations).forEach((an) =>
      console.log({
        id: an.id,
        type: an.type,
        timeFrame: toJS(an.timeFrame),
        // …any other fields you care about…
      })
    );
    console.groupEnd();

    // 4.8) Log elements
    console.group("• elements");
    toJS(sceneData.elements).forEach((el) =>
      console.log({
        id: el.id,
        type: el.type,
        timeFrame: toJS(el.timeFrame),
        // …any other fields you care about…
      })
    );
    console.groupEnd();

    // 4.9) Log text
    console.group("• text");
    toJS(sceneData.text || []).forEach((tx) =>
      console.log({
        id: tx.id,
        type: tx.type,
        value: tx.value,
        timeFrame: toJS(tx.timeFrame),
        properties: toJS(tx.properties),
        placement: toJS(tx.placement),
      })
    );
    console.groupEnd();  

    console.groupEnd(); 

 
    if (store.canvas) {
      store.canvas.discardActiveObject();
      store.canvas.requestRenderAll();
    }
  };

 
  useEffect(() => {
    if (sceneTimings.length === 0) return;
    const ct = store.currentTimeInMs;
 
    const foundIdx = sceneTimings.findIndex(
      ({ start, end }) => ct >= start && ct < end
    );
    const newIdx = foundIdx === -1 ? sceneTimings.length - 1 : foundIdx;
    if (viewMode === "master") {
      if (newIdx !== store.activeSceneIndex) {
        store.setActiveScene(newIdx);
      }
      if (newIdx !== currentSceneIndex) {
        setCurrentSceneIndex(newIdx);
      }
    }
  }, [
    store.currentTimeInMs,
    sceneTimings,
    store,
    currentSceneIndex,
    viewMode,
  ]);

 
  useEffect(() => {
    if (viewMode !== "scene") return;
    const { start, end } = sceneTimings[viewingScene];
    if (store.currentTimeInMs >= end) {
      store.setCurrentTimeInMs(start);
      store.setPlaying(false);
    }
  }, [store.currentTimeInMs, viewingScene, viewMode, sceneTimings, store]);

 
  let nowPct = 0;
  if (totalTime > 0) {
    if (viewMode === "master") {
      nowPct = (store.currentTimeInMs / totalTime) * 100;
    } else {
      const { start, duration } = sceneTimings[viewingScene];
      const rawPct = ((store.currentTimeInMs - start) / duration) * 100;
      nowPct = Math.max(0, Math.min(rawPct, 100));
    }
  }

 
  const renderMasterView = () => {
    return (
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
              style={{
                left: `${leftPct}%`,
                width: `${widthPct}%`,
              }}
            >
              <div
                className={`rounded p-2 transition-all h-64 ${
                  isActive ? "" : ""
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3
                    className={`text-lg font-semibold ${
                      isActive
                        ? "text-green-400 cursor-pointer"
                        : "text-white cursor-pointer"
                    }`}
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
                <div key={`non-scene-${el.id}`} className="rounded-lg">
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
  };

 
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
                className={`text-lg font-semibold ${
                  isActive
                    ? "text-green-400 cursor-pointer"
                    : "text-white cursor-pointer"
                }`}
                onClick={() => handleSceneClick(viewingScene)}
              >
                Scene {viewingScene + 1}{" "}
                {isActive && "(Active)"}
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
          viewMode === "scene"
            ? sceneTimings[viewingScene]?.duration || 0
            : totalTime
        }
      />

      {sceneElements.length !== 0 && (
        <div className="flex border-b border-gray-600">
          <button
            className={`text-white px-4 py-2 ${
              viewMode === "master" ? "bg-gray-700" : "hover:bg-gray-800"
            }`}
            onClick={() => setViewMode("master")}
          >
            All Scenes
          </button>
          <button
            className={`text-white px-4 py-2 ${
              viewMode === "scene" ? "bg-gray-700" : "hover:bg-gray-800"
            }`}
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
