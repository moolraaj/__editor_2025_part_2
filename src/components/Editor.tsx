"use client";

import { fabric } from "fabric";
import React, { useContext, useEffect, useRef, useState } from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { Resources } from "./Resources";
import { ElementsPanel } from "./panels/ElementsPanel";
import { Menu } from "./Menu";
import { TimeLine } from "./TimeLine";
import { Store } from "@/store/Store";
import "@/utils/fabric-utils";
 

export const EditorWithStore = () => {
  const [store] = useState(new Store());
  return (
    <StoreContext.Provider value={store}>
      <Editor></Editor>
    </StoreContext.Provider>
  );
}

export const Editor = observer(() => {
  const store = useContext(StoreContext);
  const canvasRef = useRef<fabric.Canvas | null>(null);

  useEffect(() => {
    if (!store.canvas) {
      const canvas = new fabric.Canvas("canvas", {
        height: 500,
        width: 800,
        backgroundColor: "#ededed",
        selection: true, 
      });

      fabric.Object.prototype.transparentCorners = false;
      fabric.Object.prototype.cornerColor = "#00a0f5";
      fabric.Object.prototype.cornerStyle = "circle";
      fabric.Object.prototype.cornerStrokeColor = "#0063d8";
      fabric.Object.prototype.cornerSize = 10;
      fabric.Object.prototype.lockScalingFlip = true;
      fabric.Object.prototype.borderColor = "#ff0000";  
      fabric.Object.prototype.cornerSize = 10;
      
      store.setCanvas(canvas);
      canvasRef.current = canvas;

     
      

    
      canvas.on("mouse:down", function (e) {
        if (!e.target) {
          store.setSelectedElement(null);
        }
      });
      store.canvas = canvas;
      fabric.util.requestAnimFrame(function render() {
        canvas.renderAll();
        fabric.util.requestAnimFrame(render);
      });
    }
  }, []);
  return (
    <div className="grid grid-rows-[500px_1fr_20px] grid-cols-[72px_300px_1fr_250px] h-[100svh]">

      <div className="tile row-span-2 flex flex-col">
        <Menu />
      </div>
      <div className="row-span-2 flex flex-col overflow-scroll border-r-2 border-gray-500">
        <Resources />
      </div>
      <div id="grid-canvas-container" className="col-start-3 bg-[#20272D] flex justify-center items-center">
        <canvas id="canvas" className="h-[500px] w-[800px] row" />
      </div>
      <div className="col-start-4 row-start-1 border-l-2 border-gray-500">
      
        <ElementsPanel />
      </div>
      <div className="col-start-3 row-start-2 col-span-2 relative px-[10px] py-[4px] overflow-scroll bg-[#20272D] border-t-2 border-b-2  border-gray-500">
        <TimeLine />
      </div>
     
    </div>
  );
});
