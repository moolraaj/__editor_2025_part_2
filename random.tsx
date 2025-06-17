// "use client";

// import React, { useEffect, useRef, useState, useContext } from "react";
// import { observer } from "mobx-react-lite";
// import { StoreContext } from "@/store";
// import DragableView from "./DragableView";
// import { FaCopy, FaPaste, FaTrash, FaEllipsisV, FaCut } from "react-icons/fa";
// import type { EditorElement, SceneEditorElement, SceneLayer } from "@/types";

// interface TimeFrameViewProps {
//   element: EditorElement;
//   setCurrentSceneIndex?: React.Dispatch<React.SetStateAction<number>>;
//   handleSceneClick?: (idx: number) => void;
// }

// const calculateClickedTime = (
//   e: React.MouseEvent<HTMLDivElement>,
//   totalDuration: number,
//   offset: number = 0
// ) => {
//   const rect = e.currentTarget.getBoundingClientRect();
//   const clickX = e.clientX - rect.left;
//   const clickedPct = clickX / rect.width;
//   return offset + clickedPct * totalDuration;
// };

// export const TimeFrameView: React.FC<TimeFrameViewProps> = observer(
//   ({ element, setCurrentSceneIndex, handleSceneClick }) => {
//     const store = useContext(StoreContext);
//     const formatTime = (ms: number) => {
//       const seconds = ms / 1000;
//       return seconds % 1 === 0 ? seconds.toString() : seconds.toFixed(1);
//     };
//     const isDraggingRef = useRef(false);
//     const dragStartXRef = useRef(0);


//     if (element.type === "scene") {
//       const se = element as SceneEditorElement;
//       const idx = se.properties.sceneIndex;
//       const scene = store.scenes[idx];
//       const sceneStart = scene.timeFrame.start;
//       const sceneEnd = scene.timeFrame.end;
//       const sceneDur = sceneEnd - sceneStart;
//       const denom = sceneDur;

//       const onSceneClick = (e: React.MouseEvent) => {
//         e.stopPropagation();
//         store.setActiveScene(idx);
//         setCurrentSceneIndex?.(idx);
//         handleSceneClick?.(idx);
//         store.canvas?.renderAll();
//       };

//       const MainSceneLayer = () => (
//         <div
//           className="relative w-full h-[30px] my-1 flex items-center bg-gray-100 rounded-md"
//           onClick={onSceneClick}
//         >
//           <div
//             className="absolute z-20 inset-y-0 cursor-default"
//             style={{ left: "0%", width: "10px" }}
//           >
//             <div className="bg-gray-300 border-2 border-gray-300 w-full h-full rounded-l-md" />
//           </div>

//           <div
//             className="absolute inset-y-0 cursor-default"
//             style={{ left: "10px", right: "10px" }}
//           >
//             <div className="h-full flex items-center justify-between px-2">
//               <span className="text-black font-medium truncate absolute">
//                 {formatTime(sceneDur)}
//               </span>
//               <div className="bg_overLyer" />
//               {scene.bgImage && (
//                 <div
//                   className="w-6 h-6 bg-cover bg-center rounded-sm ml-2 scene_main_img"
//                   style={{
//                     backgroundImage: `url(${scene.bgImage})`,
//                   }}
//                 />
//               )}
//             </div>
//           </div>

//           <DragableView
//             className="absolute z-20 cursor-ew-resize inset-y-0"
//             value={sceneDur}
//             total={denom}
//             onChange={(v) => store.updateSceneTimeFrame(idx, { end: sceneStart + v })}
//             style={{
//               left: `calc(${(sceneDur / denom) * 100}% - 10px)`,
//               width: "10px",
//             }}
//           >
//             <div className="bg-gray-300 border-2 border-gray-500 w-full h-full rounded-r-md" />
//           </DragableView>
//         </div>
//       );

//       const layers: SceneLayer[] = [
//         ...(scene.backgrounds || []).map((l) => ({ ...l, layerType: "background" })),
//         ...(scene.gifs || []).map((l) => ({ ...l, layerType: "svg" })),
//         ...(scene.animations || []).map((l) => ({ ...l, layerType: "animation" })),
//         ...(scene.elements || []).map((l) => ({ ...l, layerType: "element" })),
//         ...(scene.text || []).map((l) => ({ ...l, layerType: "text" })),
//         ...(scene.tts || []).map((l) => ({ ...l, layerType: "tts" })),
//       ];

//       return (
//         <div className="space-y-2">
//           {layers.map((layer) => {
//             const ls = layer.timeFrame.start - sceneStart;
//             const le = layer.timeFrame.end - sceneStart;
//             const lPct = (ls / sceneDur) * 100;
//             const wPct = ((le - ls) / sceneDur) * 100;
//             const isSel = store.selectedElement?.id === layer.id;
//             const orig = le - ls;
//             const st = layer.timeFrame.start;
//             const ed = layer.timeFrame.end;

//             return (
//               <div
//                 key={`${layer.layerType}-${layer.id}`}
//                 className="relative w-full h-[25px] my-1 flex items-center"
//                 onMouseDown={(e) => {
//                   dragStartXRef.current = e.clientX;
//                   isDraggingRef.current = false;
//                 }}
//                 onMouseMove={(e) => {
//                   if (Math.abs(e.clientX - dragStartXRef.current) > 5) {
//                     isDraggingRef.current = true;
//                   }
//                 }}
//                 onMouseUp={(e) => {
//                   if (!isDraggingRef.current) {
//                     const clickedTime = calculateClickedTime(e, sceneDur, sceneStart);
//                     store.setCurrentTimeInMs(clickedTime);
//                     store.setActiveScene(idx);
//                     setCurrentSceneIndex?.(idx);

//                     const elementForSelection = {
//                       id: layer.id,
//                       name: `${layer.layerType}-${layer.id}`,
//                       type: layer.layerType,
//                       timeFrame: layer.timeFrame,
//                       properties: layer,
//                       placement: {
//                         x: 0,
//                         y: 0,
//                         width: 100,
//                         height: 100,
//                         rotation: 0
//                       }
//                     };
//                     store.setSelectedElement(elementForSelection);

//                     if (store.selectLayerObject) {
//                       store.selectLayerObject(layer.id);
//                     }
//                   }
//                 }}
//               >

//                 <DragableView
//                   className="absolute z-10 cursor-ew-resize h-full"
//                   value={ls}
//                   total={sceneDur}
//                   onChange={(v) =>
//                     store.updateSceneLayerTimeFrame(idx, layer.id, {
//                       start: sceneStart + v,
//                     })
//                   }
//                   style={{ left: `${lPct}%`, width: "10px" }}
//                 >
//                   <div className="bg-white border-2 border-blue-400 w-full h-full" />
//                 </DragableView>

//                 <div className="absolute h-full" style={{ left: `${lPct}%`, width: `${wPct}%` }}>
//                   <div
//                     className={`h-full text-white text-xs px-2 truncate leading-[25px] ${isSel ? "ring-2 ring-white" : ""
//                       } ${layer.layerType === "background"
//                         ? "bg-green-600"
//                         : layer.layerType === "svg"
//                           ? "bg-purple-600"
//                           : layer.layerType === "animation"
//                             ? "bg-yellow-600"
//                             : layer.layerType === "text"
//                               ? "bg-red-600"
//                               : "bg-indigo-600"
//                       }`}
//                   >
//                     <strong>{layer.layerType.toUpperCase()}</strong> {formatTime(ed - st)}s
//                   </div>
//                 </div>

//                 <DragableView
//                   className="absolute z-10 cursor-ew-resize h-full"
//                   value={le}
//                   total={sceneDur}
//                   onChange={(v) => {
//                     if (layer.layerType === "tts" && v > orig) return;
//                     store.updateSceneLayerTimeFrame(idx, layer.id, { end: sceneStart + v });
//                   }}
//                   style={{
//                     left: `calc(${lPct}% + ${wPct}% - 10px)`,
//                     width: "10px",
//                   }}
//                 >
//                   <div className="bg-white border-2 border-blue-400 w-full h-full" />
//                 </DragableView>
//               </div>
//             );
//           })}

//           <MainSceneLayer />
//         </div>
//       );
//     }

//     // Non-scene elements
//     const isSelected = store.selectedElement?.id === element.id;
//     const { start, end } = element.timeFrame;
//     const duration = end - start;
//     const leftPct = (start / store.maxTime) * 100;
//     const widthPct = (duration / store.maxTime) * 100;

//     return (
//       <div
//         className="relative w-full h-[25px] my-2 flex items-center"
//         onClick={() => store.setSelectedElement(element)}
//       >
//         <DragableView
//           className="absolute z-10 cursor-ew-resize h-full"
//           value={start}
//           total={store.maxTime}
//           onChange={(v) => store.updateEditorElementTimeFrame(element, { start: v })}
//           style={{ left: `${leftPct}%`, width: "10px" }}
//         >
//           <div className="bg-white border-2 border-blue-400 w-full h-full" />
//         </DragableView>

//         <div
//           className="absolute h-full flex items-center"
//           style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
//         >
//           <div
//             className={`flex-1 h-full text-white text-xs px-2 leading-[25px] ${isSelected ? "bg-blue-600" : "bg-gray-600"
//               } flex items-center justify-between`}
//           >
//             <span>
//               {element.name} ({formatTime(start)}–{formatTime(end)})
//             </span>
//             <span className="flex space-x-2 pr-2">
//               <button
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   store.cutElement();
//                 }}
//               >
//                 <FaCut className="cursor-pointer" />
//               </button>
//               <button
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   store.copyElement();
//                 }}
//               >
//                 <FaCopy className="cursor-pointer" />
//               </button>
//               <button
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   store.pasteElement();
//                 }}
//               >
//                 <FaPaste className="cursor-pointer" />
//               </button>
//             </span>
//           </div>
//         </div>

//         <DragableView
//           className="absolute z-10 cursor-ew-resize h-full"
//           value={end}
//           total={store.maxTime}
//           onChange={(v) => store.updateEditorElementTimeFrame(element, { end: v })}
//           style={{ left: `${(end / store.maxTime) * 100}%`, width: "10px" }}
//         >
//           <div className="bg-white border-2 border-blue-400 w-full h-full" />
//         </DragableView>
//       </div>
//     );
//   }
// );



"use client";

import React, { useEffect, useRef, useState, useContext } from "react";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/store";
 
import { FaCopy, FaPaste, FaTrash, FaEllipsisV, FaCut } from "react-icons/fa";
import type { EditorElement, SceneEditorElement, SceneLayer } from "@/types";
import DragableView from "@/components/timeline-related/DragableView";

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
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);

    const formatTime = (ms: number) => {
      const seconds = ms / 1000;
      return seconds % 1 === 0 ? seconds.toString() : seconds.toFixed(1);
    };

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
            <div className="h-full flex items-center justify-between px-2">
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
            onChange={(v) => store.updateSceneTimeFrame(idx, { end: sceneStart + v })}
            style={{
              left: `calc(${(sceneDur / denom) * 100}% - 10px)`,
              width: "10px",
            }}
          >
            <div className="bg-gray-300 border-2 border-gray-500 w-full h-full rounded-r-md" />
          </DragableView>
        </div>
      );

      const layers: SceneLayer[] = [
        ...(scene.backgrounds || []).map((l) => ({ ...l, layerType: "background" })),
        ...(scene.gifs || []).map((l) => ({ ...l, layerType: "svg" })),
        ...(scene.animations || []).map((l) => ({ ...l, layerType: "animation" })),
        ...(scene.elements || []).map((l) => ({ ...l, layerType: "element" })),
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
                onMouseDown={(e) => {
                  dragStartXRef.current = e.clientX;
                  isDraggingRef.current = false;
                }}
                onMouseMove={(e) => {
                  if (Math.abs(e.clientX - dragStartXRef.current) > 5) {
                    isDraggingRef.current = true;
                  }
                }}
                onMouseUp={(e) => {
                  if (!isDraggingRef.current) {
                    const clickedTime = calculateClickedTime(e, sceneDur, sceneStart);
                    store.setCurrentTimeInMs(clickedTime);
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
                    store.setSelectedElement(elementForSelection);
                    if (store.selectLayerObject) {
                      store.selectLayerObject(layer.id);
                    }
                  }
                }}
              >
                <DragableView
                  className="absolute z-10 cursor-ew-resize h-full"
                  value={ls}
                  total={sceneDur}
                  onChange={(v) =>
                    store.updateSceneLayerTimeFrame(idx, layer.id, { start: sceneStart + v })
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
                    className={`h-full text-white text-xs px-2 truncate leading-[25px] ${
                      isSel ? "ring-2 ring-white" : ""
                    } ${
                      layer.layerType === "background"
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
                    <strong>{layer.layerType.toUpperCase()}</strong> {formatTime(ed - st)}s
                  </div>
                </div>

                <DragableView
                  className="absolute z-10 cursor-ew-resize h-full"
                  value={le}
                  total={sceneDur}
                  onChange={(v) => {
                    if (layer.layerType === "tts" && v < le) return;
                    store.updateSceneLayerTimeFrame(idx, layer.id, { end: sceneStart + v });
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

    // For non-scene elements
    const isSelected = store.selectedElement?.id === element.id;
    const { start, end } = element.timeFrame;
    const duration = end - start;
    const leftPct = (start / store.maxTime) * 100;
    const widthPct = (duration / store.maxTime) * 100;

    return (
      <div
        className="relative w-full h-[25px] my-2 flex items-center"
        onClick={() => store.setSelectedElement(element)}
      >
        <DragableView
          className="absolute z-10 cursor-ew-resize h-full"
          value={start}
          total={store.maxTime}
          onChange={(v) =>
            store.updateEditorElementTimeFrame(element, { start: v })
          }
          style={{ left: `${leftPct}%`, width: "10px" }}
        >
          <div className="bg-white border-2 border-blue-400 w-full h-full" />
        </DragableView>

        <div
          className="absolute h-full flex items-center"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        >
          <div
            className={`flex-1 h-full text-white text-xs px-2 leading-[25px] ${
              isSelected ? "bg-blue-600" : "bg-gray-600"
            } flex items-center justify-between`}
          >
            <span>
              {element.name} ({formatTime(start)}–{formatTime(end)})
            </span>
            <span className="flex space-x-2 pr-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  store.cutElement();
                }}
              >
                <FaCut className="cursor-pointer" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  store.copyElement();
                }}
              >
                <FaCopy className="cursor-pointer" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  store.pasteElement();
                }}
              >
                <FaPaste className="cursor-pointer" />
              </button>
            </span>
          </div>
        </div>

        <DragableView
          className="absolute z-10 cursor-ew-resize h-full"
          value={end}
          total={store.maxTime}
          onChange={(v) =>
            store.updateEditorElementTimeFrame(element, { end: v })
          }
          style={{
            left: `${(end / store.maxTime) * 100}%`,
            width: "10px",
          }}
        >
          <div className="bg-white border-2 border-blue-400 w-full h-full" />
        </DragableView>
      </div>
    );
  }
);
