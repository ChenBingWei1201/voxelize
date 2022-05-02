import { EventEmitter } from "events";

import {
  Container,
  ContainerParams,
  World,
  Network,
  RenderingParams,
  Rendering,
  Camera,
  CameraParams,
  Peers,
  PeersParams,
  Inputs,
  Clock,
  Controls,
  ControlsParams,
  Debug,
  Entities,
  EntitiesParams,
  NewEntity,
  Mesher,
  Registry,
  RegistryParams,
  Settings,
} from "./core";
import { Chunks } from "./core/chunks";
import { ECS, System } from "./libs";
import { ChunkUtils } from "./utils";

type ClientParams = {
  container?: Partial<ContainerParams>;
  rendering?: Partial<RenderingParams>;
  camera?: Partial<CameraParams>;
  peers?: Partial<PeersParams>;
  entities?: Partial<EntitiesParams>;
  controls?: Partial<ControlsParams>;
  registry?: Partial<RegistryParams>;
};

class Client extends EventEmitter {
  public name = "test";

  public network: Network | undefined;

  public ecs: ECS;

  public debug: Debug;
  public container: Container;
  public rendering: Rendering;
  public inputs: Inputs;
  public clock: Clock;
  public controls: Controls;
  public camera: Camera;
  public world: World;
  public peers: Peers;
  public entities: Entities;
  public mesher: Mesher;
  public registry: Registry;
  public settings: Settings;
  public chunks: Chunks;

  public loaded = false;
  public ready = false;

  private animationFrame: number;

  constructor(params: ClientParams = {}) {
    super();

    const {
      container,
      rendering,
      camera,
      peers,
      entities,
      controls,
      registry,
    } = params;

    this.ecs = new ECS();

    this.debug = new Debug(this);
    this.container = new Container(this, container);
    this.rendering = new Rendering(this, rendering);
    this.world = new World(this);
    this.camera = new Camera(this, camera);
    this.peers = new Peers(this, peers);
    this.entities = new Entities(this, entities);
    this.controls = new Controls(this, controls);
    this.registry = new Registry(this, registry);
    this.inputs = new Inputs(this);
    this.mesher = new Mesher(this);
    this.clock = new Clock(this);
    this.settings = new Settings(this);
    this.chunks = new Chunks(this);

    // all members has been initialized
    this.emit("initialized");
  }

  connect = async ({
    world,
    serverURL,
    reconnectTimeout,
  }: {
    world: string;
    serverURL: string;
    reconnectTimeout?: number;
  }) => {
    reconnectTimeout = reconnectTimeout || 5000;

    // re-instantiate networking instance
    const network = new Network(this, { reconnectTimeout, serverURL });
    // const hasWorld = await network.fetch("has-world", { world });

    // if (!hasWorld) {
    //   console.error("Room not found.");
    //   return false;
    // }

    network.connect(world).then(() => {
      console.log(`Joined world "${world}"`);
    });

    this.network = network;

    this.reset();
    this.run();

    return true;
  };

  disconnect = async () => {
    this.peers.dispose();

    if (this.network) {
      this.network.disconnect();
      console.log(`Left world "${this.network.world}"`);
    }

    if (this.animationFrame) {
      // render one last time to clear things
      this.rendering.render();
      cancelAnimationFrame(this.animationFrame);
    }

    this.network = undefined;
  };

  registerEntity = (type: string, protocol: NewEntity) => {
    this.entities.registerEntity(type, protocol);
  };

  addSystem = (system: System) => {
    this.ecs.addSystem(system);
  };

  setName = (name: string) => {
    this.name = name || " ";
  };

  reset = () => {
    this.entities.reset();
    this.chunks.reset();
  };

  get position() {
    return this.controls.object.position;
  }

  get voxel() {
    return ChunkUtils.mapWorldPosToVoxelPos(
      this.position.toArray(),
      this.world.params.dimension
    );
  }

  private run = () => {
    const animate = () => {
      this.animationFrame = requestAnimationFrame(animate);
      this.animate();
    };

    animate();
  };

  private animate = () => {
    if (!this.network.connected || !this.ready || !this.loaded) {
      return;
    }

    this.camera.update();
    this.controls.update();
    this.ecs.update();
    this.clock.update();
    this.entities.update();
    this.peers.update();
    this.debug.update();
    this.chunks.update();

    this.rendering.render();
  };
}

export { Client };

export * from "./core";
export * from "./libs";