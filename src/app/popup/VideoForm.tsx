import React, { useState } from "react";
import "./VideoForm.css";
interface VideoFormProps {
    onBack: () => void;
    onNext: (index: number) => void;
  }
  const VideoForm: React.FC<VideoFormProps> = ({ onBack, onNext }) => {
  const [selectedStyle, setSelectedStyle] = useState(true);
  const [characterVoice, setCharacterVoice] = useState("Mark");
  const [noVoice, setNoVoice] = useState(false);

  return (
    <div className="form-wrapper">
      <button className="back-btn">← Back</button>

      <div className="section">
        <h3>Video Style</h3>
        <div className="video-style-box">
          <label className="checkbox-image">
            <input
              type="checkbox"
              checked={selectedStyle}
              onChange={() => setSelectedStyle(!selectedStyle)}
            />
            <img
              src="https://via.placeholder.com/150x80?text=Video+Style"
              alt="Video Style"
            />
          </label>
        </div>
      </div>

      <div className="section">
        <h3>Video Element Settings (Optional)</h3>
        <div className="form-row">
          <select>
            <option>Select profession</option>
            <option>Teacher</option>
            <option>Engineer</option>
          </select>
          <select>
            <option>Select gender</option>
            <option>Male</option>
            <option>Female</option>
          </select>
        </div>
        <div className="form-row">
          <select>
            <option>Select usage scenario</option>
            <option>Promotion</option>
            <option>Education</option>
          </select>
        </div>
        <div className="form-row">
          <select>
            <option>Select topic element</option>
            <option>Technology</option>
            <option>Nature</option>
          </select>
        </div>
      </div>

      <div className="section">
        <h3>Audio Settings (Optional)</h3>
        <div className="form-row">
          <select>
            <option>English US</option>
            <option>English UK</option>
          </select>
          <select
            value={characterVoice}
            onChange={(e) => setCharacterVoice(e.target.value)}
          >
            <option>Mark</option>
            <option>Emma</option>
          </select>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={noVoice}
              onChange={() => setNoVoice(!noVoice)}
            />
            Do not add character voice
          </label>
        </div>
        <div className="form-row">
          <select>
            <option>Select music style</option>
            <option>Relaxing</option>
            <option>Energetic</option>
          </select>
        </div>
      </div>

      <div className="form-footer">
        <button className="generate-btn">Generate</button>
      </div>
    </div>
  );
};
export default VideoForm;
