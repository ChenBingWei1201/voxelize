import { PerspectiveCamera, Vector3, MathUtils, AudioListener } from "three";

import { Client } from "..";

/**
 * Parameters to initialize the Voxelize {@link Camera}.
 */
type CameraParams = {
  /**
   * Default camera field of view. Defaults to `90`.
   */
  fov: number;

  /**
   * Default nearest distance camera can render. Defaults to `0.1`.
   */
  near: number;

  /**
   * Default farthest distance camera can render. Defaults to `2000`.
   */
  far: number;

  /**
   * Lerp factor of camera FOV/zoom change. Defaults to `0.7`.
   */
  lerpFactor: number;
};

const defaultParams: CameraParams = {
  fov: 90,
  near: 0.1,
  far: 2000,
  lerpFactor: 0.7,
};

/**
 * The **built-in** Voxelize camera class using ThreeJS's `PerspectiveCamera`, adding custom functionalities such as FOV interpolating and camera zooming. 
 * The camera by default has a zoom of 1.0.
 *
 * ## Example
 * This is an example on binding the <kbd>v</kbd> key to zooming the camera by a factor of 2.
 * ```ts 
 * client.inputs.bind(
 *   "v",
 *   () => {
 *     client.camera.setZoom(2);
 *   },
 *   "in-game",
 *   {
 *     occasion: "keydown",
 *   }
 * );

 * client.inputs.bind(
 *   "v",
 *   () => {
 *     client.camera.setZoom(1);
 *   },
 *   "in-game",
 *   {
 *     occasion: "keyup",
 *   }
 * );
 * ```
 *
 * @category Core
 */
class Camera extends PerspectiveCamera {
  /**
   * Reference linking back to the Voxelize client instance.
   */
  public client: Client;

  /**
   * Parameters to initialize the Voxelize camera.
   */
  public params: CameraParams;

  /**
   * An audio listener attached to the camera to play music.
   */
  public listener: AudioListener;

  /**
   * A function called before every update per tick.
   */
  public onBeforeUpdate?: () => void;

  /**
   * A function called after every update per tick.
   */
  public onAfterUpdate?: () => void;

  private newZoom: number;
  private newFOV: number;

  /**
   * Construct a new Voxelize camera instance, setting up ThreeJS camera.
   *
   * @hidden
   */
  constructor(client: Client, params: Partial<CameraParams> = {}) {
    super(
      params.fov || defaultParams.fov,
      client.rendering.aspectRatio,
      params.near || defaultParams.near,
      params.far || defaultParams.far
    );

    this.client = client;

    const { fov, near, far } = (this.params = {
      ...defaultParams,
      ...params,
    });

    this.newFOV = fov;
    this.newZoom = 1;

    // initialize camera position
    this.lookAt(new Vector3(0, 0, 0));

    // listen to resize, and adjust accordingly
    // ? should move to it's own logic for all event listeners?
    window.addEventListener("resize", () => {
      client.rendering.adjustRenderer();

      this.aspect = client.rendering.aspectRatio;
      this.updateProjectionMatrix();
    });

    client.on("initialized", () => {
      client.inputs.bind(
        "v",
        () => {
          this.setZoom(3);
        },
        "in-game",
        {
          occasion: "keydown",
        }
      );

      client.inputs.bind(
        "v",
        () => {
          this.setZoom(1);
        },
        "in-game",
        {
          occasion: "keyup",
        }
      );
    });
  }

  /**
   * Interpolate the camera's zoom. Default zoom is 1.0.
   *
   * @param zoom - The new zoom for the camera to lerp to.
   */
  setZoom = (zoom: number) => {
    this.newZoom = zoom;
  };

  /**
   * Interpolate the camera's FOV. Default FOV is 90.
   *
   * @param fov - The new field of view to lerp to.
   */
  setFOV = (fov: number) => {
    this.newFOV = fov;
  };

  /**
   * Updater of the camera.
   *
   * @hidden
   */
  update = () => {
    this.onBeforeUpdate?.();

    if (this.newFOV !== this.fov) {
      this.fov = MathUtils.lerp(this.fov, this.newFOV, this.params.lerpFactor);
      this.updateProjectionMatrix();
    }

    if (this.newZoom !== this.zoom) {
      this.zoom = MathUtils.lerp(
        this.zoom,
        this.newZoom,
        this.params.lerpFactor
      );
      this.updateProjectionMatrix();
    }

    this.updateMatrix();
    this.updateMatrixWorld();

    this.onAfterUpdate?.();
  };

  /**
   * Setup the audio listener.
   *
   * @internal
   * @hidden
   */
  setupListener = () => {
    if (this.listener) return;

    // initialize the audio listener
    this.listener = new AudioListener();

    // add the audio listener to the camera
    this.add(this.listener);

    // Load all audios
    this.client.loader.loadAudios();
  };
}

export type { CameraParams };

export { Camera };
