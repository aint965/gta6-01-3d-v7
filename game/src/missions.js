export const MISSIONS = [
  {
    title: 'A Receipt for Sunshine',
    district: 'Canal Ward',
    start: { x: 0, z: 0 },
    objective: { x: -690, z: 105, label: 'Canal Ward Print Shop' },
    steps: [
      { text: 'Deliver the extortion receipt to Neri at the Canal Ward print shop', action: 'deliver' },
    ],
    boundary: { minX: -960, maxX: 300, minZ: -500, maxZ: 650 },
    reward: 750,
    evidence: 'Signed extortion receipt · Bastion Civic',
    reveal: 'The receipt bears the name Silas Rook, Bastion Civic’s broker.',
  },
  {
    title: 'Salt Ledger',
    district: 'Pearl Marina',
    start: { x: 1050, z: 170 },
    objective: { x: 1140, z: 170, label: 'Pearl Marina Freight Office' },
    steps: [
      { text: 'Reach the freight office and recover the original dock-fee ledger · Q', action: 'collect' },
      { text: 'Carry the dock-fee ledger out to the south gate · Q', action: 'deliver', target: { x: 970, z: 170, label: 'South Gate Handoff' } },
    ],
    boundary: { minX: 720, maxX: 1185, minZ: -120, maxZ: 620 },
    timerSeconds: 600,
    operationVehicle: { x: 1030, z: 220 },
    reward: 1400,
    evidence: 'Original Pearl Marina dock-fee ledger',
    reveal: 'Handwritten fee entries connect Bastion Civic patrols to the waterfront cooperative.',
  },
  {
    title: 'After the Shutters',
    district: 'South Market',
    start: { x: 70, z: 610 },
    objective: { x: -980, z: -720, label: 'Citrus Quarter Safe Courtyard' },
    steps: [
      { text: 'Escort Oren and his witness statement to the Citrus Quarter courtyard', action: 'escort' },
    ],
    boundary: { minX: -1290, maxX: 420, minZ: -1030, maxZ: 930 },
    reward: 1250,
    evidence: 'Oren’s witness statement · independently mirrored archive',
    reveal: 'Neri and Oren mirror the statement across independent public archive nodes.',
  },
  {
    title: 'Glass Debt',
    district: 'Glasspoint',
    start: { x: 480, z: -330 },
    objective: { x: 620, z: -330, label: 'Glasspoint Contract Office' },
    steps: [
      { text: 'Reach the contract office and collect the payment chain · Q', action: 'collect' },
      { text: 'Carry the payment chain to the lobby exit · Q', action: 'deliver', target: { x: 480, z: -520, label: 'Glasspoint Lobby Exit' } },
    ],
    boundary: { minX: 180, maxX: 930, minZ: -900, maxZ: 130 },
    timerSeconds: 600,
    operationVehicle: { x: 480, z: -390 },
    reward: 2500,
    evidence: 'Rook–Bastion Civic payment chain',
    reveal: 'The payment chain traces Silas Rook’s broker account directly to Bastion Civic.',
  },
  {
    title: 'The Long Way Home',
    district: 'Canal Ward',
    start: { x: -1600, z: 360 },
    objective: { x: -690, z: 105, label: 'Canal Ward Archive Room' },
    steps: [
      { text: 'Protect the authenticated archive along the coastal route to Canal Ward · Q', action: 'deliver' },
    ],
    boundary: { minX: -1780, maxX: -500, minZ: -180, maxZ: 720 },
    timerSeconds: 600,
    reward: 1800,
    evidence: 'Authenticated archive · independent coastal mirrors',
    reveal: 'The archive reaches Neri intact by an alternate coastal route.',
  },
  {
    title: 'Unbought Ground',
    district: 'Pearl Marina',
    start: { x: -1000, z: 520 },
    objective: { x: -1000, z: 520, label: 'Old Solmar Civic Relay' },
    steps: [
      { text: 'Restore the Old Solmar civic relay · Q', action: 'relay', target: { x: -1000, z: 520, label: 'Old Solmar Civic Relay' } },
      { text: 'Restore the South Market neighborhood relay · Q', action: 'relay', target: { x: 70, z: 610, label: 'South Market Neighborhood Relay' } },
      { text: 'Restore the Pearl Marina waterfront relay · Q', action: 'relay', target: { x: 1140, z: 170, label: 'Pearl Marina Waterfront Relay' } },
    ],
    boundary: { minX: -1190, maxX: 1190, minZ: -100, maxZ: 820 },
    reward: 2200,
    evidence: 'Three restored neighborhood relay attestations',
    reveal: 'Three districts independently mirror the archive before seizure teams can cut their links.',
  },
  {
    title: 'Open Contract',
    district: 'Sunstrand Beach',
    start: { x: 640, z: -300 },
    objective: { x: 640, z: -300, label: 'Glasspoint Annex' },
    steps: [
      { text: "Collect Rook's master agreement from the Glasspoint annex · Q", action: 'collect', target: { x: 640, z: -300, label: 'Glasspoint Contract Annex' } },
      { text: 'Carry the master agreement to the Sunstrand broadcast pavilion', action: 'deliver', target: { x: -1600, z: 360, label: 'Sunstrand Broadcast Pavilion' } },
    ],
    boundary: { minX: -1780, maxX: 900, minZ: -570, maxZ: 610 },
    timerSeconds: 600,
    reward: 2800,
    evidence: "Silas Rook's master agreement",
    reveal: 'The master agreement names the shell contractors and authorizes the seizure orders.',
  },
  {
    title: 'Everyone Gets the Morning',
    district: 'Old Solmar',
    start: { x: 1450, z: 170 },
    objective: { x: 1450, z: 170, label: 'Pearl Marina Relay' },
    steps: [
      { text: 'Supply the independent Marina relay · Q', action: 'relay', target: { x: 1140, z: 170, label: 'Pearl Marina Independent Relay' } },
      { text: 'Supply the South Market relay · Q', action: 'relay', target: { x: 70, z: 610, label: 'South Market Independent Relay' } },
      { text: 'Supply the Old Solmar civic rooftop relay · Q', action: 'relay', target: { x: -1000, z: 520, label: 'Old Solmar Civic Rooftop' } },
      { text: 'Protect the final upload at the civic rooftop · Q', action: 'publish', target: { x: -1000, z: 520, label: 'Civic Rooftop Final Upload' } },
    ],
    boundary: { minX: -1190, maxX: 1580, minZ: -80, maxZ: 830 },
    reward: 5000,
    evidence: 'Publicly authenticated eight-part Bastion Civic archive',
    reveal: 'The upload is mirrored by three independent relays. The contracts are dismantled in public.',
  },
];

export function objectiveFor(mission, step) {
  const stage = mission.steps[step];
  return stage.target ?? mission.objective;
}

export function insideBoundary(point, boundary) {
  return point.x >= boundary.minX && point.x <= boundary.maxX
    && point.z >= boundary.minZ && point.z <= boundary.maxZ;
}

export function formatMissionTime(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
