'use client';

import React, { useState, useRef } from 'react';
import { Mic } from 'lucide-react';
import { FaMinus, FaPlus, FaTimes } from 'react-icons/fa';
import { API_URL } from '@/utils/constants';
import '@/app/style/storyline.css';

// Callback type: passes back validated sentences
type PayloadCallback = (sentences: string[]) => void;

// Props for the popup
interface CreateStorylinePopupProps {
  onClose: () => void;
  onSubmit: PayloadCallback;
}

// Fields of the form
interface FormState {
  title: string;
  challenge: string;
  turningPoint: string;
  introMain: string;
  introSupp1: string;
  cta: string;
}

export const CreateStorylinePopup: React.FC<CreateStorylinePopupProps> = ({ onClose, onSubmit }) => {
  const [step, setStep] = useState<number>(0);
  const [open, setOpen] = useState<Record<keyof FormState, boolean>>({
    title: false,
    challenge: false,
    turningPoint: false,
    introMain: false,
    introSupp1: false,
    cta: false,
  });

  const [form, setForm] = useState<FormState>({
    title: '',
    challenge: '',
    turningPoint: '',
    introMain: '',
    introSupp1: '',
    cta: ''
  });

  // Suggestions per field if keywords invalid
  const [suggestions, setSuggestions] = useState<Partial<Record<keyof FormState, string>>>({});

  const recognitionRefs = useRef<Partial<Record<keyof FormState, any>>>({});
  const [listeningField, setListeningField] = useState<keyof FormState | null>(null);

  // Single-field toggle: only one can be open
  const toggle = (field: keyof FormState) => {
    setOpen(prev => {
      const state: Record<keyof FormState, boolean> = {
        title: false,
        challenge: false,
        turningPoint: false,
        introMain: false,
        introSupp1: false,
        cta: false,
      };
      state[field] = !prev[field];
      return state;
    });
  };

  // Handle text inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name as keyof FormState]: value }));
  };

  // Speech recognition for each field
  const startRecognition = (field: keyof FormState) => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech Recognition not supported');
      return;
    }
    const recog = new SpeechRec();
    recognitionRefs.current[field] = recog;
    recog.lang = 'en-US'; recog.interimResults = false; recog.maxAlternatives = 1;
    recog.onstart = () => setListeningField(field);
    recog.onresult = (ev: any) => {
      const t = ev.results[0][0].transcript;
      setForm(prev => ({ ...prev, [field]: t }));
    };
    recog.onerror = () => setListeningField(null);
    recog.onend = () => setListeningField(null);
    recog.start();
    setTimeout(() => recog.stop(), 5000);
  };

  // Can proceed if at least one field has text
  const canProceed = Object.values(form).some(v => v.trim() !== '');

  // Advance from step0 to step1 after validating keywords
  const handleNext = async () => {
    if (!canProceed) {
      alert('Please fill at least one field to proceed.');
      return;
    }
    // Prepare only non-empty fields in order
    const fieldKeys = (Object.keys(form) as (keyof FormState)[])
      .filter(k => form[k].trim() !== '');
    const texts = fieldKeys.map(k => form[k]);

    // Call backend search to check for invalid keywords
    const res = await fetch(`${API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });
    if (!res.ok) {
      console.error('Validation request failed:', res.statusText);
      return;
    }
    const data = await res.json();
    if (data.suggestions) {
    
      const newSug: Partial<Record<keyof FormState, string>> = {};
      Object.entries(data.suggestions).forEach(([idx, obj]) => {
        const i = Number(idx);
        const field = fieldKeys[i];
        newSug[field] = obj.suggestion;
      });
      setSuggestions(newSug);
      return;  
    }

   
    setSuggestions({});
    setStep(1);
  };

  const handlePrev = () => setStep(0);

 
  const handleSubmit = () => {
    const sentences = (Object.keys(form) as (keyof FormState)[])
      .map(k => form[k])
      .filter(s => s.trim() !== '');
    onSubmit(sentences);
  };

 
  const renderField = (
    field: keyof FormState,
    placeholder: string,
    multiline = false,
    rows = 2
  ) => (
    <div className="relative mb-4" key={field}>
      {multiline ? (
        <textarea
          name={field}
          rows={rows}
          placeholder={listeningField===field?'Listening…':placeholder}
          value={form[field]}
          onChange={handleChange}
          className="storyline-form-input"
        />
      ) : (
        <>
          <input
            name={field}
            type="text"
            placeholder={listeningField===field?'Listening…':placeholder}
            value={form[field]}
            onChange={handleChange}
            className="storyline-form-input"
          />
          
          {suggestions[field] && (
            <div className="mt-1 text-sm text-yellow-700 random_suggession">
              {suggestions[field]}
            </div>
          )}
        </>
      )}
      <button
        type="button"
        onClick={() => startRecognition(field)}
        className="absolute right-2 top-2"
      >
        <Mic size={20} className={listeningField===field?'animate-pulse':''} />
      </button>
    </div>
  );

  return (
    <div className="popup-overlay">
      <div className="popup-container">
        <div className="popup-header">
          <h3 className="popup-title">Create Storyline</h3>
          <button onClick={onClose} className="popup-close-button">
            <FaTimes />
          </button>
        </div>

        {step===0 && (
          <>
            <div className="popup-fields">
              {(Object.keys(form) as (keyof FormState)[]).map(field => (
                <div key={field} className="popup-field">
                  <button
                    onClick={()=>toggle(field)}
                    className="field-toggle-button flex items-center gap-2 relative"
                  >
                    <div className={`status-dot ${form[field].trim() ? 'filled':''}`} />
                    <span className="field-title">
                      {field==='introSupp1'? 'Intro (Supplementary 1)': field.charAt(0).toUpperCase()+field.slice(1)}
                    </span>
                    <span className="ml-auto field-toggle-icon">
                      {open[field]?<FaMinus/>:<FaPlus/>}
                    </span>
                  </button>
                  {open[field] && renderField(field, getPlaceholder(field), field==='introMain', 3)}
                </div>
              ))}
            </div>
            <div className="popup-footer">
              <button
                onClick={handleNext}
                disabled={!canProceed}
                className="buttons"
              >
                Next
              </button>
            </div>
          </>
        )}

        {step===1 && (
          <div className="popup-confirmation">
            <p className="confirmation-text">Are you ready to generate scene?</p>
            <div className="confirmation-buttons">
              <button onClick={handlePrev} className="buttons">
                Prev
              </button>
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

 
const getPlaceholder = (field: keyof FormState): string => {
  switch(field) {
    case 'title': return 'Describe your product or service in one sentence';
    case 'challenge': return 'Describe the main pain points your prospect is experiencing';
    case 'turningPoint': return 'Summarize the pain points and your solution';
    case 'introMain': return 'Describe the main service or feature you offer...';
    case 'introSupp1': return 'Connect you with your customers the way you never did before.';
    case 'cta': return 'Make a call-to-action telling potential clients exactly what to do next';
    default: return '';
  }
};
