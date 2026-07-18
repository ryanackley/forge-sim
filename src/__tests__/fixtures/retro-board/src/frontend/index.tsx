// Minimal frontend stub — the retro-board fixture exercises the backend
// (resolvers, consumers, triggers). This file exists so the manifest's
// resource path resolves: since the deploy-honesty pass (eval-6 F3), a
// non-resolving resource is a deploy ERROR and sim.deploy() throws.
import React from 'react';
import ForgeReconciler, { Text } from '@forge/react';

const App = () => <Text>Retro Board</Text>;

ForgeReconciler.render(<App />);
