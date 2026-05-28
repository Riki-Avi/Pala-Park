export class AudioManager {
  private static readonly jumpSound = new Audio("/audio/jump.mp3");
  private static readonly buttonSound = new Audio("/audio/button.mp3");
  private static readonly victorySound = new Audio("/audio/victory.mp3");
  private static readonly laserSound = new Audio("/audio/laser.mp3");

  static {
    // Precargar el sonido
    this.jumpSound.preload = "auto";
    this.buttonSound.preload = "auto";
    this.victorySound.preload = "auto";
    this.laserSound.preload = "auto";
  }

  static playJump(): void {
    try {
      const sound = this.jumpSound.cloneNode(true) as HTMLAudioElement;
      sound.volume = 0.03;
      void sound.play().catch(() => {
        // Ignorar error si el navegador bloquea la reproducción automática antes del primer click
      });
    } catch (error) {
      console.warn("Error playing jump sound:", error);
    }
  }

  static playButton(): void {
    try {
      const sound = this.buttonSound.cloneNode(true) as HTMLAudioElement;
      sound.volume = 0.12;
      void sound.play().catch(() => {
        // Ignorar error si el navegador bloquea la reproducción automática antes del primer click
      });
    } catch (error) {
      console.warn("Error playing button sound:", error);
    }
  }

  static playVictory(): void {
    try {
      const sound = this.victorySound.cloneNode(true) as HTMLAudioElement;
      sound.volume = 0.02;
      void sound.play().catch(() => {
        // Ignorar error si el navegador bloquea la reproducción automática
      });
    } catch (error) {
      console.warn("Error playing victory sound:", error);
    }
  }

  static playLaser(): void {
    try {
      const sound = this.laserSound.cloneNode(true) as HTMLAudioElement;
      sound.volume = 0.08;
      void sound.play().catch(() => {
        // Ignorar error si el navegador bloquea la reproducción automática antes del primer click
      });
    } catch (error) {
      console.warn("Error playing laser sound:", error);
    }
  }
}
