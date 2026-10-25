// Eval-7 F4 fixture handlers. okRun prints (so tests can pin that handler
// console output surfaces through the sim console log during deploy-time
// fires) and returns a value — which per Forge's scheduled-trigger docs is
// IGNORED; badRun throws, the only way a scheduled fire can fail.
export const okRun = async () => {
  console.log('sched handler says hi');
  return { anything: 'ignored per Forge docs' };
};

export const badRun = async () => {
  throw new Error('sched boom');
};
