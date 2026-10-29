const { finishRun } = require("./ux-report");

// The @ux summary, rebuilt once after all workers finished (see finishRun).
module.exports = () => {
  finishRun(process.env.VISUAL_RUN_ID);
};
