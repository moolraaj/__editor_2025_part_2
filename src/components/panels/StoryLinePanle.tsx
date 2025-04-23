'use client';

import React, { useContext, useState } from "react";
import { StoreContext } from "@/store";
import { observer } from "mobx-react-lite";
import { CreateStorylinePopup } from "../entity/StoryLineresource";
import StoryLineresults from "../storyline/StoryLineresults";
import { API_URL } from "@/utils/constants";



const StoryLinePanel = observer(() => {

    

 
  const store = useContext(StoreContext);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [payloads, setPayloads] = useState<any[]>([]);

  const speakText = async (text: string) => {
    try {
      const res = await fetch(`${API_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        console.error("TTS request failed:", res.statusText);
        return;
      }
      const blob = await res.blob();
     
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play();
    } catch (err) {
      console.error("Error playing TTS:", err);
    }
  };

  const handleSubmit = async (sentences: string[]) => {
    const fullText = sentences.join(". ");
    await speakText(fullText);

    try {
      const res = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: sentences }),
      });
      if (!res.ok) {
        console.error("Search request failed:", res.statusText);
        return;
      }
      const data = await res.json();
      setPayloads(data);
      setShowResultPopup(true);
    } catch (error) {
      console.error("Error generating storyline:", error);
    } finally {
      store.setShowStorylinePopup(false);
    }
  };

  return (
    <>
      <div className="text-sm px-[16px] text-white pt-[16px] pb-[8px] font-semibold">
        Storyline
      </div>
      <button
        onClick={() => store.createStoryline()}
        className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold text-center mx-2 py-2 px-4 rounded cursor-pointer "
      >
        Create Storyline
      </button>

      {store.showStorylinePopup && (
        <CreateStorylinePopup
          onClose={() => store.setShowStorylinePopup(false)}
          onSubmit={handleSubmit}
        />
      )}

      <StoryLineresults
        showResultPopup={showResultPopup}
        payloads={payloads}
        setShowResultPopup={setShowResultPopup}
      />
    </>
  );
});

export default StoryLinePanel;
