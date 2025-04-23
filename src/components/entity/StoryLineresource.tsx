// 'use client'

// import React, { useState, useRef } from 'react';
// import { Mic } from 'lucide-react';
// import { FaEye, FaMinus, FaPlug, FaPlus, FaTimes } from 'react-icons/fa';
// import '@/app/style/storyline.css';
// type PayloadCallback = (sentences: string[]) => void;

// interface CreateStorylinePopupProps {
//   onClose: () => void;
//   onSubmit: PayloadCallback;
// }

// interface FormState {
//   title: string;
//   challenge: string;
//   turningPoint: string;
//   introMain: string;
//   introSupp1: string;
//   cta: string;
// }

// export const CreateStorylinePopup: React.FC<CreateStorylinePopupProps> = ({
//   onClose,
//   onSubmit
// }) => {
 
//   const [step, setStep] = useState<number>(0);

//   const [open, setOpen] = useState<Record<keyof FormState, boolean>>({
//     title: true,
//     challenge: false,
//     turningPoint: false,
//     introMain: false,
//     introSupp1: false,
//     cta: false,
//   });

//   const [form, setForm] = useState<FormState>({
//     title: '',
//     challenge: '',
//     turningPoint: '',
//     introMain: '',
//     introSupp1: '',
//     cta: ''
//   });

//   const [listeningField, setListeningField] = useState<keyof FormState | null>(null);
//   const recognitionRefs = useRef<Partial<Record<keyof FormState, any>>>({});

//   const toggle = (key: keyof FormState) =>
//     setOpen(prev => ({ ...prev, [key]: !prev[key] }));

//   const handleChange = (
//     e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
//   ) => {
//     const { name, value } = e.target;
//     setForm(prev => ({ ...prev, [name as keyof FormState]: value }));
//   };

//   const startRecognition = (field: keyof FormState) => {
//     const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
//     if (!SpeechRec) {
//       alert('Speech Recognition API not supported');
//       return;
//     }
//     const recog = new SpeechRec();
//     recognitionRefs.current[field] = recog;
//     recog.lang = 'en-US';
//     recog.interimResults = false;
//     recog.maxAlternatives = 1;

//     recog.onstart = () => setListeningField(field);
//     recog.onresult = (event: any) => {
//       const transcript = event.results[0][0].transcript;
//       setForm(prev => ({ ...prev, [field]: transcript }));
//     };
//     recog.onerror = () => setListeningField(null);
//     recog.onend = () => setListeningField(null);

//     recog.start();
//     setTimeout(() => recog.stop(), 5000);
//   };

  
//   const canProceed = Object.values(form).some(val => val.trim() !== '');

//   const handleNext = () => {
//     if (canProceed) setStep(1);
//     else alert('Please fill at least one field to proceed.');
//   };

//   const handlePrev = () => setStep(0);

//   const handleSubmit = () => {
//     const sentences = (
//       [form.title, form.challenge, form.turningPoint, form.introMain, form.introSupp1, form.cta]
//       ).filter(s => s.trim() !== '');
//     onSubmit(sentences);
//   };

//   const renderField = (
//     field: keyof FormState,
//     placeholder: string,
//     multiline = false,
//     rows = 2
//   ) => (
//     <div className="relative mb-4">
//       {multiline ? (
//         <textarea
//           name={field}
//           rows={rows}
//           placeholder={listeningField === field ? 'Listening…' : placeholder}
//           value={form[field]}
//           onChange={handleChange}
//           className="storyline-form-input"
//         />
//       ) : (
//         <input
//           name={field}
//           type="text"
//           placeholder={listeningField === field ? 'Listening…' : placeholder}
//           value={form[field]}
//           onChange={handleChange}
//           className="storyline-form-input"
//         />
//       )}
//       <button
//         type="button"
//         onClick={() => startRecognition(field)}
//         className="absolute right-2 top-2"
//       >
//         <Mic
//           size={20}
//           className={listeningField === field ? ' animate-pulse' : ''}
//         />
//       </button>
//     </div>
//   );

//   return (
//     // <div className="popup-overlay">
//     //   <div className="popup-container">
//     //     <div className="flex justify-between items-center mb-4">
//     //       <h3 className="text-xl font-semibold">Create Storyline</h3>
//     //       <button onClick={onClose} className="close-button"><FaTimes/></button>
//     //     </div>

//     //     {step === 0 && (
//     //       <>
//     //         <div className="fields">
//     //           {/* Title Section */}
//     //           <div>
//     //             <button
//     //               onClick={() => toggle('title')}
//     //               className=""
//     //             >
//     //               <span>Title</span><span>{open.title ? '–' : '+'}</span>
//     //             </button>
//     //             {open.title && renderField('title', 'Describe your product or service in one sentence')}
//     //           </div>

//     //           {/* Challenge Section */}
//     //           <div>
//     //             <button
//     //               onClick={() => toggle('challenge')}
//     //               className=""
//     //             >
//     //               <span>Challenge</span><span>{open.challenge ? '–' : '+'}</span>
//     //             </button>
//     //             {open.challenge && renderField('challenge', 'Describe the main pain points your prospect is experiencing')}
//     //           </div>

//     //           {/* Turning Point Section */}
//     //           <div>
//     //             <button
//     //               onClick={() => toggle('turningPoint')}
//     //               className=""
//     //             >
//     //               <span>Turning Point</span><span>{open.turningPoint ? '–' : '+'}</span>
//     //             </button>
//     //             {open.turningPoint && renderField('turningPoint', 'Summarize the pain points and your solution')}
//     //           </div>

//     //           {/* Intro Main Section */}
//     //           <div>
//     //             <button
//     //               onClick={() => toggle('introMain')}
//     //               className=""
//     //             >
//     //               <span>Intro (Main)</span><span>{open.introMain ? '–' : '+'}</span>
//     //             </button>
//     //             {open.introMain && renderField('introMain', 'Describe the main service or feature you offer...', true, 3)}
//     //           </div>

//     //           {/* Intro Supp Section */}
//     //           <div>
//     //             <button
//     //               onClick={() => toggle('introSupp1')}
//     //               className=""
//     //             >
//     //               <span>Intro (Supplementary 1)</span><span>{open.introSupp1 ? '–' : '+'}</span>
//     //             </button>
//     //             {open.introSupp1 && renderField('introSupp1', 'Connect you with your customers the way you never did before.')}
//     //           </div>

//     //           {/* CTA Section */}
//     //           <div>
//     //             <button
//     //               onClick={() => toggle('cta')}
//     //               className=""
//     //             >
//     //               <span>Call to Action</span><span>{open.cta ? '–' : '+'}</span>
//     //             </button>
//     //             {open.cta && renderField('cta', 'Make a call‑to‑action telling potential clients exactly what to do next')}
//     //           </div>
//     //         </div>

//     //         <div className="">
//     //           <button
//     //             onClick={handleNext}
//     //             disabled={!canProceed}
//     //             className=""
//     //           >
//     //             Next
//     //           </button>
//     //         </div>
//     //       </>
//     //     )}

//     //     {step === 1 && (
//     //       <div className="">
//     //         <p className="">Are you ready to generate scene?</p>
//     //         <div className="">
//     //           <button
//     //             onClick={handlePrev}
//     //             className=""
//     //           >
//     //             Prev
//     //           </button>
//     //           <button
//     //             onClick={handleSubmit}
//     //             className=""
//     //           >
//     //             Generate Storyline
//     //           </button>
//     //         </div>
//     //       </div>
//     //     )}
//     //   </div>
//     // </div>






//     <div className="popup-overlay">
//   <div className="popup-container">
//     <div className="popup-header">
//       <h3 className="popup-title">Create Storyline</h3>
//       <button onClick={onClose} className="popup-close-button">
//         <FaTimes />
//       </button>
//     </div>

//     {step === 0 && (
//       <>
//         <div className="popup-fields">

//           {/* Title Section */}
//           <div className="popup-field">
//             <button onClick={() => toggle('title')} className="field-toggle-button">
//               <span className="field-title">Title</span>
//               <span className="field-toggle-icon">{open.title ? <FaMinus/> : <FaPlus/>}</span>
//             </button>
//             {open.title && renderField('title', 'Describe your product or service in one sentence')}
//           </div>

//           {/* Challenge Section */}
//           <div className="popup-field">
//             <button onClick={() => toggle('challenge')} className="field-toggle-button">
//               <span className="field-title">Challenge</span>
//               <span className="field-toggle-icon">{open.challenge ? <FaMinus/> : <FaPlus/>}</span>
//             </button>
//             {open.challenge && renderField('challenge', 'Describe the main pain points your prospect is experiencing')}
//           </div>

//           {/* Turning Point Section */}
//           <div className="popup-field">
//             <button onClick={() => toggle('turningPoint')} className="field-toggle-button">
//               <span className="field-title">Turning Point</span>
//               <span className="field-toggle-icon">{open.turningPoint ? <FaMinus/> : <FaPlus/>}</span>
//             </button>
//             {open.turningPoint && renderField('turningPoint', 'Summarize the pain points and your solution')}
//           </div>

//           {/* Intro Main Section */}
//           <div className="popup-field">
//             <button onClick={() => toggle('introMain')} className="field-toggle-button">
//               <span className="field-title">Intro (Main)</span>
//               <span className="field-toggle-icon">{open.introMain ? <FaMinus/> : <FaPlus/>}</span>
//             </button>
//             {open.introMain && renderField('introMain', 'Describe the main service or feature you offer...', true, 3)}
//           </div>

//           {/* Intro Supplementary 1 Section */}
//           <div className="popup-field">
//             <button onClick={() => toggle('introSupp1')} className="field-toggle-button">
//               <span className="field-title">Intro (Supplementary 1)</span>
//               <span className="field-toggle-icon">{open.introSupp1 ? <FaMinus/> : <FaPlus/>}</span>
//             </button>
//             {open.introSupp1 && renderField('introSupp1', 'Connect you with your customers the way you never did before.')}
//           </div>

//           {/* Call to Action Section */}
//           <div className="popup-field">
//             <button onClick={() => toggle('cta')} className="field-toggle-button">
//               <span className="field-title">Call to Action</span>
//               <span className="field-toggle-icon">{open.cta ? <FaMinus/> : <FaPlus/>}</span>
//             </button>
//             {open.cta && renderField('cta', 'Make a call<FaMinus/>to<FaMinus/>action telling potential clients exactly what to do next')}
//           </div>

//         </div>

//         <div className="popup-footer">
//           <button
//             onClick={handleNext}
//             disabled={!canProceed}
//             className="popup-next-button"
//           >
//             Next
//           </button>
//         </div>
//       </>
//     )}

//     {step === 1 && (
//       <div className="popup-confirmation">
//         <p className="confirmation-text">Are you ready to generate scene?</p>
//         <div className="confirmation-buttons">
//           <button
//             onClick={handlePrev}
//             className="confirmation-prev-button"
//           >
//             Prev
//           </button>
//           <button
//             onClick={handleSubmit}
//             className="confirmation-submit-button"
//           >
//             Generate Storyline
//           </button>
//         </div>
//       </div>
//     )}
//   </div>
// </div>

//   );
// };












// 'use client'

// import React, { useState, useRef } from 'react';
// import { Mic } from 'lucide-react';
// import { FaMinus, FaPlus, FaTimes } from 'react-icons/fa';
// import '@/app/style/storyline.css'; // make sure CSS linked

// type PayloadCallback = (sentences: string[]) => void;

// interface CreateStorylinePopupProps {
//   onClose: () => void;
//   onSubmit: PayloadCallback;
// }

// interface FormState {
//   title: string;
//   challenge: string;
//   turningPoint: string;
//   introMain: string;
//   introSupp1: string;
//   cta: string;
// }

// export const CreateStorylinePopup: React.FC<CreateStorylinePopupProps> = ({ onClose, onSubmit }) => {
//   const [step, setStep] = useState<number>(0);
//   const [open, setOpen] = useState<Record<keyof FormState, boolean>>({
//     title: true,
//     challenge: false,
//     turningPoint: false,
//     introMain: false,
//     introSupp1: false,
//     cta: false,
//   });

//   const [form, setForm] = useState<FormState>({
//     title: '',
//     challenge: '',
//     turningPoint: '',
//     introMain: '',
//     introSupp1: '',
//     cta: ''
//   });

//   const [listeningField, setListeningField] = useState<keyof FormState | null>(null);
//   const recognitionRefs = useRef<Partial<Record<keyof FormState, any>>>({});

//   const toggle = (key: keyof FormState) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target;
//     setForm(prev => ({ ...prev, [name as keyof FormState]: value }));
//   };

//   const startRecognition = (field: keyof FormState) => {
//     const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
//     if (!SpeechRec) {
//       alert('Speech Recognition API not supported');
//       return;
//     }
//     const recog = new SpeechRec();
//     recognitionRefs.current[field] = recog;
//     recog.lang = 'en-US';
//     recog.interimResults = false;
//     recog.maxAlternatives = 1;

//     recog.onstart = () => setListeningField(field);
//     recog.onresult = (event: any) => {
//       const transcript = event.results[0][0].transcript;
//       setForm(prev => ({ ...prev, [field]: transcript }));
//     };
//     recog.onerror = () => setListeningField(null);
//     recog.onend = () => setListeningField(null);

//     recog.start();
//     setTimeout(() => recog.stop(), 5000);
//   };

//   const canProceed = Object.values(form).some(val => val.trim() !== '');

//   const handleNext = () => {
//     if (canProceed) setStep(1);
//     else alert('Please fill at least one field to proceed.');
//   };

//   const handlePrev = () => setStep(0);

//   const handleSubmit = () => {
//     const sentences = (
//       [form.title, form.challenge, form.turningPoint, form.introMain, form.introSupp1, form.cta]
//     ).filter(s => s.trim() !== '');
//     onSubmit(sentences);
//   };

//   const renderField = (
//     field: keyof FormState,
//     placeholder: string,
//     multiline = false,
//     rows = 2
//   ) => {
//     return (
//       <div className="relative mb-4">
//         <div className="flex-1 relative">
//           {multiline ? (
//             <textarea
//               name={field}
//               rows={rows}
//               placeholder={listeningField === field ? 'Listening…' : placeholder}
//               value={form[field]}
//               onChange={handleChange}
//               className="storyline-form-input"
//             />
//           ) : (
//             <input
//               name={field}
//               type="text"
//               placeholder={listeningField === field ? 'Listening…' : placeholder}
//               value={form[field]}
//               onChange={handleChange}
//               className="storyline-form-input"
//             />
//           )}
//           <button
//             type="button"
//             onClick={() => startRecognition(field)}
//             className="absolute right-2 top-2"
//           >
//             <Mic
//               size={20}
//               className={listeningField === field ? ' animate-pulse' : ''}
//             />
//           </button>
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div className="popup-overlay">
//       <div className="popup-container">
//         <div className="popup-header">
//           <h3 className="popup-title">Create Storyline</h3>
//           <button onClick={onClose} className="popup-close-button">
//             <FaTimes />
//           </button>
//         </div>

//         {step === 0 && (
//           <>
//             <div className="popup-fields">
//               {(['title', 'challenge', 'turningPoint', 'introMain', 'introSupp1', 'cta'] as (keyof FormState)[]).map(field => {
//                 const isFilled = form[field].trim() !== '';

//                 return (
//                   <div key={field} className="popup-field">
//                     <button onClick={() => toggle(field)} className="field-toggle-button flex items-center gap-2 relative">
                      
//                       {/* --- Status Dot --- */}
//                       <div className={`status-dot ${isFilled ? 'filled' : ''}`}></div>

//                       {/* --- Field Title --- */}
//                       <span className="field-title ml-6">
//                         {field === 'introSupp1' ? 'Intro (Supplementary 1)' : field.charAt(0).toUpperCase() + field.slice(1)}
//                       </span>

//                       {/* --- Plus / Minus Icon --- */}
//                       <span className="ml-auto field-toggle-icon">{open[field] ? <FaMinus /> : <FaPlus />}</span>
//                     </button>

//                     {open[field] && renderField(
//                       field,
//                       getPlaceholder(field),
//                       field === 'introMain',
//                       3
//                     )}
//                   </div>
//                 );
//               })}
//             </div>

//             <div className="popup-footer">
//               <button
//                 onClick={handleNext}
//                 disabled={!canProceed}
//                 className="popup-next-button"
//               >
//                 Next
//               </button>
//             </div>
//           </>
//         )}

//         {step === 1 && (
//           <div className="popup-confirmation">
//             <p className="confirmation-text">Are you ready to generate scene?</p>
//             <div className="confirmation-buttons">
//               <button
//                 onClick={handlePrev}
//                 className="confirmation-prev-button"
//               >
//                 Prev
//               </button>
//               <button
//                 onClick={handleSubmit}
//                 className="confirmation-submit-button"
//               >
//                 Generate Storyline
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// // Helper for placeholder text
// const getPlaceholder = (field: keyof FormState): string => {
//   switch (field) {
//     case 'title':
//       return 'Describe your product or service in one sentence';
//     case 'challenge':
//       return 'Describe the main pain points your prospect is experiencing';
//     case 'turningPoint':
//       return 'Summarize the pain points and your solution';
//     case 'introMain':
//       return 'Describe the main service or feature you offer...';
//     case 'introSupp1':
//       return 'Connect you with your customers the way you never did before.';
//     case 'cta':
//       return 'Make a call-to-action telling potential clients exactly what to do next';
//     default:
//       return '';
//   }
// };



















'use client'

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
      <div className="popup-container next-page-popup-container">
        <div className="popup-header">
          <h3 className="popup-title">Create Storyline</h3>
          <button onClick={onClose} className="popup-close-button">
            <FaTimes />
          </button>
        </div>

        {step === 0 && (
          <>
            <div className="popup-fields">
              {(['title', 'challenge', 'turningPoint', 'introMain', 'introSupp1', 'cta'] as (keyof FormState)[]).map(field => {
                const isFilled = form[field].trim() !== '';

                return (
                  <div key={field} className="popup-field">
                    <button onClick={() => toggle(field)} className="field-toggle-button flex items-center gap-2 relative">
                      {/* ✅ Dot showing filled or empty */}
                      <div className={`status-dot ${isFilled ? 'filled' : ''}`}></div>

                      <span className="field-title">
                        {field === 'introSupp1' ? 'Intro (Supplementary 1)' : field.charAt(0).toUpperCase() + field.slice(1)}
                      </span>

                      <span className="ml-auto field-toggle-icon">{open[field] ? <FaMinus /> : <FaPlus />}</span>
                    </button>

                    {/* ✅ Only one input field open */}
                    {open[field] && renderField(
                      field,
                      getPlaceholder(field),
                      field === 'introMain',
                      3
                    )}
                  </div>
                );
              })}
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

        {step === 1 && (
          <div className="popup-confirmation">
            <p className="confirmation-text">Are you ready to generate scene?</p>
            <div className="confirmation-buttons">
              <button
                onClick={handlePrev}
                className="confirmation-prev-button buttons"
              >
                Prev
              </button>
              <button
                onClick={handleSubmit}
                className="confirmation-submit-button buttons"
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
