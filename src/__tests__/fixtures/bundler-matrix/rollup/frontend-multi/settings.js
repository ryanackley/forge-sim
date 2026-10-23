import { F as ForgeReconciler, R as React, r as reactExports, o as outExports, a as outExports$1, l as label } from './chunks/shared-47Si1RVz.js';

const Settings = () => {
  const [data, setData] = reactExports.useState(null);
  reactExports.useEffect(() => {
    outExports.invoke('summary').then(response => setData(response));
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(outExports$1.Text, null, label('settings')), /*#__PURE__*/React.createElement(outExports$1.Text, null, data ?? 'Loading...'));
};
ForgeReconciler.render(/*#__PURE__*/React.createElement(Settings, null));
