import { clearSight, distance, pursueOnFoot } from './police.js';
import { CAR_PROFILES } from './vehicles.js';

const strikes = [['Jab',24,0.27], ['Cross',34,0.32], ['Hook',45,0.42]];

export function createCombat({ actor, buildings, blocked, targets, onCrime, onDamage }) {
  const state = { action: '', cooldown: 0, combo: 0, dodge: 0, guard: null, lastHit: null };

  function reset(guard = null) {
    Object.assign(state, { action: '', cooldown: 0, combo: 0, dodge: 0, guard, lastHit: null });
  }

  function hit(target, amount, action) {
    target.health = Math.max(0, target.health - amount);
    target.stagger = 0.44;
    state.lastHit = { action, target: target.kind, health: target.health };
    onCrime(action === 'Vehicle strike' ? 'Pedestrian struck' : 'Assault reported', target);
  }

  function attack(takedown) {
    if (state.cooldown || state.dodge) return;
    const [label, damage, cooldown] = takedown ? ['Takedown',100,0.75] : strikes[state.combo++ % strikes.length];
    state.action = label;
    state.cooldown = cooldown;
    const candidates = targets().filter(unit => unit.health > 0 && (!takedown || unit.kind !== 'civilian')
      && distance(unit,actor) <= (takedown ? 42 : 49) && clearSight(unit,actor,buildings));
    const target = candidates.sort((a,b) => distance(a,actor) - distance(b,actor))[0];
    if (!target) return;
    actor.facing = Math.atan2(target.x-actor.x,target.z-actor.z);
    hit(target,damage,label);
  }

  function dodge(direction) {
    if (state.dodge || state.cooldown > 0.12) return;
    actor.facing = direction;
    state.action = 'Dodge';
    state.dodge = 0.23;
    state.cooldown = 0.48;
  }

  function update(dt, car) {
    state.cooldown = Math.max(0,state.cooldown-dt);
    if (state.dodge > 0) {
      const step = Math.min(dt,state.dodge)*275;
      const x = actor.x + Math.sin(actor.facing)*step, z = actor.z + Math.cos(actor.facing)*step;
      if (!blocked(x,actor.z)) actor.x = x;
      if (!blocked(actor.x,z)) actor.z = z;
      state.dodge = Math.max(0,state.dodge-dt);
    }
    for (const unit of targets()) unit.stagger = Math.max(0,(unit.stagger ?? 0)-dt);
    if (car && Math.abs(car.speed) > 38) {
      const profile = CAR_PROFILES[car.profile];
      const sin = Math.sin(car.heading), cos = Math.cos(car.heading);
      const victim = targets().find(unit => {
        if (!unit.health || unit.stagger || distance(unit,car) > 45) return false;
        const x = unit.x-car.x, z = unit.z-car.z;
        return Math.abs(x*cos-z*sin) < profile.width/2+7 && Math.abs(x*sin+z*cos) < profile.length/2+7;
      });
      if (victim) { hit(victim,100,'Vehicle strike'); car.speed *= 0.75; }
    }
    const guard = state.guard;
    if (!guard?.health || guard.stagger) return;
    const gap = distance(guard,actor);
    guard.cooldown = Math.max(0,(guard.cooldown ?? 0)-dt);
    if (gap > 135 || !clearSight(guard,actor,buildings)) { guard.aim = 0; return; }
    guard.facing = Math.atan2(actor.x-guard.x,actor.z-guard.z);
    if (gap > 48) pursueOnFoot(guard,actor,50,dt,blocked);
    if (guard.cooldown) return;
    guard.aim = (guard.aim ?? 0)+dt;
    if (guard.aim > 0.72) {
      guard.aim = 0;
      guard.cooldown = 1.35;
      if (!state.dodge) onDamage(car ? 9 : 22);
    }
  }

  return { state, reset, attack, dodge, update };
}
