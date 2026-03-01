import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Sample Forge UIKit app that talks to a backend resolver.
 *
 * This is a realistic Forge app: the UI calls invoke() to fetch data
 * from the resolver, which in turn calls Jira APIs and uses KVS.
 */
import { useState, useEffect } from 'react';
import ForgeReconciler, { Text, Button, Stack, Box } from '@forge/react';
import { invoke } from '@forge/bridge';
const IssueViewerApp = () => {
    const [issue, setIssue] = useState(null);
    const [views, setViews] = useState(0);
    const [loading, setLoading] = useState(true);
    const loadIssue = async () => {
        setLoading(true);
        const result = await invoke('getIssue', { issueKey: 'TEST-1' });
        setIssue(result.issue);
        setViews(result.views);
        setLoading(false);
    };
    useEffect(() => {
        loadIssue();
    }, []);
    if (loading) {
        return _jsx(Text, { children: "Loading..." });
    }
    return (_jsxs(Stack, { children: [_jsx(Box, { children: _jsxs(Text, { children: ["Issue: ", issue?.key, " - ", issue?.summary] }) }), _jsx(Box, { children: _jsxs(Text, { children: ["Views: ", views] }) }), _jsx(Button, { onClick: loadIssue, children: "Refresh" })] }));
};
ForgeReconciler.render(_jsx(IssueViewerApp, {}));
//# sourceMappingURL=ui-app.js.map