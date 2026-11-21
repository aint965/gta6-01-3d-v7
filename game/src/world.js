const PALETTE = {
  limestone: [0.79, 0.70, 0.55, 1], coral: [0.78, 0.35, 0.28, 1],
  teal: [0.14, 0.43, 0.47, 1], ink: [0.055, 0.12, 0.15, 1],
  leaf: [0.24, 0.43, 0.28, 1], brick: [0.48, 0.24, 0.19, 1],
  water: [0.035, 0.31, 0.40, 1], sand: [0.80, 0.68, 0.48, 1],
  wood: [0.34, 0.21, 0.13, 1], gold: [0.82, 0.62, 0.34, 1],
};

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createCity() {
  const vertices = [];
  const colliders = [];
  const shadeTrees = [];
  const props = [];
  const random = seeded(77031);
  const features = { brickWindows: 0, glassTowers: 0, parkTrees: 0, benches: 4, ponds: 1, streetLamps: 0, canalBridges: 3 };

  function triangle(a, b, c, normal, color, kind = 1) {
    for (const point of [a, b, c]) vertices.push(...point, ...normal, ...color, kind);
  }

  function quad(a, b, c, d, normal, color, kind = 1) {
    triangle(a, b, c, normal, color, kind);
    triangle(a, c, d, normal, color, kind);
  }

  function box(x, y, z, width, height, depth, color, kind = 1) {
    const X = x + width, Y = y + height, Z = z + depth;
    quad([x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z], [0, 0, 1], color, kind);
    quad([X, y, z], [x, y, z], [x, Y, z], [X, Y, z], [0, 0, -1], color, kind);
    quad([x, y, z], [x, y, Z], [x, Y, Z], [x, Y, z], [-1, 0, 0], color, kind);
    quad([X, y, Z], [X, y, z], [X, Y, z], [X, Y, Z], [1, 0, 0], color, kind);
    quad([x, Y, Z], [X, Y, Z], [X, Y, z], [x, Y, z], [0, 1, 0], color, kind);
    quad([x, y, z], [X, y, z], [X, y, Z], [x, y, Z], [0, -1, 0], color, kind);
  }

  function sphere(cx, cy, cz, radius, color, kind = 1, segments = 14, rings = 9) {
    for (let row = 0; row < rings; row++) {
      const phi0 = Math.PI * row / rings, phi1 = Math.PI * (row + 1) / rings;
      for (let col = 0; col < segments; col++) {
        const theta0 = col * Math.PI * 2 / segments, theta1 = (col + 1) * Math.PI * 2 / segments;
        const point = (phi, theta) => [
          cx + radius * Math.sin(phi) * Math.cos(theta),
          cy + radius * Math.cos(phi),
          cz + radius * Math.sin(phi) * Math.sin(theta),
        ];
        const normal = (p) => [(p[0] - cx) / radius, (p[1] - cy) / radius, (p[2] - cz) / radius];
        const a = point(phi0, theta0), b = point(phi1, theta0);
        const d = point(phi0, theta1), e = point(phi1, theta1);
        // This order faces outward, so back-face culling keeps the near side of every crown.
        triangle(a, d, b, normal(a), color, kind);
        triangle(d, e, b, normal(e), color, kind);
      }
    }
  }

  function cylinder(x, y, z, radius, height, color) {
    const segments = 12;
    for (let i = 0; i < segments; i++) {
      const a = i * Math.PI * 2 / segments, b = (i + 1) * Math.PI * 2 / segments;
      const point = (angle, yy) => [x + Math.cos(angle) * radius, yy, z + Math.sin(angle) * radius];
      const lowA = point(a, y), lowB = point(b, y), highA = point(a, y + height), highB = point(b, y + height);
      const mid = (a + b) / 2;
      quad(lowA, highA, highB, lowB, [Math.cos(mid), 0, Math.sin(mid)], color);
      triangle([x, y + height, z], highB, highA, [0, 1, 0], color);
    }
  }

  function windowUnit(x, y, front, width, height, stone) {
    features.brickWindows++;
    const frame = [0.22, 0.26, 0.26, 1];
    const inset = 4;
    box(x - inset, y - inset, front, width + inset * 2, height + inset * 2, 3, frame);
    box(x, y, front + 3.2, width, height, 0.8, [0.085, 0.19, 0.23, 1], 2);
    box(x + width * 0.48, y, front + 4.1, Math.max(2, width * 0.06), height, 1.4, stone);
    box(x, y + height * 0.48, front + 4.1, width, 2, 1.4, stone);
    box(x - 5, y - 7, front + 3, width + 10, 4, 8, stone);
  }

  function addBrickFront(x, z, width, depth, height, stone) {
    const floors = Math.max(2, Math.floor(height / 33));
    const columns = Math.max(2, Math.floor(width / 32));
    const front = z + depth + 0.8;
    for (let floor = 0; floor < floors; floor++) {
      const y = 10 + floor * ((height - 16) / floors);
      for (let column = 0; column < columns; column++) {
        const cell = width / columns;
        const paneWidth = Math.min(22, cell - 8);
        const paneHeight = Math.min(23, (height - 20) / floors - 7);
        windowUnit(x + column * cell + (cell - paneWidth) / 2, y, front, paneWidth, paneHeight, stone);
      }
    }
  }

  function assignDistrict(x, z) {
    if (x < -1370) return 'Sunstrand Beach';
    if (Math.abs(x + 620) < 100) return 'Canal Ward';
    if (x > 1110) return 'Pearl Marina';
    if (x > 180 && x < 1080 && z > -780 && z < 520) return 'Glasspoint';
    if (x < -700 && z < 0) return 'Citrus Quarter';
    if (x < -700) return 'Old Solmar';
    if (z > 220) return 'South Market';
    return 'Old Solmar';
  }

  function building(x, z, width, depth, height, district, glass) {
    if (glass) features.glassTowers++;
    const oldTown = district === 'Old Solmar';
    const market = district === 'South Market';
    const citrus = district === 'Citrus Quarter';
    const wall = glass
      ? [0.16, 0.28, 0.33, 1]
      : oldTown ? (random() > 0.5 ? PALETTE.coral : [0.65, 0.40, 0.29, 1])
        : market ? (random() > 0.48 ? PALETTE.limestone : PALETTE.coral)
          : citrus ? [0.69, 0.65, 0.48, 1]
            : (random() > 0.52 ? PALETTE.limestone : PALETTE.brick);
    const trim = oldTown ? [0.86, 0.70, 0.49, 1] : PALETTE.limestone;
    box(x, 0, z, width, height, depth, wall);
    box(x - 7, height, z - 7, width + 14, 9, depth + 14, glass ? PALETTE.ink : trim);

    const floors = Math.max(2, Math.floor(height / 34));
    if (glass) {
      // A continuous reflective curtain wall lets the shader draw lit rooms and silhouettes in every bay.
      box(x + 5, 5, z + depth + 1, width - 10, height - 12, 1, [0.12, 0.25, 0.30, 1], 3);
      box(x-2,5,z+5,1,height-12,depth-10,[0.12,0.25,0.30,1],3);
      box(x+width+1,5,z+5,1,height-12,depth-10,[0.12,0.25,0.30,1],3);
      box(x+5,5,z-2,width-10,height-12,1,[0.12,0.25,0.30,1],3);
      for (let row = 1; row < floors; row++) box(x, row * height / floors, z + depth + 3, width, 3, 3, [0.43, 0.58, 0.57, 1]);
      const mullions = Math.max(2, Math.floor(width / 43));
      for (let col = 1; col < mullions; col++) box(x + col * width / mullions - 2, 0, z + depth + 3, 4, height, 3, [0.38, 0.54, 0.55, 1]);
      box(x + width * 0.40, 0, z + depth + 4, width * 0.20, 28, 2, [0.06, 0.12, 0.15, 1], 2);
    } else {
      addBrickFront(x, z, width, depth, height, trim);
      if (oldTown) {
        // Small parapets, cornices, and warm roof caps distinguish the older blocks.
        for (let bay = 0; bay < width - 20; bay += 30) box(x + bay, height + 8, z + depth * 0.28, 18, 14, 22, trim);
        box(x + width * 0.12, 0, z + depth + 3, width * 0.22, 29, 3, [0.08, 0.15, 0.17, 1], 2);
      }
      if (market) {
        for (let awning = 0; awning < 3; awning++) {
          const awningColor = awning % 2 ? PALETTE.teal : PALETTE.coral;
          box(x + 8 + awning * (width - 25) / 3, 32, z + depth + 8, Math.max(14, (width - 30) / 4), 3, 19, awningColor);
        }
      }
      if (citrus) {
        box(x + 12, height * 0.48, z + depth + 4, width - 24, 3, 12, [0.43, 0.58, 0.38, 1]);
      }
    }
    if (!glass && district !== 'Old Solmar') {
      for (let row = 0; row < height / 19; row++) {
        const offset = row % 2 ? 14 : 0;
        for (let bay = offset; bay < width; bay += 28) box(x + bay, row * 19, z + depth + 1, 12, 1.5, 2, [0.42, 0.25, 0.19, 1]);
      }
    }
    colliders.push({ minX: x - 8, maxX: x + width + 8, minZ: z - 8, maxZ: z + depth + 8, top: height + 16 });
  }

  function tree(x, z, scale = 1, palm = false) {
    props.push({ minX: x - 7 * scale, maxX: x + 7 * scale, minZ: z - 7 * scale, maxZ: z + 7 * scale, top: 80 * scale });
    if (!palm) features.parkTrees++;
    cylinder(x, 4, z, palm ? 5 * scale : 7 * scale, (palm ? 82 : 47) * scale, PALETTE.wood);
    if (palm) {
      sphere(x, 84 * scale, z, 3 * scale, PALETTE.leaf, 1, 10, 6);
      for (let leaf = 0; leaf < 7; leaf++) {
        const angle = leaf * Math.PI * 2 / 7;
        box(x + Math.cos(angle) * 16 * scale, 78 * scale, z + Math.sin(angle) * 16 * scale, 38 * scale, 4, 10 * scale, [0.24, 0.43, 0.26, 1]);
      }
    } else {
      sphere(x, 61 * scale, z, 31 * scale, PALETTE.leaf, 1, 16, 10);
      sphere(x - 16 * scale, 56 * scale, z + 3 * scale, 21 * scale, [0.28, 0.48, 0.30, 1], 1, 14, 9);
      sphere(x + 15 * scale, 55 * scale, z - 4 * scale, 22 * scale, [0.31, 0.50, 0.31, 1], 1, 14, 9);
    }
    shadeTrees.push({ x, z, radius: palm ? 24 * scale : 38 * scale, height: palm ? 84 * scale : 80 * scale });
  }

  // A broad continuous base is overlaid by named districts, paving, roads, and shore water.
  box(-1920, -22, -1728, 3840, 20, 3456, [0.43, 0.48, 0.39, 1]);
  box(1210, -9, -1728, 710, 10, 3456, PALETTE.water, 4);
  box(-2020, -9, -1728, 720, 10, 3456, [0.035, 0.30, 0.38, 1], 4);
  box(-1920, -4, -1728, 610, 6, 3456, PALETTE.sand);
  box(-1320, -2, -1728, 21, 4, 3456, [0.89, 0.79, 0.61, 1]);

  // Seven city identities have their own neighborhoods and street furniture.
  for (let x = -1800; x <= 1800; x += 300) {
    box(x - 46, -1, -1728, 92, 6, 3456, [0.14, 0.19, 0.20, 1]);
    box(x - 76, 0, -1728, 30, 7, 3456, PALETTE.limestone);
    box(x + 46, 0, -1728, 30, 7, 3456, PALETTE.limestone);
  }
  for (let z = -1650; z <= 1650; z += 300) {
    box(-1920, -1, z - 44, 3840, 6, 88, [0.14, 0.19, 0.20, 1]);
    box(-1920, 0, z - 54, 3840, 7, 10, PALETTE.limestone);
    box(-1920, 0, z + 44, 3840, 7, 10, PALETTE.limestone);
    for (let stripe = 0; stripe < 6; stripe++) box(-68 + stripe * 24, 5, z - 28, 13, 1, 15, [0.88, 0.81, 0.64, 1]);
  }

  // Canal Ward is a real blue-water cut with stone retaining walls and three low bridges.
  box(-628, -7, -1200, 140, 9, 2400, [0.04, 0.35, 0.43, 1], 4);
  box(-642, -2, -1200, 12, 9, 2400, PALETTE.limestone);
  box(-486, -2, -1200, 12, 9, 2400, PALETTE.limestone);
   for (const z of [-750, 150, 1050]) {
    box(-690, 5, z - 35, 260, 7, 70, [0.68, 0.58, 0.43, 1]);
    box(-690, 12, z - 35, 260, 2, 6, PALETTE.limestone);
    box(-690, 12, z + 29, 260, 2, 6, PALETTE.limestone);
  }

  // Solmar's civic park: intersecting pale walks, lawn clearings, shaded seating, and an open pond.
  box(-365, 1, -280, 760, 3, 560, [0.24, 0.43, 0.29, 1]);
  box(-52, 4, -275, 76, 2, 550, [0.75, 0.69, 0.56, 1]);
  box(-350, 4, -34, 730, 2, 64, [0.75, 0.69, 0.56, 1]);
  box(-130, 4, -250, 260, 2, 138, [0.62, 0.57, 0.45, 1]);
  box(-122, 5, -242, 244, 3, 122, [0.035, 0.32, 0.42, 1], 4);
  box(-112, 6, -236, 224, 1, 3, [0.32, 0.66, 0.66, 1], 4);
  for (const [x, z] of [[-310, -228], [-270, -145], [-330, 155], [-250, 213], [278, -220], [330, -112], [280, 126], [335, 216], [-12, -227], [198, 214]]) tree(x, z, 0.78 + random() * 0.38);
  for (const [x, z] of [[-205, -40], [170, -40], [-18, -190], [116, 150]]) {
    props.push({ minX: x, maxX: x + 44, minZ: z - 3, maxZ: z + 11, top: 26 });
    box(x, 5, z, 44, 7, 8, [0.39, 0.22, 0.14, 1]);
    box(x + 3, 12, z, 4, 14, 6, PALETTE.ink);
    box(x + 5, 4, z - 3, 4, 2, 14, PALETTE.wood);
  }

  // Orange-grove planters and market stalls create neighborhood-scale landmarks.
  for (let x = -1080; x < -760; x += 115) for (let z = -1060; z < -260; z += 135) {
    if (Math.abs(((x + 150) % 300 + 300) % 300 - 150) < 60 || Math.abs(((z + 150) % 300 + 300) % 300 - 150) > 90) continue;
    props.push({ minX: x, maxX: x + 44, minZ: z, maxZ: z + 44, top: 20 });
    box(x, 5, z, 44, 10, 44, [0.47, 0.31, 0.18, 1]);
    for (let fruit = 0; fruit < 3; fruit++) sphere(x + 12 + fruit * 10, 22, z + 18, 5, [0.88, 0.46, 0.17, 1], 1, 8, 5);
  }
  for (let x = -255; x < 410; x += 128) {
    if (Math.abs(x % 300) < 60 || Math.abs((x + 72) % 300) < 60) continue;
    props.push({ minX: x - 4, maxX: x + 76, minZ: 372, maxZ: 432, top: 59 });
    box(x, 6, 380, 72, 50, 46, [0.57, 0.31, 0.22, 1]);
    box(x - 4, 55, 372, 80, 4, 60, x % 2 ? PALETTE.teal : PALETTE.coral);
  }

  // Pearl Marina piers, boardwalk bollards, and small original harbor craft.
  box(1120, 1, -1080, 128, 10, 2160, [0.51, 0.39, 0.27, 1]);
  for (let z = -960; z < 960; z += 180) {
    box(1170, 4, z, 330, 8, 30, [0.44, 0.34, 0.24, 1]);
    for (const side of [1165, 1485]) cylinder(side, 2, z + 8, 7, 34, PALETTE.wood);
  }
  for (const z of [-650, 125, 670]) {
    box(1390, 7, z, 96, 21, 42, z === 125 ? PALETTE.coral : [0.84, 0.79, 0.65, 1]);
    box(1412, 28, z + 7, 38, 22, 28, [0.88, 0.83, 0.69, 1]);
    box(1400, 30, z + 3, 58, 2, 34, PALETTE.ink);
  }

  // Reproducible blocks; architecture and skyline heights follow the district map.
  for (let gx = -5; gx <= 5; gx++) for (let gz = -5; gz <= 5; gz++) {
    const x = gx * 300, z = gz * 300;
    if (Math.abs(x) < 450 && Math.abs(z) < 340) continue;
    if (Math.abs(x + 620) < 115 || x < -1870 || x > 1110 || Math.abs(z) > 1450) continue;
    const district = assignDistrict(x, z);
    const glass = district === 'Glasspoint' && random() > 0.18;
    const count = district === 'Old Solmar' || district === 'South Market' ? 2 : 1 + Math.floor(random() * 2);
    for (let item = 0; item < count; item++) {
      const width = 70 + random() * 82, depth = 70 + random() * 76;
      // Place architecture inside blocks, leaving every 92-unit carriageway clear.
      const bx = x + 77 + random() * Math.max(1, 143 - width), bz = z - 84 + random() * Math.max(1, 176 - depth);
      let height = glass ? 175 + random() * 300 : 55 + random() * 125;
      if (district === 'Old Solmar') height = 52 + random() * 67;
      if (district === 'South Market') height = 48 + random() * 88;
      if (district === 'Sunstrand Beach') height = 34 + random() * 52;
      if (district === 'Pearl Marina') height = 38 + random() * 74;
      building(bx, bz, width, depth, height, district, glass);
    }
  }

  // Warm street lamps are full fixtures; their emissive heads switch on in the night shader.
  for (let x = -1650; x < 1110; x += 300) for (let z = -1500; z < 1500; z += 300) {
    features.streetLamps++;
    cylinder(x + 67, 5, z + 56, 4, 78, [0.11, 0.15, 0.15, 1]);
    props.push({ minX: x + 63, maxX: x + 71, minZ: z + 52, maxZ: z + 60, top: 83 });
    box(x + 52, 81, z + 51, 25, 5, 8, [0.92, 0.72, 0.39, 1], 6);
    box(x + 68, 78, z + 50, 13, 4, 10, [0.94, 0.76, 0.43, 1], 6);
  }

  // Palm-lined promenades frame the open water on both coasts.
  for (let z = -1250; z < 1250; z += 190) {
    tree(1172, z, 0.75 + random() * 0.14, true);
    tree(-1260, z + 48, 0.70 + random() * 0.18, true);
  }

  // Broken centre lines, stop bars and zebra crossings make the road grid legible.
  for(const x of [-1200,-900,-300,0,300,600,900]) for(const z of [-1120,-820,-520,580,880,1180]) {
    box(x+45,5,z-41,25,0.15,82,[0.24,0.29,0.28,1]);
    box(x+45,5.3,z-40,24,0.1,1,[0.76,0.75,0.61,1]);
    box(x+45,5.3,z+40,24,0.1,1,[0.76,0.75,0.61,1]);
  }
  for (let x = -1800; x <= 900; x += 300) for (let z = -1610; z < 1650; z += 52) {
    if (Math.abs(x) <= 300 && Math.abs(z) < 290) continue;
    if (x === -600 && z > -1200 && z < 1200) continue;
    const near = Math.abs(((z + 1650) % 300 + 300) % 300);
    if (near < 55 || near > 245) continue;
    box(x-1,5.12,z,2,0.12,23,[0.88,0.78,0.51,1]);
  }
  for (let z = -1650; z <= 1650; z += 300) for (let x = -1810; x < 1170; x += 52) {
    if (Math.abs(x) < 395 && Math.abs(z) < 280) continue;
    if (x > -640 && x < -470 && ![-750,150,1050].includes(z)) continue;
    if (Math.abs(((x+150)%300+300)%300-150)<55) continue;
    box(x,5.15,z-1,23,0.12,2,[0.88,0.78,0.51,1]);
  }
  for (const x of [-1500,-1200,-900,-300,0,300,600,900]) for(let z=-1350;z<=1350;z+=300){
    if(Math.abs(x)<=300&&Math.abs(z)<300)continue;
    for(const side of [-1,1]){
      box(x-39,5.2,z+side*48-1,78,0.15,2,[0.84,0.84,0.72,1]);
      box(x+side*49-1,5.2,z-39,2,0.15,78,[0.84,0.84,0.72,1]);
      for(let stripe=-33;stripe<=33;stripe+=12){
        box(x+stripe,5.3,z+side*61-4,6,0.15,8,PALETTE.limestone);
        box(x+side*61-4,5.3,z+stripe,8,0.15,6,PALETTE.limestone);
      }
    }
  }
  // Canal edges and the pond are solid boundaries for land vehicles.
  props.push({minX:-132,maxX:132,minZ:-252,maxZ:-106,top:9});
  for(const [low,high] of [[-1200,-790],[-710,110],[190,1010],[1090,1200]]) props.push({minX:-642,maxX:-474,minZ:low,maxZ:high,top:12});

  return {
    vertices,
    colliders,
    shadeTrees,
    props,
    features,
    districts: [
      { name: 'Old Solmar', x: -1000, z: 520 },
      { name: 'Canal Ward', x: -620, z: 10 },
      { name: 'South Market', x: 70, z: 610 },
      { name: 'Citrus Quarter', x: -980, z: -720 },
      { name: 'Pearl Marina', x: 1450, z: 170 },
      { name: 'Glasspoint', x: 640, z: -300 },
      { name: 'Sunstrand Beach', x: -1600, z: 360 },
    ],
  };
}
