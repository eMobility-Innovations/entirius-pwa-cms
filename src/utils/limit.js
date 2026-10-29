// At most `max` tasks in flight; the rest wait in order. `limit(task)` runs `task()` (returns a promise) when a slot is
// free and settles like it.
export function createLimiter(max) {
  let running = 0;
  const queue = [];

  function next() {
    if (running >= max || !queue.length) return;
    const { task, resolve, reject } = queue.shift();
    running += 1;
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        running -= 1;
        next();
      });
  }

  return (task) =>
    new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      next();
    });
}
