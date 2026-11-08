import { createStore } from "zustand/vanilla";
import { initialInterviewSnapshot, transition, type InterviewEvent, type InterviewSnapshot } from "./machine";

export function createInterviewStore() {
  const store = createStore<InterviewSnapshot>()(initialInterviewSnapshot);
  return {
    getState: store.getState,
    getInitialState: store.getInitialState,
    subscribe: store.subscribe,
    send(event: InterviewEvent) {
      store.setState((state) => transition(state, event), true);
    },
  };
}
