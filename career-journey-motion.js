/* Yarn road player: one complete car/driver drawing, no head or neck distortion. */
(function (global) {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const FRAME_MS = 1000 / 30;

  function nearestDistance(path, length, position) {
    const samples = 600;
    let best = 0;
    let error = Infinity;
    const squaredError = (distance) => {
      const point = path.getPointAtLength(distance);
      return (point.x - position.x) ** 2 + (point.y - position.y) ** 2;
    };
    for (let i = 0; i <= samples; i += 1) {
      const distance = length * i / samples;
      const candidate = squaredError(distance);
      if (candidate < error) {
        error = candidate;
        best = distance;
      }
    }
    let left = Math.max(0, best - length / samples);
    let right = Math.min(length, best + length / samples);
    // Refine the closest small interval; SVG path geometry supplies the actual road.
    for (let i = 0; i < 28; i += 1) {
      const a = left + (right - left) / 3;
      const b = right - (right - left) / 3;
      if (squaredError(a) <= squaredError(b)) right = b;
      else left = a;
    }
    const middle = (left + right) / 2;
    // Keep exact path endpoints exact, rather than a tiny positive search residue.
    if (squaredError(0) <= squaredError(middle)) return 0;
    if (squaredError(length) <= squaredError(middle)) return length;
    return middle;
  }

  // Monotone cubic Hermite travel, with a bounded incoming speed and a quiet stop.
  function sampleSegment(segment, elapsed) {
    const t = clamp(elapsed / segment.duration, 0, 1);
    const t2 = t * t;
    const t3 = t2 * t;
    const fraction = -2 * t3 + 3 * t2 + (t3 - 2 * t2 + t) * segment.tangent;
    const derivative = -6 * t2 + 6 * t + (3 * t2 - 4 * t + 1) * segment.tangent;
    const delta = segment.to - segment.from;
    return {
      distance: segment.from + delta * clamp(fraction, 0, 1),
      velocity: t >= 1 ? 0 : delta * derivative / segment.duration,
      progress: t
    };
  }

  class CareerJourneyMotion {
    constructor({ path, car, positions, onArrive, onTravel }) {
      if (!path || !car || !Array.isArray(positions) || positions.length < 2) {
        throw new TypeError('CareerJourneyMotion requires an SVG road, a car and at least two stops.');
      }
      this.path = path;
      this.car = car;
      this.positions = positions.map((point) => ({ x: point.x, y: point.y }));
      this.length = path.getTotalLength();
      if (!Number.isFinite(this.length) || this.length <= 0) throw new RangeError('The road must have a positive length.');
      this.stops = this.positions.map((point) => nearestDistance(path, this.length, point));
      if (this.stops.some((stop, index) => index > 0 && stop <= this.stops[index - 1])) {
        throw new RangeError('Stops must follow the order of the road.');
      }
      this.onArrive = typeof onArrive === 'function' ? onArrive : () => {};
      this.onTravel = typeof onTravel === 'function' ? onTravel : () => {};
      this.directionElement = car.querySelector('.car-direction');
      this.artElement = car.querySelector('.car-art');
      this.index = 0;
      this.targetIndex = 0;
      this.distance = this.stops[0];
      this.velocity = 0;
      this.angle = 0;
      this.facing = 1;
      this.elapsed = 0;
      this.driveTime = 0;
      this.segment = null;
      this.moving = false;
      this.destroyed = false;
      this.pauseReasons = new Set();
      this.raf = 0;
      this.lastNow = null;
      this.lastRenderedAt = -Infinity;
      this.mediaQuery = global.PortfolioMotion?.preference || (global.matchMedia ? global.matchMedia('(prefers-reduced-motion: reduce)') : null);
      this.reducedMotion = !!(this.mediaQuery && this.mediaQuery.matches);
      this.tick = this._tick.bind(this);
      this.visibilityChanged = () => this._setPauseReason('hidden', !!document.hidden);
      this.reducedMotionChanged = (event) => {
        this.reducedMotion = event.matches;
        if (event.matches && this.moving) this._arrive();
      };
      document.addEventListener('visibilitychange', this.visibilityChanged);
      if (this.mediaQuery) {
        if (this.mediaQuery.addEventListener) this.mediaQuery.addEventListener('change', this.reducedMotionChanged);
        else if (this.mediaQuery.addListener) this.mediaQuery.addListener(this.reducedMotionChanged);
      }
      if (typeof global.IntersectionObserver === 'function') {
        // Pause when the whole map leaves the page, not when a horizontally
        // scrolled mobile map temporarily places its car outside the viewport.
        this.visibilityTarget = car.closest ? car.closest('[data-journey-viewport], .map-viewport') || car : car;
        this.observer = new global.IntersectionObserver((entries) => {
          const entry = entries.find((item) => item.target === this.visibilityTarget);
          if (entry) this._setPauseReason('offscreen', !entry.isIntersecting);
        }, { rootMargin: '140px' });
        this.observer.observe(this.visibilityTarget);
      }
      if (document.hidden) this.pauseReasons.add('hidden');
      car.style.transformOrigin = '50% 100%';
      this._render(0, 0);
      this._emit(0);
    }

    goTo(index) {
      if (this.destroyed || !Number.isInteger(index) || index < 0 || index >= this.stops.length) return false;
      if (this.moving && index === this.targetIndex) return true;
      this.targetIndex = index;
      const to = this.stops[index];
      const delta = to - this.distance;
      if (this.reducedMotion || Math.abs(delta) < 0.05) {
        this._arrive();
        return true;
      }
      const ratio = Math.abs(delta) / this.length;
      const duration = clamp(500 + 4500 * Math.pow(ratio, 0.7), 180, 5000);
      // A same-direction retarget keeps momentum; a reversal starts quietly at the
      // current point instead of first moving away from the newly selected stop.
      const incoming = this.velocity * delta > 0 ? this.velocity * duration / delta : 0;
      this.segment = { from: this.distance, to, duration, tangent: clamp(incoming, 0, 1.6) };
      this.elapsed = 0;
      this.velocity = delta / duration * this.segment.tangent;
      this.facing = Math.sign(delta);
      this.moving = true;
      this.lastNow = null;
      this.lastRenderedAt = -Infinity;
      if (this.directionElement) this.directionElement.style.transform = `scaleX(${this.facing})`;
      this._emit(0);
      this._requestFrame();
      return true;
    }

    reset() {
      if (this.destroyed) return;
      this._cancelFrame();
      this.index = 0;
      this.targetIndex = 0;
      this.distance = this.stops[0];
      this.velocity = 0;
      this.angle = 0;
      this.facing = 1;
      this.elapsed = 0;
      this.driveTime = 0;
      this.segment = null;
      this.moving = false;
      this.lastNow = null;
      if (this.directionElement) this.directionElement.style.transform = 'scaleX(1)';
      this._render(0, 0);
      this._restArt();
      this._emit(0);
    }

    pause() { this._setPauseReason('manual', true); }
    resume() { this._setPauseReason('manual', false); }

    getState() {
      return {
        index: this.index,
        targetIndex: this.targetIndex,
        moving: this.moving,
        paused: this.pauseReasons.size > 0,
        distance: this.distance,
        progress: this.distance / this.length,
        segmentProgress: this.segment ? clamp(this.elapsed / this.segment.duration, 0, 1) : 1,
        facing: this.facing,
        reducedMotion: this.reducedMotion
      };
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this._cancelFrame();
      document.removeEventListener('visibilitychange', this.visibilityChanged);
      if (this.observer) this.observer.disconnect();
      if (this.mediaQuery) {
        if (this.mediaQuery.removeEventListener) this.mediaQuery.removeEventListener('change', this.reducedMotionChanged);
        else if (this.mediaQuery.removeListener) this.mediaQuery.removeListener(this.reducedMotionChanged);
      }
      this._restArt();
    }

    _setPauseReason(reason, paused) {
      if (this.destroyed) return;
      if (paused) this.pauseReasons.add(reason);
      else this.pauseReasons.delete(reason);
      this.lastNow = null;
      if (this.pauseReasons.size) this._cancelFrame();
      else this._requestFrame();
    }

    _cancelFrame() {
      if (this.raf) global.cancelAnimationFrame(this.raf);
      this.raf = 0;
    }

    _requestFrame() {
      if (!this.raf && this.moving && !this.pauseReasons.size && !this.destroyed) {
        this.raf = global.requestAnimationFrame(this.tick);
      }
    }

    _tick(now) {
      this.raf = 0;
      if (!this.moving || this.pauseReasons.size || this.destroyed) return;
      const delta = this.lastNow === null ? 0 : clamp(now - this.lastNow, 0, 120);
      this.lastNow = now;
      this.elapsed += delta;
      this.driveTime += delta;
      if (this.elapsed >= this.segment.duration) {
        this._arrive();
        return;
      }
      if (now - this.lastRenderedAt >= FRAME_MS - 0.25) {
        const sample = sampleSegment(this.segment, this.elapsed);
        this.distance = sample.distance;
        this.velocity = sample.velocity;
        this._render(this.driveTime, Math.max(FRAME_MS, now - this.lastRenderedAt));
        this.lastRenderedAt = now;
        this._emit(sample.progress);
      }
      this._requestFrame();
    }

    _arrive() {
      this._cancelFrame();
      this.distance = this.stops[this.targetIndex];
      this.index = this.targetIndex;
      this.velocity = 0;
      this.moving = false;
      this.segment = null;
      this.elapsed = 0;
      this.lastNow = null;
      this._render(0, FRAME_MS);
      this._restArt();
      this._emit(1);
      this.onArrive(this.index);
    }

    _render(driveTime, delta) {
      const point = this.path.getPointAtLength(this.distance);
      const before = this.path.getPointAtLength(Math.max(0, this.distance - 5));
      const after = this.path.getPointAtLength(Math.min(this.length, this.distance + 5));
      const roadAngle = clamp(Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI, -7, 7);
      const blend = delta === 0 ? 1 : 1 - Math.exp(-Math.min(delta, 120) / 140);
      this.angle += (roadAngle - this.angle) * blend;
      this.car.style.left = `${(point.x / 1440 * 100).toFixed(5)}%`;
      this.car.style.top = `${(point.y / 760 * 100).toFixed(5)}%`;
      this.car.style.rotate = `${this.angle.toFixed(3)}deg`;
      if (this.artElement && this.moving) {
        // Deliberately sampled at 12 fps: a soft stop-motion bounce, not a floating
        // character loop. The whole car and driver move as the same piece.
        const pose = Math.floor(driveTime / (1000 / 12));
        const phase = pose * Math.PI / 3;
        const speed = Math.min(1, Math.abs(this.velocity) / 0.4);
        const bob = Math.sin(phase) * 1.3 * speed;
        const rock = Math.sin(phase + 0.6) * 0.35 * speed * this.facing;
        this.artElement.style.transform = `translateY(${bob.toFixed(2)}px) rotate(${rock.toFixed(2)}deg)`;
      }
    }

    _restArt() {
      if (this.artElement) this.artElement.style.transform = 'translateY(0px) rotate(0deg)';
    }

    _emit(segmentProgress) {
      const point = this.path.getPointAtLength(this.distance);
      this.onTravel({
        index: this.targetIndex,
        moving: this.moving,
        progress: this.distance / this.length,
        distance: this.distance,
        segmentProgress,
        x: point.x,
        y: point.y
      });
    }
  }

  global.CareerJourneyMotion = CareerJourneyMotion;
})(window);
