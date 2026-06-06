export interface LocalInputState {
  left: boolean;
  right: boolean;
  forward: boolean;
  backward: boolean;
  jump: boolean;
  interact: boolean;
  down: boolean;
}

export function createEmptyInput(): LocalInputState {
  return {
    left: false,
    right: false,
    forward: false,
    backward: false,
    jump: false,
    interact: false,
    down: false
  };
}
