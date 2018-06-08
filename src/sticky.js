/* @flow */
import Placeholder from './placeholder';

export type StickyOptions = {
  marginTop?: number,
  wrapper?: HTMLElement|string,
  placehold?: boolean,
};

export default class Sticky {
  element: HTMLElement;
  options: StickyOptions;
  placeholder: Placeholder;
  marginTop: number = 0;
  isSticky: ?boolean;
  isStickToBottom: ?boolean = false;
  // private
  $$wrapper: HTMLElement;
  $$floor: number;
  $$additionalTop: ?number;

  static instances: Stickies = [];
  static activated: boolean = false;
  static bulkUpdateRequestId: ?number = null;

  get isSticky() {
    return this.element !== null && this.element.style.position === 'fixed';
  }

  set isSticky(value: boolean): boolean {
    this.element.dataset.stuck = value ? value.toString() : '';
    this.element.style.position = value ? 'fixed' : '';
    this.element.style.top = value ? `${this.top}px` : '';
    this.element.style.left = value ? `${this.placeholder.element.getBoundingClientRect().left}px` : '';
    if (value) {
      this.computePositionTopFromRect();
    }
    return value;
  }

  get top(): number {
    return (this.$$additionalTop || this.$$additionalTop === 0)
      ? this.$$additionalTop
      : this.marginTop;
  }

  set top(value: ?number): ?number {
    this.$$additionalTop = value;
    this.element.style.top = value ? `${value}px` : `${this.marginTop}px`;
    return value;
  }

  get floor(): number {
    return this.$$floor || 0;
  }

  get wrapper(): HTMLElement {
    return this.$$wrapper;
  }

  set wrapper(value: HTMLElement|string): HTMLElement {
    if (document.body === null) {
      throw new Error('[Stuck.js] document.body is not HTMLElement in this environment');
    }
    this.$$wrapper = Sticky.normalizeElement(value, document.body);
    this.$$floor = Sticky.computeAbsoluteFloor(this.$$wrapper);
    this.options.wrapper = this.$$wrapper;
    return this.$$wrapper;
  }

  constructor(
    element: HTMLElement,
    options: StickyOptions = {},
    activate: boolean = true,
  ) {
    this.element = element;
    this.options = {
      marginTop: 0,
      placehold: true,
      ...options,
    };
    this.marginTop = this.options.marginTop;
    this.wrapper = this.options.wrapper;
    this.placeholder = new Placeholder(element, this.options.placehold, true, Sticky.bulkUpdate);
    this.element.dataset.stuck = '';
    Sticky.register(this);

    if (activate) {
      Sticky.activate();
    }
  }

  static computeAbsoluteFloor(target: HTMLElement): number {
    const absoluteBottom = target.getBoundingClientRect().bottom + global.pageYOffset;
    const { paddingBottom } = window.getComputedStyle(target);
    const paddingBottomPixels = parseInt(paddingBottom, 10) || 0;
    return absoluteBottom - paddingBottomPixels;
  }

  static normalizeElement(value: string|HTMLElement, fallback: HTMLElement): HTMLElement {
    if (value instanceof HTMLElement) {
      return value;
    }
    return document.querySelector(value) || fallback;
  }

  static register(instance: Sticky): void {
    Sticky.instances = [...Sticky.instances, instance];
  }

  destroy(): void {
    this.placeholder.destroy();
    this.isSticky = false;
    Sticky.instances = Sticky.instances.filter(instance => instance !== this);
    delete this.placeholder;
    delete this.element;
    delete this.options;
    if (Sticky.instances.length < 1) {
      Sticky.deactivate();
    }
  }

  static destroyAll(): void {
    Sticky.instances.forEach(instance => instance.destroy());
  }

  static activate(): void {
    if (!Sticky.activated && Sticky.instances.length > 0) {
      window.addEventListener('scroll', Sticky.bulkUpdate);
      window.addEventListener('resize', Sticky.bulkPlaceholderUpdate);
      Sticky.activated = true;
    }
    Sticky.bulkUpdate();
  }

  static deactivate(): void {
    if (Sticky.activated) {
      window.removeEventListener('scroll', Sticky.bulkUpdate);
      window.removeEventListener('resize', Sticky.bulkPlaceholderUpdate);
      Sticky.activated = false;
    }
  }

  static bulkPlaceholderUpdate(): void {
    window.cancelAnimationFrame(Sticky.bulkUpdateRequestId);
    Sticky.bulkUpdateRequestId = window.requestAnimationFrame(() => {
      Sticky.instances.forEach((instance) => {
        instance.placeholder.update();
        instance.update();
      });
    });
  }

  static bulkUpdate(): void {
    window.cancelAnimationFrame(Sticky.bulkUpdateRequestId);
    Sticky.bulkUpdateRequestId = window.requestAnimationFrame(() => {
      Sticky.instances.forEach(instance => instance.update());
    });
  }

  computePositionTopFromRect(rect?: ClientRect = this.element.getBoundingClientRect()) {
    const relativeFloor = this.floor - global.pageYOffset;
    if (rect.bottom > relativeFloor && !this.isStickToBottom) {
      this.top = relativeFloor - rect.height;
      this.isStickToBottom = true;
      return;
    }

    if (this.isStickToBottom) {
      if (rect.top === this.marginTop) {
        this.isStickToBottom = false;
        return;
      }
      if (rect.top < this.marginTop) {
        this.top = relativeFloor - rect.height;
        return;
      }
    }

    this.top = null;
  }

  update(): void {
    const placeholderRect = this.placeholder.element.getBoundingClientRect();

    if (!this.isSticky && placeholderRect.top <= this.marginTop) {
      this.isSticky = true;
      return;
    }

    if (this.isSticky) {
      if (placeholderRect.top >= this.marginTop) {
        this.isSticky = false;
        return;
      }

      const rect = this.element.getBoundingClientRect();
      if (rect.left !== placeholderRect.left) {
        this.element.style.left = `${placeholderRect.left}px`;
      }

      this.computePositionTopFromRect(rect);
    }
  }
}

export type Stickies = Sticky[];
