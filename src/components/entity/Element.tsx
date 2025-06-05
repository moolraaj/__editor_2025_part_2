"use client";
import React from "react";
import { EditorElement } from "@/types";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { MdOutlineTextFields, MdMovie } from "react-icons/md";
import { AiOutlineFileImage } from "react-icons/ai";

export type ElementProps = {
  element: EditorElement;
};
export const Element = observer((props: ElementProps) => {
  const store = React.useContext(StoreContext);
  const { element } = props;

  const Icon =
    element.type === "video"
      ? MdMovie
      : element.type === "image"
      ? AiOutlineFileImage
      : MdOutlineTextFields;

  const isSelected = store.selectedElement?.id === element.id;
  const isActiveScene =
    element.type === "scene" &&
    (element as any).properties.sceneIndex === store.activeSceneIndex;

  const bgColor = isSelected ? "rgba(0, 160, 245, 0.1)" : "";
  const borderStyle = isActiveScene ? "2px solid red" : "none";

  // ← Only for scenes, get mainBackground instead of backgrounds[0]
  let bgImage: string | undefined = undefined;
  if (element.type === "scene" && element.properties.mainBackground) {
    bgImage = element.properties.mainBackground.background_url;
  }

  const handleElementClick = () => {
    store.setSelectedElement(element);
    if (element.type === "scene") {
      store.setActiveScene((element as any).properties.sceneIndex);
    }
  };

  if (element.type === "scene") {
    return (
      <div
        className="scene_outer_wrapper"
        id={`${isActiveScene ? "active_scene" : ""}`}
        key={element.id}
        onClick={handleElementClick}
      >
        {bgImage && (
          <img
            src={bgImage}
            alt="Scene background"
          />
        )}
        <div className="scene_wrapper">
          <div className="scene_name">
            <span className="ele_name">{element.name}</span>
          </div>
          <button
            className="scene_button"
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
      </div>
    );
  }

  // Non-scene elements remain unchanged
  return (
    <div
      style={{
        backgroundColor: bgColor,
        border: borderStyle,
        borderRadius: "4px",
      }}
      className="flex flex-col mx-2 my-1 py-2 px-1 justify-start items-start elements_holder"
      key={element.id}
      onClick={handleElementClick}
    >
      <div className="flex flex-row justify-between items-center w-full cursor-pointer">
        <div className="flex flex-row items-center">
          <Icon size="20" color="gray" />
          <div className="truncate text-xs ml-2 flex-1 font-medium">
            {element.name}
          </div>
        </div>

        {element.type === "video" ? (
          <video
            className="opacity-0 max-w-[20px] max-h-[20px]"
            src={element.properties.src}
            onLoad={() => store.refreshElements()}
            onLoadedData={() => store.refreshElements()}
            height={20}
            width={20}
            id={element.properties.elementId}
          ></video>
        ) : element.type === "image" ? (
          <img
            className="opacity-0 max-w-[20px] max-h-[20px]"
            src={element.properties.src}
            onLoad={() => store.refreshElements()}
            onLoadedData={() => store.refreshElements()}
            height={20}
            width={20}
            id={element.properties.elementId}
          ></img>
        ) : null}

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
    </div>
  );
});
