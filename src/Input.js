export class Input {
  constructor(target = window) {
    this.queue = [];

    target.addEventListener("keydown", (event) => {
      const action = {
        arrowleft: "left",
        a: "left",
        arrowright: "right",
        d: "right",
        arrowup: "jump",
        w: "jump",
        arrowdown: "slide",
        s: "slide",
        " ": "zipline"
      }[event.key.toLowerCase()];

      if (action) {
        event.preventDefault();
        this.queue.push(action);
      }
    });
  }

  drain() {
    const actions = this.queue;
    this.queue = [];
    return actions;
  }
}
