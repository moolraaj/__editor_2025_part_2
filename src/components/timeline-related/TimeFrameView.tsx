"use client";

import React, { useEffect, useRef, useState, useContext } from "react";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/store";
import DragableView from "./DragableView";
import { FaCopy, FaPaste, FaTrash, FaEllipsisV, FaCut } from "react-icons/fa";
import type { EditorElement, SceneEditorElement, SceneLayer } from "@/types";
import { colorMap } from "@/utils/animations";

interface TimeFrameViewProps {
  element: EditorElement;
  setCurrentSceneIndex?: React.Dispatch<React.SetStateAction<number>>;
  handleSceneClick?: (idx: number) => void;
}


const calculateClickedTime = (
  e: React.MouseEvent<HTMLDivElement>,
  totalDuration: number,
  offset: number = 0
) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickedPct = clickX / rect.width;
  return offset + clickedPct * totalDuration;
};

export const TimeFrameView: React.FC<TimeFrameViewProps> = observer(
  ({ element, setCurrentSceneIndex, handleSceneClick }) => {
    const store = useContext(StoreContext);
    const [isShow, setIsShow] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const formatTime = (ms: number) => {
      const seconds = ms / 1000;
      return seconds % 1 === 0 ? seconds.toString() : seconds.toFixed(1);
    };

    useEffect(() => {
      function handleKeyDown(event: KeyboardEvent) {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();

        if (isCtrlOrCmd) {
          switch (key) {
            case "x":
              event.preventDefault();
              if (store.selectedElement) {
                store.cutElement();
              } else {
                console.warn("⚠️ No layer selected to cut.");
              }
              return;
            case "c":
              event.preventDefault();
              if (store.selectedElement) {
                store.copyElement();
              } else {
                console.warn("⚠️ No layer selected to copy.");
              }
              return;
            case "v":
              event.preventDefault();
              store.pasteElement();
              return;
            case "/":
              event.preventDefault();
              if (store.selectedElement) {
                store.splitElement();
              } else {
                console.warn("⚠️ No layer selected to split.");
              }
              return;
            default:
              break;
          }
        } else {
          if (event.key === "Delete") {
            event.preventDefault();
            if (store.selectedElement) {
              store.deleteElement();
            } else {
              console.warn("⚠️ No layer selected to delete.");
            }
          }
        }
      }
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [store]);

    if (element.type === "scene") {
      const se = element as SceneEditorElement;
      const idx = se.properties.sceneIndex;
      const scene = store.scenes[idx];
      const sceneStart = scene.timeFrame.start;
      const sceneEnd = scene.timeFrame.end;
      const sceneDur = sceneEnd - sceneStart;
      const denom = sceneDur;

      const onSceneClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        store.setActiveScene(idx);
        setCurrentSceneIndex?.(idx);
        handleSceneClick?.(idx);
        store.canvas?.renderAll();

           
      };

      const MainSceneLayer = () => (
        <div
          className="relative w-full h-[30px] my-1 flex items-center bg-gray-100 rounded-md"
          onClick={onSceneClick}
        >
          <div
            className="absolute z-20 inset-y-0 cursor-default"
            style={{ left: "0%", width: "10px" }}
          >
            <div className="bg-gray-300 border-2 border-gray-300 w-full h-full rounded-l-md" />
          </div>

          <div
            className="absolute inset-y-0 cursor-default"
            style={{ left: "10px", right: "10px" }}
          >
            <div className={`h-full flex items-center justify-between px-2`}>
              <span className="text-black font-medium truncate absolute">
                {formatTime(sceneEnd - sceneStart)}
              </span>
              <div className="bg_overLyer"></div>
              {scene.bgImage && (
                <div
                  className="w-6 h-6 bg-cover bg-center rounded-sm ml-2 scene_main_img"
                  style={{ backgroundImage: `url(${scene.bgImage})` }}
                />
              )}
            </div>
          </div>

          <DragableView
            className="absolute z-20 cursor-ew-resize inset-y-0"
            value={sceneDur}
            total={denom}
            onChange={(v) =>
              store.updateSceneTimeFrame(idx, { end: sceneStart + v })
            }
            style={{
              left: `calc(${(sceneDur / denom) * 100}% - 10px)`,
              width: "10px",
            }}
          >
            <div className="bg-gray-300 border-2 border-gray-500 w-full h-full rounded-r-md" />
          </DragableView>
        </div>
      );
      //@ts-ignore
      const layers: SceneLayer[] = [
        ...(scene.backgrounds || []).map((l) => ({
          ...l,
          layerType: "background",
        })),
        ...(scene.gifs || []).map((l) => ({ ...l, layerType: "svg" })),
        ...(scene.animations || []).map((l) => ({
          ...l,
          layerType: "animation",
        })),
        ...(scene.elements || []).map((l) => ({
          ...l,
          layerType: "element",
        })),
        //@ts-ignore
        ...(scene.text || []).map((l) => ({ ...l, layerType: "text" })),
        ...(scene.tts || []).map((l) => ({ ...l, layerType: "tts" })),
      ];

      return (
        <div className="space-y-2">
          {layers.map((layer) => {
            const ls = layer.timeFrame.start - sceneStart;
            const le = layer.timeFrame.end - sceneStart;
            const lPct = (ls / sceneDur) * 100;
            const wPct = ((le - ls) / sceneDur) * 100;
            const isSel = store.selectedElement?.id === layer.id;
            const st = layer.timeFrame.start;
            const ed = layer.timeFrame.end;

            return (
              <div
                key={`${layer.layerType}-${layer.id}`}
                className="relative w-full h-[25px] my-1 flex items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  store.setActiveScene(idx);
                  setCurrentSceneIndex?.(idx);
                  const elementForSelection = {
                    id: layer.id,
                    name: `${layer.layerType}-${layer.id}`,
                    type: layer.layerType,
                    timeFrame: layer.timeFrame,
                    properties: layer,
                    placement: {
                      x: 0,
                      y: 0,
                      width: 100,
                      height: 100,
                      rotation: 0,
                    },
                  };
                  //@ts-ignore
                  store.setSelectedElement(elementForSelection);
                  if (store.selectLayerObject) {
                    store.selectLayerObject(layer.id);
                  }
                }}
              >
                <DragableView
                  className="absolute z-10 cursor-ew-resize h-full"
                  value={ls}
                  total={sceneDur}
                  onChange={(v) =>
                    store.updateSceneLayerTimeFrame(idx, layer.id, {
                      start: sceneStart + v,
                    })
                  }
                  style={{ left: `${lPct}%`, width: "10px" }}
                >
                  <div className="bg-white border-2 border-blue-400 w-full h-full" />
                </DragableView>

                <div
                  className="absolute h-full"
                  style={{ left: `${lPct}%`, width: `${wPct}%` }}
                >
                  <div
                    className={`h-full text-white text-xs px-2 truncate leading-[25px] ${isSel ? "ring-2 ring-white" : ""
                      } ${layer.layerType === "background"
                        ? "bg-green-600"
                        : layer.layerType === "svg"
                          ? "bg-purple-600"
                          : layer.layerType === "animation"
                            ? "bg-yellow-600"
                            : layer.layerType === "text"
                              ? "bg-red-600"
                              : "bg-indigo-600"
                      }`}
                  >
                    <strong>{layer.layerType.toUpperCase()}</strong>{" "}
                    <strong>{layer.layerType.toUpperCase()}</strong>{" "}
                    {formatTime(ed - st)}s
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        store.deleteSceneLayer(idx, layer.id);
                      }}
                      className="ml-2 p-1"
                     
                    >
                      <FaTrash className="text-sm" />
                    </button>
                  </div>
                </div>

                <DragableView
                  className="absolute z-10 cursor-ew-resize h-full"
                  value={le}
                  total={sceneDur}
                  onChange={(v) => {
                    store.updateSceneLayerTimeFrame(idx, layer.id, {
                      end: sceneStart + v,
                    });
                  }}
                  style={{
                    left: `calc(${lPct}% + ${wPct}% - 10px)`,
                    width: "10px",
                  }}
                >
                  <div className="bg-white border-2 border-blue-400 w-full h-full" />
                </DragableView>
              </div>
            );
          })}
          <MainSceneLayer />
        </div>
      );
    }


    const isSelected = store.selectedElement?.id === element.id;
    const layerColor = colorMap[element.type] || "gray";
    const { start, end } = element.timeFrame;
    const duration = end - start;
    const leftPct = (start / store.maxTime) * 100;
    const widthPct = (duration / store.maxTime) * 100;

    return (
      <div
        onClick={() => {
          store.setSelectedElement(element);
        }}
        key={element.id}
        className={`relative width-full h-[25px] my-2`}
      >
        <DragableView
          className="z-10"
          value={element.timeFrame.start}
          total={store.maxTime}
          onChange={(value) => {
            store.updateEditorElementTimeFrame(element, {
              start: value,
            });
          }}
        >
          <div
            className={`bg-white border-2 border-blue-400 w-[10px] h-[28px] mt-[calc(25px/2)] translate-y-[-50%] transform translate-x-[-50%] cursor-ew-resize`}
          ></div>
        </DragableView>

        <DragableView
          className="cursor-col-resize"
          value={element.timeFrame.start}
          style={{
            width: `${widthPct}%`,
            backgroundColor: layerColor,
          }}
          total={store.maxTime}
          onChange={(value) => {
            const { start, end } = element.timeFrame;
            store.updateEditorElementTimeFrame(element, {
              start: value,
              end: value + (end - start),
            });
          }}
        >
          <div
            className={`h-full w-full text-white text-xs min-w-[0px] px-2 leading-[25px] ${isSelected ? "layer_active" : ""
              }`}
          >
            {element.name}

            {isShow && (
              <div
                ref={dropdownRef}
                className="absolute z-50 right-0 mt-6 bg-white shadow-lg rounded-md p-2 text-black"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="flex items-center w-full px-2 py-1 hover:bg-gray-100"
                  onClick={() => {
                    store.cutElement();
                    setIsShow(false);
                  }}
                >
                  <FaCut className="text-blue-500 mr-2" />
                  Cut [Ctrl + x]
                </button>
                <button
                  className="flex items-center w-full px-2 py-1 hover:bg-gray-100"
                  onClick={() => {
                    store.copyElement();
                    setIsShow(false);
                  }}
                >
                  <FaCopy className="text-blue-500 mr-2" />
                  Copy [Ctrl + c]
                </button>
                <button
                  className="flex items-center w-full px-2 py-1 hover:bg-gray-100"
                  onClick={() => {
                    store.pasteElement();
                    setIsShow(false);
                  }}
                >
                  <FaPaste className="text-blue-500 mr-2" />
                  Paste [Ctrl + v]
                </button>
                <button
                  className="flex items-center w-full px-2 py-1 hover:bg-gray-100"
                  onClick={() => {
                    store.deleteElement();
                    setIsShow(false);
                  }}
                >
                  <FaTrash className="text-red-500 mr-2" />
                  Del [Delete]
                </button>
                <button
                  className="flex items-center w-full px-2 py-1 hover:bg-gray-100"
                  onClick={() => {
                    store.splitElement();
                    setIsShow(false);
                  }}
                >
                  <FaCut className="text-blue-500 mr-2" />
                  Split [Ctrl + /]
                </button>
              </div>
            )}

            <div className="absolute right-2 top-0 h-full flex items-center">
              <button onClick={(e) => {
                e.stopPropagation();
                setIsShow(!isShow);
              }}>
                <FaEllipsisV />
              </button>
            </div>
          </div>
        </DragableView>

        <DragableView
          className="z-10"
          value={element.timeFrame.end}
          total={store.maxTime}
          onChange={(value) => {
            store.updateEditorElementTimeFrame(element, {
              end: value,
            });
          }}
        >
          <div
            className={`bg-white border-2 border-blue-400 w-[10px] h-[28px] mt-[calc(25px/2)] translate-y-[-50%] transform translate-x-[-50%] cursor-ew-resize`}
          ></div>
        </DragableView>
      </div>
    );
  }
);