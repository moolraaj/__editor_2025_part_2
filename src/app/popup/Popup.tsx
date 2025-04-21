// MultiStepForm.tsx
import React, { useState } from "react";
import PopupForm from "./PopupForm";
import VideoForm from "./VideoForm";


interface MultiStepFormProps {
    onClose: () => void;
}

// MultiStepForm component
    const MultiStepForm: React.FC<MultiStepFormProps> = ({ onClose}) => {
  const [step, setStep] = useState(1); // Track the current step

  // Handle the "Next" button to move to the next step
  const handleNext = (index: number) => {
    setStep(index + 1); // Move to the next step
  };

  // Handle the "Back" button to move to the previous step
  const handleBack = () => {
    setStep(step - 1); // Go back to the previous form
  };

  // Reset or close form
  const handleClose = () => {
    setStep(1); // Reset to the first form
  };

  return (
    <div>
      {step === 1 && <PopupForm onClose={handleClose} onNext={handleNext} />}
      {step === 2 && <VideoForm onBack={handleBack} onNext={handleNext} />}
      {/* Add other forms as needed */}
    </div>
  );
};

export default MultiStepForm;
