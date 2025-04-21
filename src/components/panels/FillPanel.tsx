"use client";
import React from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { BlockPicker } from "react-color";
import { canvasBackgroundColor } from "@/utils/constants";



export const FillPanel = observer(() => {
  const store = React.useContext(StoreContext);
 
  return (
    <>
      <div className="text-sm px-[16px] pt-[16px] pb-[8px] font-semibold">
        Background Colour
      </div>
      <div className="flex items-center justify-center">
        <BlockPicker
          colors={canvasBackgroundColor}
          color={store.backgroundColor}
          onChangeComplete={(color: any) => {
            console.log(color);
            store.setBackgroundColor(color.hex);
          }}
        ></BlockPicker>
      </div>
    </>
  );
});
