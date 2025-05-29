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


//   const totalTime = store.maxTime;
//   const sceneCount = store.scenes.length;
//   const perSceneLength = sceneCount > 0 ? totalTime / sceneCount : totalTime;
//   const sceneElements = store.scenes.map((_, idx) =>
//     store.editorElements.find(
//       (e) =>
//         e.type === "scene" &&
//         (e as SceneEditorElement).properties.sceneIndex === idx
//     ) as SceneEditorElement | undefined
//   );

//   const handleSceneClick = (idx: number) => {
//     const sceneStartTime = idx * perSceneLength;
//     store.setCurrentTimeInMs(sceneStartTime);
//     store.setActiveScene(idx);
//     if (store.canvas) {
//       store.canvas.discardActiveObject();
//       store.canvas.requestRenderAll();
//     }
//   };

//   useEffect(() => {
//     if (sceneCount === 0) return;
//     const idx = Math.floor(store.currentTimeInMs / perSceneLength);
//     const newIdx = Math.min(Math.max(idx, 0), sceneCount - 1);
//     if (newIdx !== store.activeSceneIndex) {
//       store.setActiveScene(newIdx);
//     }
//   }, [store.currentTimeInMs, sceneCount, perSceneLength, store]);

//   const renderSceneLayers = (
//     sceneElem: SceneEditorElement | undefined,
//     idx: number
//   ) => {
//     if (!sceneElem) return null;

//     const isActive = store.activeSceneIndex === idx;
//     const isCurrentScene =
//       store.currentTimeInMs >= idx * perSceneLength &&
//       store.currentTimeInMs < (idx + 1) * perSceneLength;

//     return (
//       <div
//         key={`scene-${idx}-${sceneElem.id}`}
//         className={`rounded p-2 cursor-pointer transition-all  ${isCurrentScene ? "bg-gray-700" : ""}`}
//         onClick={() => handleSceneClick(idx)}
//       >
//         <div className="flex justify-between items-center mb-2">
//           <h3
//             className={`${isActive ? "text-green-400" : "text-white"
//               } font-semibold`}
//           >
//             Scene {idx + 1} {isActive && "(Active)"}
//           </h3>
//         </div>
//         <TimeFrameView key={`frame-${sceneElem.id}`} element={sceneElem} />
//       </div>

//     );
//   };

//   return (
//     <div className="flex flex-col space-y-6">
//       <SeekPlayer />

//       <div className="relative h-48" onDragOver={(e) => e.preventDefault()}>
//         {sceneElements.map((sceneElem, idx) => {
//           const sceneStart = idx * perSceneLength;
//           const widthPct = (perSceneLength / store.maxTime) * 100;
//           const leftPct = (sceneStart / store.maxTime) * 100;

//           return (
//             <div
//               key={`scene-container-${idx}`}
//               className="absolute top-0"
//               style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
//             >
//               {renderSceneLayers(sceneElem, idx)}
//             </div>
//           );
//         })}

//         {store.editorElements.some((e) => e.type !== "scene") && (
//           <div className="space-y-4 mt-4">
//             {store.editorElements
//               .filter((e) => e.type !== "scene")
//               .map((el) => (
//                 <div key={`non-scene-${el.id}`} className="rounded-lg">
//                   <TimeFrameView
//                     key={`frame-non-scene-${el.id}`}
//                     element={el}
//                   />
//                 </div>
//               ))}
//           </div>
//         )}

//         <div
//           className="w-[2px] bg-[#f87171] absolute top-0 bottom-0 z-20"
//           style={{ left: `${nowPct}%` }}
//         />
//       </div>
//     </div>
//   );
// });












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
  const sceneCount = store.scenes.length;
  const perSceneLength = sceneCount > 0 ? totalTime / sceneCount : totalTime;
  const sceneElements = store.scenes.map((_, idx) =>
    store.editorElements.find(
      (e) =>
        e.type === "scene" &&
        (e as SceneEditorElement).properties.sceneIndex === idx
    ) as SceneEditorElement | undefined
  );
  const nowPct = viewMode === "scene"
    ? ((store.currentTimeInMs - (viewingScene * perSceneLength)) / perSceneLength) * 100
    : (store.currentTimeInMs / store.maxTime) * 100;

  const handleSceneClick = (idx: number) => {
    const sceneStartTime = idx * perSceneLength;
    store.setCurrentTimeInMs(sceneStartTime);
    store.setActiveScene(idx);
    setCurrentSceneIndex(idx);
    if (store.canvas) {
      store.canvas.discardActiveObject();
      store.canvas.requestRenderAll();
    }
  };

  useEffect(() => {
    if (sceneCount === 0) return;
    const idx = Math.floor(store.currentTimeInMs / perSceneLength);
    const newIdx = Math.min(Math.max(idx, 0), sceneCount - 1);

    if (newIdx !== store.activeSceneIndex) {
      store.setActiveScene(newIdx);
    }

    if (store.currentTimeInMs >= (currentSceneIndex + 1) * perSceneLength) {
      const nextScene = Math.min(currentSceneIndex + 1, sceneCount - 1);
      setCurrentSceneIndex(nextScene);
      if (viewMode === "scene") {
        setViewingScene(nextScene);
      }
    }
  }, [store.currentTimeInMs, sceneCount, perSceneLength, store]);

  const renderSceneLayers = (
    sceneElem: SceneEditorElement | undefined,
    idx: number
  ) => {
    if (!sceneElem) return null;

    const isActive = store.activeSceneIndex === idx;
    const isCurrentScene =
      store.currentTimeInMs >= idx * perSceneLength &&
      store.currentTimeInMs < (idx + 1) * perSceneLength;

    return (
      <div
        key={`scene-${idx}-${sceneElem.id}`}
        className={`rounded p-2 cursor-pointer transition-all ${isActive ? "bg-gray-700" : ""}`}
      >
        <div className="flex justify-between items-center mb-2">
          <h3
            className={`${isActive ? "text-green-400" : "text-white"} font-semibold`}
          >
            Scene {idx + 1} {isActive && "(Active)"}
          </h3>
        </div>
        <TimeFrameView key={`frame-${sceneElem.id}`} element={sceneElem} setCurrentSceneIndex={setCurrentSceneIndex} handleSceneClick={handleSceneClick}/>
      </div>
    );
  };

  const renderMasterView = () => (
    <div className="relative h-48" onDragOver={(e) => e.preventDefault()}>
      {sceneElements.map((sceneElem, idx) => {
        const sceneStart = idx * perSceneLength;
        const widthPct = (perSceneLength / store.maxTime) * 100;
        const leftPct = (sceneStart / store.maxTime) * 100;

        return (
          <div
            key={`scene-container-${idx}`}
            className="absolute top-0"
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
          >
            {renderSceneLayers(sceneElem, idx)}
          </div>
        );
      })}

      {store.editorElements.some((e) => e.type !== "scene") && (
        <div className="space-y-4 mt-4">
          {store.editorElements
            .filter((e) => e.type !== "scene")
            .map((el) => (
              <div key={`non-scene-${el.id}`} className="rounded-lg">
                <TimeFrameView key={`frame-non-scene-${el.id}`} element={el} />
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

  const renderSceneView = () => {
    const sceneElem = sceneElements[viewingScene];
    if (!sceneElem) return null;

    return (
      <div className="relative h-48" onDragOver={(e) => e.preventDefault()}>
        <div className="">
          {renderSceneLayers(sceneElem, viewingScene)}
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
        perSceneLength={perSceneLength}
      />


      {sceneElements.length !== 0 && (<div className="flex border-b border-gray-600">
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
      </div>)}


      {viewMode === "master" ? renderMasterView() : renderSceneView()}
    </div>
  );
});