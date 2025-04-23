// src/components/StoryLineresults.tsx
'use client';

import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { API_URL } from '@/utils/constants';
import { StoryLinePayload } from '@/types';

interface StoryLineResultsProps {
  showResultPopup: boolean;
  payloads: StoryLinePayload[];
  sentences: string[];
  setShowResultPopup: (open: boolean) => void;
}

const StoryLineResults: React.FC<StoryLineResultsProps> = ({
  showResultPopup,
  payloads,
  sentences,
  setShowResultPopup,
}) => {
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
          {payloads.map((payload, idx) => (
            <div key={idx} className="st_wrapper_inner">
              <h3>
                {payload.is_default ? 'Default Scene' : 'Scene'} {idx + 1}
              </h3>
              {payload.gifs.length > 0 && (
                <div className="char_type">
                  {payload.gifs.map((gif) => (
                    <div key={gif.id} className="svg_type_img">
                      <img src={gif.gif_url} alt={gif.tags[0] || 'gif'} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="st_line_buttons_outer">
          <div className="st_line_buttons_inner">
            <button
              className="buttons"
              onClick={() =>
                download('/download-scenes-pdf', 'scenes.pdf')
              }
            >
              Download as PDF
            </button>
            <button
              className="buttons"
              onClick={() =>
                download('/download-all-images', 'all_images.zip')
              }
            >
              Download All Images
            </button>
            <button
              className="buttons"
              onClick={() => {
               
              }}
            >
              Add To Canvas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryLineResults;
