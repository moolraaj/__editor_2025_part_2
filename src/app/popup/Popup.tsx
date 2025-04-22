// MultiStepForm.tsx
import React, { useState } from "react";
import PopupForm from "./PopupForm";
import VideoForm from "./VideoForm";


interface MultiStepFormProps {
    onClose: () => void;
}

// MultiStepForm component
    const MultiStepForm: React.FC<MultiStepFormProps> = ({ onClose}) => {
  const [step, setStep] = useState(1);  

  
  const handleNext = (index: number) => {
    setStep(index + 1);  
  };

  
  const handleBack = () => {
    setStep(step - 1);  
  };

 
  const handleClose = () => {
    setStep(1);  
  };

  return (
    <div>
      {step === 1 && <PopupForm onClose={handleClose} onNext={handleNext} />}
      {step === 2 && <VideoForm onBack={handleBack} onNext={handleNext} />}
       
    </div>
  );
};

export default MultiStepForm;
