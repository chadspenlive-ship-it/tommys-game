const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const speedText = document.getElementById("speedText");
const wantedText = document.getElementById("wantedText");
const soundButton = document.getElementById("soundButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const gameShell = document.querySelector(".game-shell");

const TWO_PI = Math.PI * 2;
const activeTouches = new Map();
const skidMarks = [];
const tireSmoke = [];
const explosions = [];
const environmentObjects = new Map();
const boostPads = new Map();
const ramps = new Map();
const cones = new Map();
const trafficCars = new Map();

const LANE_WIDTH = 118;
const ROAD_LANES = 4;
const ROAD_HALF_WIDTH = LANE_WIDTH * ROAD_LANES * 0.5 + 74;
const TRAFFIC_TILE_SIZE = 620;
const CLOSURE_TILE_SIZE = 1400;
const LAND_TILE_SIZE = 420;
const BOOST_INTERVAL = 32000;
const TUNNEL_INTERVAL = 240000;
const TUNNEL_LENGTH = 2700;
const RAMP_INTERVAL = 5200;
const MILE_LENGTH = 8800;
const ARENA_LIMIT = 2100;
const FINAL_ARENA_LIMIT = 2850;
const CAMERA_ZOOM = 0.5;
const BOSS_SPEED_SCALE = 0.7;
const BOSS_TURN_SPEED_SCALE = 0.55;
const BOSS_TURN_SWITCH_PAUSE = 1;
const PLAYER_CAR_WIDTH = 78;
const PLAYER_CAR_LENGTH = 170;

const LEVELS = [
  {
    name: "Level 1",
    miles: 6,
    trafficDensity: 0.7,
    policeThreshold: 5,
    boosts: 7,
    training: { pass: 0.5, curves: 1 },
    boss: { name: "Big Combine", type: "combine", hits: 3, crushes: 3, allowSideHits: true },
  },
  {
    name: "Level 2",
    miles: 9,
    trafficDensity: 0.8,
    policeThreshold: 5,
    boosts: 8,
    training: { pass: 0.6, curves: 2 },
    boss: { name: "Big Monster Truck", type: "monster", hits: 5, crushes: 2, allowSideHits: false },
  },
  {
    name: "Level 3",
    miles: 12,
    trafficDensity: 0.9,
    policeThreshold: 4,
    boosts: 9,
    training: { pass: 0.7, curves: 3 },
    boss: { name: "Big Bulldozer", type: "dozer", hits: 7, crushes: 2, allowSideHits: false },
  },
  {
    name: "Level 4",
    miles: 15,
    trafficDensity: 1,
    policeThreshold: 3,
    boosts: 10,
    training: { pass: 0.8, curves: 4 },
    boss: { name: "Huge Semi-Truck", type: "semi", hits: 9, crushes: 1, allowSideHits: false },
  },
  {
    name: "Final Boss",
    miles: 0,
    trafficDensity: 0,
    policeThreshold: 99,
    boosts: 0,
    training: null,
    boss: { name: "The Four-Boss Smash", type: "final", hits: 3, crushes: 3, allowSideHits: true },
  },
];

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = performance.now();
let audio = null;
let audioEnabled = false;
let panModeIndex = 3;
let speedBaseMode = "center";
let explodedCarCount = 0;
let wantedStars = 0;
let overlayButton = null;
let overlayButtons = [];
let missionMenuDrag = null;
const PAN_MODES = [
  { label: "Pan Off", value: 0 },
  { label: "Pan Half", value: 0.5 },
  { label: "Pan On", value: 1 },
  { label: "Pan Speed", value: "speed" },
];

const MISSIONS = [
  {
    id: "grocery",
    title: "Grocery Pickup",
    subtitle: "Exit the highway, park at stall 7, load up, and return home.",
    stallNumber: 7,
    home: { x: 0, y: 720 },
    store: { x: 1040, y: -4200 },
    lot: { x: 1040, y: -3760 },
    exitY: -3060,
  },
];

const gameState = {
  phase: "start",
  levelIndex: 0,
  raceStartY: 0,
  raceFinishY: -MILE_LENGTH * 2,
  policeCalled: false,
  message: "",
  messageSub: "",
  fade: 1,
  fadeDirection: -1,
  demoTime: 0,
  trainingFinishY: 0,
  trainingTotalCones: 0,
  trainingPassed: false,
  bosses: [],
  bossIntroSeen: false,
  playerBossHits: 0,
  levelCompleteText: "",
  missionMenuScroll: 0,
  activeMissionId: null,
  missionStep: "none",
  missionStall: 0,
  missionNoticeTimer: 0,
  missionCartProgress: 0,
};

const car = {
  x: 0,
  y: 0,
  angle: 0,
  speed: 0,
  lastSpeed: 0,
  targetSpeed: 0,
  vx: 0,
  vy: 0,
  lateralSpeed: 0,
  gear: 1,
  turboTimer: 0,
  jumpTimer: 0,
  jumpDuration: 0,
  jumpPower: 0,
  jumpLanded: false,
  sensed: false,
  brakeGlow: 0,
  skid: 0,
  width: PLAYER_CAR_WIDTH,
  length: PLAYER_CAR_LENGTH,
  previousTouchX: null,
  previousTouchY: null,
};

const world = {
  x: 0,
  y: 0,
  cycle: 0,
  hill: 0,
};

const cop = {
  active: false,
  pending: false,
  pendingTimer: 0,
  exploded: false,
  outrunTimer: 0,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  speed: 0,
  angle: 0,
  width: 74,
  length: 178,
  color: "#f5f8ff",
  horn: 0,
  noisePitch: 1.7,
};

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.floor(window.innerWidth);
  height = Math.floor(window.innerHeight);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function wrap(value, size) {
  return ((value % size) + size) % size;
}

function getCurrentLevel() {
  return LEVELS[gameState.levelIndex] || LEVELS[0];
}

function isRacePhase() {
  return gameState.phase === "race";
}

function isDrivingPhase() {
  return gameState.phase === "race" || gameState.phase === "training" || gameState.phase === "boss" || gameState.phase === "mission";
}

function setControlBaseMode(mode) {
  speedBaseMode = mode;
}

function getPlayerWorld() {
  return screenToWorld(car.x, car.y);
}

function angleLerp(a, b, t) {
  let diff = ((b - a + Math.PI) % TWO_PI) - Math.PI;
  return a + diff * t;
}

function angleDistance(a, b) {
  return Math.abs(((b - a + Math.PI) % TWO_PI) - Math.PI);
}

function screenToWorld(x, y) {
  return {
    x: world.x + (x - width / 2) / CAMERA_ZOOM,
    y: world.y + (y - height / 2) / CAMERA_ZOOM,
  };
}

function worldToScreen(x, y) {
  return {
    x: (x - world.x) * CAMERA_ZOOM + width / 2,
    y: (y - world.y) * CAMERA_ZOOM + height / 2,
  };
}

function getWorldHalfWidth() {
  return width / (2 * CAMERA_ZOOM);
}

function getWorldHalfHeight() {
  return height / (2 * CAMERA_ZOOM);
}

function getWorldViewportMax() {
  return Math.max(width, height) / CAMERA_ZOOM;
}

function applyWorldTransform() {
  ctx.translate(width / 2, height / 2);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.translate(-world.x, -world.y);
}

function getSpeedBasePoint() {
  return speedBaseMode === "bottom"
    ? { x: width / 2, y: height * 0.84 }
    : { x: width / 2, y: height / 2 };
}

function getPanBlend() {
  const mode = PAN_MODES[panModeIndex];
  if (mode.value !== "speed") {
    return mode.value;
  }

  const displayedSpeed = Math.abs(car.speed) / 8;
  return 1 - clamp(displayedSpeed / 100, 0, 1);
}

function getTouchState() {
  const points = [...activeTouches.values()];
  if (!points.length) {
    return null;
  }

  let cx = 0;
  let cy = 0;
  for (const point of points) {
    cx += point.x;
    cy += point.y;
  }
  cx /= points.length;
  cy /= points.length;

  let angle = car.angle;
  let doorDistance = car.width;
  if (points.length >= 2) {
    let bestA = points[0];
    let bestB = points[1];
    let bestDistance = 0;
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const distance = dx * dx + dy * dy;
        if (distance > bestDistance) {
          bestDistance = distance;
          bestA = points[i];
          bestB = points[j];
        }
      }
    }
    doorDistance = Math.sqrt(bestDistance);
    const doorAxis = Math.atan2(bestB.y - bestA.y, bestB.x - bestA.x);
    const optionA = doorAxis;
    const optionB = doorAxis + Math.PI;
    angle = angleDistance(car.angle, optionA) <= angleDistance(car.angle, optionB) ? optionA : optionB;
  } else {
    angle = Math.atan2(cy - height / 2, cx - width / 2) + Math.PI / 2;
  }

  return { x: cx, y: cy, angle, count: points.length, doorDistance };
}

function updateCar(dt) {
  const touchState = getTouchState();
  car.sensed = Boolean(touchState);

  if (touchState) {
    const oldCarX = car.x || touchState.x;
    const oldCarY = car.y || touchState.y;
    car.x = lerp(car.x || touchState.x, touchState.x, 0.286);
    car.y = lerp(car.y || touchState.y, touchState.y, 0.286);
    car.angle = angleLerp(car.angle, touchState.angle, 0.364);
    const speedBase = getSpeedBasePoint();
    const dx = touchState.x - speedBase.x;
    const dy = touchState.y - speedBase.y;
    const maxDistance = speedBaseMode === "bottom" ? height * 0.72 : Math.min(width, height) * 0.44;
    const forwardX = Math.sin(car.angle);
    const forwardY = -Math.cos(car.angle);
    const rightX = Math.cos(car.angle);
    const rightY = Math.sin(car.angle);
    const projectedDistance = dx * forwardX + dy * forwardY;
    let drive = clamp(projectedDistance / maxDistance, -1, 1);
    if (Math.abs(drive) < 0.045) {
      drive = 0;
    }

    const panBlend = getPanBlend();
    if (panBlend > 0 && car.previousTouchX !== null && car.previousTouchY !== null) {
      const carDeltaX = car.x - oldCarX;
      const carDeltaY = car.y - oldCarY;
      const tangentDelta = carDeltaX * rightX + carDeltaY * rightY;
      world.x -= rightX * tangentDelta * panBlend;
      world.y -= rightY * tangentDelta * panBlend;
    }

    car.previousTouchX = touchState.x;
    car.previousTouchY = touchState.y;

    const hillDrag = gameState.phase === "training" || gameState.phase === "boss" ? 1 : 1 - Math.max(world.hill, 0) * 0.14;
    const turbo = car.turboTimer > 0 ? 1.5 : 1;
    const trainingControl = gameState.phase === "training" ? 0.5 : 1;
    const arenaControl = gameState.phase === "boss" ? 0.74 : 1;
    car.targetSpeed = drive * 1650 * hillDrag * turbo * trainingControl * arenaControl;
  } else {
    car.previousTouchX = null;
    car.previousTouchY = null;
    car.targetSpeed = 0;
  }

  const forwardX = Math.sin(car.angle);
  const forwardY = -Math.cos(car.angle);
  const rightX = Math.cos(car.angle);
  const rightY = Math.sin(car.angle);
  const currentForward = car.vx * forwardX + car.vy * forwardY;
  const currentSide = car.vx * rightX + car.vy * rightY;
  const forwardSpeed = lerp(currentForward, car.targetSpeed, 1 - Math.exp(-dt * (car.sensed ? 4.2 : 1.35)));
  const sideSpeed = currentSide * Math.exp(-dt * 5.5);
  car.vx = forwardX * forwardSpeed + rightX * sideSpeed;
  car.vy = forwardY * forwardSpeed + rightY * sideSpeed;
  car.speed = forwardSpeed;
  car.lateralSpeed = sideSpeed;

  const speedAbs = Math.abs(car.speed);
  const lastSpeedAbs = Math.abs(car.lastSpeed);
  const decel = Math.max(0, lastSpeedAbs - speedAbs);
  car.brakeGlow = clamp(car.brakeGlow * Math.exp(-dt * 2.8) + decel / 140, 0, 1);

  const sideGrip = clamp(Math.abs(car.lateralSpeed) / 240, 0, 1) * 0.8;
  const fastTurn = clamp(speedAbs / 560, 0, 1) * sideGrip;
  const brakeSkid = car.brakeGlow * clamp(speedAbs / 360, 0, 1);
  car.skid = clamp(fastTurn + brakeSkid, 0, 1);

  world.x += car.vx * dt;
  world.y += car.vy * dt;
  constrainTunnelDriving();
  updateJump(dt);
  if (car.turboTimer > 0) {
    car.turboTimer = Math.max(0, car.turboTimer - dt);
  }
  world.cycle += dt * 0.028 + (speedAbs / 90000) * dt;
  world.hill = sampleHill(world.x, world.y);

  if (car.skid > 0.13 && speedAbs > 70) {
    addSkidMarks();
  }

  car.lastSpeed = car.speed;
  updateAudio();
}

function constrainTunnelDriving() {
  if (!isRacePhase()) {
    return;
  }
  const playerWorld = screenToWorld(car.x, car.y);
  if (!getTunnelAt(playerWorld.y)) {
    return;
  }

  const maxOffset = ROAD_HALF_WIDTH - car.width * 0.6;
  const center = roadCenterX(playerWorld.y);
  const offset = clamp(playerWorld.x - center, -maxOffset, maxOffset);
  const correctedPlayerX = center + offset;
  world.x += correctedPlayerX - playerWorld.x;
  const roadHeading = roadAngle(playerWorld.y);
  const rightX = Math.cos(roadHeading);
  const rightY = Math.sin(roadHeading);
  const sideSpeed = car.vx * rightX + car.vy * rightY;
  car.vx -= rightX * sideSpeed * 0.65;
  car.vy -= rightY * sideSpeed * 0.65;
}

function updateJump(dt) {
  if (car.jumpTimer <= 0) {
    return;
  }

  car.jumpTimer = Math.max(0, car.jumpTimer - dt);
  if (car.jumpTimer <= 0 && !car.jumpLanded) {
    car.jumpLanded = true;
    explodeLandingTraffic();
    return;
  }

  if (car.jumpTimer <= 0) {
    car.jumpDuration = 0;
    car.jumpPower = 0;
    car.jumpLanded = false;
  }
}

function getJumpProgress() {
  if (car.jumpDuration <= 0 || car.jumpTimer <= 0) {
    return 0;
  }
  return clamp(1 - car.jumpTimer / car.jumpDuration, 0, 1);
}

function getJumpHeight() {
  const progress = getJumpProgress();
  return Math.sin(progress * Math.PI) * car.jumpPower;
}

function getWorldJumpScale() {
  return 1 - clamp(getJumpHeight() / 185, 0, 0.24);
}

function applyWorldJumpTransform() {
  const scale = getWorldJumpScale();
  if (scale >= 0.995) {
    return;
  }
  ctx.translate(car.x, car.y);
  ctx.scale(scale, scale);
  ctx.translate(-car.x, -car.y);
}

function startJump(power) {
  car.jumpDuration = 1.35 + power * 0.55;
  car.jumpTimer = car.jumpDuration;
  car.jumpPower = 58 + power * 82;
  car.jumpLanded = false;
  playRampTone(power);
}

function explodeLandingTraffic() {
  if (!isRacePhase()) {
    return;
  }
  const playerWorld = screenToWorld(car.x, car.y);
  for (const traffic of [...trafficCars.values()]) {
    const distance = Math.hypot(traffic.x - playerWorld.x, traffic.y - playerWorld.y);
    if (distance < (traffic.length + car.length) * 0.32) {
      explodeTrafficCar(traffic, 1.1);
    }
  }
  if (cop.active && Math.hypot(cop.x - playerWorld.x, cop.y - playerWorld.y) < (cop.length + car.length) * 0.34) {
    explodeCop(1.15);
  }
}

function sampleHill(x, y) {
  return (
    Math.sin(x * 0.0016) * 0.48 +
    Math.cos(y * 0.0012) * 0.34 +
    Math.sin((x + y) * 0.00085) * 0.18
  );
}

function hashNumber(x, y, salt) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 2147483647);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function roadCenterX(y) {
  return Math.sin(y * 0.00115) * 145 + Math.sin(y * 0.00043 + 1.8) * 235;
}

function roadSlope(y) {
  return Math.cos(y * 0.00115) * 145 * 0.00115 + Math.cos(y * 0.00043 + 1.8) * 235 * 0.00043;
}

function roadAngle(y) {
  return Math.atan2(roadSlope(y), 1);
}

function clampAngleNear(angle, center, limit) {
  const diff = ((angle - center + Math.PI) % TWO_PI) - Math.PI;
  return center + clamp(diff, -limit, limit);
}

function laneCenterX(lane, y) {
  return roadCenterX(y) + (lane - (ROAD_LANES - 1) / 2) * LANE_WIDTH;
}

function closedLaneForBand(band) {
  const chance = hashNumber(11, band, 2);
  if (chance > 0.34) {
    return -1;
  }
  return Math.min(ROAD_LANES - 1, Math.floor(hashNumber(17, band, 4) * ROAD_LANES));
}

function isOffRoad(x, y, padding = 36) {
  return Math.abs(x - roadCenterX(y)) > ROAD_HALF_WIDTH + padding;
}

function tunnelStartForBand(band) {
  return band * TUNNEL_INTERVAL + 10000 + hashNumber(101, band, 3) * 6000;
}

function getTunnelAt(y) {
  const band = Math.floor(y / TUNNEL_INTERVAL);
  for (let b = band - 1; b <= band + 1; b += 1) {
    const start = tunnelStartForBand(b);
    if (y >= start && y <= start + TUNNEL_LENGTH) {
      return { start, end: start + TUNNEL_LENGTH, band: b };
    }
  }
  return null;
}

function rampForBand(band) {
  const y = band * RAMP_INTERVAL + 950 + hashNumber(121, band, 5) * 2400;
  const side = hashNumber(127, band, 7) > 0.5 ? 1 : -1;
  return {
    key: `ramp:${band}`,
    x: roadCenterX(y) + side * (ROAD_HALF_WIDTH - 34),
    y,
    side,
    angle: roadAngle(y) + side * 0.72,
  };
}

function addWantedStar() {
  wantedStars = Math.min(5, wantedStars + 1);
  explodedCarCount = wantedStars;
  const threshold = getCurrentLevel().policeThreshold;
  if ((isRacePhase() || gameState.phase === "mission") && wantedStars >= threshold && !cop.active && !cop.pending) {
    startCopChase();
  }
}

function drawWheel(x, y, rx, ry, rotation = 0, hubColor = "#6d7478") {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = "#111416";
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TWO_PI);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = Math.max(3, Math.min(rx, ry) * 0.13);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.13)";
  ctx.lineWidth = 3;
  for (let t = -0.55; t <= 0.56; t += 0.28) {
    ctx.beginPath();
    ctx.moveTo(-rx * 0.78, t * ry);
    ctx.lineTo(rx * 0.78, t * ry);
    ctx.stroke();
  }
  ctx.fillStyle = hubColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.38, ry * 0.38, 0, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

function drawVehicleShape(vehicle, isPlayer = false) {
  const w = vehicle.width;
  const h = vehicle.length;
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  roundedRect(-w * 0.55 + 6, -h * 0.5 + 8, w * 1.1, h, w * 0.18);
  ctx.fill();

  const wheelY = vehicle.personality === "tractor" ? [-h * 0.25, h * 0.3] : [-h * 0.3, h * 0.31];
  for (const x of [-w * 0.52, w * 0.52]) {
    for (const y of wheelY) {
      const rearScale = y > 0 && vehicle.personality === "tractor" ? 1.35 : 1;
      drawWheel(x, y, w * 0.11 * rearScale, h * 0.11 * rearScale, 0, "#697176");
    }
  }

  const body = isPlayer ? "rgba(18, 31, 40, 0.24)" : vehicle.color;
  ctx.fillStyle = body;
  roundedRect(-w * 0.46, -h * 0.5, w * 0.92, h, w * 0.17);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  roundedRect(-w * 0.34, -h * 0.48, w * 0.68, h * 0.16, w * 0.1);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  roundedRect(-w * 0.36, h * 0.2, w * 0.72, h * 0.22, w * 0.1);
  ctx.fill();

  if (vehicle.personality === "sweeper") {
    ctx.fillStyle = "#f2a93b";
    roundedRect(-w * 0.52, -h * 0.58, w * 1.04, h * 0.18, 10);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,20,20,0.55)";
    ctx.lineWidth = 5;
    for (let x = -w * 0.48; x <= w * 0.48; x += 13) {
      ctx.beginPath();
      ctx.moveTo(x, -h * 0.58);
      ctx.lineTo(x + 8, -h * 0.44);
      ctx.stroke();
    }
  } else if (vehicle.personality === "tractor") {
    ctx.fillStyle = "#20251e";
    roundedRect(-w * 0.36, h * 0.14, w * 0.72, h * 0.25, 8);
    ctx.fill();
    ctx.fillStyle = "#f0c13e";
    ctx.beginPath();
    ctx.arc(0, -h * 0.3, w * 0.16, 0, TWO_PI);
    ctx.fill();
  } else if (vehicle.personality === "minivan") {
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(-w * 0.42, -h * 0.08, w * 0.84, h * 0.07);
    ctx.fillRect(-w * 0.42, h * 0.16, w * 0.84, h * 0.07);
  }

  ctx.fillStyle = isPlayer ? "rgba(255,255,255,0.22)" : "rgba(215, 239, 247, 0.58)";
  roundedRect(-w * 0.31, -h * 0.2, w * 0.62, h * 0.18, w * 0.1);
  roundedRect(-w * 0.31, h * 0.05, w * 0.62, h * 0.18, w * 0.1);
  ctx.fill();
  ctx.strokeStyle = "rgba(23, 42, 52, 0.34)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, -h * 0.01);
  ctx.lineTo(w * 0.3, -h * 0.01);
  ctx.moveTo(-w * 0.3, h * 0.26);
  ctx.lineTo(w * 0.3, h * 0.26);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 246, 184, 0.86)";
  roundedRect(-w * 0.32, -h * 0.53, w * 0.18, h * 0.055, 6);
  ctx.fill();
  roundedRect(w * 0.14, -h * 0.53, w * 0.18, h * 0.055, 6);
  ctx.fill();

  ctx.fillStyle = isPlayer ? "#ff2222" : "rgba(215, 22, 22, 0.92)";
  roundedRect(-w * 0.32, h * 0.475, w * 0.18, h * 0.055, 6);
  ctx.fill();
  roundedRect(w * 0.14, h * 0.475, w * 0.18, h * 0.055, 6);
  ctx.fill();
}

function ensureCones() {
  const margin = 1300;
  const minY = world.y - getWorldHalfHeight() - margin;
  const maxY = world.y + getWorldHalfHeight() + margin;
  const minBand = Math.floor(minY / CLOSURE_TILE_SIZE);
  const maxBand = Math.floor(maxY / CLOSURE_TILE_SIZE);

  for (let band = minBand; band <= maxBand; band += 1) {
    const lane = closedLaneForBand(band);
    if (lane < 0) {
      continue;
    }

    const startY = band * CLOSURE_TILE_SIZE + 190 + hashNumber(31, band, 8) * 180;
    const count = 12;
    for (let i = 0; i < count; i += 1) {
      const key = `closure:${band}:${i}`;
      if (cones.has(key)) {
        continue;
      }
      const y = startY + i * 72;
      const taper = Math.min(i / 5, 1);
      const x = laneCenterX(lane, y) + (0.5 - taper) * LANE_WIDTH * 0.82;
      cones.set(key, {
        key,
        x,
        y,
        vx: 0,
        vy: 0,
        angle: roadAngle(y),
        spin: 0,
        tipped: false,
        hitCooldown: 0,
      });
    }
  }

  for (const [key, cone] of cones) {
    const dx = cone.x - world.x;
    const dy = cone.y - world.y;
    const tooFar = Math.hypot(dx, dy) > getWorldViewportMax() + margin * 2.2;
    const barelyMoving = Math.hypot(cone.vx, cone.vy) < 6;
    if (tooFar && (!cone.tipped || barelyMoving)) {
      cones.delete(key);
    }
  }
}

function ensureRoadPickups() {
  if (!isRacePhase()) {
    return;
  }
  const margin = 1900;
  const minY = world.y - getWorldHalfHeight() - margin;
  const maxY = world.y + getWorldHalfHeight() + margin;

  const minRamp = Math.floor(minY / RAMP_INTERVAL);
  const maxRamp = Math.floor(maxY / RAMP_INTERVAL);
  for (let band = minRamp; band <= maxRamp; band += 1) {
    const ramp = rampForBand(band);
    if (!ramps.has(ramp.key)) {
      ramps.set(ramp.key, { ...ramp, used: false });
    }
  }

  for (const [key, pad] of boostPads) {
    if (Math.hypot(pad.x - world.x, pad.y - world.y) > getWorldViewportMax() + margin * 1.7) {
      boostPads.delete(key);
    }
  }
  for (const [key, ramp] of ramps) {
    if (Math.hypot(ramp.x - world.x, ramp.y - world.y) > getWorldViewportMax() + margin * 1.7) {
      ramps.delete(key);
    }
  }
}

function updateRoadPickups(dt) {
  if (!isRacePhase()) {
    return;
  }
  ensureRoadPickups();
  const playerWorld = screenToWorld(car.x, car.y);

  for (const pad of boostPads.values()) {
    if (!pad.used && Math.hypot(pad.x - playerWorld.x, pad.y - playerWorld.y) < 90) {
      pad.used = true;
      car.turboTimer = 6.5;
      playBoostSound();
    }
  }

  for (const ramp of ramps.values()) {
    if (ramp.used || car.jumpTimer > 0) {
      continue;
    }
    const dx = ramp.x - playerWorld.x;
    const dy = ramp.y - playerWorld.y;
    if (Math.hypot(dx, dy) < 185 && Math.abs(car.speed) > 260) {
      ramp.used = true;
      startJump(clamp(Math.abs(car.speed) / 1500, 0.35, 1));
    }
  }
}

function ensureEnvironmentObjects() {
  const margin = 1200;
  const minX = world.x - getWorldHalfWidth() - margin;
  const maxX = world.x + getWorldHalfWidth() + margin;
  const minY = world.y - getWorldHalfHeight() - margin;
  const maxY = world.y + getWorldHalfHeight() + margin;
  const minTileX = Math.floor(minX / LAND_TILE_SIZE);
  const maxTileX = Math.floor(maxX / LAND_TILE_SIZE);
  const minTileY = Math.floor(minY / LAND_TILE_SIZE);
  const maxTileY = Math.floor(maxY / LAND_TILE_SIZE);

  for (let tx = minTileX; tx <= maxTileX; tx += 1) {
    for (let ty = minTileY; ty <= maxTileY; ty += 1) {
      for (let i = 0; i < 4; i += 1) {
        const key = `${tx}:${ty}:${i}`;
        if (environmentObjects.has(key)) {
          continue;
        }

        const x = tx * LAND_TILE_SIZE + 30 + hashNumber(tx, ty, i * 19 + 5) * (LAND_TILE_SIZE - 60);
        const y = ty * LAND_TILE_SIZE + 30 + hashNumber(tx, ty, i * 23 + 11) * (LAND_TILE_SIZE - 60);
        if (!isOffRoad(x, y, 95)) {
          continue;
        }

        const typeRoll = hashNumber(tx, ty, i * 29 + 17);
        let type = "weed";
        if (typeRoll > 0.82) {
          type = "tree";
        } else if (typeRoll > 0.68) {
          type = "barrel";
        } else if (typeRoll > 0.56) {
          type = "sign";
        } else if (typeRoll > 0.48) {
          type = "guard";
        }
        environmentObjects.set(key, {
          key,
          type,
          x,
          y,
          vx: 0,
          vy: 0,
          angle: hashNumber(tx, ty, i * 31 + 23) * TWO_PI,
          spin: 0,
          radius: type === "tree" ? 32 + hashNumber(tx, ty, i * 37 + 3) * 26 : type === "guard" ? 42 : type === "barrel" ? 25 : type === "sign" ? 22 : 16 + hashNumber(tx, ty, i * 41 + 7) * 18,
          hitCooldown: 0,
          flattened: false,
        });
      }
    }
  }

  for (const [key, item] of environmentObjects) {
    const distance = Math.hypot(item.x - world.x, item.y - world.y);
    if (distance > getWorldViewportMax() + margin * 2.4 && Math.hypot(item.vx, item.vy) < 8) {
      environmentObjects.delete(key);
    }
  }
}

function updateEnvironmentObjects(dt) {
  if (!isRacePhase()) {
    return;
  }
  ensureEnvironmentObjects();
  if (getJumpHeight() > 25) {
    return;
  }
  const playerWorld = screenToWorld(car.x, car.y);
  const speedAbs = Math.hypot(car.vx, car.vy);

  for (const item of environmentObjects.values()) {
    if (item.hitCooldown > 0) {
      item.hitCooldown -= dt;
    }

    item.x += item.vx * dt;
    item.y += item.vy * dt;
    item.vx *= Math.exp(-dt * (item.type === "tree" || item.type === "guard" ? 2.7 : 4.5));
    item.vy *= Math.exp(-dt * (item.type === "tree" || item.type === "guard" ? 2.7 : 4.5));
    item.angle += item.spin * dt;
    item.spin *= Math.exp(-dt * 2.1);

    const dx = item.x - playerWorld.x;
    const dy = item.y - playerWorld.y;
    const hitRadius = item.radius + Math.max(car.width, car.length) * 0.22;
    if (item.hitCooldown > 0 || Math.hypot(dx, dy) > hitRadius || speedAbs < 42) {
      continue;
    }

    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    const hitPower = clamp(speedAbs / (item.type === "tree" || item.type === "guard" ? 1250 : 760), 0.12, 1);
    item.hitCooldown = 0.5;
    item.flattened = true;
    const heavy = item.type === "tree" || item.type === "guard";
    const medium = item.type === "barrel" || item.type === "sign";
    item.vx += nx * (heavy ? 110 : medium ? 220 : 300) * hitPower;
    item.vy += ny * (heavy ? 110 : medium ? 220 : 300) * hitPower;
    item.spin += (nx > 0 ? 1 : -1) * (heavy ? 2.8 : 8) * hitPower;
    car.vx *= heavy ? 0.58 : medium ? 0.74 : 0.86;
    car.vy *= heavy ? 0.58 : medium ? 0.74 : 0.86;
    car.brakeGlow = Math.max(car.brakeGlow, hitPower * 0.55);
    car.skid = Math.max(car.skid, hitPower * 0.8);
    playConeHit(hitPower * (heavy ? 1 : medium ? 0.7 : 0.45));
  }
}

function ensureTraffic() {
  if (!isRacePhase()) {
    return;
  }
  const margin = 1700;
  const minY = world.y - getWorldHalfHeight() - margin;
  const maxY = world.y + getWorldHalfHeight() + margin;
  const minTile = Math.floor(minY / TRAFFIC_TILE_SIZE);
  const maxTile = Math.floor(maxY / TRAFFIC_TILE_SIZE);
  const colors = ["#d94141", "#2f80ed", "#f2c94c", "#27ae60", "#f2994a", "#bb6bd9", "#dfe7ed"];

  for (let tile = minTile; tile <= maxTile; tile += 1) {
    for (let lane = 0; lane < ROAD_LANES; lane += 1) {
      const key = `${tile}:${lane}`;
      if (trafficCars.has(key) || closedLaneForBand(Math.floor((tile * TRAFFIC_TILE_SIZE) / CLOSURE_TILE_SIZE)) === lane) {
        continue;
      }
      const chance = hashNumber(tile, lane, 41);
      const spawnChance = 0.45 * getCurrentLevel().trafficDensity;
      if (chance < 1 - spawnChance) {
        continue;
      }

      const type = hashNumber(tile, lane, 43);
      const personalityRoll = hashNumber(tile, lane, 44);
      let personality = "car";
      let length = type > 0.78 ? 230 : type > 0.5 ? 180 : 150;
      let carWidth = type > 0.78 ? 78 : type > 0.5 ? 68 : 58;
      let speedScale = 1;
      if (personalityRoll > 0.94) {
        personality = "sweeper";
        length = 245;
        carWidth = 86;
        speedScale = 0.48;
      } else if (personalityRoll > 0.9) {
        personality = "tractor";
        length = 205;
        carWidth = 92;
        speedScale = 0.34;
      } else if (personalityRoll > 0.82) {
        personality = "minivan";
        length = 205;
        carWidth = 76;
        speedScale = 0.68;
      }
      const y = tile * TRAFFIC_TILE_SIZE + 90 + lane * 118 + hashNumber(tile, lane, 47) * (TRAFFIC_TILE_SIZE - 240);
      let tooClose = false;
      for (const other of trafficCars.values()) {
        if (Math.abs(other.y - y) < 300 && Math.abs(other.lane - lane) <= 1) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) {
        continue;
      }
      const color = colors[Math.floor(hashNumber(tile, lane, 53) * colors.length)];
      const baseSpeed = (-520 - hashNumber(tile, lane, 59) * 440) * speedScale;
      trafficCars.set(key, {
        key,
        lane,
        desiredLane: lane,
        x: laneCenterX(lane, y),
        y,
        vx: 0,
        vy: baseSpeed,
        speed: baseSpeed,
        targetSpeed: baseSpeed,
        width: carWidth,
        length,
        personality,
        color,
        angle: roadAngle(y),
        horn: 0,
        exploded: false,
        noisePitch: 0.7 + hashNumber(tile, lane, 61) * 1.1,
      });
    }
  }

  for (const [key, traffic] of trafficCars) {
    const dx = traffic.x - world.x;
    const dy = traffic.y - world.y;
    if (Math.hypot(dx, dy) > getWorldViewportMax() + margin * 1.8) {
      trafficCars.delete(key);
    }
  }
}

function resolveVehicleHit(vehicle, playerWorld, dt) {
  if (vehicle.exploded) {
    return;
  }
  if (getJumpHeight() > 25) {
    return;
  }
  const dx = vehicle.x - playerWorld.x;
  const dy = vehicle.y - playerWorld.y;
  const minDistance = (vehicle.width + car.width) * 0.42 + (vehicle.length + car.length) * 0.13;
  const distance = Math.hypot(dx, dy) || 1;
  if (distance >= minDistance) {
    return;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = minDistance - distance;
  const playerAlongHit = car.vx * nx + car.vy * ny;
  const vehicleAlongHit = vehicle.vx * nx + vehicle.vy * ny;
  const closing = playerAlongHit - vehicleAlongHit;
  const hitPower = clamp((Math.abs(closing) + overlap * 8) / 1050, 0.12, 1);

  if (hitPower > 0.66 || Math.abs(closing) > 980) {
    explodeTrafficCar(vehicle, hitPower);
    car.vx -= nx * 460 * hitPower;
    car.vy -= ny * 460 * hitPower;
    car.brakeGlow = 1;
    car.skid = 1;
    return;
  }

  vehicle.x += nx * overlap * 0.62;
  vehicle.y += ny * overlap * 0.62;
  vehicle.vx += nx * (120 + 520 * hitPower);
  vehicle.vy += ny * (120 + 520 * hitPower);
  vehicle.speed *= 0.94;
  car.vx -= nx * (90 + 260 * hitPower);
  car.vy -= ny * (90 + 260 * hitPower);
  car.brakeGlow = Math.max(car.brakeGlow, 0.45 + hitPower * 0.35);
  car.skid = Math.max(car.skid, hitPower);
  vehicle.horn = Math.max(vehicle.horn, 0.7);
  playConeHit(hitPower);
}

function explodeTrafficCar(vehicle, power) {
  vehicle.exploded = true;
  trafficCars.delete(vehicle.key);
  addWantedStar();
  createExplosion(vehicle, power);
  playExplosion(power);
}

function createExplosion(vehicle, power) {
  const count = 26;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * TWO_PI + hashNumber(Math.floor(vehicle.y), i, 91) * 0.7;
    const speed = 180 + hashNumber(Math.floor(vehicle.x), i, 93) * 760 * power;
    explosions.push({
      x: vehicle.x,
      y: vehicle.y,
      vx: Math.cos(a) * speed + vehicle.vx * 0.25,
      vy: Math.sin(a) * speed + vehicle.vy * 0.25,
      radius: 4 + hashNumber(i, Math.floor(vehicle.y), 95) * 18,
      age: 0,
      life: 0.45 + hashNumber(i, Math.floor(vehicle.x), 97) * 0.7,
      color: i % 3 === 0 ? "#ffd35c" : i % 3 === 1 ? "#ff6b24" : vehicle.color,
    });
  }
}

function startCopChase() {
  gameState.policeCalled = true;
  cop.pending = true;
  cop.pendingTimer = 5;
  cop.exploded = false;
  cop.outrunTimer = 0;
}

function spawnCopOnRoad() {
  const playerWorld = screenToWorld(car.x, car.y);
  const spawnY = playerWorld.y + 1050;
  cop.pending = false;
  cop.active = true;
  cop.outrunTimer = 0;
  cop.x = laneCenterX(Math.floor(ROAD_LANES / 2), spawnY);
  cop.y = spawnY;
  cop.vx = 0;
  cop.vy = -980;
  cop.speed = -980;
  cop.angle = roadAngle(spawnY);
  cop.horn = 1;
}

function explodeCop(power) {
  cop.active = false;
  cop.pending = false;
  cop.pendingTimer = 0;
  cop.exploded = true;
  explodedCarCount = 0;
  wantedStars = 0;
  createExplosion(cop, Math.max(power, 1));
  playExplosion(Math.max(power, 1));
}

function updateCop(dt) {
  if (!isRacePhase()) {
    return;
  }
  if (cop.pending) {
    cop.pendingTimer -= dt;
    if (cop.pendingTimer <= 0) {
      spawnCopOnRoad();
    }
    return;
  }

  if (!cop.active) {
    return;
  }

  const playerWorld = screenToWorld(car.x, car.y);
  const dx = playerWorld.x - cop.x;
  const dy = playerWorld.y - cop.y;
  const distance = Math.hypot(dx, dy) || 1;
  const desiredAngle = Math.atan2(dx, -dy);
  cop.angle = angleLerp(cop.angle, desiredAngle, 1 - Math.exp(-dt * 3.2));

  const chaseSpeed = clamp(780 + Math.abs(car.speed) * 0.18, 760, 1200);
  const leadX = playerWorld.x + car.vx * 0.22;
  const leadY = playerWorld.y + car.vy * 0.22;
  const seekX = leadX - cop.x;
  const seekY = leadY - cop.y;
  const seekDistance = Math.hypot(seekX, seekY) || 1;
  cop.vx = lerp(cop.vx, (seekX / seekDistance) * chaseSpeed, 1 - Math.exp(-dt * 2.2));
  cop.vy = lerp(cop.vy, (seekY / seekDistance) * chaseSpeed, 1 - Math.exp(-dt * 2.2));
  cop.x += cop.vx * dt;
  cop.y += cop.vy * dt;
  cop.speed = Math.hypot(cop.vx, cop.vy);
  cop.horn = 0.7 + Math.sin(performance.now() * 0.012) * 0.3;

  if (distance > 2250 && Math.abs(car.speed) > 820) {
    cop.outrunTimer += dt;
    if (cop.outrunTimer > 3.5) {
      cop.active = false;
      explodedCarCount = 0;
      wantedStars = 0;
    }
  } else {
    cop.outrunTimer = Math.max(0, cop.outrunTimer - dt * 0.7);
  }

  resolveCopHit(playerWorld);
}

function resolveCopHit(playerWorld) {
  if (!cop.active) {
    return;
  }
  if (getJumpHeight() > 25) {
    return;
  }

  const dx = cop.x - playerWorld.x;
  const dy = cop.y - playerWorld.y;
  const minDistance = (cop.width + car.width) * 0.44 + (cop.length + car.length) * 0.13;
  const distance = Math.hypot(dx, dy) || 1;
  if (distance > minDistance) {
    return;
  }

  const nx = dx / distance;
  const ny = dy / distance;
  const playerAlongHit = car.vx * nx + car.vy * ny;
  const copAlongHit = cop.vx * nx + cop.vy * ny;
  const closing = playerAlongHit - copAlongHit;
  const hitPower = clamp((Math.abs(closing) + (minDistance - distance) * 10) / 1750, 0.18, 1.2);

  if (hitPower > 1.12 || Math.abs(closing) > 1850) {
    explodeCop(hitPower);
    car.vx -= nx * 520 * hitPower;
    car.vy -= ny * 520 * hitPower;
    car.skid = 1;
    car.brakeGlow = 1;
    return;
  }

  cop.x += nx * (minDistance - distance) * 0.7;
  cop.y += ny * (minDistance - distance) * 0.7;
  cop.vx += nx * 420 * hitPower;
  cop.vy += ny * 420 * hitPower;
  car.vx -= nx * 330 * hitPower;
  car.vy -= ny * 330 * hitPower;
  car.skid = Math.max(car.skid, hitPower);
  car.brakeGlow = Math.max(car.brakeGlow, 0.75);
  playConeHit(hitPower);
}

function updateTraffic(dt) {
  if (!isRacePhase()) {
    return;
  }
  ensureTraffic();
  const playerWorld = screenToWorld(car.x, car.y);

  for (const traffic of trafficCars.values()) {
    if (traffic.horn > 0) {
      traffic.horn -= dt;
    }
    if (traffic.exploded) {
      continue;
    }
    const laneX = laneCenterX(traffic.desiredLane, traffic.y);
    const closedLane = closedLaneForBand(Math.floor(traffic.y / CLOSURE_TILE_SIZE));
    traffic.targetSpeed = closedLane === traffic.desiredLane ? -360 : traffic.targetSpeed;
    traffic.speed = lerp(traffic.speed, traffic.targetSpeed, 1 - Math.exp(-dt * 1.5));
    traffic.vx = lerp(traffic.vx, (laneX - traffic.x) * 4.8 + roadSlope(traffic.y) * traffic.speed, 1 - Math.exp(-dt * 3.1));
    traffic.vy = lerp(traffic.vy, traffic.speed, 1 - Math.exp(-dt * 2.2));
    traffic.x += traffic.vx * dt;
    traffic.y += traffic.vy * dt;
    const roadHeading = roadAngle(traffic.y);
    const speed = Math.hypot(traffic.vx, traffic.vy);
    const velocityHeading = speed > 35 ? Math.atan2(traffic.vx, -traffic.vy) : roadHeading;
    const laneError = Math.abs(laneX - traffic.x);
    const maxYaw = laneError > LANE_WIDTH * 0.48 || traffic.horn > 0.45 ? 0.46 : 0.16;
    traffic.angle = angleLerp(traffic.angle, clampAngleNear(velocityHeading, roadHeading, maxYaw), 1 - Math.exp(-dt * 8));
    resolveVehicleHit(traffic, playerWorld, dt);
  }

  const vehicles = [...trafficCars.values()];
  for (let i = 0; i < vehicles.length; i += 1) {
    for (let j = i + 1; j < vehicles.length; j += 1) {
      const a = vehicles[i];
      const b = vehicles[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDistance = (a.width + b.width) * 0.42 + (a.length + b.length) * 0.12;
      const distance = Math.hypot(dx, dy) || 1;
      if (distance > minDistance || Math.abs(a.y - b.y) > 260) {
        continue;
      }
      const nx = dx / distance;
      const ny = dy / distance;
      const push = (minDistance - distance) * 0.5;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      a.vx -= nx * 70;
      b.vx += nx * 70;
      a.vy -= ny * 40;
      b.vy += ny * 40;
      a.horn = Math.max(a.horn, 0.35);
      b.horn = Math.max(b.horn, 0.35);
    }
  }
}

function updateCones(dt) {
  if (gameState.phase === "race") {
    ensureCones();
  }
  if (getJumpHeight() > 25) {
    return;
  }
  const carWorld = screenToWorld(car.x, car.y);
  const forwardX = Math.sin(car.angle);
  const forwardY = -Math.cos(car.angle);
  const rightX = Math.cos(car.angle);
  const rightY = Math.sin(car.angle);
  const localYx = -Math.sin(car.angle);
  const localYy = Math.cos(car.angle);
  const halfWidth = car.width * 0.52;
  const halfLength = car.length * 0.52;

  for (const cone of cones.values()) {
    if (cone.hitCooldown > 0) {
      cone.hitCooldown -= dt;
    }

    if (cone.tipped) {
      cone.x += cone.vx * dt;
      cone.y += cone.vy * dt;
      cone.vx *= Math.exp(-dt * 1.9);
      cone.vy *= Math.exp(-dt * 1.9);
      cone.angle += cone.spin * dt;
      cone.spin *= Math.exp(-dt * 1.4);
    }

    const dx = cone.x - carWorld.x;
    const dy = cone.y - carWorld.y;
    const localX = dx * rightX + dy * rightY;
    const localY = dx * localYx + dy * localYy;
    const radius = cone.tipped ? 24 : 18;
    const inFootprint = Math.abs(localX) < halfWidth + radius && Math.abs(localY) < halfLength + radius;
    const speedAbs = Math.abs(car.speed);
    const travelSign = car.speed >= 0 ? 1 : -1;

    if (inFootprint && cone.hitCooldown <= 0 && speedAbs > 34) {
      const away = Math.hypot(dx, dy) || 1;
      const glancing = clamp(Math.abs(localX) / (halfWidth + radius), 0.22, 1);
      const hitPower = clamp(speedAbs / 680, 0.16, 1);
      const push = 180 + hitPower * 720;
      cone.tipped = true;
      cone.hitCooldown = 0.55;
      cone.vx = forwardX * push * travelSign + (dx / away) * 210 * glancing;
      cone.vy = forwardY * push * travelSign + (dy / away) * 210 * glancing;
      cone.spin = (localX >= 0 ? 1 : -1) * (5 + hitPower * 13);
      car.speed *= 0.93;
      car.vx *= 0.9;
      car.vy *= 0.9;
      car.brakeGlow = Math.max(car.brakeGlow, 0.5 * hitPower);
      playConeHit(hitPower);
    }
  }
}

function addSkidMarks() {
  const carWorld = screenToWorld(car.x, car.y);
  const wheelTrack = car.width * 0.34;
  const back = car.length * 0.31;
  const sideX = Math.cos(car.angle) * wheelTrack;
  const sideY = Math.sin(car.angle) * wheelTrack;
  const backX = -Math.sin(car.angle) * back;
  const backY = Math.cos(car.angle) * back;

  for (const side of [-1, 1]) {
    skidMarks.push({
      x: carWorld.x + backX + sideX * side,
      y: carWorld.y + backY + sideY * side,
      angle: car.angle,
      age: 0,
      life: 7.5,
      strength: clamp(car.skid, 0.16, 1),
    });
  }

  if (tireSmoke.length < 40 && car.skid > 0.4) {
    const rearSign = car.speed >= 0 ? 1 : -1;
    const rearX = -Math.sin(car.angle) * car.length * 0.3 * rearSign;
    const rearY = Math.cos(car.angle) * car.length * 0.3 * rearSign;
    tireSmoke.push({
      x: car.x + rearX * CAMERA_ZOOM + Math.random() * 36 - 18,
      y: car.y + rearY * CAMERA_ZOOM + Math.random() * 22,
      radius: 8 + Math.random() * 12,
      age: 0,
      life: 0.75,
    });
  }
}

function pruneEffects(dt) {
  const carWorld = screenToWorld(car.x, car.y);
  for (let i = skidMarks.length - 1; i >= 0; i -= 1) {
    const mark = skidMarks[i];
    mark.age += dt;
    const distance = Math.hypot(mark.x - carWorld.x, mark.y - carWorld.y);
    if (mark.age > mark.life || distance > getWorldViewportMax() * 2.2) {
      skidMarks.splice(i, 1);
    }
  }

  for (let i = tireSmoke.length - 1; i >= 0; i -= 1) {
    tireSmoke[i].age += dt;
    if (tireSmoke[i].age > tireSmoke[i].life) {
      tireSmoke.splice(i, 1);
    }
  }

  for (let i = explosions.length - 1; i >= 0; i -= 1) {
    const boom = explosions[i];
    boom.age += dt;
    boom.x += boom.vx * dt;
    boom.y += boom.vy * dt;
    boom.vx *= Math.exp(-dt * 2.4);
    boom.vy *= Math.exp(-dt * 2.4);
    if (boom.age > boom.life) {
      explosions.splice(i, 1);
    }
  }
}

function clearWorldObjects() {
  skidMarks.length = 0;
  tireSmoke.length = 0;
  explosions.length = 0;
  environmentObjects.clear();
  boostPads.clear();
  ramps.clear();
  cones.clear();
  trafficCars.clear();
  cop.active = false;
  cop.pending = false;
  cop.pendingTimer = 0;
}

function resetCarForPhase(phase) {
  car.x = width / 2;
  car.y = phase === "race" ? height * 0.72 : height * 0.78;
  car.angle = 0;
  car.speed = 0;
  car.lastSpeed = 0;
  car.targetSpeed = 0;
  car.vx = 0;
  car.vy = 0;
  car.lateralSpeed = 0;
  car.turboTimer = 0;
  car.jumpTimer = 0;
  car.jumpDuration = 0;
  car.jumpPower = 0;
  car.width = PLAYER_CAR_WIDTH;
  car.length = PLAYER_CAR_LENGTH;
  car.previousTouchX = null;
  car.previousTouchY = null;
  activeTouches.clear();
}

function setPhase(phase, message = "", messageSub = "") {
  gameState.phase = phase;
  gameState.message = message;
  gameState.messageSub = messageSub;
  gameState.fade = 1;
  gameState.fadeDirection = -1;
  overlayButton = null;
}

function setupRaceBoosts(level) {
  boostPads.clear();
  const count = level.boosts || 0;
  for (let i = 0; i < count; i += 1) {
    const progress = (i + 1) / (count + 1);
    const y = gameState.raceStartY - level.miles * MILE_LENGTH * progress;
    const lane = i % ROAD_LANES;
    boostPads.set(`level-boost:${i}`, {
      key: `level-boost:${i}`,
      x: laneCenterX(lane, y),
      y,
      lane,
      used: false,
    });
  }
}

function startLevel(index) {
  gameState.levelIndex = clamp(index, 0, LEVELS.length - 1);
  const level = getCurrentLevel();
  setControlBaseMode("bottom");
  panModeIndex = 3;
  clearWorldObjects();
  resetCarForPhase(level.miles > 0 ? "race" : "boss");
  wantedStars = 0;
  explodedCarCount = 0;
  gameState.policeCalled = false;
  gameState.playerBossHits = 0;
  gameState.bossIntroSeen = false;

  if (level.miles <= 0) {
    startBossIntro();
    return;
  }

  world.x = roadCenterX(350);
  world.y = 720;
  const playerStart = getPlayerWorld();
  gameState.raceStartY = playerStart.y - 420;
  gameState.raceFinishY = gameState.raceStartY - level.miles * MILE_LENGTH;
  setupRaceBoosts(level);
  setPhase("race");
}

function getActiveMission() {
  return MISSIONS.find((mission) => mission.id === gameState.activeMissionId) || MISSIONS[0];
}

function getMissionStallPosition(mission = getActiveMission()) {
  const index = Math.max(0, (gameState.missionStall || mission.stallNumber) - 1);
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    x: mission.lot.x - 270 + col * 180,
    y: mission.lot.y + 120 + row * 210,
  };
}

function getMissionCartPosition(mission = getActiveMission()) {
  const stall = getMissionStallPosition(mission);
  const start = { x: mission.store.x - 220, y: mission.store.y + 190 };
  const t = clamp(gameState.missionCartProgress, 0, 1);
  return {
    x: lerp(start.x, stall.x, t),
    y: lerp(start.y, stall.y, t),
  };
}

function startMission(id) {
  const mission = MISSIONS.find((item) => item.id === id) || MISSIONS[0];
  clearWorldObjects();
  resetCarForPhase("mission");
  setControlBaseMode("bottom");
  panModeIndex = 3;
  wantedStars = 0;
  explodedCarCount = 0;
  gameState.policeCalled = false;
  world.x = mission.home.x - (car.x - width / 2) / CAMERA_ZOOM;
  world.y = mission.home.y - (car.y - height / 2) / CAMERA_ZOOM;
  gameState.activeMissionId = mission.id;
  gameState.missionStep = "driveToStore";
  gameState.missionStall = mission.stallNumber;
  gameState.missionNoticeTimer = 0;
  gameState.missionCartProgress = 0;
  setPhase("mission", mission.title, "Drive to the grocery pickup lot.");
}

function failMission() {
  activeTouches.clear();
  car.vx *= 0.2;
  car.vy *= 0.2;
  cop.active = false;
  cop.pending = false;
  cop.pendingTimer = 0;
  setPhase("missionFail", "Mission Failed", "You got busted before the groceries made it home.");
}

function constrainMissionDriving() {
  const playerWorld = getPlayerWorld();
  const clampedX = clamp(playerWorld.x, -820, 1720);
  const clampedY = clamp(playerWorld.y, -4880, 1050);
  world.x += clampedX - playerWorld.x;
  world.y += clampedY - playerWorld.y;
}

function updateMission(dt) {
  if (gameState.policeCalled) {
    failMission();
    return;
  }

  const mission = getActiveMission();
  const playerWorld = getPlayerWorld();
  const lotDistance = Math.hypot(playerWorld.x - mission.lot.x, playerWorld.y - mission.lot.y);
  const stall = getMissionStallPosition(mission);
  const stallDistance = Math.hypot(playerWorld.x - stall.x, playerWorld.y - stall.y);
  const homeDistance = Math.hypot(playerWorld.x - mission.home.x, playerWorld.y - mission.home.y);

  if (gameState.missionStep === "driveToStore" && lotDistance < 520) {
    gameState.missionStep = "findStall";
    gameState.missionNoticeTimer = 2.6;
  } else if (gameState.missionStep === "findStall" && stallDistance < 95 && Math.abs(car.speed) < 210) {
    gameState.missionStep = "loading";
    gameState.missionCartProgress = 0;
    gameState.missionNoticeTimer = 1.7;
    car.vx *= 0.35;
    car.vy *= 0.35;
  } else if (gameState.missionStep === "loading") {
    gameState.missionCartProgress = clamp(gameState.missionCartProgress + dt * 0.34, 0, 1);
    const cart = getMissionCartPosition(mission);
    const cartDistance = Math.hypot(playerWorld.x - cart.x, playerWorld.y - cart.y);
    if (cartDistance < 92 || (gameState.missionCartProgress >= 1 && stallDistance < 130)) {
      gameState.missionStep = "returnHome";
      gameState.missionNoticeTimer = 2.4;
      playConeHit(0.9);
    }
  } else if (gameState.missionStep === "returnHome" && homeDistance < 150) {
    activeTouches.clear();
    car.vx *= 0.2;
    car.vy *= 0.2;
    setPhase("missionComplete", "Mission Complete!", "Groceries are back at home base.");
  }

  gameState.missionNoticeTimer = Math.max(0, gameState.missionNoticeTimer - dt);
}

function finishRace() {
  activeTouches.clear();
  car.vx *= 0.25;
  car.vy *= 0.25;
  if (gameState.policeCalled) {
    setPhase(
      "trainingIntro",
      "Busted!",
      "Police were called. Complete retraining before you can race again."
    );
    return;
  }
  startBossIntro();
}

function setupTrainingCourse() {
  const level = getCurrentLevel();
  const curves = level.training.curves;
  clearWorldObjects();
  resetCarForPhase("training");
  setControlBaseMode("center");
  world.x = 0;
  world.y = 520;
  gameState.trainingFinishY = -(curves * 1450 + 820);
  gameState.trainingPassed = false;

  const spacing = 116;
  let coneIndex = 0;
  for (let y = 160; y >= gameState.trainingFinishY - 120; y -= spacing) {
    const progress = clamp((160 - y) / (160 - gameState.trainingFinishY), 0, 1);
    const wave = Math.sin(progress * TWO_PI * curves);
    const nextWave = Math.sin(clamp(progress + 0.015, 0, 1) * TWO_PI * curves);
    const x = wave * 315;
    const nextX = nextWave * 315;
    const tangentX = nextX - x;
    const tangentY = -spacing * 0.015;
    const tangentLen = Math.hypot(tangentX, tangentY) || 1;
    const normalX = -tangentY / tangentLen;
    const normalY = tangentX / tangentLen;
    const halfWidth = 190;
    for (const side of [-1, 1]) {
      cones.set(`training:${coneIndex}`, {
        key: `training:${coneIndex}`,
        x: x + normalX * halfWidth * side,
        y: y + normalY * halfWidth * side,
        vx: 0,
        vy: 0,
        angle: 0,
        spin: 0,
        tipped: false,
        hitCooldown: 0,
      });
      coneIndex += 1;
    }
  }
  gameState.trainingTotalCones = coneIndex;
  setPhase("training");
}

function finishTraining() {
  activeTouches.clear();
  const tipped = [...cones.values()].filter((cone) => cone.tipped).length;
  const intactPercent = gameState.trainingTotalCones
    ? (gameState.trainingTotalCones - tipped) / gameState.trainingTotalCones
    : 1;
  const pass = getCurrentLevel().training.pass;
  if (intactPercent >= pass) {
    gameState.trainingPassed = true;
    startBossIntro();
    gameState.messageSub = `Retraining complete: ${Math.round(intactPercent * 100)}% of cones stayed put. Destroy the boss to complete the level.`;
    return;
  }
  setPhase("trainingFail", "Try Retraining Again", `You kept ${Math.round(intactPercent * 100)}%. You need ${Math.round(pass * 100)}%.`);
}

function startBossIntro() {
  clearWorldObjects();
  resetCarForPhase("boss");
  setControlBaseMode("center");
  world.x = 0;
  world.y = 480;
  setupBosses();
  const level = getCurrentLevel();
  const bossName = level.boss.name;
  setPhase("bossIntro", bossName, "Destroy the boss to complete the level.");
}

function createBoss(config, x, y, hitsOverride = null) {
  const sizes = {
    combine: { width: 260, length: 360, color: "#d98b27", collisionWidth: 300, collisionLength: 430, collisionOffsetY: -28, bumpAwaySpeed: 380 },
    monster: { width: 260, length: 330, color: "#6538b8", collisionWidth: 400, collisionLength: 390, collisionOffsetY: 0, bumpAwaySpeed: 430 },
    dozer: { width: 270, length: 340, color: "#d4a124", collisionWidth: 350, collisionLength: 400, collisionOffsetY: -22, bumpAwaySpeed: 460 },
    semi: { width: 210, length: 520, color: "#c93f3f", collisionWidth: 250, collisionLength: 690, collisionOffsetY: 82, bumpAwaySpeed: 500 },
  };
  const size = sizes[config.type] || sizes.combine;
  return {
    name: config.name,
    type: config.type,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: Math.PI,
    width: size.width,
    length: size.length,
    collisionWidth: size.collisionWidth,
    collisionLength: size.collisionLength,
    collisionOffsetY: size.collisionOffsetY,
    bumpAwaySpeed: size.bumpAwaySpeed,
    color: size.color,
    hits: 0,
    hitsNeeded: hitsOverride || config.hits,
    crushesAllowed: config.crushes,
    allowSideHits: config.allowSideHits,
    chargeTimer: 0.8,
    cooldown: 0,
    hitCooldown: 0,
    bossCollisionCooldown: 0,
    turnDirection: 0,
    turnSwitchCooldown: 0,
    trailerAngle: Math.PI,
    destroyed: false,
  };
}

function setupBosses() {
  const level = getCurrentLevel();
  const config = level.boss;
  gameState.bosses = [];
  gameState.playerBossHits = 0;
  if (config.type === "final") {
    const previous = LEVELS.slice(0, 4).map((item) => item.boss);
    const positions = [
      { x: -850, y: -900 },
      { x: 850, y: -900 },
      { x: -850, y: 520 },
      { x: 850, y: 520 },
    ];
    previous.forEach((bossConfig, index) => {
      gameState.bosses.push(createBoss(bossConfig, positions[index].x, positions[index].y, 3));
    });
    return;
  }
  gameState.bosses.push(createBoss(config, 0, -980));
}

function startBossFight() {
  clearWorldObjects();
  resetCarForPhase("boss");
  setControlBaseMode("center");
  world.x = 0;
  world.y = 480;
  setupBosses();
  setPhase("boss");
}

function completeBossFight() {
  const level = getCurrentLevel();
  activeTouches.clear();
  if (gameState.levelIndex >= LEVELS.length - 1) {
    setPhase("gameComplete", "You Beat Tommy's Game!", "All bosses are destroyed.");
    return;
  }
  setPhase("levelComplete", `${level.name} Complete!`, "Great racing. The next level is ready.");
}

function constrainTrainingDriving() {
  const playerWorld = getPlayerWorld();
  const clampedX = clamp(playerWorld.x, -720, 720);
  world.x += clampedX - playerWorld.x;
}

function constrainArenaDriving() {
  const limit = getCurrentLevel().boss.type === "final" ? FINAL_ARENA_LIMIT : ARENA_LIMIT;
  const playerWorld = getPlayerWorld();
  const clampedX = clamp(playerWorld.x, -limit, limit);
  const clampedY = clamp(playerWorld.y, -limit, limit);
  world.x += clampedX - playerWorld.x;
  world.y += clampedY - playerWorld.y;
}

function updateBosses(dt) {
  const playerWorld = getPlayerWorld();
  const limit = getCurrentLevel().boss.type === "final" ? FINAL_ARENA_LIMIT : ARENA_LIMIT;
  for (const boss of gameState.bosses) {
    if (boss.destroyed) {
      continue;
    }
    boss.cooldown = Math.max(0, boss.cooldown - dt);
    boss.hitCooldown = Math.max(0, boss.hitCooldown - dt);
    boss.bossCollisionCooldown = Math.max(0, boss.bossCollisionCooldown - dt);
    boss.turnSwitchCooldown = Math.max(0, boss.turnSwitchCooldown - dt);
    const dx = playerWorld.x - boss.x;
    const dy = playerWorld.y - boss.y;
    const distance = Math.hypot(dx, dy) || 1;
    const desiredAngle = Math.atan2(dx, -dy);
    const turnDiff = ((desiredAngle - boss.angle + Math.PI) % TWO_PI) - Math.PI;
    const turnDirection = Math.abs(turnDiff) > 0.05 ? Math.sign(turnDiff) : 0;
    if (turnDirection && boss.turnDirection && turnDirection !== boss.turnDirection && boss.turnSwitchCooldown <= 0) {
      boss.turnSwitchCooldown = BOSS_TURN_SWITCH_PAUSE;
    }
    if (turnDirection) {
      boss.turnDirection = turnDirection;
    }
    if (boss.turnSwitchCooldown <= 0) {
      const turnSpeed = (boss.type === "semi" ? 0.85 : 1.2) * BOSS_TURN_SPEED_SCALE;
      boss.angle = angleLerp(boss.angle, desiredAngle, 1 - Math.exp(-dt * turnSpeed));
    }
    boss.chargeTimer -= dt;
    const pausingToTurn = boss.cooldown > 0 || boss.turnSwitchCooldown > 0;
    const charging = boss.chargeTimer < 1.15 && !pausingToTurn;
    const baseChargeSpeed = boss.type === "semi" ? 1080 : 1220;
    const bossSpeed = pausingToTurn ? 0 : (charging ? baseChargeSpeed : 300) * BOSS_SPEED_SCALE;
    const response = pausingToTurn ? 5.8 : charging ? 2.8 : 1.2;
    boss.vx = lerp(boss.vx, (dx / distance) * bossSpeed, 1 - Math.exp(-dt * response));
    boss.vy = lerp(boss.vy, (dy / distance) * bossSpeed, 1 - Math.exp(-dt * response));
    boss.x = clamp(boss.x + boss.vx * dt, -limit, limit);
    boss.y = clamp(boss.y + boss.vy * dt, -limit, limit);
    if (boss.chargeTimer <= 0) {
      boss.chargeTimer = 2.35 + hashNumber(Math.floor(boss.x), Math.floor(boss.y), 201) * 1.2;
      boss.cooldown = 0.85;
    }
    if (boss.type === "semi") {
      boss.trailerAngle = angleLerp(boss.trailerAngle, boss.angle, 1 - Math.exp(-dt * 2.6));
    }
  }

  resolveFinalBossCollisions();

  for (const boss of gameState.bosses) {
    resolveBossHit(boss, getPlayerWorld());
  }
  if (gameState.bosses.length && gameState.bosses.every((boss) => boss.destroyed)) {
    completeBossFight();
  }
}

function damageBoss(boss, power = 1) {
  if (boss.destroyed) {
    return;
  }
  boss.hits += 1;
  playConeHit(0.75 + clamp(power, 0, 1) * 0.25);
  if (boss.hits >= boss.hitsNeeded) {
    boss.destroyed = true;
    createExplosion(boss, 1.25 + clamp(power, 0, 1) * 0.25);
    playExplosion(1.2);
  }
}

function resolveFinalBossCollisions() {
  if (getCurrentLevel().boss.type !== "final") {
    return;
  }

  const bosses = gameState.bosses.filter((boss) => !boss.destroyed);
  for (let i = 0; i < bosses.length; i += 1) {
    for (let j = i + 1; j < bosses.length; j += 1) {
      const a = bosses[i];
      const b = bosses[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 1;
      const minDistance = (a.width + b.width) * 0.42 + (a.length + b.length) * 0.1;
      if (distance >= minDistance) {
        continue;
      }

      const nx = dx / distance;
      const ny = dy / distance;
      const impactSpeed = Math.hypot(a.vx - b.vx, a.vy - b.vy);
      const push = (minDistance - distance) * 0.54;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      a.vx -= nx * 210;
      a.vy -= ny * 210;
      b.vx += nx * 210;
      b.vy += ny * 210;

      if (impactSpeed > 330 && a.bossCollisionCooldown <= 0 && b.bossCollisionCooldown <= 0) {
        a.bossCollisionCooldown = 1.05;
        b.bossCollisionCooldown = 1.05;
        damageBoss(a, clamp(impactSpeed / 900, 0.4, 1));
        damageBoss(b, clamp(impactSpeed / 900, 0.4, 1));
      }
    }
  }
}

function getBossPlayerCollision(boss, playerWorld) {
  const dx = playerWorld.x - boss.x;
  const dy = playerWorld.y - boss.y;
  const cos = Math.cos(boss.angle);
  const sin = Math.sin(boss.angle);
  const localX = dx * cos + dy * sin;
  const localY = dx * -sin + dy * cos;
  const collisionLocalY = localY - (boss.collisionOffsetY || 0);
  const halfWidth = (boss.collisionWidth || boss.width) * 0.5 + car.width * 0.54;
  const halfLength = (boss.collisionLength || boss.length) * 0.5 + car.length * 0.5;
  const overlapX = halfWidth - Math.abs(localX);
  const overlapY = halfLength - Math.abs(collisionLocalY);

  if (overlapX <= 0 || overlapY <= 0) {
    return null;
  }

  let localNormalX = 0;
  let localNormalY = 0;
  let overlap = overlapY;
  if (overlapX < overlapY) {
    localNormalX = localX >= 0 ? 1 : -1;
    overlap = overlapX;
  } else {
    localNormalY = collisionLocalY >= 0 ? 1 : -1;
  }

  return {
    localX,
    localY,
    nx: localNormalX * cos - localNormalY * sin,
    ny: localNormalX * sin + localNormalY * cos,
    overlap,
  };
}

function separatePlayerFromBoss(boss, collision) {
  const separation = collision.overlap + 8;
  world.x += collision.nx * separation;
  world.y += collision.ny * separation;

  const playerAwaySpeed = car.vx * collision.nx + car.vy * collision.ny;
  const bossAwaySpeed = boss.vx * collision.nx + boss.vy * collision.ny;
  const shoveSpeed = (boss.bumpAwaySpeed || 420) + clamp(collision.overlap / 120, 0, 1) * 240 + Math.max(0, bossAwaySpeed) * 0.3;
  const impulse = Math.max(0, shoveSpeed - playerAwaySpeed) * 0.7;
  car.vx += collision.nx * impulse;
  car.vy += collision.ny * impulse;
  car.skid = Math.max(car.skid, 0.55);
  car.brakeGlow = Math.max(car.brakeGlow, 0.55);
}

function resolveBossHit(boss, playerWorld) {
  if (boss.destroyed || getJumpHeight() > 25) {
    return;
  }
  const collision = getBossPlayerCollision(boss, playerWorld);
  if (!collision) {
    return;
  }

  separatePlayerFromBoss(boss, collision);
  if (boss.hitCooldown > 0) {
    return;
  }

  const speedAbs = Math.abs(car.speed);
  const backHit = collision.localY > boss.length * 0.18;
  const sideHit = boss.allowSideHits && Math.abs(collision.localX) > boss.width * 0.54;
  const strongEnough = speedAbs > 155 || Math.hypot(car.vx - boss.vx, car.vy - boss.vy) > 420;
  const weakHit = strongEnough && (backHit || sideHit);

  boss.hitCooldown = 0.75;
  if (weakHit) {
    boss.vx -= collision.nx * 360;
    boss.vy -= collision.ny * 360;
    car.vx += collision.nx * 240;
    car.vy += collision.ny * 240;
    damageBoss(boss, 1);
    return;
  }

  gameState.playerBossHits += 1;
  car.vx += collision.nx * 720;
  car.vy += collision.ny * 720;
  car.skid = 1;
  car.brakeGlow = 1;
  playConeHit(1);
  const allowed = getCurrentLevel().boss.type === "final" ? 3 : boss.crushesAllowed;
  if (gameState.playerBossHits >= allowed) {
    setPhase("crushed", "Crushed!", "The boss rolled you over. Try the arena again.");
  }
}

function updateGame(dt) {
  gameState.fade = clamp(gameState.fade + gameState.fadeDirection * dt * 1.7, 0, 1);
  if (gameState.phase === "start") {
    gameState.demoTime += dt;
    pruneEffects(dt);
    return;
  }

  if (gameState.phase === "race") {
    updateCar(dt);
    updateRoadPickups(dt);
    updateEnvironmentObjects(dt);
    updateTraffic(dt);
    updateCop(dt);
    updateCones(dt);
    pruneEffects(dt);
    const playerWorld = getPlayerWorld();
    if (playerWorld.y <= gameState.raceFinishY) {
      finishRace();
    }
    return;
  }

  if (gameState.phase === "training") {
    updateCar(dt);
    constrainTrainingDriving();
    updateCones(dt);
    pruneEffects(dt);
    if (getPlayerWorld().y <= gameState.trainingFinishY) {
      finishTraining();
    }
    return;
  }

  if (gameState.phase === "boss") {
    updateCar(dt);
    constrainArenaDriving();
    updateBosses(dt);
    pruneEffects(dt);
    return;
  }

  if (gameState.phase === "mission") {
    updateCar(dt);
    constrainMissionDriving();
    updateMission(dt);
    pruneEffects(dt);
    return;
  }

  car.targetSpeed = 0;
  car.speed *= Math.exp(-dt * 2.5);
  car.vx *= Math.exp(-dt * 2.5);
  car.vy *= Math.exp(-dt * 2.5);
  pruneEffects(dt);
  updateAudio();
}

function draw() {
  const theme = getTheme();
  overlayButton = null;
  overlayButtons = [];
  if (gameState.phase === "start") {
    drawStartScene(theme);
    drawStartOverlay();
    drawFade();
    return;
  }

  if (gameState.phase === "missionMenu") {
    drawMissionMenu(theme);
    drawFade();
    return;
  }

  if (gameState.phase === "mission" || gameState.phase === "missionComplete" || gameState.phase === "missionFail") {
    drawMissionScene(theme);
    drawSkidMarks(theme);
    drawGuidanceLights(theme);
    drawPlayerCar(theme);
    drawBoostHalo();
    drawTouchPoints(theme);
    drawSmoke();
    drawMissionHud();
    drawModalOverlay();
    drawFade();
    return;
  }

  if (gameState.phase === "training" || gameState.phase === "trainingIntro" || gameState.phase === "trainingFail") {
    drawTrainingLot(theme);
    drawTrainingCourse();
    drawSkidMarks(theme);
    drawCones(theme);
    drawGuidanceLights(theme);
    drawPlayerCar(theme);
    drawBoostHalo();
    drawTouchPoints(theme);
    drawSmoke();
    drawTrainingHud();
    drawModalOverlay();
    drawFade();
    return;
  }

  if (gameState.phase === "boss" || gameState.phase === "bossIntro" || gameState.phase === "crushed") {
    drawBossArena(theme);
    drawSkidMarks(theme);
    drawBosses();
    drawExplosions(theme);
    drawGuidanceLights(theme);
    drawPlayerCar(theme);
    drawBoostHalo();
    drawTouchPoints(theme);
    drawSmoke();
    drawBossHud();
    drawModalOverlay();
    drawFade();
    return;
  }

  drawGround(theme);
  drawHills(theme);
  drawEnvironmentObjects(theme);
  drawInterstate(theme);
  drawRaceLines();
  drawRoadPickups(theme);
  drawSkidMarks(theme);
  drawCones(theme);
  drawTraffic(theme);
  drawCop(theme);
  drawExplosions(theme);
  drawGuidanceLights(theme);
  drawPlayerCar(theme);
  drawBoostHalo();
  drawTouchPoints(theme);
  drawSmoke();
  drawRaceHud();
  drawModalOverlay();
  drawTunnelOverlay(theme);
  drawFade();
}

function drawStartScene(theme) {
  drawGround(theme);
  ctx.save();
  ctx.translate(width / 2, height / 2 + 280);
  ctx.rotate(-0.08);
  ctx.fillStyle = "#242a2e";
  roundedRect(-ROAD_HALF_WIDTH, -height * 1.5, ROAD_HALF_WIDTH * 2, height * 3.2, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 7;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * (ROAD_HALF_WIDTH - 20), -height * 1.4);
    ctx.lineTo(side * (ROAD_HALF_WIDTH - 20), height * 1.4);
    ctx.stroke();
  }
  ctx.setLineDash([46, 40]);
  ctx.strokeStyle = "rgba(250,250,235,0.62)";
  for (let lane = 1; lane < ROAD_LANES; lane += 1) {
    const x = (lane - ROAD_LANES / 2) * LANE_WIDTH;
    ctx.beginPath();
    ctx.moveTo(x, -height * 1.4);
    ctx.lineTo(x, height * 1.4);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  const colors = ["#d94141", "#2f80ed", "#f2c94c", "#27ae60", "#f2994a"];
  for (let i = 0; i < 12; i += 1) {
    const lane = i % ROAD_LANES;
    const x = (lane - 1.5) * LANE_WIDTH;
    const y = wrap(i * 210 + gameState.demoTime * 220, height * 1.7) - height * 0.92;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.02);
    drawVehicleShape({
      width: 58 + (i % 3) * 8,
      length: 150 + (i % 2) * 42,
      color: colors[i % colors.length],
    });
    ctx.restore();
  }
  ctx.restore();
}

function drawStartOverlay() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(72, width * 0.13)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("Tommy's Game", width / 2, height * 0.25);
  ctx.fillStyle = "#ffd35c";
  ctx.font = `800 ${Math.min(28, width * 0.055)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("Five levels. Fast roads. Big bosses.", width / 2, height * 0.33);
  const buttonWidth = Math.min(330, width - 64);
  drawOverlayButton("Start Game", width / 2, height * 0.58, buttonWidth, 76, "startGame");
  drawOverlayButton("Missions", width / 2, height * 0.72, buttonWidth, 76, "missionMenu", {
    fill: "#58d6ff",
    text: "#10202a",
  });
  ctx.restore();
}

function drawMissionMenu(theme) {
  drawGround(theme);
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(54, width * 0.095)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("Side Missions", width / 2, 82);
  ctx.fillStyle = "#ffd35c";
  ctx.font = `800 ${Math.min(23, width * 0.044)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("Pick a bonus adventure", width / 2, 122);

  const columns = width < 760 ? 1 : 2;
  const gap = 18;
  const gridWidth = Math.min(width - 36, columns === 1 ? 390 : 790);
  const cardWidth = (gridWidth - gap * (columns - 1)) / columns;
  const cardHeight = 188;
  const startX = width / 2 - gridWidth / 2;
  const startY = 160 - gameState.missionMenuScroll;
  const cards = [...MISSIONS, { id: "more", title: "More to Come", subtitle: "More missions will be added later.", locked: true }];

  for (let i = 0; i < cards.length; i += 1) {
    const mission = cards[i];
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = startX + col * (cardWidth + gap);
    const y = startY + row * (cardHeight + gap);
    if (y > height || y + cardHeight < 136) {
      continue;
    }
    drawMissionCard(mission, x, y, cardWidth, cardHeight);
  }

  drawOverlayButton("Back", 76, 126, 112, 52, "backStart", {
    fill: "#e7eef2",
    text: "#10202a",
  });
  ctx.restore();
}

function drawMissionCard(mission, x, y, w, h) {
  const locked = mission.locked;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.32)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = locked ? "rgba(38, 49, 54, 0.92)" : "#f7fbff";
  roundedRect(x, y, w, h, 8);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = locked ? "#3f4d52" : "#66d36e";
  roundedRect(x + 14, y + 14, w - 28, 72, 8);
  ctx.fill();
  ctx.save();
  ctx.translate(x + 66, y + 50);
  ctx.rotate(-0.07);
  drawVehicleShape({ width: 44, length: 96, color: locked ? "#69777c" : "#e53034" });
  ctx.restore();
  ctx.fillStyle = locked ? "#b7c6ca" : "#ffffff";
  ctx.font = "900 32px Arial, Helvetica, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(locked ? "..." : "7", x + w - 34, y + 60);

  ctx.textAlign = "left";
  ctx.fillStyle = locked ? "#d6e1e4" : "#14242c";
  ctx.font = "900 24px Arial, Helvetica, sans-serif";
  ctx.fillText(mission.title, x + 18, y + 118);
  ctx.fillStyle = locked ? "#aebcc0" : "#50616a";
  ctx.font = "700 15px Arial, Helvetica, sans-serif";
  wrapText(mission.subtitle, x + 18, y + 145, w - 36, 21);

  if (!locked) {
    overlayButtons.push({ x, y, w, h, action: `mission:${mission.id}` });
    ctx.fillStyle = "#ffd35c";
    roundedRect(x + w - 130, y + h - 48, 108, 34, 8);
    ctx.fill();
    ctx.fillStyle = "#14242c";
    ctx.font = "900 16px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Drive", x + w - 76, y + h - 31);
  }
  ctx.restore();
}

function drawOverlayButton(label, centerX, centerY, buttonWidth, buttonHeight, action = "overlay", options = {}) {
  const button = {
    x: centerX - buttonWidth / 2,
    y: centerY - buttonHeight / 2,
    w: buttonWidth,
    h: buttonHeight,
    action,
  };
  overlayButton = button;
  overlayButtons.push(button);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.42)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = options.fill || "#ffd35c";
  roundedRect(button.x, button.y, button.w, button.h, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 3;
  roundedRect(button.x + 3, button.y + 3, button.w - 6, button.h - 6, 7);
  ctx.stroke();
  ctx.fillStyle = options.text || "#14242c";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${Math.min(38, buttonHeight * 0.48)}px Arial, Helvetica, sans-serif`;
  ctx.fillText(label, centerX, centerY + 1);
  ctx.restore();
}

function drawModalOverlay() {
  if (!["trainingIntro", "trainingFail", "bossIntro", "levelComplete", "gameComplete", "crushed", "missionComplete", "missionFail"].includes(gameState.phase)) {
    return;
  }
  const buttonLabel = {
    trainingIntro: "Start Training",
    trainingFail: "Try Again",
    bossIntro: "Fight!",
    levelComplete: "Next Level",
    gameComplete: "Play Again",
    crushed: "Try Again",
    missionComplete: "Missions",
    missionFail: "Try Again",
  }[gameState.phase];
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${Math.min(54, width * 0.092)}px Arial, Helvetica, sans-serif`;
  ctx.fillText(gameState.message, width / 2, height * 0.34);
  ctx.fillStyle = "#d8eef6";
  ctx.font = `700 ${Math.min(24, width * 0.045)}px Arial, Helvetica, sans-serif`;
  wrapText(gameState.messageSub, width / 2, height * 0.42, Math.min(720, width - 54), 31);
  drawOverlayButton(buttonLabel, width / 2, height * 0.62, Math.min(330, width - 64), 74);
  ctx.restore();
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
  }
}

function drawMissionScene(theme) {
  const mission = getActiveMission();
  const stall = getMissionStallPosition(mission);
  drawGround(theme);

  ctx.save();
  applyWorldTransform();

  ctx.fillStyle = "#252c30";
  roundedRect(-ROAD_HALF_WIDTH * 0.72, -5100, ROAD_HALF_WIDTH * 1.44, 6350, 26);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * ROAD_HALF_WIDTH * 0.64, -5050);
    ctx.lineTo(side * ROAD_HALF_WIDTH * 0.64, 1180);
    ctx.stroke();
  }
  ctx.setLineDash([44, 38]);
  ctx.strokeStyle = "rgba(250,250,235,0.62)";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, -5050);
  ctx.lineTo(0, 1180);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "#30383c";
  ctx.lineWidth = 150;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ROAD_HALF_WIDTH * 0.48, mission.exitY);
  ctx.bezierCurveTo(520, mission.exitY - 180, 610, mission.lot.y + 520, mission.lot.x - 520, mission.lot.y + 360);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.42)";
  ctx.lineWidth = 5;
  ctx.setLineDash([30, 32]);
  ctx.beginPath();
  ctx.moveTo(ROAD_HALF_WIDTH * 0.48, mission.exitY);
  ctx.bezierCurveTo(520, mission.exitY - 180, 610, mission.lot.y + 520, mission.lot.x - 520, mission.lot.y + 360);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineCap = "butt";

  drawMissionHomeBase(mission);
  drawGroceryStore(mission, stall);

  if (gameState.missionStep === "loading") {
    drawGroceryCart(mission);
  }

  ctx.restore();
}

function drawMissionHomeBase(mission) {
  ctx.save();
  ctx.translate(mission.home.x, mission.home.y);
  ctx.fillStyle = "rgba(255, 211, 92, 0.2)";
  ctx.beginPath();
  ctx.arc(0, 0, 190, 0, TWO_PI);
  ctx.fill();
  ctx.strokeStyle = "#ffd35c";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(0, 0, 150, 0, TWO_PI);
  ctx.stroke();
  ctx.fillStyle = "#e74b3f";
  roundedRect(-82, -50, 164, 118, 10);
  ctx.fill();
  ctx.fillStyle = "#7b2e2a";
  ctx.beginPath();
  ctx.moveTo(-104, -45);
  ctx.lineTo(0, -128);
  ctx.lineTo(104, -45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 34px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HOME", 0, 136);
  ctx.restore();
}

function drawGroceryStore(mission, activeStall) {
  const lotX = mission.lot.x - 580;
  const lotY = mission.lot.y - 120;
  ctx.fillStyle = "#596266";
  roundedRect(lotX, lotY, 1160, 720, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 8;
  roundedRect(lotX + 16, lotY + 16, 1128, 688, 18);
  ctx.stroke();

  ctx.fillStyle = "#47b35b";
  roundedRect(mission.store.x - 430, mission.store.y - 260, 860, 360, 24);
  ctx.fill();
  ctx.fillStyle = "#f5fbff";
  roundedRect(mission.store.x - 330, mission.store.y - 212, 660, 92, 12);
  ctx.fill();
  ctx.fillStyle = "#1b6631";
  ctx.font = "900 46px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GROCERY", mission.store.x, mission.store.y - 150);
  ctx.fillStyle = "#2c7f42";
  roundedRect(mission.store.x - 360, mission.store.y - 82, 720, 150, 12);
  ctx.fill();
  ctx.fillStyle = "rgba(215, 244, 250, 0.72)";
  for (let i = -2; i <= 2; i += 1) {
    roundedRect(mission.store.x + i * 132 - 48, mission.store.y - 48, 96, 86, 8);
    ctx.fill();
  }

  ctx.strokeStyle = "#f5fbff";
  ctx.lineWidth = 7;
  ctx.font = "900 34px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < 8; i += 1) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = mission.lot.x - 270 + col * 180;
    const y = mission.lot.y + 120 + row * 210;
    const isActive = Math.abs(x - activeStall.x) < 1 && Math.abs(y - activeStall.y) < 1;
    ctx.strokeStyle = isActive ? "#ffd35c" : "#f5fbff";
    ctx.lineWidth = isActive ? 12 : 7;
    roundedRect(x - 68, y - 88, 136, 176, 10);
    ctx.stroke();
    ctx.fillStyle = isActive ? "#ffd35c" : "#f5fbff";
    ctx.fillText(`${i + 1}`, x, y + 14);
  }

  ctx.fillStyle = "#2d363b";
  roundedRect(mission.lot.x - 180, mission.lot.y + 520, 360, 74, 8);
  ctx.fill();
  ctx.fillStyle = "#ffd35c";
  ctx.font = "900 26px Arial, Helvetica, sans-serif";
  ctx.fillText("PICKUP PARKING", mission.lot.x, mission.lot.y + 568);
}

function drawGroceryCart(mission) {
  const cart = getMissionCartPosition(mission);
  ctx.save();
  ctx.translate(cart.x, cart.y);
  ctx.fillStyle = "#295e35";
  ctx.beginPath();
  ctx.arc(-38, -16, 24, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = "#f0c49a";
  ctx.beginPath();
  ctx.arc(-38, -50, 18, 0, TWO_PI);
  ctx.fill();
  ctx.strokeStyle = "#e7eef2";
  ctx.lineWidth = 7;
  roundedRect(-10, -42, 74, 68, 8);
  ctx.stroke();
  ctx.fillStyle = "#ffcf4a";
  roundedRect(4, -30, 20, 26, 4);
  roundedRect(32, -28, 20, 24, 4);
  ctx.fill();
  ctx.fillStyle = "#171a1c";
  for (const x of [4, 54]) {
    ctx.beginPath();
    ctx.arc(x, 34, 8, 0, TWO_PI);
    ctx.fill();
  }
  ctx.restore();
}

function drawMissionHud() {
  if (gameState.phase !== "mission") {
    return;
  }
  const mission = getActiveMission();
  const messages = {
    driveToStore: "Take the exit to Grocery Pickup",
    findStall: `Park in stall ${gameState.missionStall}`,
    loading: "Wait for the cart to reach your car",
    returnHome: "Groceries loaded. Return to home base",
  };
  ctx.save();
  ctx.fillStyle = "rgba(15,21,27,0.76)";
  roundedRect(24, Math.max(78, height - 104), Math.min(470, width - 48), 76, 8);
  ctx.fill();
  ctx.fillStyle = "#f5fbff";
  ctx.font = "900 18px Arial, Helvetica, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(mission.title, 42, Math.max(106, height - 70));
  ctx.fillStyle = "#ffd35c";
  ctx.font = "800 16px Arial, Helvetica, sans-serif";
  ctx.fillText(messages[gameState.missionStep] || "", 42, Math.max(130, height - 46));

  if (gameState.missionStep === "findStall" || gameState.missionNoticeTimer > 0) {
    const flash = gameState.missionStep === "findStall" ? 0.42 + Math.sin(performance.now() * 0.012) * 0.28 : 0.52;
    ctx.textAlign = "center";
    ctx.fillStyle = `rgba(255, 211, 92, ${flash})`;
    ctx.font = `900 ${Math.min(82, width * 0.14)}px Arial, Helvetica, sans-serif`;
    ctx.fillText(`STALL ${gameState.missionStall}`, width / 2, height * 0.2);
  }
  ctx.restore();
}

function drawRaceHud() {
  if (gameState.phase !== "race") {
    return;
  }
  const level = getCurrentLevel();
  const progress = clamp((gameState.raceStartY - getPlayerWorld().y) / (level.miles * MILE_LENGTH), 0, 1);
  const remaining = Math.max(0, level.miles * (1 - progress));
  ctx.save();
  ctx.fillStyle = "rgba(15,21,27,0.72)";
  roundedRect(width - 192, Math.max(78, height - 86), 168, 52, 8);
  ctx.fill();
  ctx.fillStyle = "#f5fbff";
  ctx.font = "800 17px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${level.name}  ${remaining.toFixed(1)} mi`, width - 108, Math.max(108, height - 54));
  ctx.restore();
}

function drawTrainingHud() {
  if (gameState.phase !== "training") {
    return;
  }
  const level = getCurrentLevel();
  const tipped = [...cones.values()].filter((cone) => cone.tipped).length;
  const intact = gameState.trainingTotalCones
    ? Math.round(((gameState.trainingTotalCones - tipped) / gameState.trainingTotalCones) * 100)
    : 100;
  ctx.save();
  ctx.fillStyle = "rgba(15,21,27,0.72)";
  roundedRect(width - 232, Math.max(78, height - 94), 208, 62, 8);
  ctx.fill();
  ctx.fillStyle = "#f5fbff";
  ctx.font = "800 16px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`Cones OK ${intact}%`, width - 128, Math.max(104, height - 63));
  ctx.fillStyle = "#ffd35c";
  ctx.fillText(`Need ${Math.round(level.training.pass * 100)}%`, width - 128, Math.max(126, height - 41));
  ctx.restore();
}

function drawBossHud() {
  if (gameState.phase !== "boss") {
    return;
  }
  const alive = gameState.bosses.filter((boss) => !boss.destroyed);
  const allowed = getCurrentLevel().boss.type === "final" ? 3 : getCurrentLevel().boss.crushes;
  ctx.save();
  ctx.fillStyle = "rgba(15,21,27,0.75)";
  roundedRect(24, Math.max(78, height - 104), Math.min(360, width - 48), 76, 8);
  ctx.fill();
  ctx.fillStyle = "#f5fbff";
  ctx.font = "800 15px Arial, Helvetica, sans-serif";
  ctx.textAlign = "left";
  const name = alive.length === 1 ? alive[0].name : `${alive.length} bosses left`;
  ctx.fillText(name, 42, Math.max(106, height - 73));
  ctx.fillStyle = "#ffd35c";
  const damage = alive.length === 1 ? `${alive[0].hits}/${alive[0].hitsNeeded} hits` : "3 hits each";
  ctx.fillText(`${damage}  Crushes ${gameState.playerBossHits}/${allowed}`, 42, Math.max(130, height - 49));
  ctx.restore();
}

function drawRaceLines() {
  drawCheckeredLine(gameState.raceStartY, "START");
  drawCheckeredLine(gameState.raceFinishY, "FINISH");
}

function drawCheckeredLine(y, label) {
  const screen = worldToScreen(roadCenterX(y), y);
  if (screen.y < -140 || screen.y > height + 140) {
    return;
  }
  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();
  ctx.translate(roadCenterX(y), y);
  ctx.rotate(roadAngle(y));
  const square = 34;
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 20; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#f6f6f0" : "#111820";
      ctx.fillRect(-ROAD_HALF_WIDTH + col * square, -square + row * square, square, square);
    }
  }
  ctx.fillStyle = "rgba(255, 211, 92, 0.92)";
  ctx.font = "900 44px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, 0, -46);
  ctx.restore();
}

function drawTrainingLot(theme) {
  ctx.fillStyle = theme.night > 0.55 ? "#20272a" : "#3f4648";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  applyWorldTransform();
  const grid = 260;
  const minX = world.x - getWorldHalfWidth() - grid;
  const maxX = world.x + getWorldHalfWidth() + grid;
  const minY = world.y - getWorldHalfHeight() - grid;
  const maxY = world.y + getWorldHalfHeight() + grid;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 4;
  for (let x = Math.floor(minX / grid) * grid; x < maxX; x += grid) {
    for (let y = Math.floor(minY / 180) * 180; y < maxY; y += 180) {
      ctx.beginPath();
      ctx.moveTo(x - 90, y);
      ctx.lineTo(x + 90, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 90, y);
      ctx.lineTo(x - 135, y + 105);
      ctx.moveTo(x + 90, y);
      ctx.lineTo(x + 135, y + 105);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTrainingCourse() {
  ctx.save();
  applyWorldTransform();
  ctx.strokeStyle = "rgba(255, 211, 92, 0.34)";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  const curves = getCurrentLevel().training?.curves || 1;
  for (let y = 160; y >= gameState.trainingFinishY; y -= 32) {
    const progress = clamp((160 - y) / (160 - gameState.trainingFinishY), 0, 1);
    const x = Math.sin(progress * TWO_PI * curves) * 315;
    if (y === 160) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  drawLotLine(180, "START");
  drawLotLine(gameState.trainingFinishY, "FINISH");
  ctx.restore();
}

function drawLotLine(y, label) {
  ctx.save();
  ctx.fillStyle = "#f6f6f0";
  ctx.fillRect(-330, y - 14, 660, 28);
  ctx.fillStyle = "#111820";
  for (let x = -330; x < 330; x += 44) {
    ctx.fillRect(x, y - 14, 22, 14);
    ctx.fillRect(x + 22, y, 22, 14);
  }
  ctx.fillStyle = "#ffd35c";
  ctx.font = "900 34px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, 0, y - 32);
  ctx.restore();
}

function drawBossArena(theme) {
  const limit = getCurrentLevel().boss.type === "final" ? FINAL_ARENA_LIMIT : ARENA_LIMIT;
  ctx.fillStyle = theme.night > 0.55 ? "#1f2729" : "#475154";
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  applyWorldTransform();
  ctx.fillStyle = "#596063";
  ctx.beginPath();
  ctx.arc(0, 0, limit + 220, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = "#353c3f";
  ctx.beginPath();
  ctx.arc(0, 0, limit, 0, TWO_PI);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,211,92,0.82)";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(0, 0, limit, 0, TWO_PI);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 5;
  for (let r = 520; r < limit; r += 520) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TWO_PI);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBosses() {
  ctx.save();
  applyWorldTransform();
  for (const boss of gameState.bosses) {
    if (boss.destroyed) {
      continue;
    }
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(boss.angle);
    drawBossShape(boss);
    ctx.restore();
  }
  ctx.restore();
}

function drawBossShape(boss) {
  const w = boss.width;
  const h = boss.length;
  const cw = boss.collisionWidth || w;
  const ch = boss.collisionLength || h;
  const cy = boss.collisionOffsetY || 0;

  ctx.fillStyle = "rgba(0,0,0,0.32)";
  roundedRect(-cw * 0.5 + 14, cy - ch * 0.5 + 16, cw, ch, 28);
  ctx.fill();

  if (boss.type === "semi") {
    ctx.save();
    ctx.translate(0, h * 0.42);
    ctx.rotate(boss.trailerAngle - boss.angle);
    const tw = w * 1.15;
    const th = h * 0.66;
    ctx.fillStyle = "#d5dcde";
    roundedRect(-tw * 0.5, -th * 0.22, tw, th, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,35,38,0.45)";
    ctx.lineWidth = 7;
    roundedRect(-tw * 0.44, -th * 0.12, tw * 0.88, th * 0.46, 6);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.38)";
    ctx.lineWidth = 5;
    for (let y = -th * 0.06; y <= th * 0.28; y += th * 0.12) {
      ctx.beginPath();
      ctx.moveTo(-tw * 0.36, y);
      ctx.lineTo(tw * 0.36, y);
      ctx.stroke();
    }
    for (const x of [-tw * 0.5, tw * 0.5]) {
      drawWheel(x, th * 0.12, 18, 34, 0, "#828a8f");
      drawWheel(x, th * 0.28, 18, 34, 0, "#828a8f");
    }
    ctx.restore();
  }

  if (boss.type === "combine") {
    for (const x of [-w * 0.44, w * 0.44]) {
      drawWheel(x, h * 0.18, 38, 58, 0, "#717b67");
      drawWheel(x, -h * 0.2, 24, 36, 0, "#717b67");
    }
    ctx.fillStyle = boss.color;
    roundedRect(-w * 0.46, -h * 0.36, w * 0.92, h * 0.76, 26);
    ctx.fill();
    ctx.fillStyle = "#e6a33a";
    roundedRect(-w * 0.3, h * 0.02, w * 0.6, h * 0.28, 16);
    ctx.fill();
    ctx.fillStyle = "rgba(205, 238, 246, 0.6)";
    roundedRect(-w * 0.26, -h * 0.27, w * 0.52, h * 0.18, 12);
    ctx.fill();
    ctx.fillStyle = "#f0bc42";
    roundedRect(-w * 0.62, -h * 0.66, w * 1.24, h * 0.2, 14);
    ctx.fill();
    ctx.strokeStyle = "#332b1c";
    ctx.lineWidth = 6;
    for (let x = -w * 0.58; x <= w * 0.58; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, -h * 0.72);
      ctx.lineTo(x + 13, -h * 0.48);
      ctx.stroke();
    }
    ctx.strokeStyle = "#744d1c";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, -h * 0.56, w * 0.38, Math.PI, 0);
    ctx.stroke();
  } else if (boss.type === "monster") {
    for (const x of [-w * 0.58, w * 0.58]) {
      for (const y of [-h * 0.28, h * 0.28]) {
        drawWheel(x, y, 52, 52, 0, "#8d96a0");
      }
    }
    ctx.fillStyle = "#2a213d";
    roundedRect(-w * 0.3, -h * 0.35, w * 0.6, h * 0.7, 18);
    ctx.fill();
    ctx.fillStyle = boss.color;
    roundedRect(-w * 0.42, -h * 0.46, w * 0.84, h * 0.92, 30);
    ctx.fill();
    ctx.fillStyle = "#7a55d6";
    roundedRect(-w * 0.28, -h * 0.54, w * 0.56, h * 0.24, 18);
    roundedRect(-w * 0.32, h * 0.18, w * 0.64, h * 0.24, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(230,230,255,0.52)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, -h * 0.16);
    ctx.lineTo(w * 0.24, h * 0.16);
    ctx.moveTo(w * 0.24, -h * 0.16);
    ctx.lineTo(-w * 0.24, h * 0.16);
    ctx.stroke();
    ctx.fillStyle = "rgba(205, 238, 246, 0.66)";
    roundedRect(-w * 0.24, -h * 0.24, w * 0.48, h * 0.18, 12);
    ctx.fill();
  } else if (boss.type === "dozer") {
    ctx.fillStyle = "#20251e";
    for (const x of [-w * 0.46, w * 0.46]) {
      roundedRect(x - w * 0.12, -h * 0.18, w * 0.24, h * 0.56, 16);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 4;
      for (let y = -h * 0.12; y <= h * 0.3; y += h * 0.12) {
        ctx.beginPath();
        ctx.moveTo(x - w * 0.1, y);
        ctx.lineTo(x + w * 0.1, y - h * 0.05);
        ctx.stroke();
      }
    }
    ctx.fillStyle = boss.color;
    roundedRect(-w * 0.36, -h * 0.4, w * 0.72, h * 0.82, 22);
    ctx.fill();
    ctx.fillStyle = "#c98918";
    roundedRect(-w * 0.66, -h * 0.66, w * 1.32, h * 0.2, 18);
    ctx.fill();
    ctx.strokeStyle = "#8c651b";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-w * 0.52, -h * 0.48);
    ctx.lineTo(-w * 0.28, -h * 0.28);
    ctx.moveTo(w * 0.52, -h * 0.48);
    ctx.lineTo(w * 0.28, -h * 0.28);
    ctx.stroke();
    ctx.fillStyle = "rgba(205, 238, 246, 0.58)";
    roundedRect(-w * 0.22, -h * 0.12, w * 0.44, h * 0.22, 10);
    ctx.fill();
    ctx.fillStyle = "#24282b";
    roundedRect(-w * 0.06, -h * 0.44, w * 0.12, h * 0.18, 5);
    ctx.fill();
  } else {
    ctx.fillStyle = boss.color;
    roundedRect(-w * 0.5, -h * 0.5, w, h, 24);
    ctx.fill();
  }

  if (boss.type === "semi") {
    for (const x of [-w * 0.5, w * 0.5]) {
      drawWheel(x, -h * 0.18, 20, 38, 0, "#828a8f");
      drawWheel(x, h * 0.04, 20, 38, 0, "#828a8f");
    }
    ctx.fillStyle = boss.color;
    roundedRect(-w * 0.48, -h * 0.5, w * 0.96, h * 0.5, 24);
    ctx.fill();
    ctx.fillStyle = "#b92d2d";
    roundedRect(-w * 0.36, -h * 0.6, w * 0.72, h * 0.22, 16);
    ctx.fill();
    ctx.fillStyle = "rgba(205, 238, 246, 0.64)";
    roundedRect(-w * 0.3, -h * 0.34, w * 0.6, h * 0.16, 10);
    ctx.fill();
    ctx.fillStyle = "#2f3436";
    roundedRect(-w * 0.38, -h * 0.53, w * 0.76, h * 0.08, 6);
    ctx.fill();
  }

  const weakFlash = 0.5 + Math.sin(performance.now() * 0.012) * 0.28;
  ctx.fillStyle = `rgba(79, 235, 127, ${weakFlash})`;
  roundedRect(-w * 0.24, h * 0.43, w * 0.48, 24, 8);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 26px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${boss.hits}/${boss.hitsNeeded}`, 0, -h * 0.06);
}

function drawBoostHalo() {
  if (car.turboTimer <= 0) {
    return;
  }
  const t = performance.now() * 0.008;
  const pulse = 0.5 + Math.sin(t * 1.4) * 0.5;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.shadowColor = "rgba(255, 211, 92, 0.92)";
  ctx.shadowBlur = 36 + pulse * 34;
  ctx.strokeStyle = `rgba(255, 211, 92, ${0.32 + pulse * 0.24})`;
  ctx.lineWidth = 18 + pulse * 10;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  const edge = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.26, width / 2, height / 2, Math.max(width, height) * 0.72);
  edge.addColorStop(0, "rgba(255, 211, 92, 0)");
  edge.addColorStop(0.72, `rgba(49, 211, 255, ${0.05 + pulse * 0.06})`);
  edge.addColorStop(1, `rgba(255, 211, 92, ${0.2 + pulse * 0.12})`);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.rotate(car.angle);
  ctx.lineWidth = 5;
  for (let i = 0; i < 4; i += 1) {
    const phase = t + i * 1.35;
    const radiusX = car.width * (0.72 + i * 0.08 + Math.sin(phase) * 0.05);
    const radiusY = car.length * (0.58 + i * 0.04 + Math.cos(phase * 1.2) * 0.035);
    ctx.strokeStyle = [`#ffd35c`, `#31d3ff`, `#ff63c7`, `#7cf58d`][i];
    ctx.globalAlpha = 0.34 + Math.sin(phase) * 0.16;
    ctx.beginPath();
    ctx.ellipse(Math.sin(phase * 1.7) * 10, Math.cos(phase * 1.4) * 14, radiusX, radiusY, phase * 0.45, 0, TWO_PI);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawFade() {
  if (gameState.fade <= 0) {
    return;
  }
  ctx.fillStyle = `rgba(0,0,0,${gameState.fade})`;
  ctx.fillRect(0, 0, width, height);
}

function getTheme() {
  const t = (Math.sin(world.cycle * TWO_PI) + 1) / 2;
  const night = Math.pow(1 - t, 1.7);
  const sunrise = Math.max(0, Math.sin((world.cycle + 0.13) * TWO_PI)) * 0.22;
  const name = night > 0.62 ? "Night" : sunrise > 0.14 ? "Morning" : "Day";
  return { night, sunrise, name };
}

function drawGround(theme) {
  const baseR = Math.round(43 - theme.night * 23 + theme.sunrise * 18);
  const baseG = Math.round(96 - theme.night * 46 + theme.sunrise * 10);
  const baseB = Math.round(44 - theme.night * 23);
  ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
  ctx.fillRect(0, 0, width, height);

  const blade = 64;
  const minX = world.x - getWorldHalfWidth() - blade;
  const maxX = world.x + getWorldHalfWidth() + blade;
  const minY = world.y - getWorldHalfHeight() - blade;
  const maxY = world.y + getWorldHalfHeight() + blade;
  const startX = Math.floor(minX / blade) * blade;
  const startY = Math.floor(minY / blade) * blade;

  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();
  for (let x = startX; x <= maxX; x += blade) {
    for (let y = startY; y <= maxY; y += blade) {
      const shade = hashNumber(Math.floor(x / blade), Math.floor(y / blade), 77);
      ctx.fillStyle = shade > 0.5
        ? `rgba(92, 137, 61, ${0.11 - theme.night * 0.03})`
        : `rgba(21, 72, 36, ${0.1 + theme.night * 0.02})`;
      ctx.fillRect(x, y, blade + 1, blade + 1);
      ctx.strokeStyle = `rgba(174, 198, 92, ${0.16 - theme.night * 0.05})`;
      ctx.lineWidth = 1;
      const gx = x + 8 + hashNumber(Math.floor(x), Math.floor(y), 79) * 42;
      const gy = y + 8 + hashNumber(Math.floor(x), Math.floor(y), 81) * 42;
      ctx.beginPath();
      ctx.moveTo(gx, gy + 9);
      ctx.lineTo(gx + 7, gy - 5);
      ctx.stroke();
    }
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, Math.max(width, height) * 0.75);
  vignette.addColorStop(0, "rgba(255,255,255,0.04)");
  vignette.addColorStop(1, `rgba(0,0,0,${0.26 + theme.night * 0.28})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function drawInterstate(theme) {
  const step = 42;
  const minY = world.y - getWorldHalfHeight() - 220;
  const maxY = world.y + getWorldHalfHeight() + 220;
  const startY = Math.floor(minY / step) * step;
  const edgeAlpha = 0.74 - theme.night * 0.12;
  const laneAlpha = 0.68 - theme.night * 0.08;

  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();

  ctx.beginPath();
  for (let y = startY; y <= maxY; y += step) {
    ctx.lineTo(roadCenterX(y) - ROAD_HALF_WIDTH, y);
  }
  for (let y = maxY; y >= startY; y -= step) {
    ctx.lineTo(roadCenterX(y) + ROAD_HALF_WIDTH, y);
  }
  ctx.closePath();
  ctx.fillStyle = `rgba(${Math.round(34 - theme.night * 14)}, ${Math.round(39 - theme.night * 15)}, ${Math.round(42 - theme.night * 15)}, 1)`;
  ctx.fill();

  ctx.lineWidth = 30;
  ctx.strokeStyle = `rgba(62, 68, 61, ${0.72 - theme.night * 0.18})`;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let y = startY; y <= maxY; y += step) {
      ctx.lineTo(roadCenterX(y) + side * (ROAD_HALF_WIDTH + 23), y);
    }
    ctx.stroke();
  }

  ctx.lineCap = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = `rgba(245, 245, 226, ${edgeAlpha})`;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let y = startY; y <= maxY; y += step) {
      ctx.lineTo(roadCenterX(y) + side * (ROAD_HALF_WIDTH - 18), y);
    }
    ctx.stroke();
  }

  ctx.lineWidth = 5;
  ctx.strokeStyle = `rgba(245, 244, 215, ${laneAlpha})`;
  for (let lane = 1; lane < ROAD_LANES; lane += 1) {
    const offset = (lane - ROAD_LANES / 2) * LANE_WIDTH;
    for (let y = startY; y <= maxY; y += 105) {
      const y2 = y + 48;
      ctx.beginPath();
      ctx.moveTo(roadCenterX(y) + offset, y);
      ctx.lineTo(roadCenterX(y2) + offset, y2);
      ctx.stroke();
    }
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(255, 205, 70, ${0.62 + theme.sunrise * 0.12})`;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let y = startY; y <= maxY; y += step) {
      ctx.lineTo(roadCenterX(y) + side * ROAD_HALF_WIDTH, y);
    }
    ctx.stroke();
  }

  ctx.font = "700 42px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = `rgba(255, 255, 255, ${0.18 - theme.night * 0.04})`;
  for (let band = Math.floor(minY / CLOSURE_TILE_SIZE); band <= Math.floor(maxY / CLOSURE_TILE_SIZE); band += 1) {
    const lane = closedLaneForBand(band);
    if (lane < 0) {
      continue;
    }
    const labelY = band * CLOSURE_TILE_SIZE + 90;
    if (labelY < minY || labelY > maxY) {
      continue;
    }
    ctx.save();
    ctx.translate(laneCenterX(lane, labelY), labelY);
    ctx.rotate(roadAngle(labelY));
    ctx.fillText("LANE CLOSED", 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function drawRoadPickups(theme) {
  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();

  for (const pad of boostPads.values()) {
    if (pad.used) {
      continue;
    }
    const screen = worldToScreen(pad.x, pad.y);
    if (screen.x < -140 || screen.x > width + 140 || screen.y < -160 || screen.y > height + 160) {
      continue;
    }
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.rotate(roadAngle(pad.y));
    ctx.fillStyle = `rgba(49, 211, 255, ${0.52 + Math.sin(performance.now() * 0.01) * 0.16})`;
    roundedRect(-42, -68, 84, 136, 14);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.beginPath();
    ctx.moveTo(0, -48);
    ctx.lineTo(28, 0);
    ctx.lineTo(8, 0);
    ctx.lineTo(8, 48);
    ctx.lineTo(-28, -8);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  for (const ramp of ramps.values()) {
    if (ramp.used) {
      continue;
    }
    const screen = worldToScreen(ramp.x, ramp.y);
    if (screen.x < -220 || screen.x > width + 220 || screen.y < -220 || screen.y > height + 220) {
      continue;
    }
    ctx.save();
    ctx.translate(ramp.x, ramp.y);
    ctx.rotate(ramp.angle);
    ctx.fillStyle = "rgba(17, 20, 22, 0.32)";
    roundedRect(-74, -210, 148, 420, 18);
    ctx.fill();
    ctx.fillStyle = "#565d61";
    roundedRect(-58, -190, 116, 380, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 16]);
    ctx.beginPath();
    ctx.moveTo(0, -170);
    ctx.lineTo(0, 170);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.88)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-50, -186);
    ctx.lineTo(-50, 186);
    ctx.moveTo(50, -186);
    ctx.lineTo(50, 186);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 211, 92, 0.9)";
    ctx.fillRect(-58, -190, 116, 20);
    ctx.fillRect(-58, 170, 116, 20);
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.font = "700 34px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("EXIT", 0, -92);
    ctx.restore();
  }

  const minY = world.y - getWorldHalfHeight() - 600;
  const maxY = world.y + getWorldHalfHeight() + 600;
  for (let band = Math.floor(minY / TUNNEL_INTERVAL) - 1; band <= Math.floor(maxY / TUNNEL_INTERVAL) + 1; band += 1) {
    const start = tunnelStartForBand(band);
    for (const portalY of [start, start + TUNNEL_LENGTH]) {
      if (portalY < minY || portalY > maxY) {
        continue;
      }
      ctx.save();
      ctx.translate(roadCenterX(portalY), portalY);
      ctx.rotate(roadAngle(portalY));
      ctx.fillStyle = "rgba(10, 13, 16, 0.86)";
      roundedRect(-ROAD_HALF_WIDTH * 0.88, -70, ROAD_HALF_WIDTH * 1.76, 140, 26);
      ctx.fill();
      ctx.strokeStyle = "rgba(230,230,210,0.58)";
      ctx.lineWidth = 8;
      roundedRect(-ROAD_HALF_WIDTH * 0.78, -56, ROAD_HALF_WIDTH * 1.56, 112, 22);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

function drawTunnelOverlay(theme) {
  const playerWorld = screenToWorld(car.x, car.y);
  const tunnel = getTunnelAt(playerWorld.y);
  const jump = getJumpHeight();
  if (!tunnel || jump > 35) {
    return;
  }
  const edgeFade = Math.min(playerWorld.y - tunnel.start, tunnel.end - playerWorld.y, 420);
  const alpha = clamp(1 - edgeFade / 420, 0, 1) * 0.32 + 0.42;
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, width, height);
}

function drawHills(theme) {
  const grid = 96;
  const minX = world.x - getWorldHalfWidth() - grid;
  const maxX = world.x + getWorldHalfWidth() + grid;
  const minY = world.y - getWorldHalfHeight() - grid;
  const maxY = world.y + getWorldHalfHeight() + grid;
  const startX = Math.floor(minX / grid) * grid;
  const startY = Math.floor(minY / grid) * grid;

  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();
  ctx.globalCompositeOperation = "overlay";
  for (let x = startX; x <= maxX; x += grid) {
    for (let y = startY; y <= maxY; y += grid) {
      const hill = sampleHill(x, y);
      const alpha = Math.abs(hill) * (0.08 + theme.sunrise * 0.04);
      ctx.fillStyle = hill > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(x, y, grid + 1, grid + 1);
    }
  }
  ctx.restore();
}

function drawEnvironmentObjects(theme) {
  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();

  for (const item of environmentObjects.values()) {
    const screen = worldToScreen(item.x, item.y);
    if (screen.x < -120 || screen.x > width + 120 || screen.y < -120 || screen.y > height + 120) {
      continue;
    }

    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle);

    if (item.type === "tree") {
      ctx.fillStyle = `rgba(0, 0, 0, ${item.flattened ? 0.14 : 0.22})`;
      ctx.beginPath();
      ctx.ellipse(8, 10, item.radius * 0.8, item.radius * 0.36, 0.4, 0, TWO_PI);
      ctx.fill();

      ctx.fillStyle = item.flattened ? "#6f4c2b" : "#74451e";
      roundedRect(-5, -item.radius * 0.35, 10, item.radius * 0.75, 4);
      ctx.fill();

      const green = theme.night > 0.55 ? "#17491f" : "#277337";
      ctx.fillStyle = item.flattened ? "rgba(39, 115, 55, 0.62)" : green;
      ctx.beginPath();
      ctx.arc(0, -item.radius * 0.24, item.radius, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = `rgba(83, 154, 72, ${item.flattened ? 0.24 : 0.42})`;
      ctx.beginPath();
      ctx.arc(-item.radius * 0.22, -item.radius * 0.45, item.radius * 0.5, 0, TWO_PI);
      ctx.fill();
    } else if (item.type === "barrel") {
      ctx.fillStyle = `rgba(0, 0, 0, ${item.flattened ? 0.14 : 0.22})`;
      ctx.beginPath();
      ctx.ellipse(6, 10, item.radius * 0.8, item.radius * 0.35, 0.3, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = item.flattened ? "#4d9ed6" : "#36aeea";
      roundedRect(-item.radius * 0.55, -item.radius * 0.75, item.radius * 1.1, item.radius * 1.5, 8);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillRect(-item.radius * 0.5, -item.radius * 0.18, item.radius, 5);
    } else if (item.type === "sign") {
      ctx.strokeStyle = "#d8d8c8";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, item.radius);
      ctx.lineTo(0, -item.radius * 0.9);
      ctx.stroke();
      ctx.fillStyle = item.flattened ? "#c16b35" : "#e3a642";
      ctx.fillRect(-item.radius * 0.75, -item.radius * 1.2, item.radius * 1.5, item.radius * 0.72);
    } else if (item.type === "guard") {
      ctx.strokeStyle = item.flattened ? "rgba(170,178,174,0.65)" : "#b7c0bd";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(-item.radius, 0);
      ctx.lineTo(item.radius, 0);
      ctx.stroke();
      ctx.fillStyle = "#6f7774";
      ctx.fillRect(-item.radius * 0.75, 8, 8, 18);
      ctx.fillRect(item.radius * 0.5, 8, 8, 18);
    } else {
      ctx.strokeStyle = item.flattened ? "rgba(114, 139, 48, 0.62)" : "rgba(181, 204, 79, 0.9)";
      ctx.lineWidth = item.flattened ? 3 : 4;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(i * 5, item.radius * 0.35);
        ctx.lineTo(i * 3 + Math.sin(item.angle + i) * 12, -item.radius * (item.flattened ? 0.08 : 0.68));
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawCop(theme) {
  if (!cop.active) {
    return;
  }

  const screen = worldToScreen(cop.x, cop.y);
  if (screen.x < -220 || screen.x > width + 220 || screen.y < -280 || screen.y > height + 280) {
    return;
  }

  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();
  ctx.translate(cop.x, cop.y);
  ctx.rotate(cop.angle);
  drawVehicleShape(cop, false);

  ctx.fillStyle = "#111820";
  ctx.fillRect(-cop.width * 0.5, -cop.length * 0.06, cop.width, cop.length * 0.16);
  const blink = Math.sin(performance.now() * 0.018) > 0;
  ctx.fillStyle = blink ? "#1f78ff" : "#ff2a2a";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 22;
  roundedRect(-cop.width * 0.28, -cop.length * 0.18, cop.width * 0.22, cop.length * 0.07, 5);
  ctx.fill();
  ctx.fillStyle = blink ? "#ff2a2a" : "#1f78ff";
  ctx.shadowColor = ctx.fillStyle;
  roundedRect(cop.width * 0.06, -cop.length * 0.18, cop.width * 0.22, cop.length * 0.07, 5);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = `rgba(80, 155, 255, ${0.22 + (blink ? 0.2 : 0)})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, cop.length * 0.78, 0, TWO_PI);
  ctx.stroke();
  ctx.restore();
}

function drawSkidMarks(theme) {
  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();
  ctx.lineCap = "round";
  for (const mark of skidMarks) {
    const fade = 1 - mark.age / mark.life;
    ctx.globalAlpha = fade * mark.strength * (0.42 + theme.night * 0.16);
    ctx.strokeStyle = "#050607";
    ctx.lineWidth = 5 + mark.strength * 7;
    ctx.beginPath();
    const len = 28 + Math.abs(car.speed) * 0.025;
    ctx.moveTo(mark.x - Math.sin(mark.angle) * len, mark.y + Math.cos(mark.angle) * len);
    ctx.lineTo(mark.x + Math.sin(mark.angle) * len, mark.y - Math.cos(mark.angle) * len);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawCones(theme) {
  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();

  for (const cone of cones.values()) {
    const screen = worldToScreen(cone.x, cone.y);
    if (screen.x < -80 || screen.x > width + 80 || screen.y < -80 || screen.y > height + 80) {
      continue;
    }

    ctx.save();
    ctx.translate(cone.x, cone.y);
    ctx.rotate(cone.angle);

    ctx.fillStyle = `rgba(0, 0, 0, ${cone.tipped ? 0.2 : 0.3})`;
    ctx.beginPath();
    ctx.ellipse(6, 13, cone.tipped ? 25 : 18, cone.tipped ? 8 : 12, 0.2, 0, TWO_PI);
    ctx.fill();

    if (cone.tipped) {
      ctx.fillStyle = "#ec6f22";
      roundedRect(-7, -22, 14, 43, 5);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillRect(-7, -9, 14, 5);
      ctx.fillRect(-7, 8, 14, 5);
      ctx.fillStyle = "#b44a18";
      ctx.fillRect(-15, 18, 30, 8);
    } else {
      const coneShade = theme.night > 0.5 ? "#cf581b" : "#f37a24";
      ctx.fillStyle = coneShade;
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(17, 18);
      ctx.lineTo(-17, 18);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(-10, -2, 20, 5);
      ctx.fillRect(-14, 11, 28, 5);
      ctx.fillStyle = "#803412";
      ctx.fillRect(-22, 18, 44, 9);
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawTraffic(theme) {
  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();

  for (const traffic of trafficCars.values()) {
    const screen = worldToScreen(traffic.x, traffic.y);
    if (screen.x < -180 || screen.x > width + 180 || screen.y < -260 || screen.y > height + 260) {
      continue;
    }

    ctx.save();
    ctx.translate(traffic.x, traffic.y);
    ctx.rotate(traffic.angle);
    drawVehicleShape(traffic, false);

    if (traffic.horn > 0) {
      ctx.strokeStyle = `rgba(255, 221, 80, ${traffic.horn})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -traffic.length * 0.45, traffic.width * (0.7 + traffic.horn), -2.5, -0.65);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -traffic.length * 0.45, traffic.width * (1.0 + traffic.horn), -2.5, -0.65);
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

function drawExplosions(theme) {
  ctx.save();
  applyWorldJumpTransform();
  applyWorldTransform();

  for (const boom of explosions) {
    const fade = 1 - boom.age / boom.life;
    ctx.globalAlpha = fade;
    ctx.fillStyle = boom.color;
    ctx.beginPath();
    ctx.arc(boom.x, boom.y, boom.radius * (1 + boom.age * 1.8), 0, TWO_PI);
    ctx.fill();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawGuidanceLights(theme) {
  const nightBoost = 0.38 + theme.night * 0.62;
  const brake = 0.3 + car.brakeGlow * 0.7;

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.rotate(car.angle);

  const front = -car.length * 0.36;
  const rear = car.length * 0.36;
  const headBeam = ctx.createLinearGradient(0, front, 0, front - 360);
  headBeam.addColorStop(0, `rgba(255, 242, 154, ${0.28 * nightBoost})`);
  headBeam.addColorStop(0.55, `rgba(255, 232, 124, ${0.13 * nightBoost})`);
  headBeam.addColorStop(1, "rgba(255, 232, 124, 0)");
  ctx.fillStyle = headBeam;
  ctx.beginPath();
  ctx.moveTo(-car.width * 0.3, front);
  ctx.lineTo(0, front - 370);
  ctx.lineTo(car.width * 0.3, front);
  ctx.closePath();
  ctx.fill();

  const tailBeam = ctx.createLinearGradient(0, rear, 0, rear + 190);
  tailBeam.addColorStop(0, `rgba(255, 28, 28, ${0.26 * brake})`);
  tailBeam.addColorStop(1, "rgba(255, 28, 28, 0)");
  ctx.fillStyle = tailBeam;
  ctx.beginPath();
  ctx.moveTo(-car.width * 0.28, rear);
  ctx.lineTo(0, rear + 205);
  ctx.lineTo(car.width * 0.28, rear);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPlayerCar(theme) {
  const hillTilt = world.hill * 4 * CAMERA_ZOOM;
  const w = car.width;
  const h = car.length;

  ctx.save();
  ctx.translate(car.x, car.y + hillTilt);
  ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
  ctx.rotate(car.angle);

  ctx.fillStyle = "rgba(0, 0, 0, 0.26)";
  ctx.beginPath();
  ctx.ellipse(7, h * 0.06, w * 0.62, h * 0.5, 0.04, 0, TWO_PI);
  ctx.fill();

  for (const x of [-w * 0.52, w * 0.52]) {
    drawWheel(x, -h * 0.3, w * 0.12, h * 0.12, 0, "#687079");
    drawWheel(x, h * 0.29, w * 0.12, h * 0.13, 0, "#687079");
  }

  const bodyRed = Math.round(car.sensed ? 230 : 210);
  ctx.fillStyle = `rgb(${bodyRed}, 24, 26)`;
  roundedRect(-w * 0.46, -h * 0.48, w * 0.92, h * 0.96, w * 0.2);
  ctx.fill();

  ctx.fillStyle = "#f53a2f";
  roundedRect(-w * 0.34, -h * 0.56, w * 0.68, h * 0.28, w * 0.16);
  roundedRect(-w * 0.38, h * 0.24, w * 0.76, h * 0.25, w * 0.14);
  ctx.fill();

  ctx.fillStyle = "rgba(185, 232, 250, 0.72)";
  roundedRect(-w * 0.25, -h * 0.22, w * 0.5, h * 0.19, 10);
  roundedRect(-w * 0.27, h * 0.06, w * 0.54, h * 0.19, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(26, 55, 64, 0.42)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-w * 0.25, -h * 0.01);
  ctx.lineTo(w * 0.25, -h * 0.01);
  ctx.moveTo(-w * 0.27, h * 0.27);
  ctx.lineTo(w * 0.27, h * 0.27);
  ctx.stroke();

  ctx.fillStyle = "#ffd61f";
  roundedRect(-w * 0.08, -h * 0.43, w * 0.16, h * 0.22, 5);
  ctx.fill();
  ctx.fillStyle = "#f8c400";
  roundedRect(-w * 0.38, -h * 0.05, w * 0.15, h * 0.21, 5);
  roundedRect(w * 0.23, -h * 0.05, w * 0.15, h * 0.21, 5);
  ctx.fill();
  ctx.fillStyle = "#b91518";
  ctx.font = "900 22px Arial, Helvetica, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("7", 0, -h * 0.32);

  ctx.fillStyle = `rgba(255, 246, 184, ${0.72 + theme.night * 0.25})`;
  roundedRect(-w * 0.32, -h * 0.54, w * 0.18, h * 0.055, 6);
  roundedRect(w * 0.14, -h * 0.54, w * 0.18, h * 0.055, 6);
  ctx.fill();

  const red = Math.round(110 + car.brakeGlow * 145);
  ctx.fillStyle = `rgb(${red}, 18, 18)`;
  ctx.shadowColor = `rgba(255, 0, 0, ${0.35 + car.brakeGlow * 0.55})`;
  ctx.shadowBlur = 12 + car.brakeGlow * 26;
  roundedRect(-w * 0.32, h * 0.475, w * 0.18, h * 0.055, 6);
  roundedRect(w * 0.14, h * 0.475, w * 0.18, h * 0.055, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawTouchPoints(theme) {
  if (!activeTouches.size) {
    return;
  }
  ctx.save();
  for (const point of activeTouches.values()) {
    const pulse = 7 + Math.sin(performance.now() * 0.012 + point.id) * 2;
    ctx.fillStyle = `rgba(126, 222, 255, ${0.24 + theme.night * 0.16})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 24 + pulse, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.64)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 13, 0, TWO_PI);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSmoke() {
  ctx.save();
  for (const puff of tireSmoke) {
    const fade = 1 - puff.age / puff.life;
    ctx.globalAlpha = fade * 0.24;
    ctx.fillStyle = "#e9eef0";
    ctx.beginPath();
    ctx.arc(puff.x, puff.y - puff.age * 38, puff.radius + puff.age * 24, 0, TWO_PI);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function roundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function getMissionMenuMaxScroll() {
  const columns = width < 760 ? 1 : 2;
  const gap = 18;
  const cardHeight = 188;
  const cardCount = MISSIONS.length + 1;
  const rows = Math.ceil(cardCount / columns);
  const contentHeight = rows * cardHeight + (rows - 1) * gap;
  return Math.max(0, contentHeight - Math.max(260, height - 190));
}

function scrollMissionMenu(delta) {
  gameState.missionMenuScroll = clamp(gameState.missionMenuScroll + delta, 0, getMissionMenuMaxScroll());
}

function getOverlayButtonAt(x, y) {
  for (let i = overlayButtons.length - 1; i >= 0; i -= 1) {
    const button = overlayButtons[i];
    if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
      return button;
    }
  }
  return null;
}

function handlePointerDown(event) {
  const x = event.clientX;
  const y = event.clientY;
  const button = getOverlayButtonAt(x, y);
  if (button) {
    handleOverlayAction(button.action);
    return;
  }
  if (gameState.phase === "missionMenu") {
    missionMenuDrag = {
      id: event.pointerId,
      y,
      moved: false,
    };
    canvas.setPointerCapture?.(event.pointerId);
    return;
  }
  if (!isDrivingPhase()) {
    return;
  }
  canvas.setPointerCapture?.(event.pointerId);
  activeTouches.set(event.pointerId, {
    id: event.pointerId,
    x,
    y,
  });
  initAudio();
}

function handlePointerMove(event) {
  if (missionMenuDrag && missionMenuDrag.id === event.pointerId) {
    const delta = missionMenuDrag.y - event.clientY;
    if (Math.abs(delta) > 1) {
      scrollMissionMenu(delta);
      missionMenuDrag.moved = true;
    }
    missionMenuDrag.y = event.clientY;
    return;
  }
  if (!activeTouches.has(event.pointerId)) {
    return;
  }
  activeTouches.set(event.pointerId, {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  });
}

function handlePointerUp(event) {
  activeTouches.delete(event.pointerId);
  if (missionMenuDrag && missionMenuDrag.id === event.pointerId) {
    missionMenuDrag = null;
  }
}

function handleOverlayAction(action = "overlay") {
  initAudio();
  if (action === "startGame") {
    startLevel(0);
  } else if (action === "missionMenu") {
    gameState.missionMenuScroll = 0;
    setPhase("missionMenu");
  } else if (action === "backStart") {
    setPhase("start");
  } else if (action.startsWith("mission:")) {
    startMission(action.slice("mission:".length));
  } else if (gameState.phase === "start") {
    startLevel(0);
  } else if (gameState.phase === "trainingIntro") {
    setupTrainingCourse();
  } else if (gameState.phase === "trainingFail") {
    setupTrainingCourse();
  } else if (gameState.phase === "bossIntro") {
    startBossFight();
  } else if (gameState.phase === "levelComplete") {
    startLevel(gameState.levelIndex + 1);
  } else if (gameState.phase === "gameComplete") {
    setPhase("start");
  } else if (gameState.phase === "crushed") {
    startBossFight();
  } else if (gameState.phase === "missionComplete") {
    gameState.missionMenuScroll = 0;
    setPhase("missionMenu");
  } else if (gameState.phase === "missionFail") {
    startMission(gameState.activeMissionId || "grocery");
  }
}

function initAudio() {
  if (audio || !audioEnabled) {
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }
  const context = new AudioContext();
  const engine = context.createOscillator();
  const engineGain = context.createGain();
  const skid = context.createOscillator();
  const skidGain = context.createGain();
  const traffic = context.createOscillator();
  const trafficGain = context.createGain();
  const siren = context.createOscillator();
  const sirenGain = context.createGain();
  const fun = context.createOscillator();
  const fun2 = context.createOscillator();
  const funGain = context.createGain();
  const master = context.createGain();

  engine.type = "sawtooth";
  skid.type = "square";
  traffic.type = "triangle";
  siren.type = "sine";
  fun.type = "triangle";
  fun2.type = "square";
  engine.frequency.value = 54;
  skid.frequency.value = 210;
  traffic.frequency.value = 96;
  siren.frequency.value = 520;
  fun.frequency.value = 392;
  fun2.frequency.value = 523.25;
  engineGain.gain.value = 0;
  skidGain.gain.value = 0;
  trafficGain.gain.value = 0;
  sirenGain.gain.value = 0;
  funGain.gain.value = 0;
  master.gain.value = 0.07;

  engine.connect(engineGain).connect(master).connect(context.destination);
  skid.connect(skidGain).connect(master);
  traffic.connect(trafficGain).connect(master);
  siren.connect(sirenGain).connect(master);
  fun.connect(funGain).connect(master);
  fun2.connect(funGain);
  engine.start();
  skid.start();
  traffic.start();
  siren.start();
  fun.start();
  fun2.start();
  audio = { context, engine, engineGain, skid, skidGain, traffic, trafficGain, siren, sirenGain, fun, fun2, funGain, master };
}

function updateAudio() {
  if (!audio || audio.context.state === "closed") {
    return;
  }
  const now = audio.context.currentTime;
  const speedAbs = Math.abs(car.speed);
  const gearThresholds = [0, 330, 650, 980, 1280];
  let nextGear = 1;
  for (let i = 1; i < gearThresholds.length; i += 1) {
    if (speedAbs > gearThresholds[i]) {
      nextGear = i + 1;
    }
  }
  if (nextGear !== car.gear && speedAbs > 180) {
    playGearShift(nextGear > car.gear ? 0.8 : 0.35);
    car.gear = nextGear;
  }

  const gearBase = 82 + car.gear * 24;
  const gearProgress = clamp((speedAbs - gearThresholds[car.gear - 1]) / 360, 0, 1);
  const rpm = gearBase + gearProgress * 210 + Math.abs(world.hill) * 48;
  audio.engine.frequency.setTargetAtTime(rpm, now, 0.035);
  audio.engineGain.gain.setTargetAtTime(audioEnabled ? 0.13 + clamp(speedAbs / 1500, 0, 1) * 0.18 : 0, now, 0.06);
  audio.skid.frequency.setTargetAtTime(180 + speedAbs * 0.5, now, 0.02);
  audio.skidGain.gain.setTargetAtTime(audioEnabled ? car.skid * 0.12 : 0, now, 0.025);

  let trafficVolume = 0;
  let trafficPitch = 90;
  let horns = 0;
  for (const other of trafficCars.values()) {
    const screen = worldToScreen(other.x, other.y);
    const distance = Math.hypot(screen.x - car.x, screen.y - car.y);
    const influence = clamp(1 - distance / Math.max(width, height), 0, 1);
    trafficVolume += influence * 0.045;
    trafficPitch += influence * other.noisePitch * 46;
    horns += other.horn * influence;
  }
  audio.traffic.frequency.setTargetAtTime(trafficPitch + horns * 260, now, 0.05);
  audio.trafficGain.gain.setTargetAtTime(audioEnabled ? clamp(trafficVolume + horns * 0.09, 0, 0.16) : 0, now, 0.08);

  if (audio.siren) {
    const sirenWave = (Math.sin(performance.now() * 0.0065) + 1) / 2;
    const copDistance = cop.active ? Math.hypot(worldToScreen(cop.x, cop.y).x - car.x, worldToScreen(cop.x, cop.y).y - car.y) : 9999;
    const copInfluence = cop.active ? clamp(1 - copDistance / (Math.max(width, height) * 1.35), 0.12, 1) : 0;
    audio.siren.frequency.setTargetAtTime(520 + sirenWave * 420, now, 0.035);
    audio.sirenGain.gain.setTargetAtTime(audioEnabled ? copInfluence * 0.17 : 0, now, 0.06);
  }

  if (audio.fun) {
    const beat = Math.floor(performance.now() / 170) % 8;
    const notes = [392, 523.25, 587.33, 659.25, 587.33, 523.25, 783.99, 659.25];
    audio.fun.frequency.setTargetAtTime(notes[beat], now, 0.018);
    audio.fun2.frequency.setTargetAtTime(notes[(beat + 2) % notes.length] * 0.5, now, 0.022);
    audio.funGain.gain.setTargetAtTime(audioEnabled && car.turboTimer > 0 ? 0.075 : 0, now, 0.08);
  }
}

function playGearShift(force) {
  if (!audio || !audioEnabled || audio.context.state === "closed") {
    return;
  }

  const now = audio.context.currentTime;
  const shift = audio.context.createOscillator();
  const gain = audio.context.createGain();
  shift.type = "sawtooth";
  shift.frequency.setValueAtTime(260, now);
  shift.frequency.exponentialRampToValueAtTime(120, now + 0.12);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.08 * force, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  shift.connect(gain).connect(audio.master);
  shift.start(now);
  shift.stop(now + 0.2);
}

function playExplosion(power) {
  if (!audio || !audioEnabled || audio.context.state === "closed") {
    return;
  }

  const now = audio.context.currentTime;
  const blast = audio.context.createOscillator();
  const crackle = audio.context.createOscillator();
  const blastGain = audio.context.createGain();
  const crackleGain = audio.context.createGain();
  const force = clamp(power, 0.5, 1.2);

  blast.type = "triangle";
  crackle.type = "square";
  blast.frequency.setValueAtTime(92, now);
  blast.frequency.exponentialRampToValueAtTime(31, now + 0.36);
  crackle.frequency.setValueAtTime(820, now);
  crackle.frequency.exponentialRampToValueAtTime(180, now + 0.28);

  blastGain.gain.setValueAtTime(0.001, now);
  blastGain.gain.exponentialRampToValueAtTime(0.34 * force, now + 0.018);
  blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
  crackleGain.gain.setValueAtTime(0.001, now);
  crackleGain.gain.exponentialRampToValueAtTime(0.11 * force, now + 0.02);
  crackleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

  blast.connect(blastGain).connect(audio.master);
  crackle.connect(crackleGain).connect(audio.master);
  blast.start(now);
  crackle.start(now);
  blast.stop(now + 0.52);
  crackle.stop(now + 0.28);
}

function playBoostSound() {
  if (!audio || !audioEnabled || audio.context.state === "closed") {
    return;
  }
  const now = audio.context.currentTime;
  const boost = audio.context.createOscillator();
  const gain = audio.context.createGain();
  boost.type = "sawtooth";
  boost.frequency.setValueAtTime(220, now);
  boost.frequency.exponentialRampToValueAtTime(780, now + 0.22);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.16, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
  boost.connect(gain).connect(audio.master);
  boost.start(now);
  boost.stop(now + 0.45);
}

function playRampTone(power) {
  if (!audio || !audioEnabled || audio.context.state === "closed") {
    return;
  }
  const now = audio.context.currentTime;
  const ramp = audio.context.createOscillator();
  const gain = audio.context.createGain();
  const force = clamp(power, 0.35, 1);
  ramp.type = "sine";
  ramp.frequency.setValueAtTime(360, now);
  ramp.frequency.exponentialRampToValueAtTime(1260 + force * 520, now + 0.7);
  ramp.frequency.exponentialRampToValueAtTime(430, now + 1.35);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.13, now + 0.12);
  gain.gain.setValueAtTime(0.12, now + 0.75);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
  ramp.connect(gain).connect(audio.master);
  ramp.start(now);
  ramp.stop(now + 1.55);
}

function playConeHit(power) {
  if (!audio || !audioEnabled || audio.context.state === "closed") {
    return;
  }

  const now = audio.context.currentTime;
  const thump = audio.context.createOscillator();
  const scrape = audio.context.createOscillator();
  const thumpGain = audio.context.createGain();
  const scrapeGain = audio.context.createGain();
  const impact = clamp(power, 0.12, 1);

  thump.type = "triangle";
  scrape.type = "square";
  thump.frequency.setValueAtTime(150 - impact * 55, now);
  thump.frequency.exponentialRampToValueAtTime(45, now + 0.16);
  scrape.frequency.setValueAtTime(520 + impact * 240, now);
  scrape.frequency.exponentialRampToValueAtTime(190, now + 0.22);

  thumpGain.gain.setValueAtTime(0.001, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.22 * impact, now + 0.012);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  scrapeGain.gain.setValueAtTime(0.001, now);
  scrapeGain.gain.exponentialRampToValueAtTime(0.06 * impact, now + 0.025);
  scrapeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

  thump.connect(thumpGain).connect(audio.master);
  scrape.connect(scrapeGain).connect(audio.master);
  thump.start(now);
  scrape.start(now);
  thump.stop(now + 0.24);
  scrape.stop(now + 0.32);
}

function setSound(enabled) {
  audioEnabled = enabled;
  soundButton.setAttribute("aria-pressed", String(enabled));
  if (enabled) {
    initAudio();
    audio?.context.resume?.();
  }
  updateAudio();
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function updateFullscreenButton() {
  fullscreenButton.setAttribute("aria-pressed", String(Boolean(getFullscreenElement())));
}

function toggleFullscreen() {
  const fullscreenElement = getFullscreenElement();
  if (fullscreenElement) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    exit?.call(document);
    return;
  }

  const request = gameShell.requestFullscreen || gameShell.webkitRequestFullscreen;
  request?.call(gameShell);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateGame(dt);
  draw();
  speedText.textContent = car.speed < -8 ? `R ${Math.round(Math.abs(car.speed) / 8)}` : `${Math.round(Math.abs(car.speed) / 8)}`;
  const showWanted = isRacePhase() || gameState.phase === "mission";
  wantedText.textContent = showWanted ? `${"*".repeat(wantedStars)}${"-".repeat(5 - wantedStars)}` : "-----";
  requestAnimationFrame(loop);
}

canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerUp);
canvas.addEventListener("lostpointercapture", handlePointerUp);
canvas.addEventListener("wheel", (event) => {
  if (gameState.phase !== "missionMenu") {
    return;
  }
  event.preventDefault();
  scrollMissionMenu(event.deltaY);
}, { passive: false });
soundButton.addEventListener("click", () => setSound(!audioEnabled));
fullscreenButton.addEventListener("click", toggleFullscreen);
window.addEventListener("resize", resize);
window.addEventListener("contextmenu", (event) => event.preventDefault());
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("webkitfullscreenchange", updateFullscreenButton);

resize();
car.x = width / 2;
car.y = height / 2;
updateFullscreenButton();
requestAnimationFrame(loop);
