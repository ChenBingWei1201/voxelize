use std::ops::Deref;

use hashbrown::HashMap;
use rapier3d::prelude::CollisionEvent;
use specs::{Entities, ReadExpect, ReadStorage, System, WriteExpect, WriteStorage};

use crate::{
    world::{
        components::{CurrentChunkComp, PositionComp, RigidBodyComp},
        physics::Physics,
        registry::Registry,
        stats::Stats,
        voxels::Chunks,
        WorldConfig,
    },
    ClientFilter, ClientFlag, CollisionsComp, Event, Events, IDComp, InteractorComp, Vec3,
};

#[derive(Default)]
pub struct PhysicsSystem;

impl<'a> System<'a> for PhysicsSystem {
    type SystemData = (
        Entities<'a>,
        ReadExpect<'a, Stats>,
        ReadExpect<'a, Registry>,
        ReadExpect<'a, WorldConfig>,
        ReadExpect<'a, Chunks>,
        WriteExpect<'a, Physics>,
        ReadStorage<'a, CurrentChunkComp>,
        ReadStorage<'a, InteractorComp>,
        ReadStorage<'a, ClientFlag>,
        WriteStorage<'a, CollisionsComp>,
        WriteStorage<'a, RigidBodyComp>,
        WriteStorage<'a, PositionComp>,
    );

    fn run(&mut self, data: Self::SystemData) {
        use rayon::prelude::*;
        use specs::{Join, ParJoin};

        let (
            entities,
            stats,
            registry,
            config,
            chunks,
            mut physics,
            curr_chunks,
            interactors,
            client_flag,
            mut collisions,
            mut bodies,
            mut positions,
        ) = data;

        let mut collision_map = HashMap::new();

        // Tick the voxel physics of all entities (non-clients).
        (&curr_chunks, &mut bodies, &mut positions, !&client_flag)
            .par_join()
            .for_each(|(curr_chunk, body, position, _)| {
                if !chunks.is_chunk_ready(&curr_chunk.coords) {
                    return;
                }

                Physics::iterate_body(&mut body.0, stats.delta, chunks.deref(), &registry, &config);

                let body_pos = body.0.get_position();
                let Vec3(px, py, pz) = body_pos;
                position.0.set(px, py, pz);
            });

        // Move the clients' rigid bodies to their positions
        (&entities, &interactors, &positions)
            .join()
            .for_each(|(ent, interactor, position)| {
                physics.move_rapier_body(interactor.body_handle(), &position.0);
                collision_map.insert(interactor.collider_handle().clone(), ent);
            });

        // Tick the rapier physics engine, and add the collisions to individual entities.
        let collision_events = physics.step(stats.delta);
        let mut started_collisions = Vec::new();
        let mut stopped_collisions = Vec::new();

        for event in collision_events {
            match event {
                CollisionEvent::Started(ch1, ch2, _) => {
                    if let (Some(ent1), Some(ent2)) =
                        (collision_map.get(&ch1), collision_map.get(&ch2))
                    {
                        started_collisions.push((*ent1, *ent2, event));
                    }
                }
                CollisionEvent::Stopped(ch1, ch2, _) => {
                    if let (Some(ent1), Some(ent2)) =
                        (collision_map.get(&ch1), collision_map.get(&ch2))
                    {
                        stopped_collisions.push((*ent1, *ent2, event));
                    }
                }
                _ => {}
            }
        }

        for (ent1, ent2, event) in started_collisions {
            if let Some(collision_comp) = collisions.get_mut(ent1) {
                collision_comp.0.push((event, ent2));
            }
            if let Some(collision_comp) = collisions.get_mut(ent2) {
                collision_comp.0.push((event, ent1));
            }
        }

        for (ent1, ent2, event) in stopped_collisions {
            if let Some(collision_comp) = collisions.get_mut(ent1) {
                collision_comp.0.push((event, ent2));
            }
            if let Some(collision_comp) = collisions.get_mut(ent2) {
                collision_comp.0.push((event, ent1));
            }
        }

        if config.collision_repulsion <= f32::EPSILON {
            return;
        }

        // Collision detection, push bodies away from one another.
        let mut collision_data = Vec::new();
        for (curr_chunk, body, interactor) in (&curr_chunks, &mut bodies, &interactors).join() {
            if !chunks.is_chunk_ready(&curr_chunk.coords) {
                continue;
            }

            let rapier_body = physics.get(&interactor.0);
            let after = rapier_body.translation();

            let Vec3(px, py, pz) = body.0.get_position();

            let dx = after.x - px;
            let dy = after.y - py;
            let dz = after.z - pz;

            let dx = if dx.abs() < 0.001 { 0.0 } else { dx };
            let dy = if dy.abs() < 0.001 { 0.0 } else { dy };
            let dz = if dz.abs() < 0.001 { 0.0 } else { dz };

            let len = (dx * dx + dy * dy + dz * dz).sqrt();

            if len > 0.0001 {
                collision_data.push((body, dx, dy, dz, len));
            }
        }

        for (body, dx, dy, dz, len) in collision_data {
            let mut dx = dx / len;
            let dy = dy / len;
            let mut dz = dz / len;

            // If only dy movements, add a little bias to eliminate stack overflow.
            if dx.abs() < 0.001 && dz.abs() < 0.001 {
                dx = fastrand::i32(-10..10) as f32 / 1000.0;
                dz = fastrand::i32(-10..10) as f32 / 1000.0;
            }

            body.0.apply_impulse(
                (dx * config.collision_repulsion).min(3.0),
                (dy * config.collision_repulsion).min(3.0),
                (dz * config.collision_repulsion).min(3.0),
            );
        }
    }
}
