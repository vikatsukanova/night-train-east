type Listener<Payload> = (payload: Payload) => void;
type Subscriptions<Events extends object> = {
	[Event in keyof Events]?: Set<Listener<Events[Event]>>;
};

export class EventBus<Events extends object> {
	private readonly subscriptions: Subscriptions<Events> = Object.create(null);

	on<Event extends keyof Events>(
		event: Event,
		listener: Listener<Events[Event]>,
	): () => void {
		const listeners =
			this.subscriptions[event] ?? new Set<Listener<Events[Event]>>();
		this.subscriptions[event] = listeners;
		const subscription: Listener<Events[Event]> = (payload) =>
			listener(payload);
		listeners.add(subscription);
		return () => {
			listeners.delete(subscription);
			if (listeners.size === 0 && this.subscriptions[event] === listeners) {
				delete this.subscriptions[event];
			}
		};
	}

	emit<Event extends keyof Events>(event: Event, payload: Events[Event]): void {
		const listeners = this.subscriptions[event];
		if (!listeners) return;

		// Snapshot so subscriptions added during dispatch take effect on the next emit.
		for (const listener of [...listeners]) {
			if (listeners.has(listener)) listener(payload);
		}
	}
}
