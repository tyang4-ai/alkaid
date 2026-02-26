import { Application, Container, Text, TextStyle } from 'pixi.js';
import { CANVAS_BG_COLOR } from '../constants';

export class Renderer {
  private app!: Application;
  public terrainLayer!: Container;
  public unitLayer!: Container;
  public effectLayer!: Container;
  public uiLayer!: Container;
  private fpsText!: Text;
  private tickText!: Text;
  private initialized = false;

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  get stage(): Container {
    return this.app.stage;
  }

  async init(container: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      background: CANVAS_BG_COLOR,
      resizeTo: window,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: 'webgl',
    });

    // Stop built-in ticker — we use our own GameLoop
    this.app.ticker.autoStart = false;
    this.app.ticker.stop();

    container.appendChild(this.app.canvas);
    this.setupLayers();
    this.setupFPSDisplay();
    this.initialized = true;
  }

  private setupLayers(): void {
    this.terrainLayer = new Container();
    this.unitLayer = new Container();
    this.effectLayer = new Container();
    this.uiLayer = new Container();
    this.app.stage.addChild(
      this.terrainLayer,
      this.unitLayer,
      this.effectLayer,
      this.uiLayer,
    );
  }

  private setupFPSDisplay(): void {
    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 14,
      fill: 0x00ff00,
      stroke: { color: 0x000000, width: 2 },
    });
    this.fpsText = new Text({ text: 'FPS: --', style });
    this.fpsText.position.set(8, 8);
    this.tickText = new Text({ text: 'Tick: 0', style });
    this.tickText.position.set(8, 26);
    this.uiLayer.addChild(this.fpsText, this.tickText);
  }

  updateFPS(fps: number, tick: number): void {
    this.fpsText.text = `FPS: ${fps}`;
    this.tickText.text = `Tick: ${tick}`;
  }

  render(_alpha: number): void {
    if (!this.initialized) return;
    this.app.render();
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: true });
  }
}
