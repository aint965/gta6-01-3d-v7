import { createCity } from './world.js';
import { mat4, identity, multiply, lookAt, perspective } from './matrix.js';
import { CAR_PROFILES, makeCar, driveCar, carHitsWorld, carsOverlap, beamAt } from './vehicles.js';
import { createTraffic, updateTraffic, createPedestrians, updatePedestrians, signalState } from './traffic.js';
import { streetMesh } from './street-mesh.js';
import { createHud } from './hud.js';
import { MISSIONS, objectiveFor, insideBoundary, formatMissionTime } from './missions.js';
import { createPolice, distance } from './police.js';
import { createCombat } from './combat.js';
import { createGarage, GARAGES } from './garage.js';
import { createRadio } from './radio.js';
import { createTitleScreen } from './title.js';

const canvas = document.querySelector('#scene');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, preserveDrawingBuffer: true });
if (!gl) throw new Error('WebGL 2 is required.');

const vertexShader = `#version 300 es
in vec3 position;
in vec3 normal;
in vec4 tint;
in float kind;
uniform mat4 viewProjection;
uniform mat4 model;
out vec3 worldNormal;
out vec3 worldPosition;
out vec4 color;
out float surface;
void main() {
  vec4 point = model * vec4(position, 1.0);
  worldPosition = point.xyz;
  worldNormal = mat3(model) * normal;
  color = tint;
  surface = kind;
  gl_Position = viewProjection * point;
}`;

const fragmentShader = `#version 300 es
precision highp float;
in vec3 worldNormal;
in vec3 worldPosition;
in vec4 color;
in float surface;
uniform vec3 sunDirection;
uniform vec3 eye;
uniform vec3 sky;
uniform float night;
uniform float timeOfDay;
uniform float sunset;
uniform int headlightCount;
uniform vec4 headlightPose[16];
uniform float headlightStrength;
uniform vec2 searchlight;
uniform float searchlightOn;
out vec4 outColor;
void main() {
  vec3 N = normalize(worldNormal);
  vec3 V = normalize(eye - worldPosition);
  vec3 L = normalize(sunDirection);
  float diffuse = max(dot(N, L), 0.0);
  float hemi = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 dayLight = vec3(1.00, 0.94, 0.82) * (0.59 + diffuse * 0.95);
  vec3 duskLight = vec3(1.00, 0.75, 0.58) * (0.57 + diffuse * 0.77);
  vec3 nightLight = vec3(0.52, 0.64, 0.84) * (0.39 + diffuse * 0.33);
  vec3 lighting = mix(dayLight, nightLight, night);
  lighting = mix(lighting, duskLight, sunset);
  lighting *= mix(0.76, 1.12, hemi);
  vec3 base = color.rgb * lighting;

  if (surface > 1.5 && surface < 2.5) {
    float paneU = fract((worldPosition.x + worldPosition.z * 0.17) * 0.075);
    float paneV = fract(worldPosition.y * 0.075);
    float edge = step(0.105, paneU) * step(0.11, paneV) * (1.0 - step(0.91, paneV));
    float roomSeed = sin(floor(worldPosition.x * 0.031) * 17.17 + floor(worldPosition.y * 0.031) * 41.73);
    float occupied = step(-0.32, roomSeed);
    float roomGlow = edge * occupied * night;
    base = mix(base, vec3(1.0, 0.65, 0.32), roomGlow * 1.38);
    float silhouette = step(0.78, fract(worldPosition.x * 0.041 + worldPosition.y * 0.013 + roomSeed));
    float person = silhouette * edge * night * 0.76;
    base = mix(base, vec3(0.045, 0.075, 0.09), person);
    float desk = step(0.90, fract(worldPosition.x * 0.023 + worldPosition.y * 0.041 + roomSeed));
    base = mix(base, vec3(0.44, 0.28, 0.14), desk * edge * night * 0.72);
    if (surface < 2.1) {
      float litPane = step(0.58, fract(worldPosition.x * 0.117 + worldPosition.y * 0.043));
      base = mix(base, vec3(1.0, 0.69, 0.39), litPane * night * 0.93);
    }
  }

  if (surface > 2.5 && surface < 3.5) {
    float facing = pow(max(dot(reflect(-L, N), V), 0.0), 9.0);
    float skyline = smoothstep(0.0,0.55,reflect(-V,N).y);
    float glare = (facing * 1.48 + skyline * 0.20) * (1.0 - night) * (1.0 - sunset * 0.45);
    vec3 reflection = mix(vec3(0.22, 0.43, 0.52), vec3(0.67, 0.82, 0.84), skyline);
    base = mix(base, reflection * (1.0-night*0.68), 0.55);
    base += vec3(1.0, 0.86, 0.61) * glare;
    vec2 office = vec2(mix(worldPosition.x,worldPosition.z,abs(N.x))/44.0,worldPosition.y/34.0);
    vec2 pane = fract(office);
    float room = step(0.43,fract(sin(dot(floor(office),vec2(19.9,73.1)))*853.7));
    float frame = step(0.10,pane.x)*step(pane.x,0.94)*step(0.09,pane.y)*step(pane.y,0.93);
    vec3 interior = mix(vec3(0.58,0.33,0.19),vec3(1.0,0.77,0.48),smoothstep(0.26,0.93,pane.y));
    float desk = step(0.14,pane.x)*step(pane.x,0.69)*step(pane.y,0.31);
    float chair = step(0.70,pane.x)*step(pane.x,0.82)*step(pane.y,0.49);
    interior = mix(interior,vec3(0.10,0.14,0.15),max(desk,chair));
    base = mix(base,interior,room*frame*night*night);
  }

  if (surface > 3.5 && surface < 4.5) {
    float wave = 0.5 + 0.5 * sin(worldPosition.x * 0.11 + worldPosition.z * 0.075 + timeOfDay * 3.6);
    float glint = pow(max(dot(reflect(-V, N), L), 0.0), 28.0);
    base = mix(vec3(0.035, 0.24, 0.32), vec3(0.12, 0.48, 0.56), wave * 0.55);
    base += glint * (0.36 + (1.0 - night) * 0.45);
  }

  if (surface > 4.5 && surface < 5.5) {
    float star = 0.72 + 0.28 * sin(timeOfDay * 11.0 + worldPosition.x * 0.017);
    base = mix(base, vec3(0.83, 0.88, 0.96) * star, night);
  }

  if (surface > 5.5 && surface < 6.5) {
     base = mix(base, vec3(1.0, 0.81, 0.46), night);
  }

  if (surface > 6.5 && surface < 7.5) {
    base = mix(base, vec3(0.78, 0.85, 0.89), night);
  }

  // Real world-space light cones affect asphalt, walls, people and vehicle paint.
  if (night > 0.1 && surface < 7.5) {
    vec2 lamp = vec2(-1574.0,-1444.0) + floor((worldPosition.xz-vec2(-1574.0,-1444.0))/300.0+0.5)*300.0;
    if (lamp.x >= -1574.0 && lamp.x <= 1126.0 && lamp.y >= -1444.0 && lamp.y <= 1256.0) {
      float localLight = 1.0-smoothstep(16.0,105.0,length(worldPosition.xz-lamp));
      base += (color.rgb+vec3(0.07))*vec3(1.0,0.70,0.38)*localLight*night*(1.0-smoothstep(5.0,85.0,worldPosition.y))*0.75;
    }
    vec3 illumination = vec3(0.0);
    for (int i = 0; i < 16; i++) {
      if (i >= headlightCount) break;
      vec4 pose = headlightPose[i];
      vec2 delta = worldPosition.xz - pose.xy;
      float along = dot(delta, pose.zw);
      float across = abs(delta.x * pose.w - delta.y * pose.z);
       float width = 13.0 + max(along, 0.0) * 0.25;
       if (along <= 0.0 || along >= 340.0 || across >= width || abs(worldPosition.y - 8.0) >= 59.0) continue;
      float cone = (1.0 - smoothstep(width * 0.45, width, across)) * smoothstep(0.0, 9.0, along);
      float reach = pow(max(0.0, 1.0 - along / 340.0), 1.5) * step(along, 340.0);
      float vertical = 1.0 - smoothstep(25.0, 59.0, abs(worldPosition.y - 8.0));
      float facing = 0.4 + 0.6 * max(N.y, max(dot(N.xz, -pose.zw), 0.0));
      illumination += vec3(1.0, 0.88, 0.57) * cone * reach * vertical * facing * 1.6;
    }
    base += (color.rgb * 0.9 + vec3(0.12)) * illumination * night * headlightStrength;
  }
  if (surface < 7.5 && searchlightOn > 0.5) {
    float pool = 1.0 - smoothstep(15.0,62.0,length(worldPosition.xz-searchlight));
    base += vec3(0.62,0.81,0.94) * pool * (0.17 + night * 0.35) * max(N.y,0.3);
  }
   if (surface > 7.5) {
     if (surface < 8.5) {
       // A restrained additive haze carries the cone across the road plane;
       // the solid shader lighting above remains responsible for surfaces.
       vec3 poolIllumination = vec3(0.0);
       for (int i = 0; i < 16; i++) {
         if (i >= headlightCount) break;
         vec4 pose = headlightPose[i];
         vec2 delta = worldPosition.xz - pose.xy;
         float along = dot(delta, pose.zw);
         float across = abs(delta.x * pose.w - delta.y * pose.z);
         float width = 13.0 + max(along, 0.0) * 0.25;
         if (along <= 0.0 || along >= 340.0 || across >= width) continue;
         float cone = (1.0 - smoothstep(width * 0.45, width, across)) * smoothstep(0.0, 9.0, along);
         float reach = pow(max(0.0, 1.0 - along / 340.0), 1.5);
         poolIllumination += vec3(1.0, 0.88, 0.57) * cone * reach * 1.6;
       }
       base = poolIllumination * headlightStrength * 0.9;
     } else base = color.rgb;
   }

  float distanceFog = clamp(length(eye - worldPosition) / 6200.0, 0.0, 0.38);
  base = mix(base, sky, distanceFog);
  outColor = vec4(max(base, vec3(0.0)), surface > 7.5 ? color.a : 1.0);
}`;

const skyVertexShader = `#version 300 es
const vec2 triangle[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() { gl_Position = vec4(triangle[gl_VertexID], 1.0, 1.0); }`;

const skyFragmentShader = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float phase;
uniform float elapsed;
out vec4 outColor;
float randomCell(vec2 point) { return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  float height = smoothstep(0.0, 1.0, uv.y);
  vec3 daySky = mix(vec3(0.76, 0.83, 0.81), vec3(0.20, 0.43, 0.68), height);
    vec3 duskSky = mix(vec3(0.96, 0.56, 0.36), vec3(0.28, 0.29, 0.49), height);
  vec3 nightSky = mix(vec3(0.035, 0.075, 0.12), vec3(0.006, 0.017, 0.048), height);
  vec3 sky = phase > 1.5 ? nightSky : phase > 0.5 ? duskSky : daySky;
  vec2 sunCenter = phase > 0.5 && phase < 1.5 ? vec2(0.67, 0.63) : vec2(0.72, 0.75);
  float sunDistance = length((uv - sunCenter) * vec2(resolution.x / resolution.y, 1.0));
  if (phase < 1.5) {
    float corona = exp(-sunDistance * 16.0);
    float disk = 1.0 - smoothstep(0.027, 0.035, sunDistance);
    vec3 sunTint = phase > 0.5 ? vec3(1.0, 0.55, 0.29) : vec3(1.0, 0.88, 0.62);
    sky += sunTint * (corona * 0.43 + disk * 0.84);
    float streak = exp(-abs(uv.y - sunCenter.y) * 120.0) * exp(-abs(uv.x - sunCenter.x) * 6.0);
    sky += sunTint * streak * (phase > 0.5 ? 0.16 : 0.11);
  } else {
    vec2 grid = uv * vec2(115.0, 58.0);
    vec2 cell = floor(grid);
    vec2 local = fract(grid) - 0.5;
    float seed = randomCell(cell);
    float starShape = 1.0 - smoothstep(0.035, 0.11, length(local));
    float star = step(0.962, seed) * starShape * (0.73 + 0.27 * sin(elapsed * 2.0 + seed * 21.0));
    sky += vec3(0.62, 0.73, 0.92) * star;
    vec2 moonCenter = vec2(0.77, 0.78);
    float moonDistance = length((uv - moonCenter) * vec2(resolution.x / resolution.y, 1.0));
    float moon = 1.0 - smoothstep(0.025, 0.029, moonDistance);
    float halo = exp(-moonDistance * 32.0) * 0.24;
    float mare = 0.11 * sin(uv.x*390.0) * sin(uv.y*472.0);
    sky += vec3(0.79, 0.86, 0.96) * (moon*(0.91+mare)+halo);
  }
  outColor = vec4(clamp(sky, 0.0, 1.0), 1.0);
}`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShader));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShader));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
gl.useProgram(program);

const skyProgram = gl.createProgram();
gl.attachShader(skyProgram, compileShader(gl.VERTEX_SHADER, skyVertexShader));
gl.attachShader(skyProgram, compileShader(gl.FRAGMENT_SHADER, skyFragmentShader));
gl.linkProgram(skyProgram);
if (!gl.getProgramParameter(skyProgram, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(skyProgram));
const skyResolutionLocation = gl.getUniformLocation(skyProgram, 'resolution');
const skyPhaseLocation = gl.getUniformLocation(skyProgram, 'phase');
const skyElapsedLocation = gl.getUniformLocation(skyProgram, 'elapsed');

const city = createCity();
window.__solmar = { ...city.features, districtNames: city.districts.map((district) => district.name) };
const vertices = new Float32Array(city.vertices);
window.__solmar.geometry = { staticVertices: vertices.length / 11, colliders: city.colliders.length, treeShadows: city.shadeTrees.length };
const stride = 11 * Float32Array.BYTES_PER_ELEMENT;

const cityBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, cityBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

const actorBuffer = gl.createBuffer();
const actorCapacity = 350000;
gl.bindBuffer(gl.ARRAY_BUFFER, actorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, actorCapacity * 11 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

for (const [name, size, offset] of [['position', 3, 0], ['normal', 3, 12], ['tint', 4, 24], ['kind', 1, 40]]) {
  const location = gl.getAttribLocation(program, name);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
}

const viewProjection = mat4(), projection = mat4(), view = mat4(), model = mat4();
const viewProjectionLocation = gl.getUniformLocation(program, 'viewProjection');
const modelLocation = gl.getUniformLocation(program, 'model');
const sunLocation = gl.getUniformLocation(program, 'sunDirection');
const eyeLocation = gl.getUniformLocation(program, 'eye');
const skyLocation = gl.getUniformLocation(program, 'sky');
const nightLocation = gl.getUniformLocation(program, 'night');
const sunsetLocation = gl.getUniformLocation(program, 'sunset');
const timeLocation = gl.getUniformLocation(program, 'timeOfDay');
const headlightCountLocation = gl.getUniformLocation(program, 'headlightCount');
const headlightPoseLocation = gl.getUniformLocation(program, 'headlightPose[0]');
const headlightStrengthLocation = gl.getUniformLocation(program, 'headlightStrength');
const searchlightLocation = gl.getUniformLocation(program, 'searchlight');
const searchlightOnLocation = gl.getUniformLocation(program, 'searchlightOn');

const camera = { yaw: Math.PI, pitch: 0.41, distance: 390, target: [0, 0, 0], drag: false, x: 0, y: 0 };
const actor = { x: 634, z: -625, facing: 0 };
const traffic = createTraffic();
const parkedCars = [makeCar('mara-pico',0,651,-625,0)];
for (const x of [-1200,-900,-300,0,300,600,900]) for (const z of [-1120,-820,-520,580,880,1180]) {
  parkedCars.push(makeCar(`parked-${x}-${z}`,parkedCars.length%4,x+51,z,0));
}
const ledgerVan = makeCar('ledger-operation-van', 2, 1150, 500, 0);
const glassSedan = makeCar('glass-operation-sedan', 1, 870, -820, 0);
parkedCars.push(ledgerVan, glassSedan);
const cars = [...parkedCars,...traffic.cars];
const pedestrians = createPedestrians();
const obstacles = [...city.colliders,...city.props];
for(const light of traffic.signals) for(const [dx,dz] of [[51,-47],[-51,47],[-47,-51],[47,51]]) obstacles.push({minX:light.x+dx-3,maxX:light.x+dx+3,minZ:light.z+dz-3,maxZ:light.z+dz+3,top:103});
let playerCar = null;
let headlightStrength = 1;
let headlightHaze = true;
const updateHud = createHud(city);
const keys = new Set();
const progressKey = 'palkon-auto-stage-c-progress';
let savedProgress = { unlocked: 0, cash: 0, evidence: [] };
let hasSave = false;
try {
  const parsed = JSON.parse(localStorage.getItem(progressKey) ?? 'null');
  if (parsed && Number.isInteger(parsed.unlocked) && Array.isArray(parsed.evidence)) {
    hasSave = true;
    const evidence = parsed.evidence.filter((item) => typeof item === 'string');
    const storedCash = Number(parsed.cash);
    savedProgress = { unlocked: Math.max(0, Math.min(MISSIONS.length - 1, Math.max(parsed.unlocked, evidence.length))), cash: Number.isFinite(storedCash) ? Math.max(0, storedCash) : 0, evidence, garage: parsed.garage };
  }
} catch { /* A blocked or malformed save starts a fresh courier file. */ }
let unlockedMission = savedProgress.unlocked;
let cash = savedProgress.cash;
let evidenceLog = [...savedProgress.evidence];
let activeMissionIndex = -1;
let activeStep = 0;
let missionRunning = false;
let missionTimer = 0;
let cargo = '';
let playerHealth = 100;
let oren = null;
let missionVehicle = null;
let relaySites = new Set();
let overlayMode = 'title';
let phase = 0;
let elapsed = 0;
let previousTime = performance.now();
let frameNumber = 0;
let lastRenderTime = 0;
let renderingPaused = false;
let simulationPaused = true;
let activeLights = [];
let meshInfo = {renderedCars:0,renderedSignals:0};
let frameFence = null;
let notice = '', noticeUntil = 0;
const notify = (text, seconds = 3) => { notice = text; noticeUntil = elapsed + seconds; };
const police = createPolice({ actor, cars, pedestrians, traffic, buildings:city.colliders, obstacles,
  blocked:buildingAt, nearbyAlly:() => missionRunning ? oren : null,
  onArrest: fee => recover('Arrested',fee), onRam:car => damageCar(car,14),
});
const combat = createCombat({ actor, buildings:city.colliders, blocked:buildingAt,
  targets:() => [...police.state.officers,...(combat.state.guard?[combat.state.guard]:[]),...(missionRunning&&oren?[oren]:[]),...pedestrians],
  onCrime:(reason,victim) => police.crime(reason,victim), onDamage:amount => { playerHealth = Math.max(0,playerHealth-amount); },
});
const garage = createGarage(savedProgress.garage, {
  balance:() => cash, currentCar:() => playerCar,
  pay:amount => { cash = Math.round((cash-amount)*100)/100; saveProgress(); updateMissionHud(); },
  park:parkOwnedCar, onClose:() => { simulationPaused = !modal.hidden; keys.clear(); },
});
for (const car of garage.cars) parkOwnedCar(car,GARAGES[car.home],true);
const radio = createRadio();
const titleScreen = createTitleScreen({ hasSave,
  onContinue: () => {
    titleScreen.show(false);
    setPhase(0);
    if (evidenceLog.length >= MISSIONS.length) enterFreeExplore();
    else startMission(unlockedMission);
  },
  onNewGame: () => {
    try { localStorage.removeItem(progressKey); sessionStorage.setItem('palkon-auto-new-game','1'); }
    catch { titleScreen.show(false); startMission(0); return; }
    location.reload();
  },
});

function parkOwnedCar(car, spot, restored = false) {
  if (!restored && playerCar === car) return true;
  for (const dx of [0,40,75]) for (const dz of [0,68,-68,136,-136]) {
    const x=spot.bayX+dx, z=spot.z+dz;
    if (carHitsWorld(car,x,z,0,obstacles) || cars.some(other => other !== car && Math.hypot(other.x-x,other.z-z)<83 && carsOverlap(car,other,x,z,0))) continue;
    Object.assign(car,{ x,z,heading:0,speed:0,destroyed:false });
    if (!cars.includes(car)) cars.push(car);
    return true;
  }
  return false;
}

function nearbyGarage() { return GARAGES.find(spot => distance(spot,actor)<93); }

function openGarage() {
  const spot = nearbyGarage();
  if (!spot) { notify('Find a teal garage marker on the map'); return; }
  if (Math.abs(playerCar?.speed ?? 0)>12) { notify('Stop at the garage to open it'); return; }
  simulationPaused = true;
  keys.clear();
  garage.open(spot);
}

function damageCar(car, amount) {
  car.health = Math.max(0,car.health-amount);
  if (car.id.startsWith('owned-')) saveProgress();
  if (car.health > 0) return;
  if (car === missionVehicle && missionRunning) {
    car.destroyed = true;
    car.speed = 0;
    if (playerCar === car) playerCar = null;
    failMission('Required operation vehicle destroyed');
  } else {
    car.speed = 0;
    notify('Vehicle disabled · garage service required');
  }
}

function nearestCar() {
  return cars.filter(car=>!car.police && !car.destroyed && Math.abs(car.speed)<12 && distance(car,actor)<62).sort((a,b)=>distance(a,actor)-distance(b,actor))[0];
}
function interact() {
  if (playerCar) {
    if (Math.abs(playerCar.speed)>12) return;
    const p=CAR_PROFILES[playerCar.profile];
    for(const side of [1,-1]) {
      const x=playerCar.x+Math.cos(playerCar.heading)*(p.width/2+20)*side;
      const z=playerCar.z-Math.sin(playerCar.heading)*(p.width/2+20)*side;
      if(buildingAt(x,z))continue;
      actor.x=x;actor.z=z;playerCar.speed=0;playerCar=null;
      camera.distance=390;return;
    }
    return;
  }
  const car=nearestCar();
  if(!car)return;
  if (car !== parkedCars[0] && !(missionRunning && car === missionVehicle) && !car.id.startsWith('owned-') && !car.claimed) {
    police.crime('Vehicle theft reported',null,car.traffic);
    car.claimed = true;
  }
  playerCar=car;car.traffic=false;actor.x=car.x;actor.z=car.z;
  camera.yaw=car.heading+Math.PI;camera.pitch=0.37;camera.distance=285;
}

function simulate(dt) {
  elapsed+=dt;
  updateTraffic(traffic,dt,cars,playerCar);
  if (playerCar) {
    if (playerCar.health > 0) driveCar(playerCar,keys,dt,obstacles,cars);
    actor.x=playerCar.x;actor.z=playerCar.z;actor.facing=playerCar.heading;
    playerCar.collisionDamageCooldown = Math.max(0,(playerCar.collisionDamageCooldown ?? 0)-dt);
    const operationCar = missionRunning && playerCar === missionVehicle;
    if (playerCar.collision && playerCar.health > 0 && !playerCar.collisionDamageCooldown && (operationCar || playerCar.impact > 27)) {
      playerCar.collisionDamageCooldown = 0.9;
      damageCar(playerCar,operationCar ? 34 : Math.min(35,Math.ceil(playerCar.impact*0.19)));
      if (simulationPaused) return;
    }
  }
  else if (!combat.state.dodge) moveActor(dt);
  combat.update(dt,playerCar);
  if (playerHealth <= 0) { recover('Mara was incapacitated',250); return; }
  updatePedestrians(pedestrians,actor,playerCar,dt);
  police.update(dt,playerCar,combat.state.dodge > 0);
  tickMission(dt);
}

function snapshot() {
  const player={x:actor.x,z:actor.z,heading:actor.facing,driving:Boolean(playerCar),carId:playerCar?.id??null,speed:playerCar?.speed??0,collision:playerCar?.collision??false};
  return {player,phase,time:traffic.time,cars:cars.map(({id,profile,x,z,heading,speed,traffic,stoppedFor,distance,redStops,greenStarts,health,destroyed})=>({id,profile,x,z,heading,speed,traffic,stoppedFor,distance,redStops,greenStarts,health,destroyed})),signals:traffic.signals.map(s=>({...s,xState:signalState(traffic.time,'x',s.offset),zState:signalState(traffic.time,'z',s.offset)})),redStopEvents:traffic.redStopEvents,greenStartEvents:traffic.greenStartEvents,pedestrians:pedestrians.length,mesh:meshInfo,activeLights:activeLights.map(c=>c.id),mission:{status:overlayMode,active:missionRunning,index:activeMissionIndex,step:activeStep,timer:missionTimer,cargo,health:playerHealth,cash,unlocked:unlockedMission,evidence:[...evidenceLog],objective:missionRunning?missionObjective():null,boundary:missionRunning?currentMission()?.boundary:null,oren:oren?{x:oren.x,z:oren.z,health:oren.health}:null,vehicle:missionVehicle?{id:missionVehicle.id,health:missionVehicle.health,destroyed:missionVehicle.destroyed}:null}};
}
window.__solmar.snapshot=snapshot;
window.__solmar.cityStatus=()=>({
  police:structuredClone(police.state), combat:structuredClone(combat.state),
  garage:garage.serialize(), radio:radio.snapshot(),
});
window.__solmar.profiles=CAR_PROFILES;
// Deterministic stepping runs the same simulation as real frames, for regression checks.
window.__solmar.step=(seconds)=>{for(let t=0;t<seconds&&modal.hidden&&!garage.isOpen;t+=1/60)simulate(Math.min(1/60,seconds-t));return snapshot();};
window.__solmar.setHeadlightStrength=(strength)=>{headlightStrength=strength;};
window.__solmar.setSimulationPaused=(paused)=>{simulationPaused=paused;};
window.__solmar.project=(x,y,z)=>{
  const v=viewProjection;
  const w=v[3]*x+v[7]*y+v[11]*z+v[15];
  return {x:(v[0]*x+v[4]*y+v[8]*z+v[12])/w*0.5+0.5,y:(v[1]*x+v[5]*y+v[9]*z+v[13])/w*0.5+0.5,w};
};
window.__solmar.readPixels=()=>{const pixels=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
window.__solmar.beamAt=(id,x,y,z)=>beamAt(cars.find(c=>c.id===id),x,y,z);
window.__solmar.collisionProbe=(profile,x,z,heading=0)=>carHitsWorld(makeCar('probe',profile,x,z),x,z,heading,obstacles);
if(new URLSearchParams(location.search).has('verify')) {
  window.__solmar.verificationScene=()=>{
    const car=playerCar??parkedCars[0];
    const target = parkedCars[1];
    Object.assign(car,{x:621,z:-410,heading:0,speed:0,traffic:false});
    // Stop before the next junction, beyond the previous signal's silhouette.
    Object.assign(target,{x:621,z:-230,heading:0,speed:0,traffic:false});
    // Keep the camera's sightline and both sample surfaces clear. The wider
    // exclusion radius also keeps other vehicles' beams out of the comparison.
    for (const [index, other] of cars.entries()) {
      if (other === car || other === target || Math.hypot(other.x - 621, other.z + 280) > 410) continue;
      Object.assign(other, { x: -1755, z: 1100 + index * 6, traffic: false, speed: 0 });
    }
    for (const person of pedestrians) {
      if (Math.abs(person.x - 621) > 42 || person.z < -680 || person.z > -200) continue;
      person.x = person.lane = 665;
    }
    // Expose the asphalt past the source car's hood.
    actor.x=car.x;actor.z=car.z;actor.facing=car.heading;camera.yaw=Math.PI;camera.pitch=0.65;camera.distance=285;
    return {source:car.id,target:target.id};
  };
  window.__solmar.setHeadlightHaze=(enabled)=>{headlightHaze=Boolean(enabled);};
}

window.__solmar.pauseRendering = () => { renderingPaused = true; };
window.__solmar.resumeRendering = () => {
  if (!renderingPaused) return;
  renderingPaused = false;
  previousTime = performance.now();
  lastRenderTime = 0;
  requestAnimationFrame(frame);
};

const modeLabels = ['12:18 PM · SCORCHING CLEAR', '6:42 PM · GOLDEN HOUR', '11:46 PM · MOONLIT'];
function setPhase(value) {
  phase = value;
  document.querySelectorAll('.mode button').forEach((button, index) => button.setAttribute('aria-pressed', String(index === value)));
  document.querySelector('#clock').textContent = modeLabels[value];
  document.body.dataset.phase = ['day', 'sunset', 'night'][value];
  window.__solmar.phase = ['day', 'sunset', 'night'][value];
}

function drawSky() {
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.useProgram(skyProgram);
  gl.uniform2f(skyResolutionLocation, canvas.width, canvas.height);
  gl.uniform1f(skyPhaseLocation, phase);
  gl.uniform1f(skyElapsedLocation, elapsed);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.useProgram(program);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
}

for (const [id, value] of [['day', 0], ['sunset', 1], ['night', 2]]) {
  document.querySelector(`#${id}`).addEventListener('click', () => setPhase(value));
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (titleScreen.visible || titleScreen.controlsOpen) return;
  if (garage.isOpen) return;
  if (!modal.hidden && key !== 'escape' && !['1','2','3','n','r','m'].includes(key)) return;
  if (['w','a','s','d','e','q','x',' ','arrowup','arrowdown','arrowleft','arrowright','escape','j','f','g','r','m'].includes(key)) event.preventDefault();
  if (modal.hidden) keys.add(key);
  if (key === 'e' && !event.repeat) interact();
  if (key === 'q' && !event.repeat) interactMission();
  if (key === 'x' && !event.repeat) dropCargo();
  if (key === 'g' && !event.repeat) openGarage();
  if (key === 'r' && !event.repeat) radio.cycle();
  if (key === 'm' && !event.repeat) radio.toggleMute();
  if (!playerCar && !event.repeat) {
    if (key === 'j' || key === 'f') combat.attack(key === 'f');
    if (key === ' ') {
      const forward = Number(keys.has('w'))-Number(keys.has('s'));
      const side = Number(keys.has('d'))-Number(keys.has('a'));
      combat.dodge(forward || side ? camera.yaw + Math.atan2(side,forward) : actor.facing);
    }
  }
  if (key === 'escape' && !event.repeat) {
    if (modal.hidden) { keys.clear(); simulationPaused = true; showModal('pause', missionRunning ? 'Your active operation is paused. Choose a mission, review evidence, or leave for open exploration.' : 'Solmar is open to explore. Choose an unlocked operation whenever you are ready.'); }
    else if (overlayMode === 'pause') { modal.hidden = true; simulationPaused = false; overlayMode = missionRunning ? 'active' : 'free'; }
  }
  if (key === '1') setPhase(0);
  if (key === '2') setPhase(1);
  if (key === '3') setPhase(2);
  if (key === 'n') setPhase(2);
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
document.querySelector('#pause-open').addEventListener('click', () => {
  if (!modal.hidden) return;
  keys.clear();
  simulationPaused = true;
  showModal('pause', missionRunning ? 'Your active operation is paused. Choose a mission, review evidence, or leave for open exploration.' : 'Solmar is open to explore. Choose an unlocked operation whenever you are ready.');
});

canvas.addEventListener('pointerdown', (event) => {
  camera.drag = true;
  camera.x = event.clientX;
  camera.y = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointerup', () => { camera.drag = false; });
canvas.addEventListener('pointercancel', () => { camera.drag = false; });
canvas.addEventListener('pointermove', (event) => {
  if (!camera.drag) return;
  camera.yaw -= (event.clientX - camera.x) * 0.004;
  camera.pitch = Math.max(0.35, Math.min(1.27, camera.pitch + (event.clientY - camera.y) * 0.003));
  camera.x = event.clientX;
  camera.y = event.clientY;
});
canvas.addEventListener('wheel', (event) => {
  camera.distance = Math.max(180, Math.min(2900, camera.distance + event.deltaY));
}, { passive: true });

function buildActors(time) {
  const list = [];
  const pushTriangle = (a, b, c, normal, color, kind = 1) => {
    for (const point of [a, b, c]) list.push(...point, ...normal, ...color, kind);
  };
  const pushQuad = (a, b, c, d, normal, color, kind = 1) => {
    pushTriangle(a, b, c, normal, color, kind);
    pushTriangle(a, c, d, normal, color, kind);
  };
  const pushBox = (x, y, z, width, height, depth, color, kind = 1) => {
    const X = x + width, Y = y + height, Z = z + depth;
    pushQuad([x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z], [0, 0, 1], color, kind);
    pushQuad([X, y, z], [x, y, z], [x, Y, z], [X, Y, z], [0, 0, -1], color, kind);
    pushQuad([x, y, z], [x, y, Z], [x, Y, Z], [x, Y, z], [-1, 0, 0], color, kind);
    pushQuad([X, y, Z], [X, y, z], [X, Y, z], [X, Y, Z], [1, 0, 0], color, kind);
    pushQuad([x, Y, Z], [X, Y, Z], [X, Y, z], [x, Y, z], [0, 1, 0], color, kind);
    pushQuad([x, y, z], [X, y, z], [X, y, Z], [x, y, Z], [0, -1, 0], color, kind);
  };
  const pushSphere = (cx, cy, cz, radius, color, kind = 1) => {
    const segments = 10, rings = 6;
    for (let row = 0; row < rings; row++) for (let col = 0; col < segments; col++) {
      const phi0 = Math.PI * row / rings, phi1 = Math.PI * (row + 1) / rings;
      const theta0 = col * Math.PI * 2 / segments, theta1 = (col + 1) * Math.PI * 2 / segments;
      const point = (phi, theta) => [cx + radius * Math.sin(phi) * Math.cos(theta), cy + radius * Math.cos(phi), cz + radius * Math.sin(phi) * Math.sin(theta)];
      const normal = (p) => [(p[0] - cx) / radius, (p[1] - cy) / radius, (p[2] - cz) / radius];
      const a = point(phi0, theta0), b = point(phi1, theta0), d = point(phi0, theta1), e = point(phi1, theta1);
      pushTriangle(a, d, b, normal(a), color, kind);
      pushTriangle(d, e, b, normal(e), color, kind);
    }
  };

  function groundHeight(x, z) {
    if (x > -365 && x < 395 && z > -280 && z < 280) {
      if (x > -132 && x < 132 && z > -252 && z < -106) return 8;
      if (Math.abs(x - 0) < 39 || Math.abs(z + 2) < 33) return 6;
      return 4;
    }
    for (let grid = -1800; grid <= 1800; grid += 300) {
      if (Math.abs(x - grid) < 46) return 5;
      if (Math.abs(x - grid) < 76) return 7;
    }
    for (let grid = -1650; grid <= 1650; grid += 300) {
      if (Math.abs(z - grid) < 44) return 5;
      if (Math.abs(z - grid) < 54) return 7;
    }
    return -2;
  }

  function person(x, z, facing, color, walking, kind = '', health = 100) {
    const gait = walking ? Math.sin(time * 7.2 + x * 0.04) * 5.5 : 0;
    const floor = groundHeight(x, z);
    if (!health) {
      pushBox(x-15,floor+2,z-7,35,7,14,color);
      pushBox(x+20,floor+2,z-6,11,9,12,[0.68,0.42,0.30,1]);
      return { x,z,facing,floor };
    }
    const armSwing = walking ? -gait : 0;
    const isPlayer = kind === 'player';
    const dodge = isPlayer && combat.state.dodge ? 10 : 0;
    pushBox(x - 6, floor + 1, z - 6, 31, 1, 17, [0.07, 0.09, 0.09, 1]);
    pushBox(x - 9 + gait, floor, z - 5, 7, 8, 7, [0.09, 0.13, 0.15, 1]);
    pushBox(x + 2 - gait, floor, z - 5, 7, 8, 7, [0.09, 0.13, 0.15, 1]);
    pushBox(x - 9, floor + 8, z - 5, 18, 26-dodge, 11, color);
    pushBox(x - 7 - armSwing, floor + 9, z + 1, 6, 23, 6, color);
    pushBox(x + 2 + armSwing, floor + 9, z + 1, 6, 23, 6, color);
    if (isPlayer || kind) pushSphere(x, floor + 40-dodge, z, 9, [0.68, 0.42, 0.30, 1]);
    else pushBox(x-7,floor+34,z-7,14,15,14,[0.68,0.42,0.30,1]);
    if (kind === 'officer') {
      pushBox(x-9,floor+44,z-9,18,6,18,[0.05,0.14,0.24,1]);
      pushBox(x+4,floor+27,z+6,4,5,1,[0.96,0.76,0.38,1],9);
    }
    if (kind === 'guard') {
      pushBox(x+Math.sin(facing)*12-3,floor+22,z+Math.cos(facing)*12-3,6,5,13,[0.08,0.12,0.13,1]);
      pushBox(x-6,floor+57,z-2,12*(health/100),3,3,[0.95,0.38,0.29,1],9);
    }
    if (isPlayer) {
      pushBox(x - 9, floor + 18, z + 4, 18, 3, 2, [0.90, 0.53, 0.34, 1]);
      pushBox(x - 5, floor + 45-dodge, z - 7, 10, 3, 3, [0.11, 0.19, 0.19, 1]);
      if (combat.state.cooldown && !dodge && combat.state.action !== 'Dodge') {
        const reach = combat.state.action === 'Hook' ? 16 : 23;
        pushBox(x+Math.sin(facing)*reach-4,floor+23,z+Math.cos(facing)*reach-4,8,7,8,[0.68,0.42,0.30,1]);
      }
    }
    return { x, z, facing, floor };
  }

  const people = playerCar ? [] : [person(actor.x, actor.z, actor.facing, [0.14,0.27,0.28,1], keys.size > 0,'player')];
  for (const p of pedestrians) if (distance(p,actor)<Math.max(1060,camera.distance+360)) {
    people.push(person(p.x,p.z,p.facing,p.color,p.health>0&&!p.stagger,'',p.health));
  }
  for (const p of police.state.officers) people.push(person(p.x,p.z,p.facing,[0.12,0.25,0.43,1],p.health>0,'officer',p.health));
  const guard = missionRunning && combat.state.guard;
  if (guard) people.push(person(guard.x,guard.z,guard.facing,[0.42,0.24,0.21,1],false,'guard',guard.health));
  for (const {x,z} of GARAGES) {
    const y = groundHeight(x,z);
    pushBox(x-24,y+0.3,z-24,48,1,48,[0.22,0.56,0.60,1],9);
    pushBox(x-3,y,z-3,6,89,6,[0.14,0.37,0.40,1]);
    pushBox(x-23,y+75,z-5,46,22,10,[0.22,0.56,0.60,1],9);
    pushBox(x-13,y+83,z-6,26,5,12,[0.92,0.85,0.70,1],9);
  }
  const h = police.state.helicopter;
  if (h) {
    const { x,y,z } = h;
    const body = [0.14,0.24,0.29,1], glass = [0.32,0.55,0.65,1];
    const forward = [Math.sin(h.heading),Math.cos(h.heading)];
    pushSphere(x,y,z,23,body);
    pushSphere(x+forward[0]*15,y+3,z+forward[1]*15,14,glass,3);
    for (let i=18;i<=62;i+=7) pushBox(x-forward[0]*i-5,y+2,z-forward[1]*i-5,10,8,10,body);
    pushBox(x-forward[0]*62-5,y+6,z-forward[1]*62-5,10,17,10,body);
    pushBox(x-3,y+19,z-3,6,14,6,body);
    for (const angle of [time*27,time*27+Math.PI/2]) {
      const dx=Math.cos(angle)*55, dz=Math.sin(angle)*55;
      pushQuad([x-dx,y+33,z-dz-3],[x-dx,y+33,z-dz+3],[x+dx,y+33,z+dz+3],[x+dx,y+33,z+dz-3],[0,1,0],body);
    }
    pushSphere(x,y-21,z,7,[0.77,0.91,1,1],9);
  }
  if (missionRunning && oren) {
    const witness = person(oren.x, oren.z, Math.atan2(actor.x - oren.x, actor.z - oren.z), [0.12, 0.48, 0.53, 1], true);
    people.push(witness);
    pushBox(oren.x + 8, witness.floor + 17, oren.z - 5, 10, 10, 8, [0.78, 0.62, 0.36, 1]);
  }
  if (missionRunning) {
    const marker = missionObjective();
    if (marker) {
      const floor = groundHeight(marker.x, marker.z) + 6;
      const gold = [1.0, 0.68, 0.16, 1];
      const paleGold = [1.0, 0.84, 0.40, 1];
      pushBox(marker.x - 4, floor, marker.z - 4, 8, 205, 8, gold, 9);
      pushBox(marker.x - 12, floor + 12, marker.z - 12, 24, 3, 24, paleGold, 9);
      pushBox(marker.x - 21, floor + 5, marker.z - 21, 42, 2, 42, gold, 9);
      pushSphere(marker.x, floor + 210, marker.z, 13, paleGold, 9);
    }
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, actorBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(list));
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1, 1);
  gl.uniformMatrix4fv(modelLocation, false, model);
  gl.drawArrays(gl.TRIANGLES, 0, list.length / 11);
  gl.disable(gl.POLYGON_OFFSET_FILL);
  return people;
}

function drawSearchlight(h) {
  if (!h) return;
  const data = [], segments=24;
  const ring = i => {
    const a = i*Math.PI*2/segments;
    return [h.beamX+Math.cos(a)*58,7,h.beamZ+Math.sin(a)*58];
  };
  for(let i=0;i<segments;i++) {
    data.push(h.x,h.y-20,h.z,0,1,0,0.76,0.91,1,0.25,9);
    for (const p of [ring(i),ring(i+1)]) data.push(...p,0,1,0,0.76,0.91,1,0.075,9);
  }
  gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(data));
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.disable(gl.CULL_FACE);
  gl.drawArrays(gl.TRIANGLES,0,data.length/11);
  gl.enable(gl.CULL_FACE);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}

function drawHeadlightPools() {
  if (phase !== 2 || headlightStrength <= 0 || !headlightHaze || !activeLights.length) return;
  const data = [];
  const push = (x, z, across, y = 5.24) => data.push(x, y, z, 0, 1, 0, 0, 0, 0, 0.08, 8);
  for (const car of activeLights) {
    const profile = CAR_PROFILES[car.profile];
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    const nose = profile.length / 2;
    const originX = car.x + fx * nose, originZ = car.z + fz * nose;
    const point = (along, across) => [originX + fx * along + fz * across, originZ + fz * along - fx * across];
    const near = 4, far = 340, nearWidth = 14, farWidth = 98;
    const [nearLeftX, nearLeftZ] = point(near, -nearWidth);
    const [nearRightX, nearRightZ] = point(near, nearWidth);
    const [farLeftX, farLeftZ] = point(far, -farWidth);
    const [farRightX, farRightZ] = point(far, farWidth);
    push(nearLeftX, nearLeftZ);push(nearRightX, nearRightZ);push(farRightX, farRightZ);
    push(nearLeftX, nearLeftZ);push(farRightX, farRightZ);push(farLeftX, farLeftZ);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, actorBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(data));
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.depthMask(false);
  // The pool sits above asphalt, but must stay behind cars, curbs and walls.
  // Solid surfaces receive their own world-space illumination in the shader.
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.drawArrays(gl.TRIANGLES, 0, data.length / 11);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}

function drawShadows(people, sunDirection) {
  const directionLength = Math.hypot(sunDirection[0], sunDirection[2]) || 1;
  const shiftX = -sunDirection[0] / directionLength;
  const shiftZ = -sunDirection[2] / directionLength;
  const shadowVertices = [];
  const addShadow = (x, z, length, width, opacity, floor = 5) => {
    const dx = shiftX * length, dz = shiftZ * length;
    const px = -shiftZ * width, pz = shiftX * width;
    const center = [x + dx * 0.48, floor + 0.65, z + dz * 0.48];
    const shade = [0.035, 0.055, 0.058, opacity];
    for (let segment = 0; segment < 18; segment++) {
      const angle0 = segment * Math.PI * 2 / 18, angle1 = (segment + 1) * Math.PI * 2 / 18;
      const point = (angle) => [
        center[0] + Math.cos(angle) * px * 0.9 + Math.sin(angle) * dx * 0.45,
        center[1],
        center[2] + Math.cos(angle) * pz * 0.9 + Math.sin(angle) * dz * 0.45,
      ];
   // Shadow tint is unlit; material 8 is reserved for the headlight haze.
   for (const vertex of [center, point(angle0), point(angle1)]) shadowVertices.push(...vertex, 0, 1, 0, ...shade, 10);
    }
  };

  for (const person of people) {
    const treeShade = city.shadeTrees.find((tree) => Math.hypot(tree.x - person.x, tree.z - person.z) < tree.radius + 26);
    addShadow(person.x, person.z, treeShade ? 28 : 46, 8, treeShade ? 0.28 : 0.74, person.floor);
  }
  for (const tree of city.shadeTrees) addShadow(tree.x, tree.z, 72, tree.radius * 0.52, 0.35);

  gl.bindBuffer(gl.ARRAY_BUFFER, actorBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(shadowVertices));
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthMask(false);
  gl.disable(gl.CULL_FACE);
  gl.uniformMatrix4fv(modelLocation, false, model);
  gl.drawArrays(gl.TRIANGLES, 0, shadowVertices.length / 11);
  gl.enable(gl.CULL_FACE);
  gl.depthMask(true);
  gl.disable(gl.BLEND);
}

function buildingAt(x, z) {
  return obstacles.some((obstacle) =>
    x > obstacle.minX - 10 && x < obstacle.maxX + 10 && z > obstacle.minZ - 10 && z < obstacle.maxZ + 10);
}

function nearestOpenPosition(x, z) {
  const directions = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (let radius = 0; radius <= 260; radius += 24) {
    for (const [dx, dz] of directions) {
      const testX = Math.max(-1770, Math.min(1180, x + dx * radius));
      const testZ = Math.max(-1640, Math.min(1640, z + dz * radius));
      if (!buildingAt(testX, testZ)) return [testX, testZ];
    }
  }
  return [actor.x, actor.z];
}

function moveActor(delta) {
  const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
  const sideways = Number(keys.has('d')) - Number(keys.has('a'));
  if (forward === 0 && sideways === 0) return;
  const stride = (keys.has('shift') ? 180 : 112) * delta / Math.max(1,Math.hypot(forward,sideways));
  const dx = (Math.sin(camera.yaw) * forward + Math.cos(camera.yaw) * sideways) * stride;
  const dz = (Math.cos(camera.yaw) * forward - Math.sin(camera.yaw) * sideways) * stride;
  const nextX = Math.max(-1770, Math.min(1180, actor.x + dx));
  const nextZ = Math.max(-1640, Math.min(1640, actor.z + dz));
  if (!buildingAt(nextX, actor.z)) actor.x = nextX;
  if (!buildingAt(actor.x, nextZ)) actor.z = nextZ;
  actor.facing = Math.atan2(dx, dz);
  window.__solmar.player = { x: Math.round(actor.x), z: Math.round(actor.z) };
}

const modal = document.querySelector('#modal');
const modalTitle = document.querySelector('#modal-title');
const modalCopy = document.querySelector('#modal-copy');
const modalKicker = document.querySelector('#modal-kicker');
const modalActions = document.querySelector('#modal-actions');

function currentMission() { return activeMissionIndex >= 0 ? MISSIONS[activeMissionIndex] : null; }

function saveProgress() {
  try { localStorage.setItem(progressKey, JSON.stringify({ unlocked: unlockedMission, cash, evidence: evidenceLog, garage:garage.serialize() })); }
  catch { /* The mission remains playable if browser storage is unavailable. */ }
}

function missionObjective() {
  const mission = currentMission();
  if (!mission) return null;
  if (activeMissionIndex === 5) {
    const remaining = mission.steps.filter((step) => !relaySites.has(step.target.label));
    if (!remaining.length) return null;
    return remaining.reduce((closest, step) => {
      const distance = Math.hypot(step.target.x - actor.x, step.target.z - actor.z);
      return !closest || distance < closest.distance ? { ...step.target, distance } : closest;
    }, null);
  }
  if (activeMissionIndex === 2 && oren) {
    return { x: oren.x, z: oren.z, label: 'Oren · witness statement' };
  }
  return objectiveFor(mission, activeStep);
}

function missionDestination() {
  const mission = currentMission();
  if (!mission) return null;
  return missionObjective();
}

function missionMapTargets() {
  const mission = currentMission();
  if (!missionRunning || !mission) return [];
  if (activeMissionIndex === 5) return mission.steps.filter((step) => !relaySites.has(step.target.label)).map((step) => step.target);
  if (activeMissionIndex === 7) return mission.steps.slice(0, 3).filter((step) => !relaySites.has(step.target.label)).map((step) => step.target);
  return [];
}

function missionHint() {
  const mission = currentMission();
  if (!mission || !missionRunning) return 'Explore Solmar — find a car and drive';
  if (activeMissionIndex === 2) return 'Escort Oren and his witness statement to the Citrus Quarter courtyard';
  if (activeMissionIndex === 5) return `${mission.steps.length - relaySites.size} neighborhood relays remaining · activate in any order`;
  if (activeMissionIndex === 3 && activeStep === 0 && combat.state.guard?.health) return 'Glasspoint Contract Office · Close in and take down the guard with F';
  const stage = mission.steps[activeStep];
  return cargo && stage.action === 'deliver' ? stage.text : stage.text;
}

function updateMissionHud() {
  const mission = currentMission();
  document.querySelector('#mission-name').textContent = missionRunning && mission ? mission.title : 'SOLMAR · FREE EXPLORATION';
  document.querySelector('#objective-text').textContent = missionHint();
  document.querySelector('#cash').textContent = `$${cash.toLocaleString('en-US')}`;
  document.querySelector('#mission-timer').textContent = missionRunning && mission?.timerSeconds ? `TIME ${formatMissionTime(missionTimer)}` : '';
  document.querySelector('#cargo-status').textContent = cargo ? `CARRYING · ${cargo}` : missionRunning && missionVehicle ? `OPERATION VEHICLE · ${Math.round(missionVehicle.health)}%` : oren && missionRunning ? `OREN · ${Math.round(oren.health)}%` : '';
  document.querySelector('#health-status').textContent = `HEALTH ${Math.round(playerHealth)}`;
  document.querySelector('#boundary-label').style.display = missionRunning && mission?.boundary ? 'block' : 'none';
  const destination = missionRunning ? missionDestination() : null;
  if (destination) {
    const dx = destination.x - actor.x, dz = destination.z - actor.z;
    const compass = Math.atan2(dx, -dz) - actor.facing - Math.PI;
    document.querySelector('#compass-arrow').style.transform = `rotate(${compass * 180 / Math.PI}deg)`;
    document.querySelector('#compass-distance').textContent = `${Math.round(Math.hypot(dx, dz))} M · ${destination.label.toUpperCase()}`;
  } else document.querySelector('#compass-distance').textContent = 'SOLMAR';
}

const wantedStars = document.querySelector('#wanted-stars');
const heatStatus = document.querySelector('#heat-status');
const arrestStatus = document.querySelector('#arrest-status');
const arrestMeter = document.querySelector('#arrest-meter');
const cityNotice = document.querySelector('#city-notice');

function updateCityHud() {
  const { stars, arrest, spotted, report } = police.state;
  wantedStars.textContent = '★'.repeat(stars)+'☆'.repeat(5-stars);
  wantedStars.setAttribute('aria-label',`${stars} of 5 wanted stars`);
  heatStatus.textContent = !stars ? 'NO ACTIVE WARRANT' : !spotted ? 'SEARCHING' : stars >= 4 ? 'AIR SUPPORT' : stars >= 3 ? 'PATROL PURSUIT' : 'FOOT PURSUIT';
  arrestStatus.hidden = !arrest;
  arrestMeter.value = arrest;
  const spot = nearbyGarage();
  const action = combat.state.cooldown > 0 && combat.state.action;
  const message = (elapsed < noticeUntil && notice) || action || (spot && `G · ${spot.name}`) || (stars && spotted && report) || '';
  if (cityNotice.textContent !== message) cityNotice.textContent = message;
  cityNotice.hidden = !message;
}

function fillEvidenceLog() {
  const list = document.querySelector('#evidence-log');
  list.replaceChildren();
  if (evidenceLog.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-evidence';
    empty.textContent = 'No evidence secured yet.';
    list.append(empty);
    return;
  }
  for (const entry of evidenceLog) {
    const item = document.createElement('li');
    item.textContent = entry;
    list.append(item);
  }
}

function fillMissionList() {
  const list = document.querySelector('#mission-list');
  list.replaceChildren();
  MISSIONS.forEach((mission, index) => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = `mission-choice${index > unlockedMission ? ' locked' : ''}${missionRunning && index === activeMissionIndex ? ' current' : ''}`;
    choice.disabled = index > unlockedMission;
    const name = document.createElement('span');
    name.textContent = `${String(index + 1).padStart(2, '0')}  ${mission.title}`;
    const state = document.createElement('small');
    state.textContent = evidenceLog.some((entry) => entry.startsWith(`${mission.title} —`)) ? 'SECURED' : index <= unlockedMission ? 'AVAILABLE' : 'LOCKED';
    choice.append(name, state);
    choice.addEventListener('click', () => startMission(index));
    list.append(choice);
  });
  fillEvidenceLog();
}

function addModalButton(label, callback, secondary = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (secondary) button.className = 'secondary';
  button.addEventListener('click', callback);
  modalActions.append(button);
}

function showModal(kind, copy = '') {
  overlayMode = kind;
  modal.hidden = false;
  modalKicker.textContent = kind === 'failed' ? 'OPERATION REPORT · ATTEMPT ENDED' : kind === 'complete' ? 'SOLMAR · EVIDENCE SECURED' : kind === 'broadcast' ? 'SOLMAR PUBLIC ARCHIVE · LIVE' : kind === 'pause' ? 'COURIER DOSSIER · PAUSED' : kind === 'title' ? 'SOLMAR · COASTAL COURIER' : 'COURIER DOSSIER';
  modalTitle.textContent = kind === 'title' ? 'Palkon Auto' : kind === 'pause' ? 'Courier dossier' : kind === 'complete' ? 'Mission complete' : kind === 'broadcast' ? 'Everyone gets the morning' : kind === 'failed' ? 'Mission failed' : 'Solmar';
  modalCopy.textContent = copy;
  modalActions.replaceChildren();
  fillMissionList();
  if (kind === 'title') {
    const mission = MISSIONS[unlockedMission];
    addModalButton(`Begin ${mission.title}`, () => startMission(unlockedMission));
    addModalButton('Explore Solmar', enterFreeExplore, true);
  } else if (kind === 'pause') {
    addModalButton('Resume', () => { modal.hidden = true; simulationPaused = false; overlayMode = missionRunning ? 'active' : 'free'; });
    addModalButton('Controls', titleScreen.openControls, true);
    addModalButton('Title screen', () => location.reload(), true);
    if (missionRunning) addModalButton('Leave mission · free explore', enterFreeExplore, true);
    else addModalButton('Return to city', () => { modal.hidden = true; simulationPaused = false; overlayMode = 'free'; }, true);
  } else if (kind === 'complete') {
    const next = Math.min(activeMissionIndex + 1, MISSIONS.length - 1);
    if (activeMissionIndex < MISSIONS.length - 1) addModalButton(`Continue · ${MISSIONS[next].title}`, () => startMission(next));
    else addModalButton('Watch public broadcast', () => showBroadcast());
    addModalButton('Free explore Solmar', enterFreeExplore, true);
  } else if (kind === 'broadcast') {
    addModalButton('Return to free exploration', enterFreeExplore);
  } else if (kind === 'failed') {
    addModalButton('Retry mission', () => startMission(activeMissionIndex));
    addModalButton('Leave for free exploration', enterFreeExplore, true);
  }
}

function startMission(index) {
  if (index < 0 || index > unlockedMission || index >= MISSIONS.length) return;
  if (playerCar) { playerCar.speed = 0; playerCar = null; }
  radio.unlock();
  keys.clear();
  activeMissionIndex = index;
  activeStep = 0;
  missionRunning = true;
  missionTimer = MISSIONS[index].timerSeconds ?? 0;
  playerHealth = 100;
  cargo = index === 0 ? 'Extortion receipt' : index === 4 ? 'Authenticated public archive' : '';
  oren = null;
  missionVehicle = null;
  relaySites = new Set();
  const mission = MISSIONS[index];
  [actor.x, actor.z] = nearestOpenPosition(mission.start.x, mission.start.z);
  actor.facing = 0;
  camera.yaw = Math.PI;
  camera.pitch = 0.41;
  camera.distance = 390;
  const guardPoint = index === 3 ? nearestOpenPosition(615,-330) : null;
  combat.reset(guardPoint ? { kind:'guard',x:guardPoint[0],z:guardPoint[1],facing:-Math.PI/2,health:100 } : null);
  if (index === 2) {
    oren = { kind:'ally',x: actor.x - 54, z: actor.z + 27, health: 100 };
    const destination = nearestOpenPosition(mission.objective.x, mission.objective.z);
    mission.objective.x = destination[0]; mission.objective.z = destination[1];
  }
  if (mission.operationVehicle) {
    missionVehicle = index === 1 ? ledgerVan : glassSedan;
    const point = nearestOpenPosition(mission.operationVehicle.x, mission.operationVehicle.z);
    Object.assign(missionVehicle, { x: point[0], z: point[1], heading: 0, speed: 0, health: 100, destroyed: false, traffic: false, requiredMission: index });
  }
  simulationPaused = false;
  modal.hidden = true;
  overlayMode = 'active';
  window.__solmar.beacon = missionObjective();
  window.__solmar.operationBoundary = mission.boundary;
  updateDistrict(actor.x, actor.z);
  updateMissionHud();
}

function enterFreeExplore() {
  radio.unlock();
  combat.reset();
  missionRunning = false;
  cargo = '';
  oren = null;
  missionVehicle = null;
  if (playerCar) playerCar.speed = 0;
  modal.hidden = true;
  overlayMode = 'free';
  simulationPaused = false;
  updateMissionHud();
}

function failMission(reason) {
  if (!missionRunning) return;
  missionRunning = false;
  cargo = '';
  simulationPaused = true;
  updateMissionHud();
  showModal('failed', reason);
}

function recover(reason, fee) {
  cash = Math.max(0, Math.round((cash-fee)*100)/100);
  if (playerCar) { playerCar.speed = 0; playerCar = null; }
  actor.x = 118; actor.z = 75;
  camera.distance = 390;
  playerHealth = 100;
  police.reset();
  combat.reset();
  keys.clear();
  updateDistrict();
  saveProgress();
  const report = `${reason} · recovery and $${fee} cash penalty`;
  if (missionRunning) failMission(report);
  else { notify(report,6); updateMissionHud(); }
}

function completeMission() {
  if (!missionRunning) return;
  const mission = currentMission();
  missionRunning = false;
  cargo = '';
  if (mission) {
    cash += mission.reward;
    unlockedMission = Math.max(unlockedMission, Math.min(activeMissionIndex + 1, MISSIONS.length - 1));
    const entry = `${mission.title} — ${mission.evidence}`;
    if (!evidenceLog.includes(entry)) evidenceLog.push(entry);
    saveProgress();
    showModal('complete', `${mission.reveal}  Reward: $${mission.reward.toLocaleString('en-US')} · Evidence added: ${mission.evidence}`);
  }
  simulationPaused = true;
  updateMissionHud();
}

function showBroadcast() {
  const lines = evidenceLog.map((entry, index) => `${String(index + 1).padStart(2, '0')} · ${entry}`).join('\n');
  simulationPaused = true;
  showModal('broadcast', `PUBLIC MIRRORS CONFIRMED · BASTION CIVIC CONTRACTS DISMANTLED\n\n${lines}`);
}

function interactMission() {
  if (!missionRunning) return;
  const mission = currentMission();
  if (!mission) return;
  if (activeMissionIndex === 2) return;
  let target = activeMissionIndex === 5
    ? mission.steps.filter((step) => !relaySites.has(step.target.label)).map((step) => step.target).find((point) => Math.hypot(actor.x - point.x, actor.z - point.z) <= 92)
    : objectiveFor(mission, activeStep);
  if (!target || Math.hypot(actor.x - target.x, actor.z - target.z) > 92) return;
  if (activeMissionIndex === 5) {
    relaySites.add(target.label);
    activeStep = relaySites.size;
    if (relaySites.size === mission.steps.length) completeMission();
    else updateMissionHud();
    return;
  }
  const action = mission.steps[activeStep].action;
  if (activeMissionIndex === 3 && action === 'collect' && combat.state.guard?.health) { notify('The guard is still covering the payment chain'); return; }
  if (action === 'collect') {
    cargo = activeMissionIndex === 1 ? 'Original dock-fee ledger' : activeMissionIndex === 3 ? 'Rook payment chain' : "Silas Rook's master agreement";
    activeStep++;
    updateMissionHud();
    return;
  }
  if (action === 'relay') {
    relaySites.add(target.label);
    activeStep++;
    updateMissionHud();
    return;
  }
  if (action === 'publish') {
    completeMission();
    return;
  }
  if (action === 'deliver') {
    if (activeMissionIndex === 0 && cargo !== 'Extortion receipt') { failMission('Loss of required evidence: extortion receipt'); return; }
    if (activeMissionIndex === 1 && cargo !== 'Original dock-fee ledger') { failMission('Loss of required cargo: dock-fee ledger'); return; }
    if (activeMissionIndex === 3 && cargo !== 'Rook payment chain') { failMission('Loss of required cargo: payment chain'); return; }
    if (activeMissionIndex === 4 && cargo !== 'Authenticated public archive') { failMission('Loss of required cargo: authenticated archive'); return; }
    if (activeMissionIndex === 6 && cargo !== "Silas Rook's master agreement") { failMission("Loss of required evidence/cargo: Rook's master agreement"); return; }
    cargo = '';
    completeMission();
  }
}

function tickMission(dt) {
  if (!missionRunning) return;
  const mission = currentMission();
  if (!mission) return;
  if (mission.timerSeconds) {
    missionTimer = Math.max(0, missionTimer - dt);
    if (missionTimer <= 0) { failMission('Operation timer expired'); return; }
  }
  if (!insideBoundary(actor, mission.boundary)) { failMission('Operation boundary crossed'); return; }
  if (missionVehicle?.destroyed || (missionVehicle && missionVehicle.health <= 0)) { failMission('Required operation vehicle destroyed'); return; }
  if (playerHealth <= 0) { recover('Mara was incapacitated',250); return; }
  if (activeMissionIndex === 2 && oren) {
    if (oren.health <= 0) { failMission('Oren was incapacitated'); return; }
    const dx = actor.x - oren.x, dz = actor.z - oren.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 420) { oren.x = actor.x - dx / distance * 180; oren.z = actor.z - dz / distance * 180; }
    else if (distance > 54 && !oren.stagger) {
      const pace = distance > 220 ? 225 : 150;
      oren.x += dx / distance * Math.min(distance - 48, pace * dt);
      oren.z += dz / distance * Math.min(distance - 48, pace * dt);
    }
    const target = missionObjective();
    window.__solmar.beacon = target;
    window.__solmar.minimap = updateHud(actor, playerCar, cars, nearestCar(), actor.facing, {
      boundary: mission.boundary,
      target,
      oren,
    });
    const reachedCourtyard = Math.hypot(actor.x - mission.objective.x, actor.z - mission.objective.z) < 105;
    const witnessSafe = Math.hypot(oren.x - mission.objective.x, oren.z - mission.objective.z) < 180;
    if (reachedCourtyard && witnessSafe) completeMission();
  }
}

function dropCargo() {
  if (missionRunning && cargo) {
    const lost = cargo;
    cargo = '';
    failMission(`Loss of required evidence/cargo: ${lost}`);
  }
}

function frame(now, singleFrame = false) {
  if (!singleFrame) {
    if (renderingPaused) return;
    requestAnimationFrame(frame);
    if (now - lastRenderTime < 34) return;
  }
  // Keep a slow GPU responsive instead of accumulating seconds of stale frames.
  if (frameFence) {
    if (!singleFrame && gl.clientWaitSync(frameFence, 0, 0) === gl.TIMEOUT_EXPIRED) return;
    gl.deleteSync(frameFence);
    frameFence = null;
  }
  const delta = singleFrame ? 0 : Math.min(0.12, (now - previousTime) / 1000);
  previousTime = now;
  lastRenderTime = now;
  if(!simulationPaused)for(let t=0;t<delta&&!simulationPaused;t+=1/60)simulate(Math.min(1/60,delta-t));
  if (titleScreen.visible) {
    elapsed += delta;
    updateTraffic(traffic,delta,cars,null);
    updatePedestrians(pedestrians,actor,null,delta);
  }

  const width = canvas.clientWidth, height = canvas.clientHeight;
  const pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
  if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  const isNight = phase === 2, isSunset = phase === 1;
  const sunAngle = isNight ? 0.68 : isSunset ? 0.38 : 1.09;
  const sunDirection = [Math.cos(sunAngle), Math.sin(sunAngle), 0.43];
  const night = isNight ? 1 : isSunset ? 0.2 : 0;
  const dusk = isSunset ? 1 : 0;
  const sky = isNight ? [0.018, 0.038, 0.075] : isSunset ? [0.74, 0.39, 0.25] : [0.48, 0.72, 0.83];

  gl.clearColor(...sky, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawSky();
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
  gl.disable(gl.BLEND);

  if(playerCar && !camera.drag){const desired=playerCar.heading+Math.PI;const difference=Math.atan2(Math.sin(desired-camera.yaw),Math.cos(desired-camera.yaw));camera.yaw+=difference*Math.min(1,delta*3);}
  const target = titleScreen.visible ? [100,85,-180] : [actor.x, camera.distance>700?100:30, actor.z];
  let cameraPosition = [
    target[0] + Math.sin(camera.yaw) * Math.cos(camera.pitch) * camera.distance,
    Math.sin(camera.pitch) * camera.distance + (camera.distance>700?160:55),
    target[2] + Math.cos(camera.yaw) * Math.cos(camera.pitch) * camera.distance,
  ];
  if (titleScreen.visible) {
    const drift = elapsed * 0.019;
    cameraPosition = [-1450 + Math.sin(drift)*180, 920 + Math.sin(drift*0.7)*45, -1580 + Math.cos(drift)*160];
  }
  const rayDistance = (origin, end, bounds) => {
    const delta = [end[0] - origin[0], end[1] - origin[1], end[2] - origin[2]];
    let enter = 0, exit = 1;
    for (const [axis, low, high] of [[0, bounds.minX, bounds.maxX], [1, 0, bounds.top], [2, bounds.minZ, bounds.maxZ]]) {
      if (Math.abs(delta[axis]) < 0.0001) {
        if (origin[axis] < low || origin[axis] > high) return Infinity;
      } else {
        let near = (low - origin[axis]) / delta[axis], far = (high - origin[axis]) / delta[axis];
        if (near > far) [near, far] = [far, near];
        enter = Math.max(enter, near);
        exit = Math.min(exit, far);
        if (enter > exit) return Infinity;
      }
    }
    return enter >= 0 && enter <= 1 && exit >= 0 ? enter : Infinity;
  };
  let wallFraction = 1;
  if (!titleScreen.visible) for (const obstacle of city.colliders) wallFraction = Math.min(wallFraction, rayDistance(target, cameraPosition, obstacle));
  const collisionAdjusted = wallFraction < 1;
  if (collisionAdjusted) {
    const scale = Math.max(0.015, wallFraction - 0.025);
    cameraPosition = target.map((point, axis) => point + (cameraPosition[axis] - point) * scale);
  }
  const clippedByBuilding = city.colliders.some((obstacle) =>
    cameraPosition[0] >= obstacle.minX && cameraPosition[0] <= obstacle.maxX
    && cameraPosition[1] >= 0 && cameraPosition[1] <= obstacle.top
    && cameraPosition[2] >= obstacle.minZ && cameraPosition[2] <= obstacle.maxZ);
  window.__solmar.camera = {
    clearOfBuildings: !clippedByBuilding,
    clippedByBuilding,
    collisionAdjusted,
    wallFraction: Number(wallFraction.toFixed(4)),
  };
  window.__solmar.camera.position = cameraPosition.map((value) => Math.round(value));
  window.__solmar.camera.target = target.map((value) => Math.round(value));
  lookAt(view, cameraPosition, target, [0, 1, 0]);
  perspective(projection, Math.PI / 3, canvas.width / canvas.height, 1, 10000);
  multiply(viewProjection, projection, view);
  identity(model);
  // Static geometry needs the same model transform as the dynamic actors,
  // including the first frame before buildActors has uploaded any uniforms.
  gl.uniformMatrix4fv(modelLocation, false, model);
  gl.uniformMatrix4fv(viewProjectionLocation, false, viewProjection);
  gl.uniform3fv(sunLocation, sunDirection);
  gl.uniform3fv(eyeLocation, cameraPosition);
  gl.uniform3fv(skyLocation, sky);
  gl.uniform1f(nightLocation, night);
  gl.uniform1f(sunsetLocation, dusk);
  gl.uniform1f(timeLocation, elapsed);
  activeLights=cars.filter(car=>car===playerCar||car.traffic||(car.police&&!car.block)).sort((a,b)=>distance(a,actor)-distance(b,actor)).slice(0,16);
  const poses=new Float32Array(64);
  activeLights.forEach((car,i)=>{const fx=Math.sin(car.heading),fz=Math.cos(car.heading),nose=CAR_PROFILES[car.profile].length/2;poses.set([car.x+fx*nose,car.z+fz*nose,fx,fz],i*4);});
  gl.uniform1i(headlightCountLocation,activeLights.length);
  gl.uniform4fv(headlightPoseLocation,poses);
  gl.uniform1f(headlightStrengthLocation,headlightStrength);
  const helicopter = police.state.helicopter;
  gl.uniform1f(searchlightOnLocation,helicopter ? 1 : 0);
  if (helicopter) gl.uniform2f(searchlightLocation,helicopter.beamX,helicopter.beamZ);

  gl.bindBuffer(gl.ARRAY_BUFFER, cityBuffer);
  for (const [name, size, offset] of [['position', 3, 0], ['normal', 3, 12], ['tint', 4, 24], ['kind', 1, 40]]) {
    gl.vertexAttribPointer(gl.getAttribLocation(program, name), size, gl.FLOAT, false, stride, offset);
  }
  gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 11);

  gl.bindBuffer(gl.ARRAY_BUFFER, actorBuffer);
  for (const [name, size, offset] of [['position', 3, 0], ['normal', 3, 12], ['tint', 4, 24], ['kind', 1, 40]]) {
    gl.vertexAttribPointer(gl.getAttribLocation(program, name), size, gl.FLOAT, false, stride, offset);
  }
  const people = buildActors(elapsed);
  const mesh=streetMesh(cars,traffic.signals,traffic.time,isNight,playerCar,actor);
  meshInfo={renderedCars:mesh.renderedCars,renderedSignals:mesh.renderedSignals,vertices:mesh.vertices.length/11};
  gl.bindBuffer(gl.ARRAY_BUFFER,actorBuffer);
  gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.vertices);
  gl.drawArrays(gl.TRIANGLES,0,mesh.vertices.length/11);
  drawShadows(people, sunDirection);
  drawSearchlight(helicopter);
  drawHeadlightPools();
  window.__solmar.actors = { playerAndPedestrians: people.length, movingShadows: people.length, sunDirection };
  updateMissionHud();
  updateCityHud();
  const mission = missionRunning ? currentMission() : null;
  window.__solmar.minimap=updateHud(actor,playerCar,cars,nearestCar(),actor.facing,{
    boundary: mission?.boundary ?? null,
    target: missionRunning ? missionObjective() : null,
    targets: missionMapTargets(),
    oren: missionRunning && activeMissionIndex === 2 ? oren : null,
    garages:GARAGES,
    officers:police.state.officers,
    helicopter:police.state.helicopter,
  });
  window.__solmar.beacon = missionRunning ? missionObjective() : null;
  if (frameNumber++ % 6 === 0) updateDistrict(actor.x, actor.z);
  window.__solmar.frames = frameNumber;
  frameFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
}

function updateDistrict(x = actor.x, z = actor.z) {
  const selected = city.districts.reduce((best, district) => {
    const distance = (district.x - x) ** 2 + (district.z - z) ** 2;
    return distance < best.distance ? { name: district.name, distance } : best;
  }, { name: 'Glasspoint', distance: Infinity });
  document.querySelector('#district').textContent = selected.name;
  window.__solmar.player = { x: Math.round(actor.x), z: Math.round(actor.z) };
  document.querySelectorAll('.districts button').forEach((button) => {
    if (button.textContent === selected.name) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
}

const query = new URLSearchParams(location.search);
function setCameraPreset(preset) {
playerCar=null;
if (preset === 'park') {
    actor.x = 0;
    actor.z = 0;
    camera.yaw = -0.92;
    camera.pitch = 0.66;
    camera.distance = 740;
  } else {
    if (preset === 'city' || preset === 'solmar') {
      actor.x = 118;
      actor.z = 75;
    }
    camera.yaw = -0.84;
    camera.pitch = 0.40;
    camera.distance = 2300;
  }
  updateDistrict();
}
window.__solmar.setCameraPreset = setCameraPreset;
setPhase(0);
if (query.get('mode') === 'night') setPhase(2);
if (query.get('mode') === 'sunset') setPhase(1);
if (query.get('mode') === 'day') setPhase(0);
if (query.has('shot')) setCameraPreset(query.get('shot'));
if (query.has('district')) document.querySelector('#district').textContent = query.get('district');
document.querySelectorAll('.districts button').forEach((button) => {
  button.addEventListener('click', () => {
    if(playerCar){playerCar.speed=0;playerCar=null;}
    [actor.x, actor.z] = nearestOpenPosition(Number(button.dataset.x), Number(button.dataset.z));
    if (missionRunning && activeMissionIndex === 2 && oren) { oren.x = actor.x - 54; oren.z = actor.z + 27; }
    updateDistrict(actor.x, actor.z);
    updateMissionHud();
  });
});
if (query.has('verify')) {
  window.__solmar.testRender = () => {
    renderingPaused = true;
    frame(performance.now(), true);
    gl.finish();
    return frameNumber;
  };
  window.__solmar.testCamera = (yaw,pitch,distance) => Object.assign(camera,{ yaw,pitch,distance });
  window.__solmar.testPedestrians = () => pedestrians.map(({id,x,z,lane,health,direction}) => ({id,x,z,lane,health,direction}));
  window.__solmar.testPlacePedestrian = (id,x,z) => Object.assign(pedestrians[id],{x,z,lane:x,origin:z,low:z-90,high:z+90,direction:1,health:100,stagger:0});
  window.__solmar.testPlaceCar = (id,x,z,heading = 0) => {
    const car = cars.find(car => car.id === id);
    Object.assign(car,{ x,z,heading,speed:0,traffic:false });
    if (car === playerCar) Object.assign(actor,{x,z,facing:heading});
  };
  window.__solmar.testSetPosition = (x, z) => {
    if (playerCar) { playerCar.speed = 0; playerCar = null; }
    actor.x = Number(x); actor.z = Number(z); updateDistrict(); updateMissionHud();
  };
  window.__solmar.testSetOren = (x, z, health = 100) => { if (oren) Object.assign(oren, { x: Number(x), z: Number(z), health: Number(health) }); };
  window.__solmar.testSetHealth = (health) => { playerHealth = Number(health); };
  window.__solmar.testSetTimer = (seconds) => { missionTimer = Number(seconds); };
  window.__solmar.testDestroyVehicle = () => { if (missionVehicle) { missionVehicle.health = 0; missionVehicle.destroyed = true; } };
  window.__solmar.testProgress = () => ({ active: missionRunning, index: activeMissionIndex, step: activeStep, objective: missionObjective(), beacon: window.__solmar.beacon, minimapObjective: window.__solmar.minimap?.objective ?? null, oren: oren ? { ...oren } : null, cargo, timer: missionTimer });
  window.__solmar.testMissionDestination = () => currentMission()?.objective ?? null;
  window.__solmar.testStartMission = startMission;
}
let requestedNewGame = false;
try {
  requestedNewGame = sessionStorage.getItem('palkon-auto-new-game') === '1';
  sessionStorage.removeItem('palkon-auto-new-game');
} catch { /* Storage restrictions do not prevent starting the story. */ }
if (requestedNewGame) {
  titleScreen.show(false);
  saveProgress();
  setPhase(0);
  startMission(0);
} else {
  modal.hidden = true;
  setPhase(1);
  titleScreen.show(true);
}
updateMissionHud();
frame(previousTime);
