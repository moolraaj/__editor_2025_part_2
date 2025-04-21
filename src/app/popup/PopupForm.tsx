import React, { useState, useRef } from "react";
import "../style/PopupForm.css";
import { FaAudible, FaChevronCircleDown, FaChevronCircleUp, FaEye, FaMicrophone, FaRecordVinyl } from "react-icons/fa";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: typeof window.SpeechRecognition;
  }
}

interface PopupFormProps {
    onClose: () => void;
    onNext: (index: number) => void;
  }

const fields = [
  { key: "title", label: "Title", description: "Describe your product or service in one sentence" },
  { key: "challenge", label: "Challenge", description: "Describe the main pain points your prospect is experiencing" },
  { key: "turningPoint", label: "Turning Point", description: "Summarize the pain points and your solution" },
  { key: "intro", label: "Intro", description: "Describe your main service feature" },
  { key: "subIntro1", label: "Supplementary Description Intro", description: "Connect with customers like never before" },
  { key: "subIntro2", label: "Supplementary Description Intro", description: "Join and convert new users" },
  { key: "callToAction", label: "Call to Action", description: "Tell users what to do next" },
];

const PopupForm: React.FC<PopupFormProps> = ({ onClose,onNext }) => {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [openField, setOpenField] = useState<string>("title");
  const [listeningField, setListeningField] = useState<string | null>(null);

  const recognitionRef = useRef<(typeof window)["SpeechRecognition"] | null>(null);

  const handleToggle = (key: string) => {
    setOpenField(openField === key ? "" : key);
  };

  const handleChange = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleMicClick = (fieldKey: string) => {
    listeningField === fieldKey ? stopListening() : startListening(fieldKey);
  };

  const startListening = (fieldKey: string) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition not supported. Try Chrome!");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setFormData((prevData) => ({ ...prevData, [fieldKey]: transcript }));
    };

    recognition.start();
    setListeningField(fieldKey);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListeningField(null);
  };

  const handleSubmit = () => {
    console.log(formData);
    alert("Form submitted!");
    onClose();
  };

  return (
    <div className="popup-overlay">
      <div className="popup-container">
        <button className="close-button" onClick={onClose}>✕</button>

        <div className="fields">
          {fields.map((field) => (
            <div className="accordion-item" key={field.key}>
              <div className="accordion-header" onClick={() => handleToggle(field.key)}>
                <div className="left-rail">
                  <div className={`dot ${formData[field.key] ? "filled" : ""}`} />
                </div>
                <div className="field-label">{field.label}</div>
                <div className="arrow">
  {openField === field.key ? <FaChevronCircleUp /> : <FaChevronCircleDown />}
</div>

              </div>

              {openField === field.key && (
                <div className="accordion-content">
                  <div className="input-with-icon">
                    <textarea
                      className="custom-textarea"
                      value={formData[field.key] || ""}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                    <span className="placeholder-text">{field.description}</span>
                    <button
                      className={`mic-btn ${listeningField === field.key ? "listening" : ""}`}
                      onClick={() => handleMicClick(field.key)}
                    >
                         <FaMicrophone />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="form-footer">
          <button className="next-btn" onClick={() => onNext(2)}>Next</button>
        </div>
      </div>
    </div>
  );
};

export default PopupForm;