'use client'

import React, { useState, useRef } from 'react';
import { Mic } from 'lucide-react';

type PayloadCallback = (sentences: string[]) => void;

interface CreateStorylinePopupProps {
  onClose: () => void;
  onSubmit: PayloadCallback;
}

interface FormState {
  title: string;
  challenge: string;
  turningPoint: string;
  introMain: string;
  introSupp1: string;
  cta: string;
}

export const CreateStorylinePopup: React.FC<CreateStorylinePopupProps> = ({
  onClose,
  onSubmit
}) => {
 
  const [step, setStep] = useState<number>(0);

  const [open, setOpen] = useState<Record<keyof FormState, boolean>>({
    title: true,
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

  const [listeningField, setListeningField] = useState<keyof FormState | null>(null);
  const recognitionRefs = useRef<Partial<Record<keyof FormState, any>>>({});

  const toggle = (key: keyof FormState) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name as keyof FormState]: value }));
  };

  const startRecognition = (field: keyof FormState) => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Speech Recognition API not supported');
      return;
    }
    const recog = new SpeechRec();
    recognitionRefs.current[field] = recog;
    recog.lang = 'en-US';
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onstart = () => setListeningField(field);
    recog.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setForm(prev => ({ ...prev, [field]: transcript }));
    };
    recog.onerror = () => setListeningField(null);
    recog.onend = () => setListeningField(null);

    recog.start();
    setTimeout(() => recog.stop(), 5000);
  };

  
  const canProceed = Object.values(form).some(val => val.trim() !== '');

  const handleNext = () => {
    if (canProceed) setStep(1);
    else alert('Please fill at least one field to proceed.');
  };

  const handlePrev = () => setStep(0);

  const handleSubmit = () => {
    const sentences = (
      [form.title, form.challenge, form.turningPoint, form.introMain, form.introSupp1, form.cta]
      ).filter(s => s.trim() !== '');
    onSubmit(sentences);
  };

  const renderField = (
    field: keyof FormState,
    placeholder: string,
    multiline = false,
    rows = 2
  ) => (
    <div className="relative mb-4">
      {multiline ? (
        <textarea
          name={field}
          rows={rows}
          placeholder={listeningField === field ? 'Listening…' : placeholder}
          value={form[field]}
          onChange={handleChange}
          className="w-full border rounded p-2 pr-10 resize-y"
        />
      ) : (
        <input
          name={field}
          type="text"
          placeholder={listeningField === field ? 'Listening…' : placeholder}
          value={form[field]}
          onChange={handleChange}
          className="w-full border rounded p-2 pr-10"
        />
      )}
      <button
        type="button"
        onClick={() => startRecognition(field)}
        className="absolute right-2 top-2"
      >
        <Mic
          size={20}
          className={listeningField === field ? 'text-red-500 animate-pulse' : ''}
        />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Create Storyline</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✖</button>
        </div>

        {step === 0 && (
          <>
            <div className="space-y-4">
              {/* Title Section */}
              <div>
                <button
                  onClick={() => toggle('title')}
                  className="flex justify-between items-center w-full bg-gray-100 p-3 rounded"
                >
                  <span>Title</span><span>{open.title ? '–' : '+'}</span>
                </button>
                {open.title && renderField('title', 'Describe your product or service in one sentence')}
              </div>

              {/* Challenge Section */}
              <div>
                <button
                  onClick={() => toggle('challenge')}
                  className="flex justify-between items-center w-full bg-gray-100 p-3 rounded"
                >
                  <span>Challenge</span><span>{open.challenge ? '–' : '+'}</span>
                </button>
                {open.challenge && renderField('challenge', 'Describe the main pain points your prospect is experiencing')}
              </div>

              {/* Turning Point Section */}
              <div>
                <button
                  onClick={() => toggle('turningPoint')}
                  className="flex justify-between items-center w-full bg-gray-100 p-3 rounded"
                >
                  <span>Turning Point</span><span>{open.turningPoint ? '–' : '+'}</span>
                </button>
                {open.turningPoint && renderField('turningPoint', 'Summarize the pain points and your solution')}
              </div>

              {/* Intro Main Section */}
              <div>
                <button
                  onClick={() => toggle('introMain')}
                  className="flex justify-between items-center w-full bg-gray-100 p-3 rounded"
                >
                  <span>Intro (Main)</span><span>{open.introMain ? '–' : '+'}</span>
                </button>
                {open.introMain && renderField('introMain', 'Describe the main service or feature you offer...', true, 3)}
              </div>

              {/* Intro Supp Section */}
              <div>
                <button
                  onClick={() => toggle('introSupp1')}
                  className="flex justify-between items-center w-full bg-gray-100 p-3 rounded"
                >
                  <span>Intro (Supplementary 1)</span><span>{open.introSupp1 ? '–' : '+'}</span>
                </button>
                {open.introSupp1 && renderField('introSupp1', 'Connect you with your customers the way you never did before.')}
              </div>

              {/* CTA Section */}
              <div>
                <button
                  onClick={() => toggle('cta')}
                  className="flex justify-between items-center w-full bg-gray-100 p-3 rounded"
                >
                  <span>Call to Action</span><span>{open.cta ? '–' : '+'}</span>
                </button>
                {open.cta && renderField('cta', 'Make a call‑to‑action telling potential clients exactly what to do next')}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleNext}
                disabled={!canProceed}
                className={`py-2 px-4 rounded ${canProceed ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'}`}
              >
                Next
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <div className="text-center space-y-6">
            <p className="text-lg">Are you ready to generate scene?</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={handlePrev}
                className="py-2 px-4 rounded bg-gray-200 hover:bg-gray-300"
              >
                Prev
              </button>
              <button
                onClick={handleSubmit}
                className="py-2 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Generate Storyline
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
