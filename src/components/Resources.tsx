"use client";
import React from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { ExportVideoPanel } from "./panels/ExportVideoPanel";
 import { AudioResourcesPanel } from "./panels/AudioResourcesPanel";
import { FillPanel } from "./panels/FillPanel";
import { ImageResourcesPanel } from "./panels/ImageResourcesPanel";
import { TextResourcesPanel } from "./panels/TextResourcesPanel";
import { VideoResourcesPanel } from "./panels/VideoResourcesPanel";
 import { SvgResourcesPanel } from "./panels/SvgResourcesPanel";

export const Resources = observer(() => {
  const store = React.useContext(StoreContext);
  const selectedMenuOption = store.selectedMenuOption;
  return (
    <div className="bg-[#20272D] h-full">
      {selectedMenuOption === "Video" ? <VideoResourcesPanel /> : null}
      {selectedMenuOption === "Audio" ? <AudioResourcesPanel /> : null}
      {selectedMenuOption === "Image" ? <ImageResourcesPanel /> : null}
      {selectedMenuOption === "Text" ? <TextResourcesPanel /> : null}
       {selectedMenuOption === "Export" ? <ExportVideoPanel /> : null}
      {selectedMenuOption === "Fill" ? <FillPanel /> : null}
      {selectedMenuOption === "SVG" ? <SvgResourcesPanel /> : null}
    </div>
  );
});
