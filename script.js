const videoElement = document.getElementsByClassName("input_video")[0];
const canvasElement = document.getElementsByClassName("output_canvas")[0];
const canvasCtx = canvasElement.getContext("2d");

videoElement.style.cssText =
  "-moz-transform: scale(-1, 1); \
-webkit-transform: scale(-1, 1); -o-transform: scale(-1, 1); \
transform: scale(-1, 1); filter: FlipH;";

let jewelryImage = new Image();

const imagesList = document.querySelector("#imageList");

const imageInput = document.querySelector("#imageInput");

let selectedImageId = "";

const images = [];

let currentTimeEnd;
let FPS;
let startShakingTime;

let JewelryWidth;
let JewelryHeight;
const faceHeight = 112; //mm

// let xAccelerationThreshold = 0.5;
let xVelocityThreshold = 0.1;

let startShaking = false;
let startDumping = false;

let shakingAngle = 0;
let shakingPeriod = 750; //ms
let angleAmplitude = 0.2; //rad

const gamma = 0.0004;
let dumpingCoef = 1;

const numShakingPeriods = 5;

const canvasWidth = canvasElement.width;
const canvasHeight = canvasElement.height;

function updateSelectOptions(data) {
  imagesList.textContent = "";

  data.forEach((image) => {
    const option = document.createElement("option");
    option.setAttribute("data-id", image.id);
    option.textContent = image.name;

    if (image.id === selectedImageId) option.selected = true;

    imagesList.append(option);
  });
  updateSelectOptions;
}

function onFileSelected(event) {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onloadend = function (e) {
    const {
      target: { result },
    } = e;
    const { name } = file;

    images.unshift({ id: `${images.length}-${name}`, name, src: result });

    updateSelectOptions(images);
  };
  reader.readAsDataURL(file);
}

imageInput.addEventListener("change", onFileSelected);

//Aspect ratio
let aspectRatio;
jewelryImage.addEventListener("load", () => {
  aspectRatio = jewelryImage.naturalHeight / jewelryImage.naturalWidth;
});

let exponentialSmoothing = 0.5;

const jewelryWidthRatio = 0.1;

const finalVideoRatio = 1;

const elongationX = 0.4;
const elongationY = 2.8;

let userInputEarringHeight; // mm

let i = 0;
let totalCounts = 0;

let poseLandmarks93SmoothedX = [];
let poseLandmarks93SmoothedY = [];
let poseLandmarks137SmoothedX = [];
let poseLandmarks137SmoothedY = [];
let poseLandmarks123SmoothedX = [];
let poseLandmarks123SmoothedY = [];
let poseLandmarks352SmoothedX = [];
let poseLandmarks352SmoothedY = [];
let poseLandmarks366SmoothedX = [];
let poseLandmarks366SmoothedY = [];
let poseLandmarks323SmoothedX = [];
let poseLandmarks323SmoothedY = [];

let poseLandmarks132SmoothedY = [];
let poseLandmarks361SmoothedY = [];

let xVelocity;
let xVelocityArray = [];

//Draw keypoints
function drawKeyPoint(landmarks, num, color = "orange", radius = 5) {
  drawPoint(
    landmarks[num].x * videoElement.videoWidth * finalVideoRatio,
    landmarks[num].y * videoElement.videoHeight * finalVideoRatio,
    String(num),
    color,
    radius
  );
}

function drawPoint(x, y, label = true, color = "orange", size = 5) {
  // if (color == null) {
  //   color = "#000";
  // }

  // if (size == null) {
  //   size = 5;
  // }

  let radius = 0.5 * size;

  // to increase smoothing for numbers with decimal part
  let pointX = Math.round(x - radius);
  let pointY = Math.round(y - radius);

  canvasCtx.beginPath();
  canvasCtx.fillStyle = color;
  canvasCtx.fillRect(pointX, pointY, size, size);
  canvasCtx.fill();

  if (label) {
    let textX = Math.round(x);
    let textY = Math.round(pointY - 5);

    canvasCtx.font = "Italic 14px Arial";
    canvasCtx.fillStyle = color;
    canvasCtx.textAlign = "center";
    canvasCtx.fillText(label, textX, textY);
  }
}

function drawEarring(
  outterLandMarkX,
  middleLandmarkX,
  innerLandMarkX,
  outterLandMarkY,
  middleLandmarkY,
  innerLandMarkY,
  jewelryImage,
  side,
  angle
) {
  let drawCondition;
  if (side === "left") {
    drawCondition = innerLandMarkX > outterLandMarkX;
  } else if (side === "right") {
    drawCondition = outterLandMarkX > innerLandMarkX;
  }

  if (drawCondition) {
    let CenterX;

    if (middleLandmarkX - outterLandMarkX > 0) {
      CenterX =
        outterLandMarkX - (middleLandmarkX - outterLandMarkX) * elongationX;
    } else {
      CenterX =
        outterLandMarkX + (outterLandMarkX - middleLandmarkX) * elongationX;
    }

    let dy;

    dy = outterLandMarkY - (outterLandMarkY - middleLandmarkY) * (0.4 - (middleLandmarkY - innerLandMarkY)*10);


    canvasCtx.translate(
      CenterX * canvasElement.width,
      dy * canvasElement.height
    );
    
    canvasCtx.rotate(angle);
    if (side == 'right'){
      canvasCtx.scale(-1, 1);
    }
    canvasCtx.drawImage(
      jewelryImage,
      (-JewelryWidth / 2.8) * canvasElement.width,
      0,
      JewelryWidth * canvasElement.width,
      JewelryHeight * canvasElement.width
    );

    canvasCtx.rotate(-angle);

    canvasCtx.translate(
      -CenterX * canvasElement.width,
      -dy * canvasElement.height
    );
  }
}

function smoothArray(smoothedArray, previousValue, currentValue) {
  return smoothedArray.push(
    previousValue * exponentialSmoothing +
      currentValue * (1 - exponentialSmoothing)
  );
}

function userInput(elemntId) {
  let variable = document.getElementById(elemntId).value;
  return variable;
}

function onResults(results) {
  document.body.classList.add("loaded");

  canvasCtx.save();

  canvasElement.width = videoElement.videoWidth * finalVideoRatio;
  canvasElement.height = videoElement.videoHeight * finalVideoRatio;

  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  userInputEarringHeight = userInput("earringHeight") || 30; //mm

  if (results.multiFaceLandmarks) {
    const option = imagesList.options[imagesList.selectedIndex];
    const imageId = option && option.dataset.id;
    selectedImageId = imageId;
    const image = images.find((elem) => elem.id === imageId) || {};

    jewelryImage.src = image.src || "";

    const canvasAspectRatio = canvasElement.height / canvasElement.width;

    for (const landmarks of results?.multiFaceLandmarks) {
      // drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {
      //   color: "#C0C0C070",
      //   lineWidth: 1,
      // });

      if (i === 0) {
        poseLandmarks93SmoothedX.push(landmarks[93].x);
        poseLandmarks93SmoothedY.push(landmarks[93].y);
        poseLandmarks137SmoothedX.push(landmarks[137].x);
        poseLandmarks137SmoothedY.push(landmarks[137].y);
        poseLandmarks123SmoothedX.push(landmarks[123].x);
        poseLandmarks123SmoothedY.push(landmarks[123].y);
        poseLandmarks352SmoothedX.push(landmarks[352].x);
        poseLandmarks352SmoothedY.push(landmarks[352].y);
        poseLandmarks366SmoothedX.push(landmarks[366].x);
        poseLandmarks366SmoothedY.push(landmarks[366].y);
        poseLandmarks323SmoothedX.push(landmarks[323].x);
        poseLandmarks323SmoothedY.push(landmarks[323].y);

        poseLandmarks132SmoothedY.push(landmarks[132].y);
        poseLandmarks361SmoothedY.push(landmarks[361].y);

        xVelocityArray.push(0);
        // xAccelerationArray.push(0);
      } else {
        smoothArray(
          poseLandmarks93SmoothedX,
          poseLandmarks93SmoothedX[poseLandmarks93SmoothedX.length - 1],
          landmarks[93].x
        );

        smoothArray(
          poseLandmarks93SmoothedY,
          poseLandmarks93SmoothedY[poseLandmarks93SmoothedY.length - 1],
          landmarks[93].y
        );

        smoothArray(
          poseLandmarks137SmoothedX,
          poseLandmarks137SmoothedX[poseLandmarks137SmoothedX.length - 1],
          landmarks[137].x
        );

        smoothArray(
          poseLandmarks137SmoothedY,
          poseLandmarks137SmoothedY[poseLandmarks137SmoothedY.length - 1],
          landmarks[137].y
        );

        smoothArray(
          poseLandmarks123SmoothedX,
          poseLandmarks123SmoothedX[poseLandmarks123SmoothedX.length - 1],
          landmarks[123].x
        );

        smoothArray(
          poseLandmarks123SmoothedY,
          poseLandmarks123SmoothedY[poseLandmarks123SmoothedY.length - 1],
          landmarks[123].y
        );

        smoothArray(
          poseLandmarks352SmoothedX,
          poseLandmarks352SmoothedX[poseLandmarks352SmoothedX.length - 1],
          landmarks[352].x
        );

        smoothArray(
          poseLandmarks352SmoothedY,
          poseLandmarks352SmoothedY[poseLandmarks352SmoothedY.length - 1],
          landmarks[352].y
        );

        smoothArray(
          poseLandmarks366SmoothedX,
          poseLandmarks366SmoothedX[poseLandmarks366SmoothedX.length - 1],
          landmarks[366].x
        );

        smoothArray(
          poseLandmarks366SmoothedY,
          poseLandmarks366SmoothedY[poseLandmarks366SmoothedY.length - 1],
          landmarks[366].y
        );

        smoothArray(
          poseLandmarks323SmoothedX,
          poseLandmarks323SmoothedX[poseLandmarks323SmoothedX.length - 1],
          landmarks[323].x
        );

        smoothArray(
          poseLandmarks323SmoothedY,
          poseLandmarks323SmoothedY[poseLandmarks323SmoothedY.length - 1],
          landmarks[323].y
        );

        smoothArray(
          poseLandmarks132SmoothedY,
          poseLandmarks132SmoothedY[poseLandmarks132SmoothedY.length - 1],
          landmarks[132].y
        );

        smoothArray(
          poseLandmarks361SmoothedY,
          poseLandmarks361SmoothedY[poseLandmarks361SmoothedY.length - 1],
          landmarks[361].y
        );
        // xDrift =
        //   (poseLandmarks123SmoothedX[i] -
        //     poseLandmarks123SmoothedX[i - 1] +
        //     poseLandmarks352SmoothedX[i] -
        //     poseLandmarks352SmoothedX[i - 1]) /
        //   2;

        // console.log("xDrift", xDrift);

        xVelocity =
          (Math.abs(
            poseLandmarks123SmoothedX[poseLandmarks123SmoothedX.length - 1] -
              poseLandmarks123SmoothedX[poseLandmarks123SmoothedX.length - 2]
          ) +
            Math.abs(
              poseLandmarks352SmoothedX[poseLandmarks352SmoothedX.length - 1] -
                poseLandmarks352SmoothedX[poseLandmarks352SmoothedX.length - 2]
            )) *
          FPS;

        //console.log("xVelocity", xVelocity);

        smoothArray(
          xVelocityArray,
          xVelocityArray[xVelocityArray.length - 1],
          xVelocity
        );
      }

      JewelryHeight =
        (userInputEarringHeight / faceHeight) *
        (landmarks[152].y - landmarks[168].y) *
        canvasAspectRatio;
      console.log(JewelryHeight * canvasElement.width);
      JewelryWidth = JewelryHeight / aspectRatio;

      // if (
      //   xVelocityArray[xVelocityArray.length - 1] > xVelocityThreshold &&
      //   startShaking === false
      // ) {
      //   startShakingTime = Date.now();
      //   startDumpingTime = Date.now();
      //   startShaking = true;
      // }

      // if (
      //   startShaking === true &&
      //   Date.now() - startShakingTime < numShakingPeriods * shakingPeriod
      // ) {
      //   shakingAngle =
      //     angleAmplitude *
      //     Math.cos(
      //       ((2 * Math.PI) / shakingPeriod) * (Date.now() - startShakingTime) +
      //         Math.PI / 2
      //     );
      // }

      // if (
      //   startShaking === true &&
      //   Date.now() - startShakingTime > 4 * shakingPeriod
      // ) {
      //   startShaking = false;
      //   shakingAngle = 0;
      // }

      if (
        xVelocityArray[xVelocityArray.length - 1] > xVelocityThreshold &&
        startShaking === false
      ) {
        startShakingTime = Date.now();
        startDumpingTime = Date.now();
        startShaking = true;
      }

      if (
        startShaking === true &&
        Date.now() - startShakingTime < numShakingPeriods * shakingPeriod
      ) {
        // if (
        //   xVelocityArray[xVelocityArray.length - 1] < xVelocityThreshold &&
        //   xVelocityArray[xVelocityArray.length - 2] > xVelocityThreshold
        // ) {
        //   let startDumpingTime = Date.now();
        //   startDumping = true;
        //   if (startDumping === true) {
        //     dumpingCoef = Math.exp(-gamma * (Date.now() - startDumpingTime));
        //   } else {
        //     dumpingCoef = 1;
        //   }
        // }

        // if (xVelocityArray[xVelocityArray.length - 1] > xVelocityThreshold) {
        //   startDumping = false;
        // }

        if (xVelocityArray[xVelocityArray.length - 1] > xVelocityThreshold) {
          startDumpingTime = Date.now();
        }

        dumpingCoef = Math.exp(-gamma * (Date.now() - startDumpingTime));

        //console.log("dumpingCoef", dumpingCoef);

        shakingAngle =
          angleAmplitude *
          dumpingCoef *
          Math.cos(
            ((2 * Math.PI) / shakingPeriod) * (Date.now() - startShakingTime) +
              Math.PI / 2
          );
      }

      if (
        startShaking === true &&
        Date.now() - startShakingTime > numShakingPeriods * shakingPeriod
      ) {
        startShaking = false;
        shakingAngle = 0;
      }

      drawEarring(
        poseLandmarks93SmoothedX[poseLandmarks93SmoothedX.length - 1],
        poseLandmarks137SmoothedX[poseLandmarks137SmoothedX.length - 1],
        poseLandmarks123SmoothedX[poseLandmarks123SmoothedX.length - 1],
        poseLandmarks132SmoothedY[poseLandmarks132SmoothedY.length - 1],
        poseLandmarks93SmoothedY[poseLandmarks93SmoothedY.length - 1],
        poseLandmarks123SmoothedY[poseLandmarks123SmoothedY.length - 1],
        jewelryImage,
        "left",
        shakingAngle
      );

      drawEarring(
        poseLandmarks323SmoothedX[poseLandmarks323SmoothedX.length - 1],
        poseLandmarks366SmoothedX[poseLandmarks366SmoothedX.length - 1],
        poseLandmarks352SmoothedX[poseLandmarks352SmoothedX.length - 1],
        poseLandmarks361SmoothedY[poseLandmarks361SmoothedY.length - 1],
        poseLandmarks323SmoothedY[poseLandmarks323SmoothedY.length - 1],
        poseLandmarks352SmoothedY[poseLandmarks352SmoothedY.length - 1],
        jewelryImage,
        "right",
        shakingAngle
      );

      //drawKeyPoint(landmarks, 93);
      //drawKeyPoint(landmarks, 137);
      //drawKeyPoint(landmarks, 323);
      //drawKeyPoint(landmarks, 366);
      //drawKeyPoint(landmarks, 123);
      //drawKeyPoint(landmarks, 352);

      //drawKeyPoint(landmarks, 132);
      //drawKeyPoint(landmarks, 361);
    }

    if (i > 1) {
      poseLandmarks93SmoothedX.shift();
      poseLandmarks93SmoothedY.shift();
      poseLandmarks137SmoothedX.shift();
      poseLandmarks137SmoothedY.shift();
      poseLandmarks123SmoothedX.shift();
      poseLandmarks123SmoothedY.shift();
      poseLandmarks352SmoothedX.shift();
      poseLandmarks352SmoothedY.shift();
      poseLandmarks366SmoothedX.shift();
      poseLandmarks366SmoothedY.shift();
      poseLandmarks323SmoothedX.shift();
      poseLandmarks323SmoothedY.shift();

      poseLandmarks132SmoothedY.shift();
      poseLandmarks361SmoothedY.shift();
      xVelocityArray.shift();
    }
    i++;
  }
  canvasCtx.restore();

  totalCounts++;
  //console.log(totalCounts);

  currentTimeEnd = Date.now();

  FPS = (totalCounts / (currentTimeEnd - startTime)) * 1000; //time in miliseconds
  //console.log("FPS", FPS);

  exponentialSmoothing = Math.min(0.01 * FPS + 0.16, 0.9);
}

const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.3.1620248508/${file}`;
  },
});
faceMesh.setOptions({
  selfieMode: true,
  maxNumFaces: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});
faceMesh.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({ image: videoElement });
  },
});

startTime = Date.now();
camera.start();
