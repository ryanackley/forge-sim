import { F as ForgeReconciler, R as React, l as label, r as reactExports, o as outExports, a as outExports$1 } from './chunks/shared-Dyv9WOwu.js';

// Canonical multi-entry page, shaped after the Forge "Bundling multi-entry
// frontend with Vite" example: named component, invoke in an effect,
// React.StrictMode around the root.
const Home = ({
  title
}) => {
  const [data, setData] = reactExports.useState(null);
  reactExports.useEffect(() => {
    outExports.invoke('summary').then(response => setData(response));
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(outExports$1.Text, null, title), /*#__PURE__*/React.createElement(outExports$1.Text, null, data ?? 'Loading...'));
};
ForgeReconciler.render(/*#__PURE__*/React.createElement(React.StrictMode, null, /*#__PURE__*/React.createElement(Home, {
  title: label('home')
})));

export { Home };
