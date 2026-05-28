export class AudioManager {
  private static readonly jumpSound = new Audio("/audio/jump.mp3");

  static {
    // Precargar el sonido
    this.jumpSound.preload = "auto";
  }

  static playJump(): void {
    try {
      const sound = this.jumpSound.cloneNode(true) as HTMLAudioElement;
      sound.volume = 0.35;
      void sound.play().catch(() => {
        // Ignorar error si el navegador bloquea la reproducción automática antes del primer click
      });
    } catch (error) {
      console.warn("Error playing jump sound:", error);
    }
  }
}
