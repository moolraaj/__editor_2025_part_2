"use client";

import React, { useContext, useState } from "react";
import { observer } from "mobx-react-lite";
import { StoreContext } from "@/store";
import { CreateStorylinePopup } from "../entity/StoryLineresource";
import StoryLineResults from "../storyline/StoryLineresults";
import { API_URL } from "@/utils/constants";

type SearchResponse = {
  results: any[];
  suggestions?: Record<number, { suggestion: string; assets: any }>;
};

const StoryLinePanel: React.FC = observer(() => {
  const store = useContext(StoreContext);
  const hasScenes = store.scenes.length > 0;

  const [showResultPopup, setShowResultPopup] = useState(false);
  const [payloads, setPayloads] = useState<any[]>([]);
  const [lastSentences, setLastSentences] = useState<string[]>([]);

  const handleSubmit = async (sentences: string[]) => {
    if (!sentences.length) return;
    setLastSentences(sentences);

    const res = await fetch(`${API_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: sentences }),
    });
    if (!res.ok) {
      console.error("Search request failed:", res.statusText);
      return;
    }
    const data: SearchResponse = await res.json();
    if (data.suggestions) {
      const lines = Object.entries(data.suggestions).map(
        ([idx, { suggestion }]) =>
          `• Input #${Number(idx) + 1}: ${suggestion}`
      );
      alert(
        `Some inputs didn’t match any assets.\n\nPlease try again with better keywords:\n\n${lines.join(
          "\n"
        )}`
      );
      return;
    }
    setPayloads(data.results);
    setShowResultPopup(true);
    store.setShowStorylinePopup(false);
  };

  return (
    <div>
       
      <div className={`text-sm px-4 text-white pt-4 pb-2 font-semibold ${hasScenes?'opacity-50':''} ` }>
        Storyline
      </div>

      
      <button
        onClick={() => store.createStoryline()}
        disabled={hasScenes}
        className={`
          bg-gray-300 text-gray-800 font-bold mx-2 py-2 px-4 rounded
          ${hasScenes
            ? "opacity-50 cursor-not-allowed"
            : ""}
        `}
      >
        Create Storyline
      </button>

      {store.showStorylinePopup && (
        <CreateStorylinePopup
          onClose={() => store.setShowStorylinePopup(false)}
          onSubmit={handleSubmit}
        />
      )}

      <StoryLineResults
        showResultPopup={showResultPopup}
        payloads={payloads}
        sentences={lastSentences}
        setShowResultPopup={setShowResultPopup}
      />
    </div>
  );
});

export default StoryLinePanel;
