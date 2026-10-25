(() => {
  'use strict';
  const root = document.getElementById('career-journey');
  if (!root || typeof window.CareerJourneyMotion !== 'function') return;
  const stops = [
    { title:'起点', stage:'', x:132, y:500 },
    { title:'0—6个月', stage:'第一阶段', x:406, y:300 },
    { title:'6—12个月', stage:'第二阶段', x:700, y:510 },
    { title:'12—24个月', stage:'第三阶段', x:998, y:300 },
    { title:'目标', stage:'', x:1282, y:500 }
  ];
  const car = root.querySelector('#career-car');
  const viewport = root.querySelector('.career-map-viewport');
  const world = root.querySelector('.career-map-world');
  const route = root.querySelector('#career-journey-route');
  const trail = root.querySelector('#career-journey-trail');
  const status = root.querySelector('#career-status-text');
  const count = root.querySelector('#career-stage-count');
  const dialog = root.querySelector('#career-level-dialog');
  const library = root.querySelector('#career-content-library');
  const dialogContent = root.querySelector('#career-dialog-content');
  const stages = [...library.querySelectorAll('[data-career-stage]')];
  const stopButtons = [...root.querySelectorAll('[data-career-stop]')];
  const routeLength = route.getTotalLength();
  const reducedMotion = (window.PortfolioMotion?.preference || matchMedia('(prefers-reduced-motion: reduce)'));
  let current = 0, destination = null, moving = false, lastButton = null;
  let pendingOpen = 0, travelToken = 0, activeStage = null, motion = null;
  trail.style.strokeDasharray = `${routeLength} ${routeLength}`;
  trail.style.strokeDashoffset = String(routeLength);

  function followCar() {
    if (viewport.clientWidth >= world.clientWidth - 2) return;
    const x = world.offsetLeft + parseFloat(car.style.left) / 100 * world.clientWidth;
    viewport.scrollLeft = Math.max(0, Math.min(viewport.scrollWidth - viewport.clientWidth, x - viewport.clientWidth * .5));
  }
  function markStop(index, target = false) {
    stopButtons.forEach(button => {
      const active = Number(button.dataset.careerStop) === index;
      button.classList.toggle('is-current', active && !target);
      button.classList.toggle('is-target', active && target);
      if (active) button.setAttribute('aria-current', target ? 'location' : 'step');
      else button.removeAttribute('aria-current');
    });
  }
  function restoreStage() {
    // Move the actual manuscript nodes: the page never keeps a second text copy.
    if (activeStage) {
      library.append(activeStage);
      stages.forEach(stage => library.append(stage));
      activeStage = null;
    }
  }
  function openStage(index) {
    if (index < 1 || index > 3 || moving || document.querySelector('dialog[open]')) return;
    restoreStage();
    const stage = stages[index - 1];
    if (!stage) return;
    root.querySelector('#career-dialog-kicker').textContent = stops[index].stage;
    root.querySelector('#career-dialog-title').textContent = stops[index].title;
    activeStage = stage;
    dialogContent.replaceChildren(stage);
    dialog.dataset.careerStop = String(index);
    motion.pause();
    try {
      dialog.showModal();
      document.body.classList.add('modal-open');
      dialog.scrollTop = 0;
    } catch (_) {
      restoreStage();
      motion.resume();
    }
  }
  function arrive(index) {
    moving = false; destination = null; current = index;
    car.dataset.currentStop = String(index);
    car.dataset.travelState = 'parked';
    delete car.dataset.targetStop;
    car.classList.remove('is-driving');
    car.removeAttribute('aria-disabled');
    markStop(index);
    status.textContent = index === 0 ? '停靠在起点' : index === 4 ? '已抵达目标' : `已抵达${stops[index].title}`;
    count.replaceChildren(document.createTextNode(String(index + 1).padStart(2,'0') + ' '));
    const divider = document.createElement('i'); divider.textContent = '/';
    count.append(divider, document.createTextNode(' 05'));
    const landmark = root.querySelector(`.career-landmark[data-career-stop="${index}"]`);
    landmark.classList.remove('is-arriving');
    requestAnimationFrame(() => landmark.classList.add('is-arriving'));
    if (index === 0 && motion) motion.reset();
    followCar();
    clearTimeout(pendingOpen);
    if (index >= 1 && index <= 3) {
      const token = travelToken;
      pendingOpen = setTimeout(() => {
        pendingOpen = 0;
        if (token === travelToken && current === index && !moving) openStage(index);
      }, reducedMotion.matches ? 0 : 350);
    }
  }
  try {
    motion = new window.CareerJourneyMotion({
      path:route, car, positions:stops.map(({x,y}) => ({x,y})), onArrive:arrive,
      onTravel(event) {
        if (typeof event.progress === 'number') trail.style.strokeDashoffset = String(routeLength * (1 - event.progress));
        if (event.moving) followCar();
      }
    });
  } catch (_) {
    // All three stages stay readable if SVG motion is unavailable.
    return;
  }
  function go(index, trigger) {
    if (!Number.isInteger(index) || index < 0 || index >= stops.length || document.querySelector('dialog[open]')) return;
    clearTimeout(pendingOpen); pendingOpen = 0; travelToken += 1;
    lastButton = trigger || root.querySelector(`.career-landmark[data-career-stop="${index}"]`);
    if (!moving && current === index) {
      if (index >= 1 && index <= 3) openStage(index);
      return;
    }
    destination = index; moving = true;
    car.dataset.targetStop = String(index);
    car.dataset.travelState = 'driving';
    car.classList.add('is-driving');
    car.setAttribute('aria-disabled','true');
    status.textContent = `正在前往${stops[index].title}…`;
    markStop(index,true);
    motion.goTo(index);
  }
  stopButtons.forEach(button => button.addEventListener('click', () => go(Number(button.dataset.careerStop),button)));
  root.querySelector('[data-career-reset]').addEventListener('click', event => go(0,event.currentTarget));
  car.addEventListener('click', event => {
    if (moving) return;
    clearTimeout(pendingOpen);pendingOpen=0;travelToken+=1;
    lastButton = event.currentTarget;
    if (current >= 1 && current <= 3) openStage(current);
  });
  root.querySelectorAll('[data-career-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect=dialog.getBoundingClientRect();
    if (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    restoreStage();
    document.body.classList.toggle('modal-open',!!document.querySelector('dialog[open]'));
    if (!document.querySelector('dialog[open]')) motion.resume();
    lastButton?.focus({preventScroll:true});
  });
  // A citation or system modal opened elsewhere also suspends the car's clock.
  const modalObserver = new MutationObserver(() => {
    if (document.querySelector('dialog[open]')) motion.pause();
    else motion.resume();
  });
  document.querySelectorAll('dialog').forEach(el => modalObserver.observe(el,{attributes:true,attributeFilter:['open']}));
  addEventListener('beforeprint', () => {
    clearTimeout(pendingOpen);pendingOpen=0;travelToken+=1;
    if (dialog.open) dialog.close();
    restoreStage();
  });
  addEventListener('resize',followCar,{passive:true});
  car.dataset.currentStop = '0';car.dataset.travelState = 'parked';
  root.classList.add('is-enhanced');
  markStop(0);followCar();
  window.CareerJourney = Object.freeze({getState:() => ({current,destination,moving,...motion.getState()}),stops:stops.map(s => ({title:s.title,stage:s.stage}))});
})();
