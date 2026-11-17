// Machine speed test (spec 046): a fixed calculation on one thread, five runs,
// then the same calculation on four threads at once. Prints one line of JSON.
// Times are milliseconds; lower is faster.
const os = require('os');
const { Worker, isMainThread, parentPort } = require('worker_threads');

const ITERATIONS = 3e8;
const SINGLE_RUNS = 5;
const PARALLEL_THREADS = 4;

const runOnce = () => {
  const start = process.hrtime.bigint();
  let acc = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    acc = (acc + i * 7) % 1000003;
  }
  return Math.round(Number(process.hrtime.bigint() - start) / 1e6);
};

const runInWorker = () =>
  new Promise((resolve, reject) => {
    const worker = new Worker(__filename);
    worker.once('message', resolve);
    worker.once('error', reject);
  });

const main = async () => {
  const single = Array.from({ length: SINGLE_RUNS }, runOnce);
  const wallStart = process.hrtime.bigint();
  const parallel = await Promise.all(Array.from({ length: PARALLEL_THREADS }, runInWorker));
  const parallelWallMs = Math.round(Number(process.hrtime.bigint() - wallStart) / 1e6);

  console.log(
    JSON.stringify({
      host: os.hostname(),
      atUtc: new Date().toISOString(),
      node: process.version,
      singleMs: single,
      singleBestMs: Math.min(...single),
      parallelMs: parallel,
      parallelWallMs,
    }),
  );
};

if (isMainThread) {
  main();
} else {
  parentPort.postMessage(runOnce());
}
