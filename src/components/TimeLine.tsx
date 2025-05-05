"use client";

import React, { useContext, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/store";
import { SeekPlayer } from "./timeline-related/SeekPlayer";
import { TimeFrameView } from "./timeline-related/TimeFrameView";
import type { SceneEditorElement } from "@/types";
import type { fabric } from "fabric";
export const TimeLine: React.FC = observer(() => {
  const store = useContext(StoreContext);
  const nowPct = (store.currentTimeInMs / store.maxTime) * 100;
  const [expandedScene, setExpandedScene] = useState<number | null>(null);
  useEffect(() => {
    const sceneCount = store.scenes.length;
    if (sceneCount === 0) return;
    const durationPerScene = store.maxTime / sceneCount;
    let idx = Math.floor(store.currentTimeInMs / durationPerScene);
    idx = Math.min(Math.max(idx, 0), sceneCount - 1)
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
  const handleSceneClick = (idx: number, sceneElem: SceneEditorElement) => {
    console.log("Scene clicked:", idx, sceneElem);
    store.setActiveScene(idx);
    store.setSelectedElement(sceneElem);
  };
  const renderSceneLayers = (sceneElem: SceneEditorElement, idx: number) => {
    const layers = Array.isArray(sceneElem.fabricObject)
      ? (sceneElem.fabricObject as fabric.Object[])
      : [];
    console.groupEnd();
    const isOpen = expandedScene === idx;
    const isActive = store.activeSceneIndex === idx;
    return (
      <div
        key={sceneElem.id}
        className={`bg-gray-800 rounded-lg p-4 ${isActive ? "ring-2 ring-blue-500" : ""
          }`}
        onClick={() => handleSceneClick(idx, sceneElem)}
      >
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white font-semibold">
            Scene {idx + 1} {isActive && "(Active)"}
          </h3>
          <button
            className="text-sm text-blue-400 underline"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedScene(isOpen ? null : idx);
            }}
          >
            {isOpen ? "Hide Layers" : "Show Layers"}
          </button>
        </div>
        <TimeFrameView element={sceneElem} />
        {isOpen && (
          <div className="space-y-4">
            <div>
              <div className="flex flex-col gap-1 mt-2">
                {layers.map((layer, i) => (
                  <div
                    key={i}
                    className="flex items-center px-2 py-1 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      store.setSelectedElement(sceneElem);
                      if (store.canvas) {
                        store.canvas.setActiveObject(layer);
                        store.canvas.requestRenderAll();
                      }
                    }}
                  >
                    <span className="truncate flex-1 text-white">
                      {layer.name || `Layer ${i + 1}`}
                    </span>
                    <span className="text-gray-400 text-xs ml-2">
                      {layer.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {sceneElem.properties.elements?.length ? (
          <div>
            <div className="flex flex-col gap-1 mt-2">
              {sceneElem.properties.elements.map((el, i) => (
                <div
                  key={`child-${i}`}
                  className="flex items-center px-2 py-1 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    store.setSelectedElement(el);
                    if (store.canvas && el.fabricObject) {
                      store.canvas.setActiveObject(
                        Array.isArray(el.fabricObject)
                          ? el.fabricObject[0]
                          : el.fabricObject
                      );
                      store.canvas.requestRenderAll();
                    }
                  }}
                >
                  <span className="truncate flex-1 text-white">
                    {el.name || `${el.type}-${i + 1}`}
                  </span>
                  <span className="text-gray-400 text-xs ml-2">{el.type}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <div className="flex flex-col space-y-6">
      <SeekPlayer />
      <div
        className="flex-1 relative  space-y-6"
        onDragOver={(e) => e.preventDefault()}
      >
        {store.scenes.map((scene, idx) => {
          const sceneElem = store.editorElements.find(
            (e) =>
              e.type === "scene" &&
              (e as SceneEditorElement).properties.sceneIndex === idx
          ) as SceneEditorElement | undefined;

          if (!sceneElem) {
            console.warn(`Missing scene element for scene ${idx}`);
            return null;
          }

          return renderSceneLayers(sceneElem, idx);
        })}
        {store.editorElements.filter((e) => e.type !== "scene").length > 0 && (
          <div className="space-y-4  ">

            {store.editorElements
              .filter((e) => e.type !== "scene")
              .map((el) => (
                <div
                  key={el.id}
                  className="bg-gray-800 rounded-lg"
                  onClick={() => store.setSelectedElement(el)}
                >
                  <TimeFrameView element={el} />
                  <div className="text-xs text-gray-400"></div>
                </div>
              ))}
          </div>
        )}
        <div
          className="w-[2px] bg-[#f87171] absolute top-0 bottom-0 z-20 left-10 mover"
          style={{ left: `${nowPct}%` }}
        />
      </div>
    </div>
  );
});
