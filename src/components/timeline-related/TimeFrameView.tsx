"use client";

import React, { useEffect, useRef, useState, useContext } from "react";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/store";
import DragableView from "./DragableView";
import { FaCopy, FaPaste, FaTrash, FaEllipsisV, FaCut } from "react-icons/fa";
import type {
  EditorElement,
  SceneEditorElement,
  SceneLayer,
  TimeFrame,
} from "@/types";
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

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (cmd && k === "x") e.preventDefault(), store.cutElement();
      else if (cmd && k === "c") e.preventDefault(), store.copyElement();
      else if (cmd && k === "v") e.preventDefault(), store.pasteElement();
      else if (cmd && k === "/") e.preventDefault(), store.splitElement();
      else if (e.key === "Delete") e.preventDefault(), store.deleteElement();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  // SCENE timeline
  if (element.type === "scene") {
    const scene = element as SceneEditorElement;
    const idx = scene.properties.sceneIndex;
    const storeScene = store.scenes[idx];

    const sceneStart = storeScene.timeFrame.start;
    const sceneEnd = storeScene.timeFrame.end;
    const sceneDuration = sceneEnd - sceneStart;
    const fabricObjs = Array.isArray(scene.fabricObject)
      ? (scene.fabricObject as fabric.Object[])
      : [];

    // build layers array
    const layers: SceneLayer[] = [];
    const mainBg = scene.properties.mainBackground;
    if (mainBg) {
      layers.push({
        id: mainBg.id,
        layerType: "mainBackground",
        timeFrame: { start: sceneStart, end: sceneEnd },
        name: mainBg.name,
        ...mainBg,
      } as SceneLayer);
    }
    (scene.properties.backgrounds || []).forEach((bg) =>
      layers.push({ ...bg, layerType: "background", timeFrame: { ...bg.timeFrame } })
    );
    (scene.properties.gifs || []).forEach((gf) =>
      layers.push({ ...gf, layerType: "svg", timeFrame: { ...gf.timeFrame } })
    );
    (scene.properties.animations || []).forEach((an) =>
      layers.push({ ...an, layerType: "animation", timeFrame: { ...an.timeFrame } })
    );
    (scene.properties.elements || []).forEach((el) =>
      layers.push({ ...el, layerType: "element", timeFrame: { ...el.timeFrame } })
    );
    if (Array.isArray(scene.properties.text)) {
      scene.properties.text.forEach((tx) =>
        layers.push({ ...tx, layerType: "text", timeFrame: { ...tx.timeFrame } })
      );
    }

    // offsets state
    const [offs, setOffs] = useState(
      layers.map((l) => l.timeFrame.start - sceneStart)
    );

    // onLayerChange: mainBackground adjusts scene timeframe, others adjust layer
    const onLayerChange = (
      i: number,
      raw: number,
      isEnd: boolean
    ) => {
      const l = layers[i];
      if (l.layerType === "mainBackground") {
        // update scene timeframe only
        const newEnd = Math.min(
          Math.max(sceneStart, sceneStart + raw),
          store.maxTime
        );
        store.updateSceneAndShiftFollowing(idx, newEnd - sceneStart);
      } else {
        // update individual layer
        const old = l.timeFrame;
        const abs = Math.min(
          Math.max(sceneStart, sceneStart + raw),
          sceneEnd
        );
        const newTf: TimeFrame = isEnd
          ? { start: old.start, end: abs }
          : { start: abs, end: old.end };
        setOffs((a) =>
          a.map((v, j) => (j === i ? newTf.start - sceneStart : v))
        );
        store.updateSceneLayerTimeFrame(idx, l.id, newTf);
      }
    };

    return (
      <div className="space-y-2">
        {layers.map((layer, i) => {
          const tf = layer.timeFrame;
          const left = ((tf.start - sceneStart) / sceneDuration) * 100;
          const width = ((tf.end - tf.start) / sceneDuration) * 100;
          const right = left + width;
          const sel = store.selectedElement?.id === layer.id;

          return (
            <div
              key={`${layer.layerType}-${layer.id}`}
              className="relative w-full h-[25px] my-1 flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                store.setActiveScene(idx);
                setCurrentSceneIndex?.(idx);
                handleSceneClick?.(idx);
                if (layer.layerType === "element") {
                  const el = store.editorElements.find(
                    (x) => x.id === layer.id
                  );
                  if (el) {
                    store.setSelectedElement(el);
                    const obj = Array.isArray(el.fabricObject)
                      ? el.fabricObject[0]
                      : el.fabricObject;
                    obj && store.canvas?.setActiveObject(obj);
                  }
                } else {
                  store.setSelectedElement(scene);
                  fabricObjs[i] && store.canvas?.setActiveObject(fabricObjs[i]);
                }
                store.canvas?.requestRenderAll();
              }}
            >
              {/* left handle */}
              <DragableView
                className="z-10 cursor-ew-resize absolute h-full"
                value={tf.start - sceneStart}
                total={layer.layerType === "mainBackground" ? store.maxTime : sceneDuration}
                onChange={(v) => onLayerChange(i, v, false)}
                style={{ left: `${left}%`, width: "10px" }}
              >
                <div className="bg-white border-2 border-blue-400 w-full h-full" />
              </DragableView>

              {/* bar */}
              <DragableView
                className="cursor-grab absolute h-full"
                value={tf.start - sceneStart}
                total={layer.layerType === "mainBackground" ? store.maxTime : sceneDuration}
                onChange={(v) => onLayerChange(i, v, false)}
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <div
                  className={`h-full text-white text-xs px-2 leading-[25px] truncate ${
                    sel ? "ring-2 ring-white" : ""
                  } ${
                    layer.layerType === "mainBackground"
                      ? "bg-blue-700"
                      : layer.layerType === "background"
                      ? "bg-green-600"
                      : layer.layerType === "svg"
                      ? "bg-purple-600"
                      : layer.layerType === "animation"
                      ? "bg-yellow-600"
                      : "bg-gray-600"
                  }`}
                >
                  <strong>
                    {layer.layerType === "mainBackground"
                      ? "MAIN BG"
                      : layer.layerType.toUpperCase()}
                  </strong>{" "}
                  {layer.name || layer.id}
                </div>
              </DragableView>

              {/* right handle */}
              <DragableView
                className="z-10 cursor-ew-resize absolute h-full"
                value={tf.end - sceneStart}
                total={layer.layerType === "mainBackground" ? store.maxTime : sceneDuration}
                onChange={(v) => onLayerChange(i, v, true)}
                style={{ left: `${right}%`, width: "10px" }}
              >
                <div className="bg-white border-2 border-blue-400 w-full h-full" />
              </DragableView>
            </div>
          );
        })}
      </div>
    );
  }

  // NON-SCENE
  const selElem = store.selectedElement?.id === element.id;
  const { start, end } = element.timeFrame;
  const dur = end - start;
  const lPct = (start / store.maxTime) * 100;
  const wPct = (dur / store.maxTime) * 100;

  return (
    <div
      className="relative w-full h-[25px] my-2"
      onClick={() => store.setSelectedElement(element)}
    >
      {/* start handle */}
      <DragableView
        className="z-10 cursor-ew-resize absolute h-full"
        value={start}
        total={store.maxTime}
        onChange={(v) =>
          store.updateEditorElementTimeFrame(element, { start: v })
        }
        style={{ left: `${lPct}%`, width: "10px" }}
      >
        <div className="bg-white border-2 border-blue-400 w-full h-full" />
      </DragableView>

      {/* bar */}
      <DragableView
        className="absolute h-full cursor-col-resize"
        value={start}
        total={store.maxTime}
        onChange={(v) =>
          store.updateEditorElementTimeFrame(element, { start: v, end: v + dur })
        }
        style={{ left: `${lPct}%`, width: `${wPct}%` }}
      >
        <div
          className={`h-full w-full text-white text-xs px-2 leading-[25px] ${
            selElem ? "bg-blue-600" : "bg-gray-600"
          }`}
        >
          {element.name}
          <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
            <button
              className="text-white hover:text-gray-200"
              onClick={(e) => {
                e.stopPropagation();
                setIsShow(!isShow);
              }}
            >
              <FaEllipsisV size={12} />
            </button>
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
        </div>
      </DragableView>

      {/* end handle */}
      <DragableView
        className="z-10 cursor-ew-resize absolute h-full"
        value={end}
        total={store.maxTime}
        onChange={(v) => store.updateEditorElementTimeFrame(element, { end: v })}
        style={{ left: `${(end / store.maxTime) * 100}%`, width: "10px" }}
      >
        <div className="bg-white border-2 border-blue-400 w-full h-full" />
      </DragableView>
    </div>
  );
});
