import { CAR_PROFILES } from './vehicles.js';

export function createHud(city) {
  const map = document.querySelector('#minimap'), ctx = map.getContext('2d');
  const speed = document.querySelector('#speed'), vehicle = document.querySelector('#vehicle-name');
  const prompt = document.querySelector('#interaction');
  return function updateHud(actor, car, cars, nearby, heading, navigation = {}) {
    speed.textContent = car ? String(Math.round(Math.abs(car.speed) * 0.36)).padStart(3, '0') : 'ON FOOT';
    document.querySelector('#speed-unit').textContent = car ? 'KM/H' : 'MARA VENN';
    vehicle.textContent = car ? `${CAR_PROFILES[car.profile].name} · ${Math.round(car.health)}%` : 'Coastal courier';
    prompt.textContent = car ? Math.abs(car.speed) > 12 ? 'Slow down to leave the vehicle' : 'E · Exit vehicle' : nearby ? `E · Enter ${CAR_PROFILES[nearby.profile].name.split(' · ')[0]}` : 'Find a parked car · E to enter';
    const size=224, scale=size/1100;
    const mapPoint=(x,z)=>[112+(x-actor.x)*scale,112+(z-actor.z)*scale];
    ctx.clearRect(0,0,size,size);
    ctx.fillStyle='#203e43';ctx.fillRect(0,0,size,size);
    ctx.save();ctx.beginPath();ctx.rect(0,0,size,size);ctx.clip();
    const rect=(x,z,w,d,color)=>{const p=mapPoint(x,z);ctx.fillStyle=color;ctx.fillRect(p[0],p[1],w*scale,d*scale);};
    rect(1210,-2000,1000,4000,'#28616d');rect(-2200,-2000,900,4000,'#28616d');
    ctx.strokeStyle='#9caa9f';ctx.lineWidth=13;
    for(let x=-1800;x<=1200;x+=300){const p=mapPoint(x,-1800),q=mapPoint(x,1800);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();}
    for(let z=-1650;z<=1650;z+=300){const p=mapPoint(-2000,z),q=mapPoint(1400,z);ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();}
    // Match the actual canal crossings and park instead of drawing roads over water and lawn.
    rect(-628,-1200,140,2400,'#28616d');
    for(const z of [-750,150,1050])rect(-690,z-35,260,70,'#9caa9f');
    rect(-365,-280,760,560,'#56856b');
    rect(-52,-275,76,550,'#cfbc96');rect(-350,-34,730,64,'#cfbc96');
    rect(-122,-242,244,122,'#28616d');
    ctx.fillStyle='#cfbc96';
    for(const b of city.colliders){const p=mapPoint(b.minX,b.minZ);ctx.fillRect(p[0],p[1],(b.maxX-b.minX)*scale,(b.maxZ-b.minZ)*scale);}
    if (navigation.boundary) {
      const b = navigation.boundary, p = mapPoint(b.minX, b.minZ), q = mapPoint(b.maxX, b.maxZ);
      ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle='#f07f70';ctx.lineWidth=2;ctx.strokeRect(p[0],p[1],q[0]-p[0],q[1]-p[1]);ctx.restore();
    }
    let nearbyCount=0;
    for(const other of cars){if(other===car||Math.hypot(other.x-actor.x,other.z-actor.z)>730)continue;nearbyCount++;const p=mapPoint(other.x,other.z);ctx.save();ctx.translate(...p);ctx.rotate(-other.heading);ctx.fillStyle=other.police?'#8bb5fb':other.traffic?'#ead8b2':'#d77f69';ctx.fillRect(-2,-4,4,8);ctx.restore();}
    for (const spot of navigation.garages ?? []) {
      const [x,z] = mapPoint(spot.x,spot.z);
      ctx.fillStyle='#398e99';ctx.fillRect(x-7,z-7,14,14);
      ctx.fillStyle='#fff4d5';ctx.font='bold 10px Arial';ctx.fillText('G',x-4,z+4);
    }
    for (const unit of [...(navigation.officers ?? []),navigation.helicopter].filter(unit => unit && unit.health !== 0)) {
      const [x,z] = mapPoint(unit.x,unit.z);
      ctx.beginPath();ctx.arc(x,z,unit.beam?5:3,0,Math.PI*2);ctx.fillStyle='#8bb5fb';ctx.fill();
    }
    for (const target of navigation.targets ?? []) {
      const p = mapPoint(target.x, target.z);
      ctx.beginPath();ctx.arc(p[0],p[1],5,0,Math.PI*2);ctx.fillStyle='#f6ca66';ctx.fill();ctx.strokeStyle='#fff2c5';ctx.lineWidth=1;ctx.stroke();
    }
    if (navigation.target) {
      const p = mapPoint(navigation.target.x, navigation.target.z);
      ctx.beginPath();ctx.arc(p[0],p[1],8,0,Math.PI*2);ctx.fillStyle='#e8b64c';ctx.fill();ctx.strokeStyle='#fff2c5';ctx.lineWidth=2;ctx.stroke();
      ctx.beginPath();ctx.arc(p[0],p[1],13,0,Math.PI*2);ctx.strokeStyle='#e8b64c99';ctx.lineWidth=2;ctx.stroke();
    }
    if (navigation.oren) {
      const p=mapPoint(navigation.oren.x,navigation.oren.z);ctx.beginPath();ctx.moveTo(p[0],p[1]-6);ctx.lineTo(p[0]+6,p[1]);ctx.lineTo(p[0],p[1]+6);ctx.lineTo(p[0]-6,p[1]);ctx.closePath();ctx.fillStyle='#6ad0c8';ctx.fill();ctx.strokeStyle='#142d38';ctx.lineWidth=1;ctx.stroke();
    }
    ctx.translate(112,112);ctx.rotate(-heading);ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(-6,-6);ctx.lineTo(0,-3);ctx.lineTo(6,-6);ctx.closePath();ctx.fillStyle='#fff4d5';ctx.fill();ctx.strokeStyle='#142d38';ctx.lineWidth=2;ctx.stroke();ctx.restore();
    ctx.fillStyle='#f4e5c9';ctx.font='bold 11px Arial';ctx.fillText('N',11,18);
    return { nearbyCars: nearbyCount, heading, width: map.width, height: map.height, objective: navigation.target ?? null, objectives: navigation.targets ?? [], operationBoundary: navigation.boundary ?? null, escort: navigation.oren ?? null };
  };
}
