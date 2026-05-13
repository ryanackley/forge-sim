// N10 fixture: a macro that does NOT call useConfig().
// The waitForContent timeout hint should NOT suggest setMacroConfig for this.
import ForgeReconciler, { Text } from '@forge/react';

const App = () => <Text>Hello from a simple macro with no config.</Text>;

ForgeReconciler.render(<App />);
