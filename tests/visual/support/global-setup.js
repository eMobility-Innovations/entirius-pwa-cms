// One id per run, inherited by the workers: report entries of an earlier run are dropped, not merged.
module.exports = () => {
  process.env.VISUAL_RUN_ID = new Date().toISOString();
};
