// Solmar uses ten world units per metre. Headings point along local +Z.
export const CAR_PROFILES = [
  { name: 'Pico · City compact', type: 'compact', width: 27, length: 47, roof: 25, acceleration: 72, brake: 155, maxSpeed: 245, wheelbase: 30, steer: 0.58, color: [0.84, 0.44, 0.32, 1] },
  { name: 'Vela · Touring sedan', type: 'sedan', width: 30, length: 61, roof: 26, acceleration: 63, brake: 145, maxSpeed: 300, wheelbase: 40, steer: 0.49, color: [0.19, 0.53, 0.57, 1] },
  { name: 'Porter · Utility van', type: 'van', width: 32, length: 65, roof: 39, acceleration: 43, brake: 118, maxSpeed: 205, wheelbase: 43, steer: 0.43, color: [0.86, 0.79, 0.63, 1] },
  { name: 'Sirocco · Sport coupe', type: 'coupe', width: 29, length: 57, roof: 21, acceleration: 96, brake: 180, maxSpeed: 375, wheelbase: 36, steer: 0.52, color: [0.32, 0.45, 0.32, 1] },
];

export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
export const forward = (car) => [Math.sin(car.heading), Math.cos(car.heading)];
export function makeCar(id, profile, x, z, heading = 0, traffic = false) {
  return { id, profile, x, z, heading, speed: 0, steering: 0, traffic, brakeLight: false, collision: false, stoppedFor: null, distance: 0, health: 100 };
}

export function carHitsWorld(car, x, z, heading, obstacles) {
  const profile = CAR_PROFILES[car.profile];
  const s = Math.sin(heading), c = Math.cos(heading);
  const halfWidth = profile.width / 2, halfLength = profile.length / 2;
  if (x < -1860 || x > 1180 || Math.abs(z) > 1670) return true;
  // Separating axes for the oriented car and each axis-aligned obstacle.
  for (const box of obstacles) {
    const dx = (box.minX + box.maxX) / 2 - x, dz = (box.minZ + box.maxZ) / 2 - z;
    const ex = (box.maxX - box.minX) / 2, ez = (box.maxZ - box.minZ) / 2;
    if (Math.abs(dx) > ex + Math.abs(c) * halfWidth + Math.abs(s) * halfLength) continue;
    if (Math.abs(dz) > ez + Math.abs(s) * halfWidth + Math.abs(c) * halfLength) continue;
    if (Math.abs(dx * c - dz * s) > halfWidth + ex * Math.abs(c) + ez * Math.abs(s)) continue;
    if (Math.abs(dx * s + dz * c) > halfLength + ex * Math.abs(s) + ez * Math.abs(c)) continue;
    return true;
  }
  return false;
}

export function carsOverlap(car, other, x = car.x, z = car.z, heading = car.heading) {
  const a = CAR_PROFILES[car.profile], b = CAR_PROFILES[other.profile];
  const sideA = [Math.cos(heading), -Math.sin(heading)], frontA = [Math.sin(heading), Math.cos(heading)];
  const sideB = [Math.cos(other.heading), -Math.sin(other.heading)], frontB = forward(other);
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1];
  const delta = [other.x - x, other.z - z];
  for (const axis of [sideA, frontA, sideB, frontB]) {
    const extentA = Math.abs(dot(axis, sideA)) * a.width / 2 + Math.abs(dot(axis, frontA)) * a.length / 2;
    const extentB = Math.abs(dot(axis, sideB)) * b.width / 2 + Math.abs(dot(axis, frontB)) * b.length / 2;
    if (Math.abs(dot(delta, axis)) >= extentA + extentB) return false;
  }
  return true;
}

export function driveCar(car, keys, dt, obstacles, cars) {
  const profile = CAR_PROFILES[car.profile];
  const throttle = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
  const steer = Number(keys.has('a') || keys.has('arrowleft')) - Number(keys.has('d') || keys.has('arrowright'));
  // Direction changes are a two-stage maneuver: finish braking to an exact stop,
  // then let the next simulation tick apply throttle in the opposite direction.
  const braking = Boolean(throttle && car.speed !== 0 && Math.sign(car.speed) !== Math.sign(throttle));
  const handbrake = keys.has(' ');
  car.brakeLight = Boolean(braking || handbrake);
  if (handbrake) car.speed = approach(car.speed, 0, profile.brake * dt * 1.8);
  else if (braking) car.speed = approach(car.speed, 0, profile.brake * dt);
  else if (throttle) car.speed += throttle * profile.acceleration * dt * (1 - Math.abs(car.speed) / (profile.maxSpeed * 1.24));
  else car.speed = approach(car.speed, 0, (9 + car.speed * car.speed * 0.00015) * dt);
  car.speed = clamp(car.speed, -profile.maxSpeed * 0.29, profile.maxSpeed);
  car.steering = approach(car.steering, steer, dt * 3.3);
  const angle = profile.steer * car.steering / (1 + Math.abs(car.speed) / 95);
  const yaw = car.speed / profile.wheelbase * Math.tan(angle);
  // Swept microsteps ensure a fast coupe cannot tunnel through narrow lamp posts.
  const steps = Math.max(1, Math.ceil(Math.abs(car.speed * dt) / 3));
  car.collision = false;
  car.impact = 0;
  for (let i = 0; i < steps; i++) {
    const heading = car.heading + yaw * dt / steps;
    const x = car.x + Math.sin(heading) * car.speed * dt / steps;
    const z = car.z + Math.cos(heading) * car.speed * dt / steps;
    const hitsCar = cars.some((other) => other !== car && Math.hypot(x - other.x, z - other.z) < 85 && carsOverlap(car, other, x, z, heading));
    if (carHitsWorld(car, x, z, heading, obstacles) || hitsCar) {
      car.impact = Math.abs(car.speed);
      car.speed = 0;
      car.collision = true;
      break;
    }
    car.distance += Math.hypot(x - car.x, z - car.z);
    Object.assign(car, { x, z, heading });
  }
}

// Shared by the fragment shader's light selection and verification diagnostics.
export function beamAt(car, x, y, z) {
  const [fx, fz] = forward(car), nose = CAR_PROFILES[car.profile].length / 2;
  const dx = x - car.x - fx * nose, dz = z - car.z - fz * nose;
  const along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx);
  if (along <= 0 || along >= 340 || y > 52) return 0;
  const width = 13 + along * 0.25;
  return Math.max(0, 1 - across / width) * (1 - along / 340) * Math.max(0, 1 - Math.abs(y - 8) / 55);
}
