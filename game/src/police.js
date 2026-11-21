import { approach, carHitsWorld, carsOverlap, makeCar } from './vehicles.js';

export const ARREST_SECONDS = 2.5;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function clearSight(a, b, buildings, height = 35) {
  for (const box of buildings) {
    if (box.top < height) continue;
    let near = 0.01, far = 0.99;
    for (const [start, end, low, high] of [[a.x,b.x,box.minX,box.maxX],[a.z,b.z,box.minZ,box.maxZ]]) {
      const delta = end - start;
      if (Math.abs(delta) < 0.001) {
        if (start < low || start > high) far = -1;
      } else {
        const t1 = (low - start) / delta, t2 = (high - start) / delta;
        near = Math.max(near, Math.min(t1, t2));
        far = Math.min(far, Math.max(t1, t2));
      }
      if (near > far) break;
    }
    if (near <= far) return false;
  }
  return true;
}

export function pursueOnFoot(unit, target, pace, dt, blocked) {
  const heading = Math.atan2(target.x - unit.x, target.z - unit.z);
  for (const offset of [0, 0.65, -0.65, 1.25, -1.25, 1.6, -1.6]) {
    const facing = heading + offset;
    const x = unit.x + Math.sin(facing) * pace * dt;
    const z = unit.z + Math.cos(facing) * pace * dt;
    if (blocked(x, z)) continue;
    Object.assign(unit, { x, z, facing });
    return;
  }
}

export function createPolice({ actor, cars, pedestrians, traffic, buildings, obstacles, blocked, onArrest, onRam, nearbyAlly }) {
  const state = { stars: 0, arrest: 0, unseen: 0, spotted: false, officers: [], patrols: [], blocks: [], helicopter: null, report: '', rams: 0 };
  let dispatch = 0, sightClock = 0, incident = { ...actor };

  function removeUnits(units, keep = 0) {
    for (const car of units.splice(keep)) cars.splice(cars.indexOf(car), 1);
  }

  function reset() {
    removeUnits(state.blocks);
    removeUnits(state.patrols);
    Object.assign(state, { stars: 0, arrest: 0, unseen: 0, spotted: false, officers: [], helicopter: null, report: '', rams: 0 });
    dispatch = sightClock = 0;
  }

  function crime(report, victim, occupied = false) {
    if (!occupied && ![...pedestrians, ...traffic.cars.filter(car => car.traffic), ...state.officers, nearbyAlly()].some(witness =>
      witness && witness !== victim && witness.health !== 0 && distance(witness, actor) < 235 && clearSight(witness, actor, buildings))) return false;
    state.stars = Math.min(5, state.stars + 1);
    state.report = report;
    state.unseen = 0;
    state.spotted = true;
    incident = { ...actor };
    return true;
  }

  function placeCar(id, range, isBlock) {
    const options = [];
    for (const road of traffic.signals) for (const offset of [-106, 106]) {
      for (const [x,z,heading] of [[road.x, road.z+offset, 0], [road.x+offset, road.z, Math.PI/2]]) {
        const gap = distance({ x, z }, actor);
        if (gap < range[0] || gap > range[1]) continue;
        if (state.blocks.some(block => distance(block, { x, z }) < 170)) continue;
        options.push({ x, z, heading: heading + (isBlock ? Math.PI/2 : 0), gap });
      }
    }
    options.sort((a,b) => a.gap - b.gap);
    for (const { x, z, heading } of options) {
      const car = makeCar(id, 1, x, z, heading);
      if (carHitsWorld(car,x,z,heading,obstacles) || cars.some(other => distance(car,other) < 83 && carsOverlap(car,other))) continue;
      Object.assign(car, { police: true, block: isBlock, ramCooldown: 0, stall: 0, detour: 0 });
      cars.push(car);
      return car;
    }
    return null;
  }

  function dispatchUnits() {
    const count = state.stars === 1 ? 1 : 2;
    if (state.officers.length < count) {
      for (const radius of [112, 156, 220]) {
        for (let i = 0; i < 12; i++) {
          const angle = i * Math.PI / 6 + state.officers.length * 0.3;
          const officer = { kind: 'officer', x: actor.x + Math.sin(angle)*radius, z: actor.z + Math.cos(angle)*radius, facing: angle + Math.PI, health: 100 };
          if (blocked(officer.x,officer.z) || state.officers.some(other => distance(other,officer) < 55) || !clearSight(officer,actor,buildings)) continue;
          state.officers.push(officer);
          return;
        }
      }
    }
  }

  function drivePatrol(car, target, playerCar, dt) {
    car.ramCooldown = Math.max(0, car.ramCooldown - dt);
    car.detour = Math.max(0, car.detour - dt);
    const heading = Math.atan2(target.x - car.x, target.z - car.z);
    const error = Math.atan2(Math.sin(heading-car.heading), Math.cos(heading-car.heading));
    const steer = car.detour > 0 ? car.detourSide * 1.35 : error;
    car.heading += Math.max(-2.5*dt, Math.min(2.5*dt, steer));
    const speed = car.detour > 0 ? -55 : Math.abs(error) > 1.05 ? 35 : state.stars === 5 ? 285 : 225;
    car.speed = approach(car.speed, speed, 175 * dt);
    const x = car.x + Math.sin(car.heading)*car.speed*dt;
    const z = car.z + Math.cos(car.heading)*car.speed*dt;
    const hit = cars.find(other => other !== car && distance({ x,z },other) < 80 && carsOverlap(car,other,x,z));
    const wall = carHitsWorld(car,x,z,car.heading,obstacles);
    if (hit || wall) {
      if (playerCar && hit === playerCar && !car.ramCooldown) {
        car.ramCooldown = 1.2;
        state.rams++;
        onRam(playerCar);
      }
      car.speed = 0;
      car.stall += dt;
      if (car.stall > 0.23 && !car.detour) {
        car.detour = 0.85;
        car.detourSide = (car.detourSide ?? 1) * -1;
      }
    } else {
      car.distance += Math.hypot(x-car.x,z-car.z);
      Object.assign(car, { x, z, stall: 0 });
    }
  }

  function update(dt, playerCar, dodging) {
    if (!state.stars) return;
    dispatch -= dt;
    if (dispatch <= 0) {
      dispatch = 0.65;
      state.officers = state.officers.filter(unit => distance(unit,actor) < 650);
      const activeArea = state.spotted && distance(actor,incident)<310;
      if (activeArea) dispatchUnits();
      if (state.stars >= 3 && activeArea) {
        for (const car of [...state.patrols]) if (distance(car,actor) > 1050) {
          state.patrols.splice(state.patrols.indexOf(car),1);
          cars.splice(cars.indexOf(car),1);
        }
        while (state.blocks.length < 2) {
          const block = placeCar(`roadblock-${state.blocks.length}`, [190,950], true);
          if (!block) break;
          state.blocks.push(block);
        }
        if (state.patrols.length < (state.stars === 5 ? 3 : 2)) {
          const patrol = placeCar(`patrol-${state.patrols.length}`, [135,660], false);
          if (patrol) state.patrols.push(patrol);
        }
      }
    }

    const units = [...state.officers.filter(unit => unit.health), ...state.patrols, ...state.blocks];
    const policeSight = units.some(unit => distance(unit,actor) < 305 && clearSight(unit,actor,buildings));
    sightClock -= dt;
    if (sightClock <= 0) {
      sightClock = 0.16;
      const trafficSight = traffic.cars.some(car => car.traffic && distance(car,actor) < 108 && clearSight(car,actor,buildings));
      state.spotted = policeSight || trafficSight;
      if (state.spotted) { state.unseen = 0; incident = { ...actor }; }
    }
    if (!state.spotted) state.unseen += dt;
    if (state.unseen >= 9) {
      state.unseen = 0;
      if (--state.stars === 0) { reset(); return; }
      if (state.stars < 3) { removeUnits(state.patrols); removeUnits(state.blocks); }
      else if (state.stars === 4) removeUnits(state.patrols, 2);
      if (state.stars < 4) state.helicopter = null;
      if (state.stars === 1) state.officers.length = Math.min(1, state.officers.length);
    }

    for (const officer of state.officers) {
      if (!officer.health) continue;
      const target = policeSight ? actor : incident;
      if (distance(officer,target) > 23) pursueOnFoot(officer,target,playerCar ? 151 : 131,dt,blocked);
    }
    for (const patrol of state.patrols) drivePatrol(patrol, policeSight ? actor : incident, playerCar, dt);
    if (state.stars >= 4) {
      const h = state.helicopter ??= { x: actor.x+155, z: actor.z-130, y: 310, orbit: 0, beam: true };
      h.orbit += dt * 0.84;
      const target = state.spotted ? actor : incident;
      h.x = approach(h.x, target.x + Math.cos(h.orbit)*185, 260*dt);
      h.z = approach(h.z, target.z + Math.sin(h.orbit)*185, 260*dt);
      h.beamX = target.x + Math.sin(h.orbit*1.4)*24;
      h.beamZ = target.z + Math.cos(h.orbit*1.4)*24;
      h.heading = Math.atan2(h.beamX - h.x, h.beamZ - h.z);
    }
    const close = !playerCar && !dodging && state.officers.some(unit => unit.health && distance(unit,actor) < 35 && clearSight(unit,actor,buildings));
    state.arrest = close ? state.arrest + dt : 0;
    if (state.arrest + 1e-6 >= ARREST_SECONDS) {
      const fee = 60 + 20*state.stars;
      reset();
      onArrest(fee);
    }
  }

  return { state, crime, update, reset };
}
