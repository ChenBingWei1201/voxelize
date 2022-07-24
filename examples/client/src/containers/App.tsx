import { useEffect, useRef } from "react";
import styled from "styled-components";
import * as VOXELIZE from "@voxelize/client";
import {
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
} from "postprocessing";
import * as THREE from "three";

import { setupWorld } from "src/core/world";
import { ChunkUtils, NameTag, Peers, SpriteText } from "@voxelize/client";
import { sRGBEncoding } from "three";
import TestImage from "../assets/cat.jpeg";

const GameWrapper = styled.div`
  background: black;
  position: absolute;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  overflow: hidden;
`;

const GameCanvas = styled.canvas`
  position: absolute;
  width: 100%;
  height: 100%;
`;

let BACKEND_SERVER_INSTANCE = new URL(window.location.href);

if (BACKEND_SERVER_INSTANCE.origin.includes("localhost")) {
  BACKEND_SERVER_INSTANCE.port = "4000";
}

const BACKEND_SERVER = BACKEND_SERVER_INSTANCE.toString();

const App = () => {
  const domRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<VOXELIZE.World | null>(null);

  useEffect(() => {
    if (domRef.current && canvasRef.current && !worldRef.current) {
      const clock = new THREE.Clock();
      const world = new VOXELIZE.World({
        textureDimension: 128,
      });
      const chat = new VOXELIZE.Chat();
      const inputs = new VOXELIZE.Inputs<"menu" | "in-game" | "chat">();

      inputs.setNamespace("menu");

      const sky = new VOXELIZE.Sky(2000);
      sky.box.paint("top", VOXELIZE.drawSun);
      world.add(sky);

      const clouds = new VOXELIZE.Clouds({
        uFogColor: sky.uMiddleColor,
      });
      // world.add(clouds);

      world.uniforms.fogColor.value.copy(sky.uMiddleColor.value);

      const camera = new THREE.PerspectiveCamera(
        90,
        domRef.current.offsetWidth / domRef.current.offsetHeight,
        0.1,
        5000
      );

      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
      });
      renderer.setSize(
        renderer.domElement.offsetWidth,
        renderer.domElement.offsetHeight
      );

      renderer.outputEncoding = sRGBEncoding;

      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(world, camera));
      composer.addPass(new EffectPass(camera, new SMAAEffect({})));

      const nametag = new NameTag(
        "∆#E6B325∆[VIP] ∆white∆LMAO\n∆cyan∆[MVP] ∆white∆BRUH",
        { fontSize: 0.5 }
      );
      nametag.position.set(0, 75, 0);
      world.add(nametag);

      domRef.current.appendChild(renderer.domElement);

      const controls = new VOXELIZE.RigidControls(
        camera,
        renderer.domElement,
        world
      );

      const network = new VOXELIZE.Network();

      setupWorld(world);

      window.addEventListener("resize", () => {
        const width = domRef.current?.offsetWidth as number;
        const height = domRef.current?.offsetHeight as number;

        renderer.setSize(width, height);

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      });

      controls.on("lock", () => {
        inputs.setNamespace("in-game");
      });

      inputs.bind(
        "t",
        () => {
          controls.unlock(() => {
            inputs.setNamespace("chat");
          });
        },
        "in-game"
      );

      inputs.bind(
        "esc",
        () => {
          controls.lock();
        },
        "chat",
        {
          // Need this so that ESC doesn't unlock the pointerlock.
          occasion: "keyup",
        }
      );

      inputs.click(
        "left",
        () => {
          if (!controls.lookBlock) return;
          const [vx, vy, vz] = controls.lookBlock;
          world.updateVoxel(vx, vy, vz, 0);
        },
        "in-game"
      );

      let hand = "Stone";

      inputs.click(
        "middle",
        () => {
          if (!controls.lookBlock) return;
          const [vx, vy, vz] = controls.lookBlock;
          hand = world.getBlockByVoxel(vx, vy, vz).name;
        },
        "in-game"
      );

      inputs.click(
        "right",
        () => {
          if (!controls.targetBlock) return;
          const { rotation, voxel, yRotation } = controls.targetBlock;
          const id = world.getBlockByName(hand).id;
          world.updateVoxel(
            ...voxel,
            id,
            rotation
              ? VOXELIZE.BlockRotation.encode(rotation, yRotation)
              : undefined
          );
        },
        "in-game"
      );

      const peers = new Peers(controls.object);

      peers.onPeerUpdate = (peer) => {
        console.log(peer);
      };

      world.loader.addTexture(TestImage, (texture) => {
        sky.box.paint("top", texture);
      });

      network
        .register(chat)
        .register(world)
        .register(peers)
        .connect({ serverURL: BACKEND_SERVER, secret: "test" })
        .then(() => {
          network.join("world3").then(() => {
            const animate = () => {
              requestAnimationFrame(animate);

              const delta = clock.getDelta();

              peers.update();
              controls.update(delta);

              clouds.update(camera.position, delta);
              sky.position.copy(camera.position);

              world.update(camera.position, delta, controls.getDirection());

              network.flush();

              composer.render();
            };

            animate();
          });
        });

      worldRef.current = world;
    }
  }, [domRef, canvasRef]);

  return (
    <GameWrapper ref={domRef}>
      <GameCanvas ref={canvasRef} />
    </GameWrapper>
  );
};

export default App;
