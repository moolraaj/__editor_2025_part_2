import React, { useContext } from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { TimeFrameView } from "./timeline-related/TimeFrameView";
import { SeekPlayer } from "./timeline-related/SeekPlayer";

export const TimeLine = observer(() => {
  const store = useContext(StoreContext);
  const percentOfCurrentTime = (store.currentTimeInMs / store.maxTime) * 100;
  return (
    <div className="flex flex-col">
      <SeekPlayer />
      <div
        className="flex-1 relative"
      
        onDragOver={(e) => e.preventDefault()}   
      >
         {store.editorElements.map((element) => {
          return <TimeFrameView key={element.id} element={element} />;
        })}
        <div
          className="w-[2px] bg-[#f87171] absolute top-0 bottom-0 z-20 left-10"
          style={{ left: `${percentOfCurrentTime}%` }}
        ></div>
      </div>
    </div>
  );
});


