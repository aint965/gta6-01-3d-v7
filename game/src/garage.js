import { CAR_PROFILES, makeCar } from './vehicles.js';

export const GARAGES = [
  { x: 549, z: -625, name: 'Glasspoint Motor Works', bayX: 569 },
  { x: -951, z: 530, name: 'Old Solmar Coachworks', bayX: -931 },
];
export const PAINTS = [
  ['Limestone','#ead8b2'], ['Coral','#d77f69'], ['Teal','#398e99'], ['Ink','#142d38'], ['Leaf','#56856b'],
];
const prices = [220,620,360,440];
const money = amount => amount.toLocaleString('en-US',{ style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2 });
const rgb = hex => [...[1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255),1];

export function createGarage(saved, { balance, pay, park, currentCar, onClose }) {
  const dialog = document.querySelector('#garage');
  const stock = document.querySelector('#garage-stock');
  const paints = document.querySelector('#garage-paints');
  const status = document.querySelector('#garage-status');
  const repair = document.querySelector('#garage-repair');
  const owned = new Map();
  const colors = new Set(Array.isArray(saved?.paints) ? saved.paints.filter(i => PAINTS[i] && Number.isInteger(i)) : []);
  const fleet = Array.isArray(saved?.cars) ? saved.cars : [];
  for (const spec of fleet) {
    if (!spec || !Number.isInteger(spec.profile) || !CAR_PROFILES[spec.profile] || owned.has(spec.profile)) continue;
    const home = GARAGES[Number(spec.home) === 1 ? 1 : 0];
    const car = makeCar(`owned-${spec.profile}`,spec.profile,home.bayX,home.z);
    if (colors.has(spec.paint)) { car.paint = spec.paint; car.color = rgb(PAINTS[car.paint][1]); }
    car.health = Number.isFinite(spec.health) ? Math.max(0,Math.min(100,spec.health)) : 100;
    car.home = GARAGES.indexOf(home);
    owned.set(car.profile,car);
  }
  let location = null;
  const serialize = () => ({ paints: [...colors], cars: [...owned.values()].map(({ profile, paint, home, health }) => ({ profile, paint, home, health })) });
  const repairFee = car => Math.round((100 - car.health)*60)/100;

  function render(message = '') {
    const focusId = document.activeElement?.id;
    status.textContent = `${money(balance())} available${message ? ` · ${message}` : ''}`;
    stock.replaceChildren();
    paints.replaceChildren();
    const car = currentCar();
    for (const [index, profile] of CAR_PROFILES.entries()) {
      const button = document.createElement('button');
      button.id = `stock-${index}`;
      button.textContent = `${profile.name} · ${owned.has(index) ? 'Recall' : money(prices[index])}`;
      button.addEventListener('click', () => {
        let selection = owned.get(index);
        if (!selection && balance() < prices[index]) { render('Insufficient funds'); return; }
        selection ??= makeCar(`owned-${index}`,index,location.bayX,location.z);
        if (!park(selection,location)) { render('Delivery bay is occupied'); return; }
        const cost = owned.has(index) ? 0 : prices[index];
        selection.home = GARAGES.indexOf(location);
        owned.set(index,selection);
        pay(cost);
        render('Vehicle ready');
      });
      stock.append(button);
    }
    for (const [index,[name,hex]] of PAINTS.entries()) {
      const button = document.createElement('button');
      button.id = `paint-${index}`;
      const swatch = document.createElement('i');
      swatch.style.background = hex;
      button.append(swatch,`${name} · ${colors.has(index) ? 'Owned' : '$25'}`);
      button.addEventListener('click', () => {
        const cost = colors.has(index) ? 0 : 25;
        if (balance() < cost) { render('Insufficient funds'); return; }
        colors.add(index);
        if (car) { car.paint = index; car.color = rgb(hex); }
        pay(cost);
        render(car ? `${name} applied` : `${name} added to your paint collection`);
      });
      paints.append(button);
    }
    repair.disabled = !car || car.health >= 100;
    repair.textContent = car ? `Repair · ${Math.round(car.health)}% · ${money(repairFee(car))}` : 'Enter a car to repair it';
    if (focusId) document.getElementById(focusId)?.focus();
  }

  repair.addEventListener('click', () => {
    const car = currentCar();
    if (!car) return;
    const cost = repairFee(car);
    if (balance() < cost) { render('Insufficient funds'); return; }
    Object.assign(car,{ health:100,destroyed:false });
    pay(cost);
    render('Full service complete');
    stock.firstElementChild.focus();
  });
  dialog.querySelector('#garage-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', onClose);
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Enter' && event.target instanceof HTMLButtonElement) {
      event.preventDefault();
      if (!event.repeat) event.target.click();
      return;
    }
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
    const i = buttons.indexOf(document.activeElement);
    buttons[(i + (['ArrowDown','ArrowRight'].includes(event.key) ? 1 : -1) + buttons.length)%buttons.length].focus();
  });
  return {
    open: spot => { location = spot; dialog.querySelector('h2').textContent = spot.name; render(); dialog.showModal(); stock.firstElementChild.focus(); },
    get isOpen() { return dialog.open; },
    cars: [...owned.values()], serialize,
  };
}
