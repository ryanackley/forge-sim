/**
 * ForgeEditors — ChromelessEditor & CommentEditor using @atlaskit/editor-core
 *
 * Maps Forge UIKit editor props to the real Atlaskit ComposableEditor.
 * Both editors input/output ADF (JSONDocNode).
 */
import React, { useCallback, useRef } from 'react';
import { ComposableEditor } from '@atlaskit/editor-core/composable-editor';
import { useUniversalPreset } from '@atlaskit/editor-core/preset-universal';

// ── Types ──────────────────────────────────────────────────────────────

interface ForgeFeatures {
  blockType?: boolean;
  textFormatting?: boolean;
  list?: boolean;
  textColor?: boolean;
  hyperLink?: boolean;
  codeBlock?: boolean;
  insertBlock?: boolean;
  quickInsert?: boolean;
}

interface ChromelessEditorProps {
  defaultValue?: any; // JSONDocNode (ADF)
  features?: ForgeFeatures;
  isDisabled?: boolean;
  onChange?: (value?: any) => void;
}

interface CommentEditorProps extends ChromelessEditorProps {
  onSave?: (value?: any) => void;
  onCancel?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Extract ADF from ProseMirror editor view */
function getAdfFromView(editorView: any) {
  try {
    const doc = editorView.state.doc.toJSON();
    return { version: 1, type: 'doc', content: doc.content };
  } catch {
    return undefined;
  }
}

// ── ChromelessEditor ───────────────────────────────────────────────────

export function ForgeChromelessEditor({
  defaultValue,
  features,
  isDisabled,
  onChange,
}: ChromelessEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleChange = useCallback((editorView: any) => {
    if (onChangeRef.current) {
      onChangeRef.current(getAdfFromView(editorView));
    }
  }, []);

  const preset = useUniversalPreset({
    props: {
      appearance: 'chromeless',
      defaultValue,
      disabled: isDisabled,
      quickInsert: features?.quickInsert !== false,
    },
  });

  return (
    <ComposableEditor
      preset={preset}
      appearance="chromeless"
      defaultValue={defaultValue}
      disabled={isDisabled}
      onChange={handleChange}
    />
  );
}

// ── CommentEditor ──────────────────────────────────────────────────────

export function ForgeCommentEditor({
  defaultValue,
  features,
  isDisabled,
  onChange,
  onSave,
  onCancel,
}: CommentEditorProps) {
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  const editorViewRef = useRef<any>(null);

  const handleChange = useCallback((editorView: any) => {
    editorViewRef.current = editorView;
    if (onChangeRef.current) {
      onChangeRef.current(getAdfFromView(editorView));
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!onSaveRef.current) return;
    const adf = editorViewRef.current
      ? getAdfFromView(editorViewRef.current)
      : undefined;
    onSaveRef.current(adf);
  }, []);

  const preset = useUniversalPreset({
    props: {
      appearance: 'comment',
      defaultValue,
      disabled: isDisabled,
      quickInsert: features?.quickInsert !== false,
    },
  });

  return (
    <div>
      <ComposableEditor
        preset={preset}
        appearance="comment"
        defaultValue={defaultValue}
        disabled={isDisabled}
        onChange={handleChange}
      />
      {(onSave || onCancel) && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '6px 12px',
                borderRadius: '3px',
                border: 'none',
                background: '#F4F5F7',
                color: '#172B4D',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={handleSave}
              style={{
                padding: '6px 12px',
                borderRadius: '3px',
                border: 'none',
                background: '#0052CC',
                color: 'white',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Save
            </button>
          )}
        </div>
      )}
    </div>
  );
}
