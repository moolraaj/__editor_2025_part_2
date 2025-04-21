"use client";
import React from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { UploadButton } from "../shared/UploadButton";
import { SvgResource } from "../entity/SvgResource";

export const SvgResourcesPanel = observer(() => {
    const store = React.useContext(StoreContext);

  
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type !== "image/svg+xml") {
            alert("Only SVG files are allowed!");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                store.addSvgResource(e.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <>
            <div className="text-sm px-[16px] pt-[16px] pb-[8px] font-semibold">
                SVG Files
            </div>
            <UploadButton
                accept="image/svg+xml"
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold text-center mx-2 py-2 px-4 rounded cursor-pointer"
                onChange={handleFileChange}
            />
            <div>
                {store.svgs.map((svg, index) => {
                    return <SvgResource key={index} svg={svg} index={index} />;
                })}

            </div>
        </>
    );
});
