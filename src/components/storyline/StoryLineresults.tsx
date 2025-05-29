'use client';

import React, { useContext } from 'react';
import { FaTimes } from 'react-icons/fa';
import { API_URL } from '@/utils/constants';
import { StoreContext } from '@/store';

interface SvgAsset {
  tags: string[];
  svg_url: string;
}
interface BackgroundAsset {
  name: string;
  background_url: string;
}
interface AnimationAsset {
  name: string;
}
interface ScenePayload {
  svgs: SvgAsset[];
  backgrounds: BackgroundAsset[];
  animations: AnimationAsset[];
  text:string[]
}
interface StoryLineResultsProps {
  showResultPopup: boolean;
  payloads: ScenePayload[];
  sentences: string[];
  setShowResultPopup: (open: boolean) => void;
}
const StoryLineResults: React.FC<StoryLineResultsProps> = ({
  showResultPopup,
  payloads,
  sentences,
  setShowResultPopup,
}) => {
  const store = useContext(StoreContext);
  if (!showResultPopup) return null;
  const download = async (path: string, filename: string) => {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: sentences }),
      });
      if (!res.ok) {
        console.error(`Download failed: ${res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  };

 


  const handleAddToCanvas = () => {
    payloads.forEach((scenePayload) => {
      store.addSceneResource({
        backgrounds: scenePayload.backgrounds,
        gifs: scenePayload.svgs,
        animations: scenePayload.animations,
        elements: [],
        text: scenePayload.text
      });
    });
    store.refreshElements();
    setShowResultPopup(false);
  };
  return (
    <div className="popup_overlay">
      <div className="popup_content">
        <button
          className="popup_close"
          onClick={() => setShowResultPopup(false)}
        >
          <FaTimes />
        </button>
        <div className="st_line_wrap_outer">
          {payloads.map((payload, sceneIdx) => {
            const hasAny =
              payload.svgs.length > 0 ||
              payload.backgrounds.length > 0 ||
              payload.animations.length > 0;
            return (
              <div key={sceneIdx} className="st_wrapper_inner">
                <div className="heading">
                  <h3>Scene {sceneIdx + 1}</h3>
                </div>
                <div className="playloads">
                  {!hasAny ? (
                    <p className="text-sm text-gray-500">
                      No matching data found for this scene.
                    </p>
                  ) : (
                    <>
                      {payload.backgrounds.length > 0 && (
                        <div className="p_outer_wrapper">
                          {payload.backgrounds.slice(0, 1).map((bg, i) => (
                            <div key={i} className="p_inner_wrapper">
                              <img
                                src={bg.background_url}
                                alt={bg.name}
                                className="p_img"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                       {payload.svgs.length > 0 && (
                      <div className="char_type">
                        {payload.svgs.map((svg, i) => (
                          <div key={i} className="svg_type_img">
                            <img src={svg.svg_url} alt={svg.tags.join(', ')} />
                          </div>
                        ))}
                      </div>
                    )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="st_line_buttons_outer">
          <div className="st_line_buttons_inner space-x-2">
           
            <button
              className="buttons"
              onClick={() => download('/download-all-images', 'all_images.zip')}
            >
              Download All Images
            </button>
            <button className="buttons" onClick={handleAddToCanvas}>
              Add To Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryLineResults;
