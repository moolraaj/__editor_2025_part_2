import { StoryLinePayload } from '@/types'
import React from 'react'
import { FaTimes } from 'react-icons/fa'

interface StoryLineResultsProps {
  
  showResultPopup: boolean
  payloads: StoryLinePayload[]
  setShowResultPopup: (open: boolean) => void
}

const StoryLineResults: React.FC<StoryLineResultsProps> = ({
  showResultPopup,
  payloads,
  setShowResultPopup
}) => {
  if (!showResultPopup) return null

  return (
    <div className="popup_overlay">
      <div className="popup_content">
        <button
          className="popup_close"
          onClick={() => setShowResultPopup(false)}
        >
          <FaTimes/>
        </button>
        <div className="st_line_wrap_outer">
          {payloads.length > 0 && payloads.map((payload, index) => (
            <div key={index} className="st_wrapper_inner">
              <h3>
                {payload.is_default ? 'Default Scene' : 'Scene'} {index + 1}
              </h3>

              {/* {payload.animations.length > 0 && (
                <div className="ani_type">
                  {payload.animations.map(anim => (
                    <div key={anim.id}>{anim.name}</div>
                  ))}
                </div>
              )} */}

              {/* {payload.backgrounds.length > 0 && (
                <div className="bg_type">
                  {payload.backgrounds.map(bg => (
                    <div key={bg.id} className="bg_type_bac">
                      <img src={bg.background_url} alt={bg.name} />
                    </div>
                  ))}
                </div>
              )} */}

              {payload.gifs.length > 0 && (
                <div className="char_type">
                  {payload.gifs.map(gif => (
                    <div key={gif.id} className="svg_type_img">
                      <img src={gif.gif_url} alt={gif.tags[0]} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          
        </div>
        <div className='st_line_buttons_outer'>
            <div className='st_line_buttons_inner'>
              <button
                className="buttons">
                Download as Pdf
              </button>
              <button
                className="buttons">
                Download as image
              </button>
              <button
                className="buttons">
                Add To Canvas
              </button>
            </div>
          </div>
      </div>
      
    </div>
    
  )
}

export default StoryLineResults
