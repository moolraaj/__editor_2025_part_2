
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
//     const [ttsPlayed, setTtsPlayed] = useState(false);

//     const formatTime = (ms: number) => {
//       const seconds = ms / 1000;
//       return seconds % 1 === 0 ? seconds.toString() : seconds.toFixed(1);
//     };

//     useEffect(() => {
//       if (element.type === "scene") {
//         const se = element as SceneEditorElement;
//         const idx = se.properties.sceneIndex;
//         if (idx === store.activeSceneIndex && !ttsPlayed) {
//           store.scenes[idx].tts?.forEach(({ text }) => {
//             if (text) {
//               window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
//             }
//           });
//           setTtsPlayed(false);
//         } else if (idx !== store.activeSceneIndex && ttsPlayed) {
//           setTtsPlayed(false);
//         }
//       }
//     }, [store.activeSceneIndex, element, ttsPlayed, store.scenes]);

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
//             <div className={`h-full flex items-center justify-between px-2`}>
//               <span className="text-black font-medium truncate absolute">
//                 {formatTime(sceneEnd - sceneStart)}
//               </span>
//               <div className="bg_overLyer"></div>
//               {scene.bgImage && (
//                 <div
//                   className="w-6 h-6 bg-cover bg-center rounded-sm ml-2 scene_main_img"
//                   style={{ backgroundImage: `url(${scene.bgImage})` }}
//                 />
//               )}
//             </div>
//           </div>

//           <DragableView
//             className="absolute z-20 cursor-ew-resize inset-y-0"
//             value={sceneDur}
//             total={denom}
//             onChange={(v) =>
//               store.updateSceneTimeFrame(idx, { end: sceneStart + v })
//             }
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
//         ...(scene.backgrounds || []).map((l) => ({
//           ...l,
//           layerType: "background",
//         })),
//         ...(scene.gifs || []).map((l) => ({ ...l, layerType: "svg" })),
//         ...(scene.animations || []).map((l) => ({
//           ...l,
//           layerType: "animation",
//         })),
//         ...(scene.elements || []).map((l) => ({
//           ...l,
//           layerType: "element",
//         })),
//         ...(scene.text || []).map((l) => ({ ...l, layerType: "text" })),
//         ...(scene.tts || []).map((l) => ({ ...l, layerType: "tts" })),
//       ];

//       return (
//         <div className="space-y-2">
//           <MainSceneLayer />

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
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   store.setActiveScene(idx);
//                   setCurrentSceneIndex?.(idx);
//                   const clickedTime = calculateClickedTime(e, sceneDur, sceneStart);
//                   store.setCurrentTimeInMs(clickedTime);
//                   const elementForSelection = {
//                     id: layer.id,
//                     name: `${layer.layerType}-${layer.id}`,
//                     type: layer.layerType,
//                     timeFrame: layer.timeFrame,
//                     properties: layer,
//                     placement: {
//                       x: 0,
//                       y: 0,
//                       width: 100,
//                       height: 100,
//                       rotation: 0,
//                     },
//                   };

//                   store.setSelectedElement(elementForSelection);
//                   if (store.selectLayerObject) {
//                     store.selectLayerObject(layer.id);
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

//                 <div
//                   className="absolute h-full"
//                   style={{ left: `${lPct}%`, width: `${wPct}%` }}
//                 >
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
//                     <strong>{layer.layerType.toUpperCase()}</strong>{" "}
//                     {formatTime(ed - st)}s
//                   </div>
//                 </div>

//                 <DragableView
//                   className="absolute z-10 cursor-ew-resize h-full"
//                   value={le}
//                   total={sceneDur}
//                   onChange={(v) => {
//                     if (layer.layerType === "tts" && v > orig) return;
//                     store.updateSceneLayerTimeFrame(idx, layer.id, {
//                       end: sceneStart + v,
//                     });
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
//         </div>
//       );
//     }

//     // Non-scene element rendering (fallback)
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
//           onChange={(v) =>
//             store.updateEditorElementTimeFrame(element, { start: v })
//           }
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
//           onChange={(v) =>
//             store.updateEditorElementTimeFrame(element, { end: v })
//           }
//           style={{ left: `${(end / store.maxTime) * 100}%`, width: "10px" }}
//         >
//           <div className="bg-white border-2 border-blue-400 w-full h-full" />
//         </DragableView>
//       </div>
//     );
//   }
// );




//   updateTimeTo(newTime: number) {
//     this.setCurrentTimeInMs(newTime);
//     this.animationTimeLine.seek(newTime);

//     if (this.canvas) {
//       this.canvas.backgroundColor = this.backgroundColor;
//     }

//     const sceneSegments = this.editorElements
//       .filter((e) => e.type === "scene")
//       .sort((a, b) =>
//         (a as SceneEditorElement).properties.sceneIndex -
//         (b as SceneEditorElement).properties.sceneIndex
//       )
//       .map((sc) => {
//         const sceneElement = sc as SceneEditorElement;
//         return {
//           sc: sceneElement,
//           start: sceneElement.timeFrame.start,
//           end: sceneElement.timeFrame.end
//         };
//       });


//     const popAnimate = (obj: fabric.Object) => {
//       if ((obj as any).__isPopping) return;
//       (obj as any).__isPopping = true;

//       const origTop = obj.top as number;
//       const origScaleX = obj.scaleX as number;
//       const origScaleY = obj.scaleY as number;
//       const popOffset = -80;
//       const maxScale = 1.2;
//       const minScale = 0.6;


//       obj.animate(
//         { top: origTop - popOffset, scaleX: origScaleX * maxScale, scaleY: origScaleY * maxScale },
//         {
//           duration: 800,
//           onChange: () => this.canvas?.requestRenderAll(),
//           onComplete: () => {

//             obj.animate(
//               { scaleX: origScaleX * minScale, scaleY: origScaleY * minScale },
//               {
//                 duration: 800,
//                 onChange: () => this.canvas?.requestRenderAll(),
//                 onComplete: () => {

//                   obj.animate(
//                     { top: origTop, scaleX: origScaleX, scaleY: origScaleY },
//                     {
//                       duration: 800,
//                       onChange: () => this.canvas?.requestRenderAll(),
//                       onComplete: () => delete (obj as any).__isPopping,
//                     }
//                   );
//                 },
//               }
//             );
//           },
//         }
//       );
//     };


//     const toggleNoPop = (objects: any[], sources: any[]) => {
//       objects?.forEach((obj, idx) => {
//         const src = sources?.[idx];
//         if (!src || !obj || typeof obj.set !== 'function') return;
//         const vis = newTime >= src.timeFrame.start && newTime <= src.timeFrame.end;
//         obj.set({ visible: vis });
//         if (vis) this.canvas?.add(obj);
//       });
//     };

//     const togglePop = (objects: any[], sources: any[]) => {
//       objects?.forEach((obj, idx) => {
//         const src = sources?.[idx];
//         if (!src || !obj || typeof obj.set !== 'function') return;
//         const vis = newTime >= src.timeFrame.start && newTime <= src.timeFrame.end;
//         obj.set({ visible: vis });
//         if (vis) {
//           this.canvas?.add(obj);
//           popAnimate(obj);
//         }
//       });
//     };

//     const initializeSceneObjectsIfMissing = (scene: any, idx: number) => {
//       const placement = this.editorElements.find(
//         e => e.type === 'scene' && (e as SceneEditorElement).properties.sceneIndex === idx
//       )?.placement;

//       if (!scene.fabricObjects) {
//         scene.fabricObjects = {
//           background: null,
//           backgrounds: [],
//           gifs: [],
//           texts: [],
//           elements: [],
//           animations: [],
//           tts: []
//         };
//       }

//       if (scene.gifs) {
//         scene.gifs.forEach((gif, i) => {
//           if (!scene.fabricObjects.gifs[i]) {
//             const url = gif.svg_url;
//             const pos = gif.calculatedPosition || { x: 100, y: 100, width: 200, height: 200 };
//             const scaleObj = (img: fabric.Object) => {
//               const scale = Math.min(
//                 pos.width / (img.width || 1),
//                 pos.height / (img.height || 1)
//               );
//               img.set({ left: pos.x, top: pos.y, scaleX: scale, scaleY: scale, visible: false });
//               scene.fabricObjects.gifs[i] = img;
//             };

//             if (url.toLowerCase().endsWith('.svg')) {
//               fabric.loadSVGFromURL(url, (objs, opts) => {
//                 const grp = fabric.util.groupSVGElements(objs, opts);
//                 scaleObj(grp);
//               });
//             } else {
//               fabric.Image.fromURL(url, scaleObj, { crossOrigin: 'anonymous' });
//             }
//           }
//         });
//       }

//       if (scene.text) {
//         scene.text.forEach((txt, i) => {
//           if (!scene.fabricObjects.texts[i]) {
//             const bottom = (placement?.y || 0) + (placement?.height || 300) - (txt.properties.fontSize || 24) - 20;
//             const t = new fabric.Textbox(txt.value, {
//               left: txt.placement.x,
//               top: bottom,
//               width: txt.placement.width,
//               fontSize: txt.properties.fontSize,
//               fontFamily: txt.properties.fontFamily,
//               fill: txt.properties.fill,
//               textAlign: 'center',
//               visible: false
//             });
//             scene.fabricObjects.texts[i] = t;
//           }
//         });
//       }

//       if (scene.backgrounds) {
//         scene.backgrounds.forEach((bg, i) => {
//           if (!scene.fabricObjects.backgrounds[i]) {
//             const pos = bg.calculatedPosition || { x: 0, y: 0, width: 800, height: 400 };
//             fabric.Image.fromURL(bg.background_url, (img) => {
//               const scaleX = pos.width / (img.width || 1);
//               const scaleY = pos.height / (img.height || 1);
//               img.crossOrigin = 'anonymous';
//               img.set({ left: pos.x, top: pos.y, scaleX, scaleY, visible: false });
//               scene.fabricObjects.backgrounds[i] = img;
//             });
//           }
//         });
//       }

//       scene.tts?.forEach((ttsItem: any, i: number) => {
//         if (!scene.fabricObjects.tts[i]) {
//           const ICON_SIZE = 24
//           const padding = 10
//           const placement = this.editorElements.find(e =>
//             e.type === 'scene' &&
//             (e as SceneEditorElement).properties.sceneIndex === idx
//           )?.placement
//           const iconX = (placement?.x ?? 0) + padding + i * (ICON_SIZE + 5)
//           const iconY = (placement?.y ?? 0) + padding
//           const icon = new fabric.Text('🔊', {
//             left: iconX,
//             top: iconY,
//             fontSize: ICON_SIZE,
//             selectable: false,
//             hoverCursor: 'pointer',
//             name: ttsItem.id,
//             visible: false
//           })
//           scene.fabricObjects.tts[i] = icon
//         }
//       })



//     };


//     sceneSegments.forEach(({ sc }) => {
//       const idx = sc.properties.sceneIndex;
//       const scene = this.scenes[idx];
//       initializeSceneObjectsIfMissing(scene, idx);
//       if (!scene.fabricObjects) return;
//       if (scene.fabricObjects.background) {
//         const bgVis = newTime >= scene.timeFrame.start && newTime <= scene.timeFrame.end;
//         scene.fabricObjects.background.set({ visible: bgVis });
//         if (bgVis) this.canvas.add(scene.fabricObjects.background);
//       }
//       toggleNoPop(scene.fabricObjects.backgrounds, scene.backgrounds);
//       togglePop(scene.fabricObjects.gifs, scene.gifs);
//       togglePop(scene.fabricObjects.elements, scene.elements);
//       togglePop(scene.fabricObjects.animations, scene.animations);
//       toggleNoPop(scene.fabricObjects.texts, scene.text);
//       toggleNoPop(scene.fabricObjects.tts, scene.tts);

//     });
//     this.editorElements.forEach((el) => {
//       if (el.type !== "scene") {
//         if (!el.fabricObject) return;
//         const inRange = newTime >= el.timeFrame.start && newTime <= el.timeFrame.end;
//         if (Array.isArray(el.fabricObject)) {
//           el.fabricObject.forEach((o) => {
//             if (!o || typeof o.set !== 'function') return;
//             o.set({ visible: inRange });
//             if (inRange) this.canvas.add(o);
//           });
//         } else {
//           el.fabricObject.set({ visible: inRange });
//           if (inRange) this.canvas.add(el.fabricObject);
//         }
//       }
//     });
//     this.updateAudioElements();
//     this.canvas?.requestRenderAll();
//   }