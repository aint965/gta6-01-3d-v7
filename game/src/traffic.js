import { CAR_PROFILES, makeCar, approach, clamp, forward } from './vehicles.js';

export function signalState(time, axis, offset = 0) {
  const t = ((time + offset) % 24 + 24) % 24;
  if (axis === 'z') return t < 9 ? 'green' : t < 11 ? 'yellow' : 'red';
  return t >= 12 && t < 21 ? 'green' : t >= 21 && t < 23 ? 'yellow' : 'red';
}

export function createTraffic() {
  const signals = [];
  for (const x of [-1500, -1200, -900, -300, 0, 300, 600, 900]) {
    for (let z = -1350; z <= 1350; z += 300) {
      if (Math.abs(x) <= 300 && Math.abs(z) < 300) continue;
      signals.push({ id: `${x}:${z}`, x, z, offset: 0 });
    }
  }
  // Clockwise loops use right-side lane centres, and rounded corner waypoints.
  const loops = [
    [600, 900, -1350, 1350], [-1200, -900, -1350, 1350],
    [-300, 300, 450, 1350], [-300, 300, -1350, -450],
    [600, 900, -750, 450], [-1200, -900, -750, 750],
    [300, 600, -1350, -450], [300, 600, 450, 1350],
    [-1500, -1200, -1050, 1050],
  ];
  const cars = [];
  for (let loopIndex = 0; loopIndex < loops.length; loopIndex++) {
    const [left, right, top, bottom] = loops[loopIndex];
    // Clockwise in map coordinates: top east, right south, bottom west, left north.
    const points = [[left + 48, top + 21], [right - 48, top + 21], [right - 21, top + 48], [right - 21, bottom - 48], [right - 48, bottom - 21], [left + 48, bottom - 21], [left + 21, bottom - 48], [left + 21, top + 48]];
    const lengths = points.map((p, i) => Math.hypot(points[(i + 1) % points.length][0] - p[0], points[(i + 1) % points.length][1] - p[1]));
    const perimeter = lengths.reduce((a, b) => a + b, 0);
    const count = loopIndex < 2 ? 13 : loopIndex === 8 ? 9 : 7;
    for (let index = 0; index < count; index++) {
      let distance = perimeter * (index + 0.17) / count, segment = 0;
      while (distance >= lengths[segment]) distance -= lengths[segment++];
      const a = points[segment], b = points[(segment + 1) % points.length], t = distance / lengths[segment];
      const car = makeCar(`traffic-${loopIndex}-${index}`, (loopIndex + index) % 4, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[0] - a[0], b[1] - a[1]), true);
      Object.assign(car, { route: points, segment, progress: distance, cruise: 65 + (index % 4) * 9, redStops: 0, greenStarts: 0, wasRed: false });
      cars.push(car);
    }
  }
  return { signals, cars, time: 0, redStopEvents: 0, greenStartEvents: 0 };
}

export function updateTraffic(traffic, dt, allCars, playerCar) {
  traffic.time += dt;
  for (const car of traffic.cars) {
    if (car === playerCar || !car.traffic) continue;
    const [fx, fz] = forward(car);
    let target = car.cruise, reason = null, stopDistance = Infinity;
    const half = CAR_PROFILES[car.profile].length / 2;
    for (const light of traffic.signals) {
      const dx = light.x - car.x, dz = light.z - car.z;
      const along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx);
      if (along < 48 + half - 2 || along > 215 || across > 34) continue;
      const state = signalState(traffic.time, Math.abs(fz) > 0.7 ? 'z' : 'x', light.offset);
      const gap = along - 48 - half;
      if (state !== 'green' && !(state === 'yellow' && gap < car.speed * 0.65)) {
        stopDistance = Math.min(stopDistance, Math.max(0, gap - 1.5));
        const limit = Math.sqrt(Math.max(0, 2 * 100 * (gap - 1.5)));
        if (limit < target) { target = limit; reason = state; }
      }
    }
    for (const other of allCars) {
      if (other === car) continue;
      const dx = other.x - car.x, dz = other.z - car.z;
      const along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx);
      if (along <= 0 || along > 150 || across > 29) continue;
      const gap = along - half - CAR_PROFILES[other.profile].length / 2 - 13;
      const limit = clamp(gap * 1.2, 0, car.cruise);
      if (limit < target) { target = limit; reason = 'vehicle'; }
    }
    car.brakeLight = target < car.speed - 2 || target < 1;
    car.speed = approach(car.speed, target, (target < car.speed ? 125 : 35) * dt);
    car.stoppedFor = car.speed < 1 ? reason : null;
    if (car.stoppedFor === 'red' && !car.wasRed) { car.redStops++; traffic.redStopEvents++; car.wasRed = true; }
    if (car.wasRed && car.speed > 8) { car.greenStarts++; traffic.greenStartEvents++; car.wasRed = false; }
    // The stopping curve is comfortable; the swept stop bar is authoritative.
    // This also covers a light turning red during the current simulation step.
    let step = Math.min(car.speed * dt, stopDistance);
    if (step < car.speed * dt) {
      car.speed = 0;
      car.brakeLight = true;
    }
    car.distance += step;
    // Follow actual connected lane segments; carry overshoot through corners.
    while (step > 0) {
      const a = car.route[car.segment], b = car.route[(car.segment + 1) % car.route.length];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const move = Math.min(step, length - car.progress);
      car.progress += move;
      step -= move;
      const t = car.progress / length;
      car.x = a[0] + (b[0] - a[0]) * t;
      car.z = a[1] + (b[1] - a[1]) * t;
      car.heading = Math.atan2(b[0] - a[0], b[1] - a[1]);
      if (car.progress >= length - 0.00001) { car.segment = (car.segment + 1) % car.route.length; car.progress = 0; }
    }
  }
}

export function createPedestrians() {
  const people = [];
  const clothes = [[0.77,0.39,0.27,1],[0.18,0.42,0.46,1],[0.83,0.70,0.45,1],[0.30,0.48,0.35,1]];
  for (const x of [-1200,-900,-300,0,300,600,900]) for (let z = -1200; z <= 1200; z += 300) {
    if (Math.abs(x) < 400 && Math.abs(z) < 300) continue;
    for (const side of [-1,1]) {
      const id = people.length, lane = x + side*63;
      const origin = z + ((id*37)%100) - 50;
      people.push({ id, kind:'civilian', health:100, x:lane, z:origin, lane, origin, low:z-90, high:z+90, pace:27+id%13, direction:side, facing:side<0?Math.PI:0, color:clothes[id%clothes.length] });
    }
  }
  return people;
}

export function updatePedestrians(people, actor, car, dt) {
  for (const person of people) {
    if (!person.health) {
      person.downTime = (person.downTime ?? 0)+dt;
      if (person.downTime > 42 && Math.hypot(actor.x-person.x,actor.z-person.z) > 450) {
        Object.assign(person,{ health:100,downTime:0,x:person.lane,z:person.origin });
      }
      continue;
    }
    if (person.stagger) continue;
    const dx = person.x-actor.x, dz = person.z-actor.z;
    const alert = Math.abs(dx)<(car?57:31) && Math.abs(dz)<(car?85:53);
    if (alert && Math.abs(dz)>7) person.direction = Math.sign(dz);
    if (person.z <= person.low) person.direction = 1;
    if (person.z >= person.high) person.direction = -1;
    const pace = person.pace * (alert ? 1.85 : 1);
    person.z = clamp(person.z + person.direction*pace*dt,person.low,person.high);
    person.x = approach(person.x, person.lane + (alert ? (Math.sign(dx)||1)*7 : 0),30*dt);
    person.facing = person.direction < 0 ? Math.PI : 0;
  }
}
