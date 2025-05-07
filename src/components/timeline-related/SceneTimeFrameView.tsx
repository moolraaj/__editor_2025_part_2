// SceneLayers.tsx
"use client";
import React from "react";
import type { fabric } from "fabric";
import type { EditorElement, SceneEditorElement } from "@/types";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";

interface SceneLayersProps {
  sceneElem: SceneEditorElement;
  sceneIndex: number;
  onLayerSelect?: (layer: fabric.Object) => void;
  onElementSelect?: (element: EditorElement) => void;
}

export const SceneLayers = observer(({
  sceneElem,
  sceneIndex,
  onLayerSelect,
  onElementSelect
}: SceneLayersProps) => {
  const store = React.useContext(StoreContext);
  const layers = Array.isArray(sceneElem.fabricObject)
    ? (sceneElem.fabricObject as fabric.Object[])
    : [];

  const handleLayerClick = (e: React.MouseEvent, layer: fabric.Object) => {
    e.stopPropagation();
    if (onLayerSelect) {
      onLayerSelect(layer);
    } else {
      // Default behavior if no handler provided
      if (store.activeSceneIndex !== sceneIndex) {
        store.setActiveScene(sceneIndex);
      }
      store.setSelectedElement(sceneElem);
      store.canvas?.setActiveObject(layer);
      store.canvas?.requestRenderAll();
    }
  };

  const handleElementClick = (e: React.MouseEvent, el: EditorElement) => {
    e.stopPropagation();
    if (onElementSelect) {
      onElementSelect(el);
    } else {
      if (store.activeSceneIndex !== sceneIndex) {
        store.setActiveScene(sceneIndex);
      }
      store.setSelectedElement(el);
      if (el.fabricObject) {
        store.canvas?.setActiveObject(
          Array.isArray(el.fabricObject) ? el.fabricObject[0] : el.fabricObject
        );
        store.canvas?.requestRenderAll();
      }
    }
  };

  return (
    <div className="space-y-4">
      {layers.length > 0 && (
        <div className="flex flex-col gap-1 mt-2">
          {layers.map((layer, i) => (
            <LayerItem 
              key={`layer-${i}`}
              name={layer.name || `Layer ${i + 1}`}
              type={layer.type}
              onClick={(e) => handleLayerClick(e, layer)}
            />
          ))}
        </div>
      )}

      {sceneElem.properties.elements?.length ? (
        <div className="flex flex-col gap-1 mt-2">
          {sceneElem.properties.elements.map((el, i) => (
            <LayerItem
              key={`element-${i}`}
              name={el.name || `${el.type}-${i + 1}`}
              type={el.type}
              onClick={(e) => handleElementClick(e, el)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
});

const LayerItem = ({
  name,
  type,
  onClick
}: {
  name: string;
  type: string;
  onClick: (e: React.MouseEvent) => void;
}) => (
  <div
    className="flex items-center px-2 py-1 bg-gray-700 rounded cursor-pointer hover:bg-gray-600 text-xs"
    onClick={onClick}
  >
    <span className="truncate flex-1 text-white">{name}</span>
    <span className="text-gray-400 text-xs ml-2">{type}</span>
  </div>
);