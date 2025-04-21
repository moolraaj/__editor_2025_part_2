"use client";

import React, { useState } from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { MdClose } from "react-icons/md";
import { ALL_FONTS } from "@/utils/constants";

const FONT_FAMILIES=ALL_FONTS

const FONT_SIZES: number[] = Array.from({ length: 200 }, (_, i) => i + 1);  

export const TextEditorPanel: React.FC = observer(() => {
    const store = React.useContext(StoreContext);
    const [color, setColor] = useState<string>("#ffffff");
    const [isVisible, setIsVisible] = useState<boolean>(true);  

    if (!store.selectedElement || store.selectedElement.type !== "text" || !isVisible) {
        return <></>;
    }

    return (
        <div className="text-editor-panel">
        
            <button onClick={() => setIsVisible(false)} className="close-button">
                <MdClose size={18} />
            </button>

        
        

            
            <div className="text-color-panel text-holder">
                <div className="text_left">

                <label>Text Color</label>
                <input
                    type="color"
                    value={color}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setColor(e.target.value);
                        store.setTextColor(e.target.value);
                    }}
                    className="color-input"
                />
                </div>

                <div className="text-right">
                 
                <button
                    className={`text-style-button ${store.selectedElement.properties.fontWeight === "bold" ? "active" : ""}`}
                    onClick={() => store.toggleBold()}
                >
                    B
                </button>
                <button
                    className={`text-style-button italic ${store.selectedElement.properties.fontStyle === "italic" ? "active" : ""}`}
                    onClick={() => store.toggleItalic()}
                >
                    I
                </button>
             
                </div>
            </div>

 
            <div className="font-size-wrapper text-holder">
                <label>Font Size</label>
                <select
                    value={store.selectedElement.properties.fontSize}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        store.setFontSize(Number(e.target.value))
                    }
                    className="font-size-dropdown text-holder"
                >
                    {FONT_SIZES.map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </select>
            </div>

            
           

            
            <div className="font-family-wrapper text-holder">
                <label>Font Family</label>
                <select
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => store.setFontFamily(e.target.value)}
                    className="font-family-dropdown"
                >
                    {FONT_FAMILIES.map((font) => (
                        <option key={font} value={font} style={{ fontFamily: font }}>
                            {font}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
});
