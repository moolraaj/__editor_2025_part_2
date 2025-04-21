export const ALL_FONTS: string[] = [
  "Arial",
  "Verdana",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Comic Sans MS",
  "Impact",
  "Tahoma",
  "Trebuchet MS",
  "Lucida Console",
  "Garamond",
  "Palatino Linotype",
  "Book Antiqua",
  "Century Gothic",
  "Franklin Gothic Medium",
  "Gill Sans",
  "Brush Script MT",
  "Copperplate",
  "Segoe UI",
  "Calibri",
  "Cambria",
  "Didot",
  "Rockwell",
  "Arial Black",
];

export const WALKING:string='walking'
export const HANDSTAND:string='handstand'
export const VIDEO_EXPORT_LENGTH=600


export function showLoading() {
  let loadingEl = document.createElement('div')
  loadingEl.id = 'loadingIndicator'
  loadingEl.innerText = 'Please wait, video is downloading...' 
  loadingEl.style.position = 'fixed'
  loadingEl.style.top = '57.5%'
  loadingEl.style.left = '53%'
  loadingEl.style.transform = 'translate(-50%, -50%)'
  loadingEl.style.backgroundColor = 'rgb(107 114 128)'
  loadingEl.style.color = '#fff'
  loadingEl.style.padding = '20px 30px'
  loadingEl.style.borderRadius = '4px'
  loadingEl.style.zIndex = '10000'
  document.body.appendChild(loadingEl)
}

export function hideLoading() {
  const loadingEl = document.getElementById('loadingIndicator')
  if (loadingEl) {
    loadingEl.remove()
  }
}


export const MARKINGS = [
  {
    interval: 5000,
    color: "black",
    size: 16,
    width: 1,
  },
  {
    interval: 1000,
    color: "black",
    size: 8,
    width: 1,
  },
  {
    interval: 100,
    color: "black",
    size: 5,
    width: 1,
  },
];


export const canvasBackgroundColor = [
  "#000000", // Black
  "#FFFFFF", // White
  "#404040", // Dark Gray
  "#808080", // Gray
  "#C0C0C0", // Silver
  "#E0E0E0", // Light Gray
  "#003366", // Dark Blue
  "#336699", // Medium Blue
  "#6699CC", // Blue
  "#99CCFF", // Light Blue
  "#990000", // Dark Red
  "#CC3333", // Red
  "#FF6666", // Light Red
  "#663300", // Dark Brown
  "#996633", // Brown
  "#CC9966", // Light Brown
  "#006600", // Dark Green
  "#339933", // Green
  "#66CC99", // Light Green
  "#FFFF00", // Yellow
];


 
 