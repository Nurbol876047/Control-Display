import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Constants
const RADIUS = 230;
const BLUR_STRENGTH = 65;
const LERP_SPEED = 0.28; // High responsiveness
const MAX_HANDS = 2;

// Elements
const video = document.getElementById("webcam");
const canvas = document.getElementById("reveal-canvas");
const ctx = canvas.getContext("2d");
const instruction = document.getElementById("instruction");
const loader = document.getElementById("loader");
const statusCard = document.getElementById("status-card");

let handLandmarker;
let lastVideoTime = -1;
let results = undefined;
let isLoaded = false;

// Hand states
let hands = [
    { x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false },
    { x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false }
];

// Assets
const colorImg = new Image();
const lifeImg = new Image();
colorImg.src = "/color.png";
lifeImg.src = "/life-layer.png";

// Initialization
async function init() {
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: MAX_HANDS
        });

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
             resizeCanvas();
             isLoaded = true;
             loader.classList.add("hidden");
             instruction.innerText = "Ships & People are alive. Explore with both hands!";
             setTimeout(() => { statusCard.style.opacity = "0.4"; }, 3000);
             render();
        });
    } catch (err) {
        console.error("Initialization failed", err);
        instruction.innerText = "Error: Camera access is required.";
        loader.classList.add("hidden");
    }
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);

function render() {
    let nowInMs = Date.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        results = handLandmarker.detectForVideo(video, nowInMs);
    }

    hands.forEach(h => h.active = false);

    if (results && results.landmarks) {
        results.landmarks.forEach((landmarks, index) => {
            if (index < MAX_HANDS) {
                const h = (landmarks[0].x + landmarks[9].x) / 2;
                const v = (landmarks[0].y + landmarks[9].y) / 2;
                hands[index].targetX = (1 - h) * canvas.width;
                hands[index].targetY = v * canvas.height;
                hands[index].active = true;
                if (hands[index].x < -500) {
                    hands[index].x = hands[index].targetX;
                    hands[index].y = hands[index].targetY;
                }
            }
        });
    }

    hands.forEach(h => {
        if (h.active) {
            h.x += (h.targetX - h.x) * LERP_SPEED;
            h.y += (h.targetY - h.y) * LERP_SPEED;
        } else {
            h.x += (-2000 - h.x) * 0.1;
        }
    });

    draw();
    requestAnimationFrame(render);
}

function getLayout(img) {
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = canvas.width / canvas.height;
    let renderW, renderH, offsetX, offsetY;
    if (canvasRatio > imgRatio) {
        renderW = canvas.width;
        renderH = canvas.width / imgRatio;
        offsetX = 0;
        offsetY = (canvas.height - renderH) / 2;
    } else {
        renderH = canvas.height;
        renderW = canvas.height * imgRatio;
        offsetX = (canvas.width - renderW) / 2;
        offsetY = 0;
    }
    return { w: renderW, h: renderH, x: offsetX, y: offsetY };
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!colorImg.complete) return;

    const layout = getLayout(colorImg);
    const visibleHands = hands.filter(h => h.x > -1500);
    if (visibleHands.length === 0) return;

    const time = Date.now();
    const bobOffset = Math.sin(time * 0.0018) * 6; // 6px bobbing for ships

    ctx.save();
    
    // Multi-hand Clipping Path
    ctx.beginPath();
    visibleHands.forEach(h => {
        ctx.moveTo(h.x + RADIUS, h.y);
        ctx.arc(h.x, h.y, RADIUS, 0, Math.PI * 2);
    });
    ctx.closePath();
    ctx.shadowBlur = BLUR_STRENGTH;
    ctx.shadowColor = "rgba(255, 255, 255, 0.45)";
    ctx.clip();

    // 1. Draw STATIC Layer (Architecture, Mountains)
    ctx.drawImage(colorImg, layout.x, layout.y, layout.w, layout.h);

    // 2. Draw ANIMATED 'Life' Layer (Ships, People)
    // Only ships and people bob
    if (lifeImg.complete) {
        ctx.save();
        ctx.translate(0, bobOffset);
        ctx.drawImage(lifeImg, layout.x, layout.y, layout.w, layout.h);
        ctx.restore();
    }

    ctx.restore();

    // Subtle indicators
    visibleHands.forEach(h => {
        ctx.beginPath();
        ctx.arc(h.x, h.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fill();
    });
}

init();
