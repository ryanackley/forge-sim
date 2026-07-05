/**
 * A UIKit app exercising @forge/react/router — Router, Route, useNavigate,
 * useLocation, useParams.
 *
 * The loader routes the `@forge/react/router` subpath through forge-sim's
 * shim (which re-exports the real package), and Router's async
 * `view.createHistory()` resolves against the sim's in-memory bridge history.
 * Initial render shows Router's "History is not defined" SectionMessage until
 * the createHistory effect settles — tests must wait for routed content.
 */
import ForgeReconciler, { Text, Button } from '@forge/react';
import { Router, Route, useNavigate, useLocation, useParams } from '@forge/react/router';

const Home = () => {
  const navigate = useNavigate();
  return (
    <>
      <Text>Home page</Text>
      <Button onClick={() => navigate('/detail/TEST-1')}>Go to detail</Button>
    </>
  );
};

const Detail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  return (
    <>
      <Text>{`Detail for ${params.id}`}</Text>
      <Text>{`At ${location.pathname}`}</Text>
      <Button onClick={() => navigate(-1)}>Back</Button>
    </>
  );
};

const App = () => (
  <Router fallback={<Text>Not found</Text>}>
    <Route path="/">
      <Home />
    </Route>
    <Route path="/detail/:id">
      <Detail />
    </Route>
  </Router>
);

ForgeReconciler.render(<App />);
