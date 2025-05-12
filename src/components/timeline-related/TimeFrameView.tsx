"use client";
import React, { useEffect, useRef, useState, useContext } from "react";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/store";
import DragableView from "./DragableView";
import { FaCopy, FaPaste, FaTrash, FaEllipsisV, FaCut } from "react-icons/fa";
import type { EditorElement, SceneEditorElement, SceneLayer, TimeFrame } from "@/types";
import { fabric } from 'fabric';






export const TimeFrameView = observer((props: { element: EditorElement }) => {
  const store = useContext(StoreContext);
  const { element } = props;
  const [isShow, setIsShow] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const cmd = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
      if (cmd && key === "x") { e.preventDefault(); store.cutElement(); }
      else if (cmd && key === "c") { e.preventDefault(); store.copyElement(); }
      else if (cmd && key === "v") { e.preventDefault(); store.pasteElement(); }
      else if (cmd && key === "/") { e.preventDefault(); store.splitElement(); }
      else if (e.key === "delete") { e.preventDefault(); store.deleteElement(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [store]);


  if (element.type === "scene") {
    const scene = element as SceneEditorElement;
    const sceneStart = scene.timeFrame.start;
    const sceneEnd = scene.timeFrame.end;
    const sceneDuration = sceneEnd - sceneStart;
    const fabricLayers = Array.isArray(scene.fabricObject)
      ? (scene.fabricObject as fabric.Object[])
      : [];


    const sceneLayers: SceneLayer[] = [
      ...(scene.properties.backgrounds || []).map(bg => ({ ...bg, layerType: "background" as const , timeFrame: { ...bg.timeFrame } })),
      ...(scene.properties.gifs || []).map(gf => ({ ...gf, layerType: "svg" as const, timeFrame: { ...gf.timeFrame } })),
      ...(scene.properties.animations || []).map(an => ({ ...an, layerType: "animation" as const, timeFrame: { ...an.timeFrame } })),
      ...(scene.properties.elements || []).map(el => ({ ...el, layerType: "element" as const, timeFrame: { ...el.timeFrame } })),
    ];




    const [offsets, setOffsets] = useState(
      sceneLayers.map(l => l.timeFrame.start - sceneStart)
    );

    console.log(offsets)

    const handleLayerChange = (
      idx: number,
      rawValue: number,
      isEnd: boolean
    ) => {
      const layer = sceneLayers[idx];





      const oldTF = layer.timeFrame;
      const absTime = Math.min(
        Math.max(sceneStart, sceneStart + rawValue),
        sceneEnd
      );
      const newTF: TimeFrame = isEnd
        ? { start: oldTF.start, end: absTime }
        : { start: absTime, end: oldTF.end };



      setOffsets(ofs =>
        ofs.map((o, i) => (i === idx ? newTF.start - sceneStart : o))
      );


      store.updateSceneLayerTimeFrame(
        scene.properties.sceneIndex,
        layer.id,
        newTF
      );
    };


    return (
      <div className="space-y-2">

        <div
          className="p-2 bg-gray-800 text-white cursor-pointer flex justify-between items-center"
          onClick={e => {
            e.stopPropagation();
            store.setCurrentTimeInMs(scene.timeFrame.start);
            store.setActiveScene(scene.properties.sceneIndex);
            store.setSelectedElement(scene);

            const objs = Array.isArray(scene.fabricObject)
              ? scene.fabricObject
              : [];
            if (objs.length && store.canvas) {
              const sel = new fabric.ActiveSelection(objs, { canvas: store.canvas });
              store.canvas.setActiveObject(sel);
            }
            store.updateTimeTo(scene.timeFrame.start);
          }}
        >

          <span className="text-xs opacity-75">{sceneLayers.length} layers</span>
        </div>


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
              onClick={e => {
                e.stopPropagation();
                store.setActiveScene(scene.properties.sceneIndex);

                if (layer.layerType === "element") {
                  const sceneElement = store.editorElements.find(e => e.id === layer.id);
                  if (sceneElement) {
                    store.setSelectedElement(sceneElement);

                    const obj = Array.isArray(sceneElement.fabricObject)
                      ? sceneElement.fabricObject[0]
                      : sceneElement.fabricObject;

                    obj && store.canvas?.setActiveObject(obj);
                  }
                } else {
                  store.setSelectedElement(scene); // scene is already a SceneEditorElement
                  fabricLayers[idx] && store.canvas?.setActiveObject(fabricLayers[idx]);
                }

                store.canvas?.requestRenderAll();
              }}

            >
              {/* Left handle */}
              <DragableView
                className="z-10 cursor-ew-resize absolute h-full"
                value={tf.start - sceneStart}
                total={sceneDuration}
                onChange={val => handleLayerChange(idx, val, false)}
                style={{ left: `${leftPct}%`, width: "10px" }}
              >
                <div className="bg-white border-2 border-blue-400 w-full h-full" />
              </DragableView>

              {/* Bar */}
              <DragableView
                className="cursor-grab absolute h-full"
                value={tf.start - sceneStart}
                total={sceneDuration}
                onChange={val => handleLayerChange(idx, val, false)}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              >
                <div
                  className={`h-full text-white text-xs px-2 leading-[25px] truncate ${isSelected ? "ring-2 ring-white" : ""
                    } ${layer.layerType === "background"
                      ? "bg-green-600"
                      : layer.layerType === "svg"
                        ? "bg-purple-600"
                        : layer.layerType === "animation"
                          ? "bg-yellow-600"
                          : "bg-gray-600"
                    }`}
                >
                  <strong>{layer.layerType.toUpperCase()} </strong>
                  {layer.layerType === 'background' ? layer.name : ''}
                  {layer.layerType === 'svg' ? layer.tags[0] : ''}
                  {layer.layerType === 'element' ? layer.type : ''}

                </div>
              </DragableView>


              <DragableView
                className="z-10 cursor-ew-resize absolute h-full"
                value={tf.end - sceneStart}
                total={sceneDuration}
                onChange={val => handleLayerChange(idx, val, true)}
                style={{ left: `${rightPct}%`, width: "10px" }}
              >
                <div className="bg-white border-2 border-blue-400 w-full h-full" />
              </DragableView>
            </div>
          );
        })}
      </div>
    );
  }


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
        onChange={v => store.updateEditorElementTimeFrame(element, { start: v })}
        style={{ left: `${leftPct}%`, width: "10px" }}
      >
        <div className="bg-white border-2 border-blue-400 w-full h-full" />
      </DragableView>


      <DragableView
        className="absolute h-full cursor-col-resize"
        value={start}
        total={store.maxTime}
        onChange={v =>
          store.updateEditorElementTimeFrame(element, { start: v, end: v + duration })
        }
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      >
        <div className={`h-full w-full text-white text-xs px-2 leading-[25px] ${isSelected ? "bg-blue-600" : "bg-gray-600"
          }`}>
          {element.name}
          <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
            <button className="text-white hover:text-gray-200" onClick={e => { e.stopPropagation(); setIsShow(!isShow); }}>
              <FaEllipsisV size={12} />
            </button>
            {isShow && (
              <div ref={dropdownRef} className="absolute right-0 mt-6 w-48 bg-white shadow-lg rounded-md z-50" onClick={e => e.stopPropagation()}>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center" onClick={() => { store.cutElement(); setIsShow(false); }}>
                  <FaCut className="text-blue-500 mr-2" /> Cut
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center" onClick={() => { store.copyElement(); setIsShow(false); }}>
                  <FaCopy className="text-blue-500 mr-2" /> Copy
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center" onClick={() => { store.pasteElement(); setIsShow(false); }}>
                  <FaPaste className="text-blue-500 mr-2" /> Paste
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center" onClick={() => { store.deleteElement(); setIsShow(false); }}>
                  <FaTrash className="text-red-500 mr-2" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </DragableView>

      {/* Right handle */}
      <DragableView
        className="z-10 cursor-ew-resize absolute h-full"
        value={end}
        total={store.maxTime}
        onChange={v => store.updateEditorElementTimeFrame(element, { end: v })}
        style={{ left: `${(end / store.maxTime) * 100}%`, width: "10px" }}
      >
        <div className="bg-white border-2 border-blue-400 w-full h-full" />
      </DragableView>
    </div>
  );
});

