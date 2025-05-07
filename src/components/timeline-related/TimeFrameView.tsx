"use client";
import React, { useEffect, useRef, useState, useContext } from "react";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/store";
import DragableView from "./DragableView";
import { FaCopy, FaPaste, FaTrash, FaEllipsisV, FaCut } from "react-icons/fa";
import type { EditorElement, SceneEditorElement } from "@/types";
import type { fabric } from "fabric";

export const TimeFrameView = observer((props: { element: EditorElement }) => {
  const store = useContext(StoreContext);
  const { element } = props;

 
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (isCtrlOrCmd) {
        if (key === "x") {
          event.preventDefault();
          store.cutElement();
          return;
        }
        if (key === "c") {
          event.preventDefault();
          store.copyElement();
          return;
        }
        if (key === "v") {
          event.preventDefault();
          store.pasteElement();
          return;
        }
        if (key === "/") {
          event.preventDefault();
          store.splitElement();
          return;
        }
      } else if (event.key === "delete") {
        event.preventDefault();
        store.deleteElement();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store]);

  // -------- Scene branch --------
  if (element.type === "scene") {
    const scene = element as SceneEditorElement;
    const layers = Array.isArray(scene.fabricObject)
      ? (scene.fabricObject as fabric.Object[])
      : [];

    const sceneStart = scene.timeFrame.start;
    const sceneEnd = scene.timeFrame.end;
    const sceneDuration = sceneEnd - sceneStart; // should be 10_000

    // Track per-layer offsets
    const [offsets, setOffsets] = useState<number[]>(
      layers.map(() => 0)
    );
    useEffect(() => {
      setOffsets(layers.map(() => 0));
    }, [layers.length]);

    const handleLayerChange = (idx: number, newOffset: number) => {
      const updated = [...offsets];
      updated[idx] = newOffset;
      setOffsets(updated);

      const child = scene.properties.elements?.[idx];
      if (child) {
        store.updateEditorElementTimeFrame(child, {
          start: sceneStart + newOffset,
          end: sceneStart + newOffset + sceneDuration,
        });
      }
    };

    // ensure clicking anywhere in this scene block selects it
    const sceneClick = () => {
      store.setActiveScene(scene.properties.sceneIndex);
      store.setSelectedElement(scene);
    };

    return (
      <div className="space-y-2" onClick={sceneClick}>
        {layers.map((layer, idx) => {
          
          const offset = offsets[idx];
          const leftPct = (offset / sceneDuration) * 100;
          const rightPct =
            ((offset + sceneDuration) / sceneDuration) * 100;

          const child = scene.properties.elements?.[idx];
          console.log(child)
          const isLayerActive = child && store.selectedElement?.id === child.id;

          console.log(isLayerActive)

          return (
            <div
              key={idx}
              className="relative w-full h-[25px] my-1 flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                if (store.activeSceneIndex !== scene.properties.sceneIndex) {
                  store.setActiveScene(scene.properties.sceneIndex);
                }
                if (child) {
                  store.setSelectedElement(child);
                  if (store.canvas) {
                    const obj = Array.isArray(child.fabricObject)
                      ? child.fabricObject[0]
                      : child.fabricObject;
                    store.canvas.setActiveObject(obj);
                    store.canvas.requestRenderAll();
                  }
                } else {
                  store.setSelectedElement(scene);
                  if (store.canvas) {
                    store.canvas.setActiveObject(layer);
                    store.canvas.requestRenderAll();
                  }
                }
              }}
            >
              {/* Left handle: now scoped to sceneDuration */}
              <DragableView
                className="z-10 cursor-ew-resize absolute h-full"
                value={offset}
                total={sceneDuration} // ← changed from store.maxTime
                onChange={(val) => handleLayerChange(idx, val)}
                disabled={false}
                style={{ left: `${leftPct}%`, width: "10px" }}
              >
                <div className="bg-white border-2 border-blue-400 w-full h-full" />
              </DragableView>

              {/* Bar: spans full 100% of this scene’s block */}
              <DragableView
                className="cursor-grab absolute h-full"
                value={offset}
                total={sceneDuration} // ← changed from store.maxTime
                onChange={(val) => handleLayerChange(idx, val)}
                disabled={false}
                style={{ left: `${leftPct}%`, width: "100%" }}
              >
                <div className="h-full bg-gray-600 text-white text-xs px-2 leading-[25px] truncate">
                  {layer.name || `Layer ${idx + 1}`}
                </div>
              </DragableView>

              {/* Right handle */}
              <DragableView
                className="z-10 cursor-ew-resize absolute h-full"
                value={offset + sceneDuration}
                total={sceneDuration} // ← changed from store.maxTime
                onChange={(val) =>
                  handleLayerChange(idx, val - sceneDuration)
                }
                disabled={false}
                style={{
                  left: `${rightPct}%`,
                  width: "10px",
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

  // -------- Global (non-scene) branch --------
  const isSelected = store.selectedElement?.id === element.id;
  const [isShow, setIsShow] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { start, end } = element.timeFrame;
  const duration = end - start;
  const leftPct = (start / store.maxTime) * 100;
  const widthPct = (duration / store.maxTime) * 100;

  return (
    <div
      className="relative w-full h-[25px] my-2"
      onClick={() => store.setSelectedElement(element)}
    >
      {/* Left handle */}
      <DragableView
        className="z-10 cursor-ew-resize absolute h-full"
        value={start}
        total={store.maxTime}
        disabled={false}
        onChange={(value) =>
          store.updateEditorElementTimeFrame(element, {
            start: value,
          })
        }
        style={{ left: `${leftPct}%`, width: "10px" }}
      >
        <div className="bg-white border-2 border-blue-400 w-full h-full" />
      </DragableView>

      {/* Draggable bar */}
      <DragableView
        className="absolute h-full cursor-col-resize"
        value={start}
        total={store.maxTime}
        disabled={false}
        onChange={(value) => {
          store.updateEditorElementTimeFrame(element, {
            start: value,
            end: value + duration,
          });
        }}
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      >
        <div
          className={`h-full w-full text-white text-xs px-2 leading-[25px] ${
            isSelected ? "layer_active" : ""
          }`}
        >
          {element.name}

          {isShow && (
            <div
              ref={dropdownRef}
              className="layers_w"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  store.cutElement();
                  setIsShow(false);
                }}
              >
                <FaCut className="text-blue-500" /> Cut
              </button>
              <button
                onClick={() => {
                  store.copyElement();
                  setIsShow(false);
                }}
              >
                <FaCopy className="text-blue-500" /> Copy
              </button>
              <button
                onClick={() => {
                  store.pasteElement();
                  setIsShow(false);
                }}
              >
                <FaPaste className="text-blue-500" /> Paste
              </button>
              <button
                onClick={() => {
                  store.deleteElement();
                  setIsShow(false);
                }}
              >
                <FaTrash className="text-red-500" /> Delete
              </button>
              <button
                onClick={() => {
                  store.splitElement();
                  setIsShow(false);
                }}
              >
                <FaCut className="text-blue-500" /> Split
              </button>
            </div>
          )}

          {!element.type.startsWith("scene") && (
            <div className="button_l_w absolute right-1 top-1">
              <button onClick={() => setIsShow(!isShow)}>
                <FaEllipsisV />
              </button>
            </div>
          )}
        </div>
      </DragableView>

      {/* Right handle */}
      <DragableView
        className="z-10 cursor-ew-resize absolute h-full"
        value={end}
        total={store.maxTime}
        disabled={false}
        onChange={(value) =>
          store.updateEditorElementTimeFrame(element, {
            end: value,
          })
        }
        style={{ left: `${(end / store.maxTime) * 100}%`, width: "10px" }}
      >
        <div className="bg-white border-2 border-blue-400 w-full h-full" />
      </DragableView>
    </div>
  );
});
