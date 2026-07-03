/**
 * A UIKit app that (incorrectly) renders a raw HTML element.
 *
 * Real Forge UI Kit rejects this — apps are restricted to components
 * exported from '@forge/react'. Used to verify the sim matches (UIK-003)
 * instead of silently passing the host element through.
 */
import ForgeReconciler, { Text } from '@forge/react';

const RawHtmlApp = () => (
  <>
    <Text>Legit UIKit text</Text>
    <div>this is raw HTML and must be rejected</div>
  </>
);

ForgeReconciler.render(<RawHtmlApp />);
