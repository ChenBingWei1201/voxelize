import { ChunkProtocol } from "@voxelize/transport/src/types";
import { Mesh } from "three";

import { Coords2 } from "../../types";

import { RawChunk, RawChunkOptions } from "./raw-chunk";

export class Chunk extends RawChunk {
  public meshes = new Map<number, Mesh[]>();

  public added = false;
  public isDirty = false;

  constructor(id: string, coords: Coords2, options: RawChunkOptions) {
    super(id, coords, options);
  }

  setData(data: ChunkProtocol) {
    const { id, x, z } = data;

    if (this.id !== id) {
      throw new Error("Chunk id mismatch");
    }

    if (this.coords[0] !== x || this.coords[1] !== z) {
      throw new Error("Chunk coords mismatch");
    }

    const { voxels, lights } = data;

    if (lights && lights.byteLength) this.lights.data = new Uint32Array(lights);
    if (voxels && voxels.byteLength) this.voxels.data = new Uint32Array(voxels);
  }

  dispose() {
    this.meshes.forEach((mesh) => {
      mesh.forEach((subMesh) => {
        if (!subMesh) return;

        subMesh.geometry?.dispose();

        if (subMesh.parent) {
          subMesh.parent.remove(subMesh);
        }
      });
    });

    // Free the array buffers
    this.lights.data = new Uint32Array();
    this.voxels.data = new Uint32Array();
  }
}
