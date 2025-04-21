"use client";
import React from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import {
  MdDownload,
  MdVideoLibrary,
  MdImage,
  
  MdTitle,
  MdAudiotrack,
  MdOutlineFormatColorFill,
 
  MdUploadFile
} from "react-icons/md";
import { Store } from "@/store/Store";

export const Menu = observer(() => {
  const store = React.useContext(StoreContext);

  return (
    <ul className="bg-[#0E0E0E] h-full">
      {MENU_OPTIONS.map((option) => {
        const isSelected = store.selectedMenuOption === option.name;
        return (
          <li
            key={option.name}
            className={`h-[72px] w-[72px] flex flex-col items-center justify-center ${isSelected ? "bg-[#20272D]" : ""}`}
          >
            <button
              onClick={() => option.action(store)}
              className={`flex flex-col items-center`}
            >
              <option.icon
                size="20"
                color={
                  isSelected ? "#fff" : "#fff"
                }
              />
              <div
                className={`text-[0.6rem] hover:text-white ${isSelected ? "text-white" : "text-white"}`}
              >
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
  {
    name: "Video",
    icon: MdVideoLibrary,
    action: (store: Store) => {
      store.setSelectedMenuOption("Video");
    },
  },
  {
    name: "Audio",
    icon: MdAudiotrack,
    action: (store: Store) => {
      store.setSelectedMenuOption("Audio");
    },
  },
  {
    name: "Image",
    icon: MdImage,
    action: (store: Store) => {
      store.setSelectedMenuOption("Image");
    },
  },
  {
    name: "Text",
    icon: MdTitle,
    action: (store: Store) => {
      store.setSelectedMenuOption("Text");
    },
  },

  {
    name: "Fill",
    icon: MdOutlineFormatColorFill,
    action: (store: Store) => {
      store.setSelectedMenuOption("Fill");
    },
  },
  {
    name: "SVG",
    icon: MdUploadFile,
    action: (store: Store) => {
      store.setSelectedMenuOption("SVG"); 
    },
  },
  {
    name: "Export",
    icon: MdDownload,
    action: (store: Store) => {
      store.setSelectedMenuOption("Export");
    },
  },
];
