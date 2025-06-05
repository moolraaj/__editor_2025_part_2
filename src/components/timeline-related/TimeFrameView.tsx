// File: components/timeline-related/TimeFrameView.tsx
"use client";

import React, { useEffect, useRef, useState, useContext } from "react";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/store";
import DragableView from "./DragableView";
import { FaCopy, FaPaste, FaTrash, FaEllipsisV, FaCut } from "react-icons/fa";
import type { EditorElement, SceneEditorElement, SceneLayer, TimeFrame } from "@/types";
import { fabric } from "fabric";

interface TimeFrameViewProps {
  element: EditorElement;
  setCurrentSceneIndex?: React.Dispatch<React.SetStateAction<number>>;
  handleSceneClick?: (idx: number) => void;
}

export const TimeFrameView = observer((props: TimeFrameViewProps) => {
  const store = useContext(StoreContext);
  const { element, setCurrentSceneIndex, handleSceneClick } = props;
  const [isShow, setIsShow] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const cmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (cmd && key === "x") {
        e.preventDefault();
        store.cutElement();
      } else if (cmd && key === "c") {
        e.preventDefault();
        store.copyElement();
      } else if (cmd && key === "v") {
        e.preventDefault();
        store.pasteElement();
      } else if (cmd && key === "/") {
        e.preventDefault();
        store.splitElement();
      } else if (e.key === "Delete") {
        e.preventDefault();
        store.deleteElement();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store]);

  if (element.type === "scene") {
    const scene = element as SceneEditorElement;
    const sceneIndex = scene.properties.sceneIndex;
    const sceneStart = scene.timeFrame.start;
    const sceneEnd = scene.timeFrame.end;
    const sceneDuration = sceneEnd - sceneStart;

    const sceneLayers: SceneLayer[] = [
      ...(scene.properties.backgrounds || []).map((bg) => ({
        ...bg,
        layerType: "background" as const,
        timeFrame: { ...bg.timeFrame },
      })),
      ...(scene.properties.gifs || []).map((gf) => ({
        ...gf,
        layerType: "svg" as const,
        timeFrame: { ...gf.timeFrame },
      })),
      ...(scene.properties.animations || []).map((an) => ({
        ...an,
        layerType: "animation" as const,
        timeFrame: { ...an.timeFrame },
      })),
      ...(scene.properties.elements || []).map((el) => ({
        ...el,
        layerType: "element" as const,
        timeFrame: { ...el.timeFrame },
      })),
      ...(Array.isArray(scene.properties.text)
        ? scene.properties.text.map((tx) => ({
            ...tx,
            layerType: "text" as const,
            timeFrame: { ...tx.timeFrame },
          }))
        : []),
    ];

    const handleLeftResize = (idx: number, rawValue: number) => {
      const layer = sceneLayers[idx];
      const oldTF = layer.timeFrame;
      const minStart = idx === 0 ? sceneStart : Math.max(sceneStart, oldTF.start);
      const maxStart = Math.min(oldTF.end - 1, sceneEnd);
      
      const newStart = Math.max(minStart, Math.min(maxStart, sceneStart + rawValue));
      const newTF: TimeFrame = { start: newStart, end: oldTF.end };
      store.updateSceneLayerTimeFrame(sceneIndex, layer.id, newTF);
    };

    const handleRightResize = (idx: number, rawValue: number) => {
      const layer = sceneLayers[idx];
      const oldTF = layer.timeFrame;
      const candidateEnd = sceneStart + rawValue;

      if (idx === 0 && layer.layerType === "background") {
        const newDuration = Math.max(1, candidateEnd - sceneStart);
        store.updateSceneDuration(sceneIndex, newDuration);
        
        // Update background to fill the entire scene
        const updatedScene = store.scenes[sceneIndex];
        const finalSceneEnd = updatedScene.timeFrame.end;
        const newTF: TimeFrame = { start: sceneStart, end: finalSceneEnd };
        store.updateSceneLayerTimeFrame(sceneIndex, layer.id, newTF);
      } else {
        const minEnd = oldTF.start + 1;
        const maxEnd = sceneEnd;
        const clampedEnd = Math.max(minEnd, Math.min(maxEnd, candidateEnd));
        const newTF: TimeFrame = { start: oldTF.start, end: clampedEnd };
        store.updateSceneLayerTimeFrame(sceneIndex, layer.id, newTF);
      }
    };

    const handleBarDrag = (idx: number, rawValue: number) => {
      const layer = sceneLayers[idx];
      const oldTF = layer.timeFrame;
      const width = oldTF.end - oldTF.start;
      const minStart = sceneStart;
      const maxStart = sceneEnd - width;
      
      const newStart = Math.max(minStart, Math.min(maxStart, sceneStart + rawValue));
      const newEnd = newStart + width;
      const newTF: TimeFrame = { start: newStart, end: newEnd };
      store.updateSceneLayerTimeFrame(sceneIndex, layer.id, newTF);
    };

    return (
      <div className="space-y-2">
        {sceneLayers.map((layer, idx) => {
          const tf = layer.timeFrame;
          const leftPct = ((tf.start - sceneStart) / sceneDuration) * 100;
          const widthPct = ((tf.end - tf.start) / sceneDuration) * 100;
          const rightPct = leftPct + widthPct;
          const isSelected = store.selectedElement?.id === layer.id;

          return (
            <div
              key={`${layer.layerType}-${layer.id}`}
              className="relative w-full h-[25px] my-1 flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                store.setActiveScene(sceneIndex);
                setCurrentSceneIndex?.(sceneIndex);
                handleSceneClick?.(sceneIndex);

                let targetElement: EditorElement | undefined;
                let targetFabricObject: fabric.Object | undefined;

                if (layer.layerType === "background") {
                  targetElement = store.editorElements.find(
                    (e) =>
                      e.type === "scene" &&
                      (e as SceneEditorElement).properties.sceneIndex ===
                        sceneIndex
                  );
                  targetFabricObject =
                    targetElement?.fabricObject as fabric.Object | undefined;
                } else if (layer.layerType === "element") {
                  targetElement = store.editorElements.find(
                    (e) => e.id === layer.id
                  );
                  targetFabricObject =
                    targetElement?.fabricObject as fabric.Object | undefined;
                } else {
                  targetElement = store.editorElements.find(
                    (e) =>
                      e.type === "scene" &&
                      (e as SceneEditorElement).properties.sceneIndex ===
                        sceneIndex
                  );
                  if (targetElement?.fabricObject) {
                    if (Array.isArray(targetElement.fabricObject)) {
                      targetFabricObject = (
                        targetElement.fabricObject as fabric.Object[]
                      ).find((obj) => obj.data?.elementId === layer.id);
                    } else {
                      targetFabricObject = targetElement.fabricObject;
                    }
                  }
                }

                if (targetElement) {
                  store.setSelectedElement(targetElement);
                  if (store.canvas && targetFabricObject) {
                    store.canvas.discardActiveObject();
                    targetFabricObject.set({
                      selectable: true,
                      evented: true,
                    });
                    store.canvas.setActiveObject(targetFabricObject);
                    targetFabricObject.bringToFront();
                    store.canvas.viewportCenterObject(targetFabricObject);
                    store.canvas.requestRenderAll();
                  }
                }
              }}
            >
              <DragableView
                className="z-10 cursor-ew-resize absolute h-full"
                value={tf.start - sceneStart}
                total={sceneDuration}
                onChange={(val) => handleLeftResize(idx, val)}
                style={{ left: `${leftPct}%`, width: "10px" }}
                bounds={{
                  min: idx === 0 ? 0 : tf.start - sceneStart,
                  max: tf.end - sceneStart - 1
                }}
              >
                <div className="bg-white border-2 border-blue-400 w-full h-full" />
              </DragableView>

              <DragableView
                className="absolute h-full cursor-grab"
                value={tf.start - sceneStart}
                total={sceneDuration}
                onChange={(val) => handleBarDrag(idx, val)}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                }}
                bounds={{
                  min: 0,
                  max: sceneDuration - (tf.end - tf.start)
                }}
              >
                <div
                  className={`relative h-full text-white text-xs px-2 leading-[25px] truncate ${
                    isSelected ? "ring-2 ring-white" : ""
                  } ${
                    layer.layerType === "background"
                      ? "bg-green-600"
                      : layer.layerType === "svg"
                      ? "bg-purple-600"
                      : layer.layerType === "animation"
                      ? "bg-yellow-600"
                      : layer.layerType === "element"
                      ? "bg-blue-600"
                      : "bg-gray-600"
                  }`}
                >
                  <strong>{layer.layerType.toUpperCase()} </strong>
                  {layer.layerType === "background"
                    ? layer.name
                    : layer.layerType === "svg"
                    ? layer.tags?.[0] || ""
                    : layer.layerType === "element"
                    ? layer.type
                    : layer.layerType === "text"
                    ? layer.type
                    : ""}

                  <span className="absolute right-1 top-1/2 transform -translate-y-1/2 text-[10px] text-white/80">
                    {tf.start}–{tf.end}
                  </span>
                </div>
              </DragableView>

              <DragableView
                className="z-10 cursor-ew-resize absolute h-full"
                value={tf.end - sceneStart}
                total={sceneDuration}
                onChange={(val) => handleRightResize(idx, val)}
                style={{ left: `${rightPct}%`, width: "10px" }}
                bounds={{
                  min: tf.start - sceneStart + 1,
                  max: idx === 0 ? sceneDuration : sceneDuration
                }}
              >
                <div className="bg-white border-2 border-blue-400 w-full h-full" />
              </DragableView>
            </div>
          );
        })}
      </div>
    );
  }

  // Non-scene elements
  const isSelected = store.selectedElement?.id === element.id;
  const { start, end } = element.timeFrame;
  const duration = end - start;
  const leftPct = (start / store.maxTime) * 100;
  const widthPct = (duration / store.maxTime) * 100;

  return (
    <div
      className="relative w-full h-[25px] my-2"
      onClick={() => store.setSelectedElement(element)}
    >
      <DragableView
        className="z-10 cursor-ew-resize absolute h-full"
        value={start}
        total={store.maxTime}
        onChange={(v) =>
          store.updateEditorElementTimeFrame(element, { start: v })
        }
        style={{ left: `${leftPct}%`, width: "10px" }}
        bounds={{
          min: 0,
          max: end - 1
        }}
      >
        <div className="bg-white border-2 border-blue-400 w-full h-full" />
      </DragableView>

      <DragableView
        className="absolute h-full cursor-col-resize"
        value={start}
        total={store.maxTime}
        onChange={(v) =>
          store.updateEditorElementTimeFrame(element, {
            start: v,
            end: v + duration,
          })
        }
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        bounds={{
          min: 0,
          max: store.maxTime - duration
        }}
      >
        <div
          className={`relative h-full w-full text-white text-xs px-2 leading-[25px] ${
            isSelected ? "bg-blue-600" : "bg-gray-600"
          }`}
        >
          {element.name}
          <span className="absolute right-1 top-1/2 transform -translate-y-1/2 text-[10px] text-white/80">
            {start}–{end}
          </span>
          <div className="absolute right-6 top-1/2 transform -translate-y-1/2">
            <button
              className="text-white hover:text-gray-200"
              onClick={(e) => {
                e.stopPropagation();
                setIsShow(!isShow);
              }}
            >
              <FaEllipsisV size={12} />
            </button>
          </div>
          {isShow && (
            <div
              ref={dropdownRef}
              className="absolute right-0 mt-6 w-48 bg-white shadow-lg rounded-md z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                onClick={() => {
                  store.cutElement();
                  setIsShow(false);
                }}
              >
                <FaCut className="text-blue-500 mr-2" /> Cut
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                onClick={() => {
                  store.copyElement();
                  setIsShow(false);
                }}
              >
                <FaCopy className="text-blue-500 mr-2" /> Copy
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                onClick={() => {
                  store.pasteElement();
                  setIsShow(false);
                }}
              >
                <FaPaste className="text-blue-500 mr-2" /> Paste
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center"
                onClick={() => {
                  store.deleteElement();
                  setIsShow(false);
                }}
              >
                <FaTrash className="text-red-500 mr-2" /> Delete
              </button>
            </div>
          )}
        </div>
      </DragableView>

      <DragableView
        className="z-10 cursor-ew-resize absolute h-full"
        value={end}
        total={store.maxTime}
        onChange={(v) =>
          store.updateEditorElementTimeFrame(element, { end: v })
        }
        style={{ left: `${(end / store.maxTime) * 100}%`, width: "10px" }}
        bounds={{
          min: start + 1,
          max: store.maxTime
        }}
      >
        <div className="bg-white border-2 border-blue-400 w-full h-full" />
      </DragableView>
    </div>
  );
});