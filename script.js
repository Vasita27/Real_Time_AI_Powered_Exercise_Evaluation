
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.skypack.dev/@mediapipe/tasks-vision@0.10.0";

const demosSection = document.getElementById("demos");
const statusText = document.getElementById("status-text");
const repCounter = document.getElementById("rep-counter");
const formFeedback = document.getElementById("form-feedback");
const squatsButton = document.getElementById("squatsButton");
const pushUpsButton = document.getElementById("pushUpsButton");

let poseLandmarker = undefined;
let runningMode = "VIDEO";
let enableWebcamButton;
let webcamRunning = false;
let currentExercise = null;
let repCount = 0;
let exerciseState = "waiting"; // waiting, down, up
let lastExerciseState = "waiting";
let lastFeedbackTime = 0;
let feedbackTimer = null;
let lastFeedbackText = '';


// Three.js variables
let scene, camera, renderer;
let annotations = [];
const SQUAT_KNEE_ANGLE_MIN = 90;  // halfway down
const SQUAT_KNEE_ANGLE_MAX = 175; // mostly standing up
const SQUAT_BACK_ANGLE_MIN = 120; // allow slouching and leaning
const SQUAT_BACK_ANGLE_MAX = 195; // Too arched back if above this
const PUSHUP_ELBOW_ANGLE_MIN = 85;
const PUSHUP_ELBOW_ANGLE_MAX = 150;
const PUSHUP_BACK_ANGLE_MIN = 160; // For back straightness

// Colors for visualization
const RED = '#FF0000';
const GREEN = '#00FF00';

// Initialize Three.js scene
function initThreeJS() {
  const container = document.getElementById('three-container');
  
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
  
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight); //Creates a renderer that will draw everything in the scene using WebGL.
  container.appendChild(renderer.domElement);
  
  camera.position.z = 5;
}
initThreeJS();

//Animation function
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// Create a text sprite for annotations
function createTextSprite(text, color) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = 512;  // Higher resolution canvas
  canvas.height = 256;

  context.font = "bold 24px Arial"; // Increased font size
  context.fillStyle = color;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(text, 20, canvas.height / 2); // Center vertically

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(5, 2.5, 1); // Scaled up for visibility
  sprite.renderOrder = 999;

  return sprite;
}

// Update or create annotation - will be used for feedback if showInPlace Feedback is not used
function updateAnnotation(position, text, color) {
  let sprite = annotations.find(a => a.userData.text === text);
  
  if (!sprite) {
    sprite = createTextSprite(text, color);
    sprite.userData.text = text;
    annotations.push(sprite);
    scene.add(sprite);
  }
  
  sprite.position.set(position.x * 10 - 5, position.y * 10 - 5, 0);
  sprite.color = color;
}

// Clear all annotations
function clearAnnotations() {
  annotations.forEach(sprite => {
    scene.remove(sprite);
  });
  annotations = [];
}

// Calculate angle between three points (in 3D for accuracy)
function calculateAngle3D(a, b, c) {
  if (!a || !b || !c) return 0;
  const ab = { x: b.x - a.x, y: b.y - a.y, z: (b.z || 0) - (a.z || 0) };
  const cb = { x: b.x - c.x, y: b.y - c.y, z: (b.z || 0) - (c.z || 0) };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2 + ab.z ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2 + cb.z ** 2);
  if (magAB * magCB === 0) return 0;
  let angle = Math.acos(dot / (magAB * magCB));
  return Math.abs(angle * (180 / Math.PI));
}


// Helper to get averaged value
function average(a, b) {
  return (a + b) / 2;
}



// Exercise detection logic
function detectExercise(landmarks) {
  if (!currentExercise || !landmarks || landmarks.length === 0) return;

  const landmark = landmarks[0];
  let feedback = [];
  let color = RED;
  clearAnnotations();
  function calculateDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  const leftHip = landmark[23];
  const leftShoulder = landmark[11];
  const leftKnee = landmark[25];
  const rightKnee = landmark[26];
  const rightHip = landmark[24];
  const leftAnkle = landmark[27];
  const rightAnkle = landmark[28];
  const rightShoulder = landmark[12];

  if (currentExercise === 'squats') {
    // Use both knees and hips for robust angle calculation
    const leftKneeAngle = calculateAngle3D(
      landmark[23], // left hip
      landmark[25], // left knee
      landmark[27]  // left ankle
    );
    const rightKneeAngle = calculateAngle3D(
      landmark[24], // right hip
      landmark[26], // right knee
      landmark[28]  // right ankle
    );
    // Use both sides for back angle (shoulder-hip-ankle)
    const leftBackAngle = calculateAngle3D(
      landmark[11], // left shoulder
      landmark[23], // left hip
      landmark[27]  // left ankle
    );
    const rightBackAngle = calculateAngle3D(
      landmark[12], // right shoulder
      landmark[24], // right hip
      landmark[28]  // right ankle
    );
    // Average for stability
    const kneeAngle = average(leftKneeAngle, rightKneeAngle);
    const backAngle = average(leftBackAngle, rightBackAngle);
    // Hip angle (between shoulder, hip, and knee)
    const hipAngle = calculateAngle3D(landmark[11], landmark[23], landmark[25]); 
    const ankleKneeDistance = calculateDistance(leftKnee, leftAnkle);
    const feetDistanceTooClose = calculateDistance(leftAnkle, rightAnkle) < 0.2;
    const feetDistanceTooWide = calculateDistance(leftAnkle, rightAnkle) > 0.6;

    // Define whether knees are inward
    const kneesInward = (leftKnee.x < leftHip.x && rightKnee.x < rightHip.x);

    // Feedback logic
    if (backAngle < SQUAT_BACK_ANGLE_MIN) {
      showInPlaceFeedback("Straighten your back", RED, landmark[23]); // Left hip
    }
    
    if (backAngle > SQUAT_BACK_ANGLE_MAX) {
      showInPlaceFeedback("Don't lean forward", RED, landmark[11]); // Left shoulder
    }
    
    if (kneeAngle > SQUAT_KNEE_ANGLE_MAX) {
      showInPlaceFeedback("Bend your knees more", RED, landmark[25]); // Left knee
    }
    
    if (kneeAngle < SQUAT_KNEE_ANGLE_MIN) {
      showInPlaceFeedback("Don't go too low", RED, landmark[26]); // Right knee
    }
    
    if (hipAngle > 170) {
      showInPlaceFeedback("Lower your hips", RED, landmark[23]); // Left hip
    }
    
    if (hipAngle < 60) {
      showInPlaceFeedback("Don't sit too low", RED, landmark[24]); // Right hip
    }
    
    
    
    if (feetDistanceTooClose) {
      showInPlaceFeedback("Spread your feet", RED, landmark[27]); // Left ankle
    }
    
    if (feetDistanceTooWide) {
      showInPlaceFeedback("Bring feet closer", RED, landmark[28]); // Right ankle
    }
    
    if (kneesInward) {
      showInPlaceFeedback("Push knees out", RED, landmark[25]); // Left knee
    }
    
    // if (chestDropping) {
    //   showInPlaceFeedback("Keep chest up", RED, landmark[12]); // Right shoulder
    // }
    

    // Rep counting and perfect form
    if (backAngle >= SQUAT_BACK_ANGLE_MIN &&
        kneeAngle >= SQUAT_KNEE_ANGLE_MIN &&
        kneeAngle <= SQUAT_KNEE_ANGLE_MAX) {
      color = GREEN;
      if (exerciseState === 'waiting' && kneeAngle < SQUAT_KNEE_ANGLE_MIN + 10) {
        exerciseState = 'down';
        feedback = ['Good! Now stand up slowly'];
      } else if (exerciseState === 'down' && kneeAngle > SQUAT_KNEE_ANGLE_MAX - 10) {
        if (lastExerciseState === 'down') {
          exerciseState = 'up';
          repCount++;
          feedback = ['Great job! Prepare for next rep'];
          setTimeout(() => {
            exerciseState = 'waiting';
            formFeedback.textContent = 'Ready for next rep';
          }, 700);
        }
      }
    }
  } else if (currentExercise === 'pushups') {
    // Calculate angles
    const leftElbowAngle = calculateAngle3D(landmark[11], landmark[13], landmark[15]);
    const rightElbowAngle = calculateAngle3D(landmark[12], landmark[14], landmark[16]);
    const leftBackAngle = calculateAngle3D(landmark[11], landmark[23], landmark[25]);
    const rightBackAngle = calculateAngle3D(landmark[12], landmark[24], landmark[26]);
  
    const elbowAngle = average(leftElbowAngle, rightElbowAngle);
    const backAngle = average(leftBackAngle, rightBackAngle);
  
    // Relaxed thresholds
    const relaxedElbowMin = PUSHUP_ELBOW_ANGLE_MIN - 10; // allow going a bit deeper
    const relaxedElbowMax = PUSHUP_ELBOW_ANGLE_MAX + 10; // allow slightly shallower pushup
    const relaxedBackMin = PUSHUP_BACK_ANGLE_MIN - 10;   // slight curve allowed
  
    // Feedback for back
    if (backAngle < relaxedBackMin) {
      showInPlaceFeedback('Try to keep your back straighter', RED, landmark[23]);
      showInPlaceFeedback('Try to keep your back straighter', RED, landmark[24]);
    }
  
    // Feedback for elbows
    if (elbowAngle > relaxedElbowMax) {
      showInPlaceFeedback('Try lowering a bit more', RED, landmark[13]);
      showInPlaceFeedback('Try lowering a bit more', RED, landmark[14]);
    } else if (elbowAngle < relaxedElbowMin) {
      showInPlaceFeedback('Don’t go too low', RED, landmark[13]);
      showInPlaceFeedback('Don’t go too low', RED, landmark[14]);
    }
  
    // Acceptable range for counting
    const inGoodBackForm = backAngle >= relaxedBackMin;
    const inElbowRange = elbowAngle >= relaxedElbowMin && elbowAngle <= relaxedElbowMax;
  
    if (inGoodBackForm && inElbowRange) {
      color = GREEN;
  
      // Looser rep detection (add ±10 buffer to transitions)
      if (exerciseState === 'waiting' && elbowAngle < PUSHUP_ELBOW_ANGLE_MIN + 10) {
        exerciseState = 'down';
        showInPlaceFeedback('Nice! Now push up', GREEN, landmark[11]);
      } else if (exerciseState === 'down' && elbowAngle > PUSHUP_ELBOW_ANGLE_MAX - 10) {
        if (lastExerciseState === 'down') {
          exerciseState = 'up';
          repCount++;
          showInPlaceFeedback('Rep counted! Great effort!', GREEN, landmark[11]);
          setTimeout(() => {
            exerciseState = 'waiting';
            formFeedback.textContent = 'Ready for next rep';
            showInPlaceFeedback('Ready for next rep', GREEN, landmark[11]);
          }, 700);
        }
      }
    }
  
    // Additional form feedback
    const kneesTooLow = (landmark[25].y > landmark[23].y || landmark[26].y > landmark[24].y);
    if (kneesTooLow) {
      showInPlaceFeedback('Lift your knees', RED, landmark[25]);
      showInPlaceFeedback('Lift your knees', RED, landmark[26]);
    }
  
    const feetDistance = calculateDistance(landmark[27], landmark[28]);
    const idealFeetDistance = 0.5;
    const feetTooClose = feetDistance < idealFeetDistance - 0.15; // relaxed
    const feetTooWide = feetDistance > idealFeetDistance + 0.15; // relaxed
  
    if (feetTooClose) {
      showInPlaceFeedback('Spread your feet a bit', RED, landmark[27]);
      showInPlaceFeedback('Spread your feet a bit', RED, landmark[28]);
    }
    if (feetTooWide) {
      showInPlaceFeedback('Bring your feet a bit closer', RED, landmark[27]);
      showInPlaceFeedback('Bring your feet a bit closer', RED, landmark[28]);
    }
  }
  
  // Update feedback and rep counter
  if (feedback.length > 0) {
    formFeedback.textContent = feedback.join(' | ');
    formFeedback.style.color = color; // Set text color based on exercise correctness
  }
  repCounter.textContent = `Reps: ${repCount}`;
  lastExerciseState = exerciseState;
  renderer.render(scene, camera);
  return color;
}
function showInPlaceFeedback(text, color = RED, position = {x: 0.5, y: 0.5}) {
  clearAnnotations();
  const sprite = createTextSprite(text, color);
  sprite.position.set(position.x * 10 - 5, position.y * 10 - 5, 0);
  scene.add(sprite);
  annotations.push(sprite);

  // Automatically remove it after 3s
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    clearAnnotations();
  }, 3000);
}

// Create PoseLandmarker
const createPoseLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
      delegate: "GPU"
    },
    runningMode: runningMode,
    numPoses: 1
  });
  demosSection.classList.remove("invisible");
};

createPoseLandmarker();

// Initialize Three.js


// Setup exercise buttons
squatsButton.addEventListener('click', () => {
  currentExercise = 'squats';
  repCount = 0;
  exerciseState = 'waiting';
  lastExerciseState = 'waiting';
  statusText.textContent = 'Squat Exercise Active';
  formFeedback.textContent = 'Stand with feet shoulder-width apart';
  clearAnnotations();
  if (!webcamRunning) {
    enableCam();
  }
});

pushUpsButton.addEventListener('click', () => {
  currentExercise = 'pushups';
  repCount = 0;
  exerciseState = 'waiting';
  lastExerciseState = 'waiting';
  statusText.textContent = 'Push-Up Exercise Active';
  formFeedback.textContent = 'Get in plank position';
  clearAnnotations();
  if (!webcamRunning) {
    enableCam();
  }
});

// Setup webcam
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const drawingUtils = new DrawingUtils(canvasCtx);

// Check if webcam access is supported
const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection
function enableCam(event) {
  if (!poseLandmarker) {
    console.log("Wait! poseLandmaker not loaded yet.");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "ENABLE WEBCAM";
    // Stop all video streams
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "DISABLE WEBCAM";
  }

  // Set video dimensions
  video.style.width = '100%';
  video.style.height = '100%';
  
  // Set canvas dimensions to match video
  canvasElement.width = video.clientWidth;
  canvasElement.height = video.clientHeight;
  
  // Update Three.js renderer size
  if (renderer) {
    renderer.setSize(video.clientWidth, video.clientHeight);
  }

  const constraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };

  // Activate the webcam stream
  navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
      console.log("Webcam stream obtained successfully");
      video.srcObject = stream;
      video.addEventListener("loadeddata", predictWebcam);
    })
    .catch((err) => {
      console.error("Error accessing webcam:", err);
      alert("Error accessing webcam. Please ensure you have granted camera permissions.");
      webcamRunning = false;
      enableWebcamButton.innerText = "ENABLE WEBCAM";
    });
}

let lastVideoTime = -1;

async function predictWebcam() {
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await poseLandmarker.setOptions({ runningMode: "VIDEO" });
  }
  
  let startTimeMs = performance.now();
  
  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      
      if (result.landmarks && result.landmarks.length > 0) {
        const color = detectExercise(result.landmarks);
        
        // Draw landmarks with the determined color
        for (const landmark of result.landmarks) {
          drawingUtils.drawLandmarks(landmark, {
            radius: 5,
            color: color
          });
          drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {
            color: color
          });
        }
      }
      
      canvasCtx.restore();
    });
  }

  if (webcamRunning === true) {
    window.requestAnimationFrame(predictWebcam);
  }
}

// Handle window resize
window.addEventListener('resize', () => {
  if (renderer) {
    renderer.setSize(video.clientWidth, video.clientHeight);
  }
});


//------------------- Image upload logic---------------------------

const uploadSquat = document.getElementById('uploadSquat');
const uploadPushup = document.getElementById('uploadPushup');
const uploadSquatBtn = document.getElementById('uploadSquatBtn');
const uploadPushupBtn = document.getElementById('uploadPushupBtn');
// Open file dialog on button click
uploadSquatBtn.addEventListener('click', () => uploadSquat.click());
uploadPushupBtn.addEventListener('click', () => uploadPushup.click());

// Handle squat image upload
uploadSquat.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  handleImage(file, "squat");
});

// Handle pushup image upload
uploadPushup.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  handleImage(file, "pushup");
});

async function handleImage(file, type) {
  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = async () => {
    canvasElement.width = img.width;
    canvasElement.height = img.height;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(img, 0, 0);

    if (runningMode === "VIDEO") {
      runningMode = "IMAGE";
      await poseLandmarker.setOptions({ runningMode: "IMAGE" });
    }

    const result = await poseLandmarker.detect(img);

    if (result.landmarks && result.landmarks.length > 0) {
      const color = detectExercise(result.landmarks);
      for (const landmark of result.landmarks) {
        drawingUtils.drawLandmarks(landmark, { radius: 5, color });
        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, { color });
      }

      const feedback = evaluatePose(result.landmarks[0], type);
      formFeedback.textContent = feedback[0];
      formFeedback.style.color = feedback[1];
    } else {
      alert("No pose detected.");
    }
  };
}
function evaluatePose(landmarks,type) {
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  const avgKneeY = (leftKnee.y + rightKnee.y) / 2;
  const avgHipY = (leftHip.y + rightHip.y) / 2;
  const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;

  // Example simple squat check: hips below shoulders, knees bent
  if ((type=="squat") && avgHipY > avgShoulderY && Math.abs(leftKnee.y - leftHip.y) < 0.1 && !(Math.abs(leftShoulder.y - leftHip.y) < 0.1 && Math.abs(leftHip.y - leftKnee.y) < 0.1)) {
    return ["Great! This looks like a good squat.",GREEN];
  }

  // Example simple push-up check: straight body
  if ((type=="pushup") && Math.abs(leftShoulder.y - leftHip.y) < 0.1 && Math.abs(leftHip.y - leftKnee.y) < 0.1 && !(avgHipY > avgShoulderY && Math.abs(leftKnee.y - leftHip.y) < 0.1)) {
    return ["Good push-up posture!",GREEN];
  }

  return ["Pose not clearly correct.",RED];
}
