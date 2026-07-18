// Eval-7 F4 fixture handlers. okRun prints (so tests can pin that handler
// console output surfaces through the sim console log during deploy-time
// fires); badRun returns a failing status per the scheduled-trigger
// { statusCode } contract.
export const okRun = async () => {
  console.log('sched handler says hi');
  return { statusCode: 204 };
};

export const badRun = async () => ({ statusCode: 500 });
