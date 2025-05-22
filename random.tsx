// "use client";
// import React, { useContext, useState, useEffect } from "react";
// import { observer } from "mobx-react-lite";
// import { StoreContext } from "@/store";
// import { SeekPlayer } from "./timeline-related/SeekPlayer";
// import { TimeFrameView } from "./timeline-related/TimeFrameView";
// import type { SceneEditorElement } from "@/types";

// export const TimeLine: React.FC = observer(() => {
//   const store = useContext(StoreContext);
//   const nowPct = (store.currentTimeInMs / store.maxTime) * 100;
//   const [viewMode, setViewMode] = useState<"master" | "scene">("master");
//   const [selectedScene, setSelectedScene] = useState<number | null>(null);

//   const handleSceneClick = (idx: number) => {
//     store.setActiveScene(idx);
//     setSelectedScene(idx);
//     setViewMode("scene");
//     if (store.canvas) {
//       store.canvas.discardActiveObject();
//       store.canvas.requestRenderAll();
//     }
//   };

//   const handleBackToMaster = () => {
//     setViewMode("master");
//     setSelectedScene(null);
//   };

//   const renderSceneLayers = (sceneElem: SceneEditorElement, idx: number) => {
//     const isActive = store.activeSceneIndex === idx;
//     return (
//       <div
//         key={sceneElem.id}
//         className={`bg-gray-800 p-2 ${isActive ? "ring-2 ring-blue-500" : ""}`}
//         onClick={() => handleSceneClick(idx)}
//       >
//         <div className="flex justify-between items-center mb-2">
//           <h3 className={`${isActive ? "text-green-400" : "text-white"} font-semibold`}>
//             Scene {idx + 1} {isActive && "(Active)"}
//           </h3>
//         </div>
//         <TimeFrameView element={sceneElem} />
//       </div>
//     );
//   };

//   const totalTime = store.maxTime;

//   return (
//     <div className="flex flex-col space-y-6">
//       {/* Seek bar */}
//       <SeekPlayer />

//       {/* No-scene fallback */}
//       {store.editorElements.filter((e) => e.type === "scene").length === 0 && (
//         <div className="flex">
//           <button
//             className="px-4 py-2 rounded bg-blue-500 text-white"
//             onClick={handleBackToMaster}
//           >
//             Master View
//           </button>
//         </div>
//       )}

//       {/* Scene tabs */}
//       {store.editorElements.filter((e) => e.type === "scene").length > 0 && (
//         <div className="flex items-center space-x-4 scene_tab">
//           <button
//             className={`main_tab scene_tab_b ${viewMode === "master" ? "ac_scenes" : ""}`}
//             onClick={handleBackToMaster}
//           >
//             All Scenes
//           </button>
//           {store.scenes.map((_, idx) => (
//             <button
//               key={idx}
//               className={`scene_tabs scene_tab_b ${selectedScene === idx ? "ac_scene" : ""}`}
//               onClick={() => handleSceneClick(idx)}
//             >
//               Scene {idx + 1}
//             </button>
//           ))}
//         </div>
//       )}

//       {/* Timeline */}
//       <div className="relative h-48" onDragOver={(e) => e.preventDefault()}>
//         {/* Master view: all scene strips */}
//         {viewMode === "master" && (
//           <>
//             {store.editorElements
//               .filter((e) => e.type === "scene")
//               .map((sceneElem) => {
//                 const se = sceneElem as SceneEditorElement;
//                 const { start, end } = se.timeFrame;
//                 const duration = end - start;
//                 const leftPct = (start / totalTime) * 100;
//                 const widthPct = (duration / totalTime) * 100;
//                 const idx = se.properties.sceneIndex;

//                 return (
//                   <div
//                     key={se.id}
//                     className="absolute top-0"
//                     style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
//                   >
//                     {renderSceneLayers(se, idx)}
//                   </div>
//                 );
//               })}

//             {/* Global (non-scene) layers */}
//             {store.editorElements.some((e) => e.type !== "scene") && (
//               <div className="space-y-4 mt-4">
//                 {store.editorElements
//                   .filter((e) => e.type !== "scene")
//                   .map((el) => (
//                     <div key={el.id} className="bg-gray-800 rounded-lg p-2">
//                       <TimeFrameView element={el as SceneEditorElement} />
//                     </div>
//                   ))}
//               </div>
//             )}
//           </>
//         )}

//         {/* Scene-only view */}
//         {viewMode === "scene" && selectedScene !== null && (
//           <div className="w-full">
//             {(() => {
//               const sceneElem = store.editorElements.find(
//                 (e) =>
//                   e.type === "scene" &&
//                   (e as SceneEditorElement).properties.sceneIndex === selectedScene
//               ) as SceneEditorElement | undefined;
//               if (!sceneElem) return null;
//               return renderSceneLayers(sceneElem, selectedScene);
//             })()}

//             {/* Global layers under scene */}
//             {store.editorElements.some((e) => e.type !== "scene") && (
//               <div className="space-y-4 mt-4">
//                 {store.editorElements
//                   .filter((e) => e.type !== "scene")
//                   .map((el) => (
//                     <div key={el.id} className="bg-gray-800 rounded-lg p-2">
//                       <TimeFrameView element={el as SceneEditorElement} />
//                     </div>
//                   ))}
//               </div>
//             )}
//           </div>
//         )}

//         {/* Playhead */}
//         <div
//           className="w-[2px] bg-[#f87171] absolute top-0 bottom-0 z-20"
//           style={{ left: `${nowPct}%` }}
//         />
//       </div>
//     </div>
//   );
// });
