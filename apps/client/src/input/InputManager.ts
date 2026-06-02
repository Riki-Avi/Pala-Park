import { createEmptyInput, type LocalInputState } from "./InputState";

type PlayerKeyMap = Record<keyof LocalInputState, string[]>;

const playerOne: PlayerKeyMap = {
  left: ["KeyA"],
  right: ["KeyD"],
  forward: ["KeyW"],
  backward: ["KeyS"],
  jump: ["Space"],
  interact: ["KeyE", "MouseLeft"]
};

const playerTwo: PlayerKeyMap = {
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  forward: ["ArrowUp"],
  backward: ["ArrowDown"],
  jump: ["ShiftRight", "Enter"],
  interact: ["Slash", "MouseLeft"]
};

export class InputManager {
  private readonly pressed = new Set<string>();
  private pointerElement: HTMLElement | null = null;
  private sensitivity = 0.0024;
  private resetRequested = false;
  private switchPlayerRequested = false;
  private fullPitchLook = false;
  yaw = 0;
  pitch = -0.35;
  private readonly maps = new Map<string, PlayerKeyMap>([
    ["p1", playerOne],
    ["p2", playerTwo]
  ]);

  constructor() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mouseup", this.handleMouseUp);
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("mousemove", this.handleMouseMove);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("mousemove", this.handleMouseMove);
    this.pointerElement?.removeEventListener("click", this.handlePointerRequest);
  }

  enablePointerLook(element: HTMLElement): void {
    this.pointerElement?.removeEventListener("click", this.handlePointerRequest);
    this.pointerElement = element;
    this.pointerElement.addEventListener("click", this.handlePointerRequest);
  }

  setSensitivity(value: number): void {
    this.sensitivity = Math.max(0.0008, Math.min(0.006, value));
  }

  getSensitivity(): number {
    return this.sensitivity;
  }

  setFullPitchLook(enabled: boolean): void {
    this.fullPitchLook = enabled;
    if (!enabled) {
      this.pitch = Math.max(-1.2, Math.min(0.85, this.pitch));
    }
  }

  consumeResetPressed(): boolean {
    const requested = this.resetRequested;
    this.resetRequested = false;
    return requested;
  }

  consumeSwitchPlayerPressed(): boolean {
    const requested = this.switchPlayerRequested;
    this.switchPlayerRequested = false;
    return requested;
  }

  getPrimaryInput(): LocalInputState {
    return this.readInput(playerOne);
  }

  getInput(playerId: string): LocalInputState {
    const map = this.maps.get(playerId);

    if (!map) {
      return createEmptyInput();
    }

    return this.readInput(map);
  }

  private readInput(map: PlayerKeyMap): LocalInputState {
    const input = createEmptyInput();

    for (const action of Object.keys(input) as Array<keyof LocalInputState>) {
      input[action] = map[action].some((code) => this.pressed.has(code));
    }

    return input;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    this.pressed.add(event.code);
    if (event.code === "KeyR" && !event.repeat) {
      this.resetRequested = true;
    }

    if (event.code === "Tab" && !event.repeat) {
      this.switchPlayerRequested = true;
    }

    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(event.code)) {
      event.preventDefault();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) { // Left click
      this.pressed.add("MouseLeft");
    }
  };

  private readonly handleMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.pressed.delete("MouseLeft");
    }
  };

  private readonly handleBlur = (): void => {
    this.pressed.clear();
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.pointerElement) {
      return;
    }

    this.yaw -= event.movementX * this.sensitivity;
    this.pitch -= event.movementY * this.sensitivity;
    if (!this.fullPitchLook) {
      this.pitch = Math.max(-1.2, Math.min(0.85, this.pitch));
    }
  };

  private readonly handlePointerRequest = (): void => {
    void this.pointerElement?.requestPointerLock();
  };
}
