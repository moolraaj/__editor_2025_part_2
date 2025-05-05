"use client";
import React from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { Element } from "../entity/Element";

export const ElementsPanel = observer((_props: {}) => {
  const store = React.useContext(StoreContext);
  
 
  const hasScenes = store.editorElements.some(el => el.type === "scene");

  return (
    <div className="bg-[#20272D] h-full overflow-scroll text-white">
      <div className="flex flex-row justify-between">
        <div className="text-sm px-[16px] py-[7px] font-semibold">
          {hasScenes ? "Scenes" : "Elements"}
        </div>
      </div>
      <div className={`${hasScenes?'scenes_contrainer':'flex flex-col'}`}>
        {store.editorElements.map((element) => (
          <Element key={element.id} element={element} />
        ))}
      </div>
    </div>
  );
});