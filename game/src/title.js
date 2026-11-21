// A tiny original vector alphabet, drawn specifically for the Solmar title.
const alphabet = {
  P: 'M0 84V0H30L42 12V37L30 49H0M0 12H26L30 16V33L26 37H0',
  A: 'M0 84V22L20 0H28L48 22V84M0 51H48M12 39H36V27L24 14L12 27Z',
  L: 'M0 0V84H42M12 0V72H42',
  K: 'M0 0V84M12 0V84M45 0L12 42L45 84M31 0L0 42L31 84',
  O: 'M12 0H32L44 12V72L32 84H12L0 72V12ZM14 12L12 14V70L14 72H30L32 70V14L30 12Z',
  N: 'M0 84V0H12L36 58V0H48V84H36L12 26V84Z',
  U: 'M0 0V72L12 84H32L44 72V0M12 0V66L18 72H26L32 66V0',
  T: 'M0 0H48V12H30V84H18V12H0Z',
};

function letterLine(word) {
  return [...word].map((letter, index) => `<g transform="translate(${index * 62} 0)"><path d="${alphabet[letter]}"/></g>`).join('');
}

export function createTitleScreen({ hasSave, onContinue, onNewGame }) {
  const screen = document.querySelector('#title-screen');
  const controls = document.querySelector('#controls');
  document.querySelector('#title-lettering').innerHTML = `<svg viewBox="-7 -7 385 218" role="img" aria-label="PALKON AUTO"><g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="bevel">${letterLine('PALKON')}<g transform="translate(0 118)">${letterLine('AUTO')}</g></g></svg>`;
  const resume = document.querySelector('#title-continue');
  resume.hidden = !hasSave;
  resume.addEventListener('click', onContinue);
  document.querySelector('#title-new').addEventListener('click', onNewGame);
  const openControls = () => { controls.showModal(); document.querySelector('#controls-close').focus(); };
  document.querySelector('#title-controls').addEventListener('click', openControls);
  document.querySelector('#controls-close').addEventListener('click', () => controls.close());
  window.addEventListener('keydown', event => {
    if (screen.hidden || controls.open) return;
    const buttons = [...screen.querySelectorAll('button')].filter(button => !button.hidden);
    if (['ArrowDown','ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement);
      buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
    }
  });
  function show(visible) {
    screen.hidden = !visible;
    document.body.dataset.screen = visible ? 'title' : 'game';
    for (const element of document.querySelector('#world').children) {
      if (![screen, controls].includes(element)) element.inert = visible;
    }
    if (visible) (hasSave ? resume : document.querySelector('#title-new')).focus({ preventScroll:true });
  }
  return { show, openControls, get visible() { return !screen.hidden; }, get controlsOpen() { return controls.open; } };
}
