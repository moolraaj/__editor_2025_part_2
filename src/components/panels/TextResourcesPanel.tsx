"use client";
import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { TextResource } from "../entity/TextResource";
import { Store } from "@/store/Store";
import { StoreContext } from "@/store";
import { TextEditorPanel } from "./TextEditorPanel";

const TEXT_RESOURCES = [
  {
    name: "Title",
    fontSize: 28,
    fontWeight: 600,
  },
   
];

export const TextResourcePanleWithStore = () => {
  const [store] = useState(new Store());
  return (
    <StoreContext.Provider value={store}>
      <TextResourcesPanel></TextResourcesPanel>
    </StoreContext.Provider>
  );
}

export const TextResourcesPanel = observer(() => {
   const store = React.useContext(StoreContext);
  return (
    <div className="bg-[#20272D] h-full">
      <div className="text-sm px-[16px] pt-[16px] pb-[8px] font-semibold text-white">
        Text Panel
      </div>
      <ul>


        {TEXT_RESOURCES.map((resource) => {
          return (
            <li
              key={resource.name}
            >
              <TextResource
                sampleText={resource.name}
                fontSize={resource.fontSize}
                fontWeight={resource.fontWeight}
              />
            </li>
          );
        })}
      </ul>
        {store.selectedElement?.type === "text" ? <TextEditorPanel /> : ""}
      
    </div>
  );
});
