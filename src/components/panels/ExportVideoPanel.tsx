"use client";
import React from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { VIDEO_EXPORT_LENGTH } from "@/utils/constants";

export const ExportVideoPanel = observer(() => {
  const store = React.useContext(StoreContext);

  let seconds = store.maxTime / 1000 === 1 ? 'sec' : 'secs'
  let maxtime=store.maxTime / 1000
   

  return (
    <>
      <div className="text-sm px-[16px] pt-[16px] pb-[8px] font-semibold text-white">
        Export Activities
      </div>

      <div className="px-[16px]">
        <div className="flex flex-row items-center my-2 text-white section_bottom_margin">
          <div className="text-xs font-semibold mr-2">Video Length</div>
          <select
            className="text-black rounded text-center border-slate-200 placeholder-slate-400 contrast-more:border-slate-400 contrast-more:placeholder-slate-500 max-w-[80px] mr-2"
            value={maxtime}
            onChange={(e) => {
              const seconds = Number(e.target.value);
              store.setMaxTime(seconds * 1000);
            }}
          >
            {Array.from({ length: VIDEO_EXPORT_LENGTH }, (_, i) => i + 1).map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
          <div className="text-xs">
            {seconds}
          </div>
        </div>
      </div>





      <div className="px-[16px] text-white">
        <div className="text-xs font-semibold mr-2">Download Video Format</div>
        <div className="flex flex-row items-center my-2">
          <input
            type="radio"
            className="mr-2"
            name="video-format"
            value="mp4"
            checked={store.selectedVideoFormat === "mp4"}
            onChange={(e) => {
              store.setVideoFormat("mp4");
            }}
          />
          <div className="text-xs mr-2">mp4 format</div>
          <input
            type="radio"
            className="mr-2"
            name="video-format"
            value="gif"
            checked={store.selectedVideoFormat === "webm"}
            onChange={(e) => {
              store.setVideoFormat("webm");
            }}
          />
          <div className="text-xs mr-2">webm format</div>
        </div>
      </div>

      <button
        className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-1 rounded-lg m-4 export_button"
        onClick={() => {
          store.handleSeek(0);
          store.setSelectedElement(null);
          setTimeout(() => {
            store.setPlaying(true);
            store.saveCanvasToVideoWithAudio();
          }, 1000);
        }}
      >
        Download {store.selectedVideoFormat === "mp4" ? (`mp4 (${maxtime})  ${seconds}`) : (`webm (${maxtime}) ${seconds}`)}
      </button>
    </>
  );
});
