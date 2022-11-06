import { MessageProtocol } from "@voxelize/transport/src/types";

import { NetIntercept } from "./network";

/**
 * A Voxelize event from the server.
 */
export type Event = {
  /**
   * The name to identify the event.
   */
  name: string;

  /**
   * Additional information of the event.
   */
  payload?: any;
};

/**
 * The handler for an event sent from the Voxelize server.
 */
export type EventHandler = (payload: any | null) => void;

/**
 * A manager for any events interacting with the Voxelize server. This is useful
 * for any defined game events that are sent from or needs to be broadcasted to
 * the server.
 *
 * # Example
 * ```ts
 * const events = new VOXELIZE.Events();
 *
 * // Define the behavior to handle a game-over event. Keep in mind that this
 * // event is most likely sent from the server, so check out the documentations
 * // for creating and emitting custom events fullstack.
 * events.on("game-over", (payload) => {
 *   // Do something about the game over event.
 * });
 *
 * // Register the interceptor with the network.
 * network.register(events);
 * ```
 *
 * TODO-DOC
 *
 * @noInheritDoc
 */
export class Events extends Map<string, EventHandler> implements NetIntercept {
  /**
   * The network intercept implementation for events.
   *
   * DO NOT CALL THIS METHOD OR CHANGE IT UNLESS YOU KNOW WHAT YOU ARE DOING.
   *
   * @hidden
   * @param message The message to intercept.
   */
  public onMessage = (message: MessageProtocol) => {
    switch (message.type) {
      case "EVENT": {
        const { events } = message;

        events.forEach((e: any) => {
          this.handle(e.name, e.payload);
        });

        return;
      }
    }
  };

  /**
   * Synonym for {@link on}, adds a listener to a Voxelize server event.
   * If the payload cannot be parsed by JSON, `null` is set.
   *
   * @param name The name of the event to listen on. Case sensitive.
   * @param handler What to do when this event is received?
   */
  public addEventListener = (name: string, handler: EventHandler) => {
    this.on(name, handler);
  };

  /**
   * Synonym for {@link addEventListener}, adds a listener to a Voxelize server event.
   * If the payload cannot be parsed by JSON, `null` is set.
   *
   * @param name The name of the event to listen on. Case sensitive.
   * @param handler What to do when this event is received?
   */
  public on = (name: string, handler: EventHandler) => {
    if (this.has(name)) {
      console.warn(
        `Registering handler for ${name} canceled: handler already exists.`
      );
      return;
    }

    this.set(name, handler);
  };

  /**
   * The handler for network packages to distribute to the event handlers.
   *
   * @hidden
   */
  public handle = (name: string, payload: string) => {
    const handler = this.get(name);

    if (!handler) {
      console.warn(
        `Received Voxelize event of "${name}", but no handlers are registered!`
      );
      return;
    }

    let deserialized: any;
    try {
      deserialized = JSON.parse(payload);
    } catch {
      console.error(`Could not serialize event payload of ${name}: ${payload}`);
      return;
    }

    handler(deserialized);
  };
}
