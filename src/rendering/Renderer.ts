import { Application, Container, Text, TextStyle } from 'pixi.js';
import { CANVAS_BG_COLOR } from '../constants';
import type { Camera } from '../core/Camera';

export class Renderer {
  private app!: Application;
  public worldContainer!: Container;
  public terrainLayer!: Container;
  public unitLayer!: Container;
  public fogLayer!: Container;
  public effectLayer!: Container;
  public uiLayer!: Container;
  private fpsText!: Text;
  private tickText!: Text;
  private unitCountText!: Text;
  private initialized = false;

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  get stage(): Container {
    return this.app.stage;
  }

  get pixiRenderer() { return this.app.renderer; }

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
    this.worldContainer = new Container();
    this.terrainLayer = new Container();
    this.unitLayer = new Container();
    this.fogLayer = new Container();
    this.effectLayer = new Container();
    this.uiLayer = new Container();

    // World layers inside worldContainer (camera transforms here)
    this.worldContainer.addChild(
      this.terrainLayer,
      this.unitLayer,
      this.fogLayer,
      this.effectLayer,
    );

    // uiLayer stays at stage level (HUD, unaffected by camera)
    this.app.stage.addChild(this.worldContainer, this.uiLayer);
  }

  /** Apply camera transform to the world container. */
  applyCamera(camera: Camera): void {
    const vpW = this.app.screen.width;
    const vpH = this.app.screen.height;
    this.worldContainer.position.set(
      vpW / 2 - camera.x * camera.zoom,
      vpH / 2 - camera.y * camera.zoom,
    );
    this.worldContainer.scale.set(camera.zoom);
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
    this.unitCountText = new Text({ text: 'Units: 0', style });
    this.unitCountText.position.set(8, 44);
    this.uiLayer.addChild(this.fpsText, this.tickText, this.unitCountText);
  }

  updateFPS(fps: number, tick: number, unitCount?: number): void {
    this.fpsText.text = `FPS: ${fps}`;
    this.tickText.text = `Tick: ${tick}`;
    if (unitCount !== undefined) {
      this.unitCountText.text = `Units: ${unitCount}`;
    }
  }

  render(_alpha: number): void {
    if (!this.initialized) return;
    this.app.render();
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: true });
  }
}
