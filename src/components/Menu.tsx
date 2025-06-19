"use client";
import React from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import {
  MdDownload,
  MdVideoLibrary,
  MdImage,
  MdAddCircleOutline,
  MdTitle,
  MdAudiotrack,
  MdOutlineFormatColorFill,
  MdUploadFile
} from "react-icons/md";
import { Store } from "@/store/Store";

export const Menu = observer(() => {
  const store = React.useContext(StoreContext);


  const hasGlobalElements = store.editorElements.some(
    (e) => e.type !== "scene"
  );

  return (
    <ul className="bg-[#0E0E0E] h-full">
      {MENU_OPTIONS.map((option) => {
        const isSelected = store.selectedMenuOption === option.name;

        const disableStoryline =
          option.name === "STORYLINE" && hasGlobalElements;

        return (
          <li
            key={option.name}
            className={`h-[72px] w-[72px] flex flex-col items-center justify-center ${isSelected ? "bg-[#20272D]" : ""
              }`}
          >
            <button
              onClick={() =>
                !disableStoryline && option.action(store)
              }
              disabled={disableStoryline}
              className={`
                flex flex-col items-center
                ${disableStoryline
                  ? "opacity-50 cursor-not-allowed"
                  : ""}
              `}
            >
              <option.icon size={20} color="#fff" />
              <div className="text-[0.6rem] text-white">
                {option.name}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
});

const MENU_OPTIONS = [
  { name: "Video", icon: MdVideoLibrary, action: (s: Store) => s.setSelectedMenuOption("Video") },
  { name: "Audio", icon: MdAudiotrack, action: (s: Store) => s.setSelectedMenuOption("Audio") },
  { name: "Image", icon: MdImage, action: (s: Store) => s.setSelectedMenuOption("Image") },
  { name: "Text", icon: MdTitle, action: (s: Store) => s.setSelectedMenuOption("Text") },
  { name: "Fill", icon: MdOutlineFormatColorFill, action: (s: Store) => s.setSelectedMenuOption("Fill") },
  { name: "SVG", icon: MdUploadFile, action: (s: Store) => s.setSelectedMenuOption("SVG") },
  { name: "STORYLINE", icon: MdAddCircleOutline, action: (s: Store) => s.setSelectedMenuOption("STORYLINE") },
  { name: "Export", icon: MdDownload, action: (s: Store) => s.setSelectedMenuOption("Export") },
];
