import { CAR_PROFILES } from './vehicles.js';
import { signalState } from './traffic.js';

export function streetMesh(cars, signals, time, night, playerCar, viewer) {
  const vertices = [];
  let transform = null;
  function point(p) {
    if (!transform) return p;
    const [x, z, s, c] = transform;
    return [x + p[0] * c + p[2] * s, p[1], z - p[0] * s + p[2] * c];
  }
  function quad(a, b, c, d, normal, color, kind = 1) {
    const n = transform ? [normal[0] * transform[3] + normal[2] * transform[2], normal[1], -normal[0] * transform[2] + normal[2] * transform[3]] : normal;
    for (const p of [a, b, c, a, c, d]) vertices.push(...point(p), ...n, ...color, kind);
  }
  function box(x, y, z, w, h, depth, color, kind = 1) {
    const X = x + w, Y = y + h, Z = z + depth;
    quad([x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z],[0,0,1],color,kind);
    quad([X,y,z],[x,y,z],[x,Y,z],[X,Y,z],[0,0,-1],color,kind);
    quad([x,y,z],[x,y,Z],[x,Y,Z],[x,Y,z],[-1,0,0],color,kind);
    quad([X,y,Z],[X,y,z],[X,Y,z],[X,Y,Z],[1,0,0],color,kind);
    quad([x,Y,Z],[X,Y,Z],[X,Y,z],[x,Y,z],[0,1,0],color,kind);
    quad([x,y,z],[X,y,z],[X,y,Z],[x,y,Z],[0,-1,0],color,kind);
  }
  const ink = [0.045,0.08,0.095,1], chrome = [0.58,0.65,0.63,1], glass = [0.12,0.27,0.32,1];
  let renderedCars = 0, renderedSignals = 0;
  for (const car of cars) {
    if (Math.hypot(car.x - viewer.x, car.z - viewer.z) > 1700) continue;
    renderedCars++;
    const p = CAR_PROFILES[car.profile], w = p.width, l = p.length;
    const lampsOn = night && (car === playerCar || car.traffic || car.police);
    const paint = car.police ? [0.66,0.73,0.75,1] : car.color ?? p.color;
    transform = [car.x, car.z, Math.sin(car.heading), Math.cos(car.heading)];
    box(-w/2, 11, -l/2, w, 12, l, paint);
    box(-w/2+2, 23, -l*0.24, w-4, p.roof-12, l*(p.type === 'van' ? 0.71 : 0.46), paint);
    const roofY = 11 + p.roof;
    box(-w/2+3, 24, l*(p.type === 'van' ? 0.40 : 0.22), w-6, p.roof-14, 1, glass);
    box(-w/2+3, 24, -l*0.245-1, w-6, p.roof-14, 1, glass);
    for (const side of [-1, 1]) {
      box(side*w/2-0.7, 24, -l*0.17, 1.4, p.roof-15, l*0.33, glass);
      box(side*w/2-1, 22, -l*0.02, 2, p.roof-12, 2, paint);
      box(side*w/2-2, 20, l*0.21, 5, 4, 5, paint);
      if (car.police) box(side*w/2-0.6,16,-l/2,1.3,5,l,[0.08,0.25,0.40,1]);
      for (const axle of [-0.31,0.31]) {
        box(side*w/2-2, 6, l*axle-6, 5, 13, 12, ink);
        box(side*w/2+(side>0?2:-2.4), 9, l*axle-3, 0.9, 6, 6, chrome);
      }
      box(side*(w/2-7)-3.5, 16, l/2+0.4, 7, 4, 1.2, lampsOn ? [1,0.94,0.68,1] : [0.91,0.87,0.68,1], lampsOn ? 9 : 1);
      box(side*(w/2-6)-3.5, 16, -l/2-1.6, 7, 4, 1.2, [car.brakeLight ? 1 : 0.68,0.035,0.025,1], lampsOn || car.brakeLight ? 9 : 1);
    }
    box(-w/2+2, 11, l/2+1, w-4, 3, 2, chrome);
    box(-w/2+2, 11, -l/2-3, w-4, 3, 2, chrome);
    box(-5, 13, -l/2-3.2, 10, 3, 0.7, [0.91,0.83,0.63,1]);
    if (p.type === 'van') {
      box(-0.7,24,-l*0.245-1.2,1.4,p.roof-13,1,ink);
      box(-w/2-0.8,26,-l*0.10,1,6,l*0.29,[0.22,0.49,0.49,1]);
    }
    if (p.type === 'coupe') box(-w/2,roofY-3,-l*0.38,w,3,5,ink);
    if (car.police) {
      const flash = Math.floor(time*9)%2 === 0;
      box(-11,roofY,0,22,3,6,ink);
      box(-11,roofY+3,0,10,4,6,flash?[1,0.13,0.08,1]:[0.31,0.08,0.07,1],flash?9:1);
      box(1,roofY+3,0,10,4,6,flash?[0.07,0.15,0.32,1]:[0.22,0.52,1,1],flash?1:9);
      if (car.block) {
        box(-w/2,10,-l/2-6,w,5,4,[1,0.57,0.20,1],9);
        box(-w/2,10,l/2+2,w,5,4,[1,0.57,0.20,1],9);
      }
    }
    if (car === playerCar) {
      box(-5,roofY+1, -3,10,0.8,6,[0.86,0.53,0.33,1]);
    }
    // Contact shadows remain under the car when it is parked after exiting.
    box(-w*0.48,5.25,-l*0.44,w*0.96,0.08,l*0.88,[0.05,0.07,0.075,1]);
    transform = null;
  }
  for (const signal of signals) {
    if (Math.hypot(signal.x-viewer.x,signal.z-viewer.z)>1450) continue;
    for (const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
      renderedSignals++;
      transform = [signal.x, signal.z, Math.sin(heading), Math.cos(heading)];
      box(49,5,-49,4,97,4,chrome);
      box(15,98,-49,38,4,4,chrome);
      box(11,67,-49,16,37,10,ink);
      const axis = Math.abs(Math.cos(heading))>0.7 ? 'z' : 'x';
      const state = signalState(time,axis,signal.offset);
      for (const [index,name] of ['red','yellow','green'].entries()) {
        const active = state===name;
        const color = active ? [[1,0.06,0.025,1],[1,0.66,0.045,1],[0.12,1,0.43,1]][index] : [[0.19,0.035,0.025,1],[0.18,0.12,0.025,1],[0.02,0.15,0.09,1]][index];
        box(14,92-index*11,-50,10,8,12,color,active?9:1);
        box(12,101-index*11,-53,14,1,16,ink);
      }
      transform = null;
    }
  }
  return { vertices: new Float32Array(vertices), renderedCars, renderedSignals };
}
