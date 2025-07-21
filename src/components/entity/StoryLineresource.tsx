import React, { useState, useRef } from 'react';
import { Mic } from 'lucide-react';
import { FaMinus, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import { API_URL } from '@/utils/constants';
import '@/app/style/storyline.css';

type PayloadCallback = (sentences: string[]) => void;

interface CreateStorylinePopupProps {
  onClose: () => void;
  onSubmit: PayloadCallback;
}

export const CreateStorylinePopup: React.FC<CreateStorylinePopupProps> = ({ onClose, onSubmit }) => {
  const [step, setStep] = useState<number>(0);
  const [storylines, setStorylines] = useState<string[]>(Array(6).fill(''));
  const [expanded, setExpanded] = useState<boolean[]>(Array(6).fill(false));
  const recognitionRefs = useRef<Record<number, any>>({});
  const [listeningIndex, setListeningIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setExpanded(prev => prev.map((_, idx) => idx === i ? !prev[idx] : false));
  };

  const handleChange = (i: number, value: string) => {
    setStorylines(prev => prev.map((v, idx) => (idx === i ? value : v)));
  };

  const startRecognition = (i: number) => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return alert('Speech Recognition not supported');
    const recog = new SpeechRec();
    recognitionRefs.current[i] = recog;
    recog.lang = 'en-US'; recog.interimResults = false; recog.maxAlternatives = 1;
    recog.onstart = () => setListeningIndex(i);
    recog.onresult = (ev: any) => handleChange(i, ev.results[0][0].transcript);
    recog.onerror = () => setListeningIndex(null);
    recog.onend = () => setListeningIndex(null);
    recog.start(); setTimeout(() => recog.stop(), 5000);
  };

  const canProceed = storylines.some(text => text.trim() !== '');

  const handleNext = async () => {
    if (!canProceed) return alert('Please fill at least one field to proceed.');
    const texts = storylines.filter(s => s.trim());
    const res = await fetch(`${API_URL}/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texts })
    });
    if (!res.ok) return console.error('Validation failed', res.statusText);
    const data = await res.json();
    if (data.suggestions) {
      // suggestions handling
      return;
    }
    setStep(1);
  };

  const handlePrev = () => setStep(0);
  const handleSubmit = () => onSubmit(storylines.filter(s => s.trim()));

  const addField = () => {
    if (storylines.length >= 10) return;
    setStorylines(prev => [...prev, '']);
    setExpanded(prev => [...prev, false]);
  };

  const removeField = (i: number) => {
    setStorylines(prev => prev.filter((_, idx) => idx !== i));
    setExpanded(prev => prev.filter((_, idx) => idx !== i));
  };

  return (
    <div className="popup-overlay">
      <div className="popup-container">
        <div className="popup-header">
          <h3 className="popup-title">Create Storyline</h3>
          <button onClick={onClose} className="popup-close-button">
            <FaTimes />
          </button>
        </div>

        {step === 0 && (
          <>
            <div className="popup-fields">
              {storylines.map((text, i) => (
                <div key={i} className="popup-field">
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    className="field-toggle-button flex items-center gap-2 relative"
                  >
                    <div className={`status-dot ${text.trim() ? 'filled' : ''}`} />
                    <span className="field-title">Storyline {i + 1}</span>
                    <span className="  field-toggle-icon">
                      {expanded[i] ? <FaMinus fontSize={20}/> : <FaPlus fontSize={20}/>}
                    </span>
                    <span onClick={() => removeField(i)}
                      className="">
                      <FaTrash />
                    </span>

                  </button>

                  {expanded[i] && (
                    <div className="relative mb-4">
                      <textarea
                        name={`storyline-${i}`}
                        rows={3}
                        placeholder="write and generate your own storyline"
                        value={text}
                        onChange={e => handleChange(i, e.target.value)}
                        className="storyline-form-input"
                      />
                      <button
                        type="button"
                        onClick={() => startRecognition(i)}
                        className="absolute right-12 top-2"
                      >
                        <Mic size={20} className={listeningIndex === i ? 'animate-pulse' : ''} />
                      </button>

                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="popup-footer">

              {storylines.length >= 10 ? <FaPlus onClick={addField} className='disable_button' fontSize={30}/> : <FaPlus onClick={addField} fontSize={30}/>}


              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed}
                className={`buttons ${!canProceed?'disabled_next':''}`}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <div className="popup-confirmation">
            <p className="confirmation-text">Are you ready to generate scene?</p>
            <div className="confirmation-buttons">
              <button onClick={handlePrev} className="buttons">Prev</button>
              <button onClick={handleSubmit} className="buttons">
                Generate Storyline
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
