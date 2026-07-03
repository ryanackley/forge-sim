/**
 * A UIKit app that (incorrectly) renders raw HTML elements.
 * Real Forge rejects this — the sim's test API / MCP surface must hard-fail
 * with UIKitRawHtmlError (spec UIK-003).
 */
import ForgeReconciler, { Text } from '@forge/react';

const App = () => {
  return (
    <>
      <Text>Legit UIKit text</Text>
      {/* @ts-expect-error — raw HTML is not part of @forge/react */}
      <div>this is raw HTML and must be rejected</div>
    </>
  );
};

ForgeReconciler.render(<App />);
