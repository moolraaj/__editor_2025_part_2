"use client";
import React, { useState } from "react";
import { EditorElement } from "@/types";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { MdOutlineTextFields, MdMovie, MdExpandMore } from "react-icons/md";
import { AiOutlineFileImage } from "react-icons/ai";
import { fabric } from "fabric";

export type ElementProps = {
  element: EditorElement;
};


function getNestedLayers(obj: fabric.Object): fabric.Object[] {
  let result: fabric.Object[] = [];
  if (obj.type === "group") {
    const group = obj as fabric.Group;
    group.getObjects().forEach(child => {
      result.push(child);
      result = result.concat(getNestedLayers(child));
    });
  }
  return result;
}

export const Element = observer((props: ElementProps) => {
  const store = React.useContext(StoreContext);
  const { element } = props;
  const [isExpanded, setIsExpanded] = useState(false);

  const Icon =
    element.type === "video"
      ? MdMovie
      : element.type === "image"
        ? AiOutlineFileImage
        : MdOutlineTextFields;

  const isSelected = store.selectedElement?.id === element.id;
  const bgColor = isSelected ? "rgba(0, 160, 245, 0.1)" : "";
  let nestedLayers: fabric.Object[] = [];
  if (
    element.type === "svg" &&
    isExpanded &&
    element.fabricObject instanceof fabric.Group
  ) {
    nestedLayers = getNestedLayers(element.fabricObject);
  }

  return (
    <div
      style={{ backgroundColor: bgColor }}
      className={`flex flex-col mx-2 my-1 py-2 px-1 justify-start items-start ${bgColor} elements_holder`}
      key={element.id}
    >
      <div
        className="flex flex-row justify-between items-center w-full cursor-pointer"
        onClick={() => store.setSelectedElement(element)}
      >
        <div className="flex flex-row items-center">
          <Icon size="20" color="gray" />
          <div className="truncate text-xs ml-2 flex-1 font-medium">
            {element.name}
          </div>
        </div>

        <div>
          {element.type === "video" ? (
            <video
              className="opacity-0 max-w-[20px] max-h-[20px]"
              src={element.properties.src}
              onLoad={() => {
                store.refreshElements();
              }}
              onLoadedData={() => {
                store.refreshElements();
              }}
              height={20}
              width={20}
              id={element.properties.elementId}
            ></video>
          ) : null}
          {element.type === "image" ? (
            <img
              className="opacity-0 max-w-[20px] max-h-[20px]"
              src={element.properties.src}
              onLoad={() => {
                store.refreshElements();
              }}
              onLoadedData={() => {
                store.refreshElements();
              }}
              height={20}
              width={20}
              id={element.properties.elementId}
            ></img>
          ) : null}
          {element.type === "audio" ? (
            <audio
              className="opacity-0 max-w-[20px] max-h-[20px]"
              src={element.properties.src}
              onLoad={() => {
                store.refreshElements();
              }}
              onLoadedData={() => {
                store.refreshElements();
              }}
              id={element.properties.elementId}
            ></audio>
          ) : null}
        </div>

        {element.type === "svg" && (
          <button
            className="ml-2"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <MdExpandMore
              className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
              size="18"
              color="white"
            />
          </button>
        )}

        <button
          className="bg-red-500 hover:bg-red-700 text-white mr-2 text-xs py-0 px-1 rounded"
          onClick={(e) => {
            store.removeEditorElement(element.id);
            store.refreshElements();
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          X
        </button>
      </div>

    
      {element.type === "svg" && isExpanded && element.fabricObject instanceof fabric.Group && (
        <div className="ml-6 mt-2 flex flex-col gap-1">
          {nestedLayers.map((layer, index) => (
            <div
              key={index}
              className="flex items-center px-2 py-1 bg-gray-700 rounded text-xs cursor-pointer hover:bg-gray-600"
              onClick={() => {
              
                store.setSelectedElement({
                  ...element,
                  fabricObject: layer,
                });
              }}
            >
              <span className="truncate flex-1">
                {layer.name || `Layer ${index + 1}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
