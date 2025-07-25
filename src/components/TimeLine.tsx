"use client";

import React, { useContext, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/store";
import { SeekPlayer } from "./timeline-related/SeekPlayer";
import { TimeFrameView } from "./timeline-related/TimeFrameView";
import type { SceneEditorElement } from "@/types";

export const TimeLine: React.FC = observer(() => {
  const store = useContext(StoreContext);

  const [viewMode, setViewMode] = useState<"master" | "scene">("master");
  const [viewingScene, setViewingScene] = useState<number>(0);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);

  const totalTime = store.maxTime;
  const sceneTimings = store.scenes.map((scene) => {
    const start = scene.timeFrame.start;
    const end = scene.timeFrame.end;
    const duration = end - start;
    return { start, duration, end };
  });
  const sceneElements = store.scenes.map((_, idx) =>
    store.editorElements.find(
      (e) =>
        e.type === "scene" &&
        (e as SceneEditorElement).properties.sceneIndex === idx
    ) as SceneEditorElement | undefined
  );

 

  const handleSceneClick = (idx: number) => {
    const sceneStartTime = sceneTimings[idx].start;
    store.setCurrentTimeInMs(sceneStartTime);
    store.setActiveScene(idx);
    setCurrentSceneIndex(idx);
    // const sceneData = store.scenes[idx];
    // const sceneElement = store.editorElements.find(
    //   e => e.type === "scene" &&
    //     (e as SceneEditorElement).properties.sceneIndex === idx
    // ) as SceneEditorElement | undefined;
    // const backgroundsArray = toJS(sceneData.backgrounds);
    // //@ts-ignore
    // const bgImage = sceneElement?.properties.bgImage ?? null;
    // console.group(`Active Scene ${idx}`);
    // console.log("MAIN SCENE LAYER:", {
    //   id: sceneElement?.id,
    //   name: sceneElement?.name,
    //   timeFrame: toJS(sceneElement?.timeFrame),
    //   bgImage,
    // });
    // console.group("• backgrounds (nested)");
    // backgroundsArray.forEach(bg =>
    //   console.log({
    //     id: bg.id,
    //     name: bg.name,
    //     timeFrame: toJS(bg.timeFrame),
    //     background_url: bg.background_url,
    //   })
    // );
    // console.groupEnd();
    // console.group("• gifs");
    // toJS(sceneData.gifs).forEach(gf =>
    //   console.log({
    //     id: gf.id,
    //     tags: toJS(gf.tags),
    //     timeFrame: toJS(gf.timeFrame),
    //     svg_url: gf.svg_url,
    //     calculatedPosition: toJS(gf.calculatedPosition),
    //   })
    // );
    // console.groupEnd();

    // console.group("• animations");
    // toJS(sceneData.animations).forEach(an =>
    //   console.log({
    //     id: an.id,
    //     type: an.type,
    //     timeFrame: toJS(an.timeFrame),
    //   })
    // );
    // console.groupEnd();

    // console.group("• elements");
    // console.group("• elements");
    // toJS(sceneData.elements).forEach(el =>
    //   console.log({
    //     id: el.id,
    //     type: el.type,
    //     timeFrame: toJS(el.timeFrame),
    //   })
    // );
    // console.groupEnd();

    // console.groupEnd();

    // console.group("• text");
    // toJS(sceneData.text || []).forEach(tx =>
    //   console.log({
    //     id: tx.id,
    //     type: tx.type,
    //     value: tx.value,
    //     timeFrame: toJS(tx.timeFrame),
    //     properties: toJS(tx.properties),
    //     placement: toJS(tx.placement),
    //   })
    // );
    // console.groupEnd();
    // console.groupEnd();

    //  console.group("• tts");
    // toJS(sceneData.tts || []).forEach(tx =>
    //   console.log({
    //     id: tx.id,
    //     layerType: tx.layerType,
    //     played: tx.played,
    //     timeFrame: toJS(tx.timeFrame),
    //     audioUrl: tx.audioUrl,
    //   })
    // );
    // console.groupEnd();
    // console.groupEnd();
    // if (store.canvas) {
    //   store.canvas.discardActiveObject();
    //   store.canvas.requestRenderAll();
    // }
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
    if (viewMode === "master") {
      if (store.scenesTotalTime > 0 && store.currentTimeInMs >= store.scenesTotalTime) {
        store.setCurrentTimeInMs(0);
        store.setPlaying(false);
      }
    } else {
      const { start, end } = sceneTimings[viewingScene];
      if (store.currentTimeInMs >= end) {
        store.setCurrentTimeInMs(start);
        handleSceneClick(store.activeSceneIndex)
        store.setPlaying(false);
      }
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
      <div className="relative h-48 drag_view_line" onDragOver={(e) => e.preventDefault()}>
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
                borderRight: '1px solid rgb(75 85 99)'
              }}
            >
              <div
                className={`rounded transition-all h-64 ${isActive ? "" : ""
                  }`}
              >

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


    return (
      <div className="relative h-48 drag_view_line" onDragOver={(e) => e.preventDefault()}>
        <div className="absolute top-0 left-0 w-full">
          <div className="rounded  transition-all h-64">

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
    <div className="flex flex-col space-y-6 main-time-line-wrapper">
     

      {sceneElements.length !== 0 && (
        <div className="flex border-b border-gray-600 master_scene_view">
          <button
            className={`text-white px-4 py-2 ${viewMode === "master" ? "bg-gray-700" : "hover:bg-gray-800"
              }`}
            onClick={() => setViewMode("master")}
          >
            All Scenes
          </button>
          <button
            className={`text-white px-4 py-2 ${viewMode === "scene" ? "bg-gray-700" : "hover:bg-gray-800"
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

       <SeekPlayer
        viewMode={viewMode}
        sceneIndex={viewingScene}
        perSceneLength={
          viewMode === "scene"
            ? sceneTimings[viewingScene]?.duration || 0
            : totalTime
        }
      />

      {viewMode === "master" ? renderMasterView() : renderSceneView()}
    </div>
  );
});
