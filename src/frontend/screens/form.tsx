// The form screen: one text question per field, asked in order.

import { Box, Text, useInput } from 'ink';
import { TextPrompt } from 'inkstand';
import type { ReactElement } from 'react';
import { useState } from 'react';
import type { Field } from '../explorer/forms';

/** The form contract. */
export interface FormScreenProps {
  /** The screen title. */
  title: string;
  /** The fields, in question order. */
  fields: Field[];
  /** Called with the answers by field key. */
  onSubmit: (answers: Record<string, string>) => void;
  /** Called when the user cancels with escape. */
  onCancel: () => void;
}

/**
 * Renders the form: the answered fields so far, then the current question.
 *
 * @param props - The component props.
 * @returns The form element.
 */
export function FormScreen(props: FormScreenProps): ReactElement {
  const { answers, index, field, answer } = useForm(props);
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      props.onCancel();
    }
  });
  return (
    <Box
      borderColor="cyan"
      borderStyle="round"
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color="cyan">
        {props.title} (esc cancels)
      </Text>
      {props.fields.slice(0, index).map((done) => (
        <Text dimColor key={done.key}>
          {done.label}: {answers[done.key]}
        </Text>
      ))}
      {field !== undefined && (
        <Question
          field={field}
          key={field.key}
          onAnswer={answer}
          onCancel={props.onCancel}
        />
      )}
    </Box>
  );
}

/**
 * Owns the answers and the current field.
 *
 * @param props - The form props.
 * @returns The answers so far, the field index, the field, and the answer
 * function that moves on or submits.
 */
function useForm(props: FormScreenProps): {
  answers: Record<string, string>;
  index: number;
  field: Field | undefined;
  answer: (value: string) => void;
} {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const field = props.fields[index];
  const answer = (value: string): void => {
    if (field === undefined) {
      return;
    }
    const next = { ...answers, [field.key]: value };
    if (index + 1 >= props.fields.length) {
      props.onSubmit(next);
      return;
    }
    setAnswers(next);
    setIndex(index + 1);
  };
  return { answers, index, field, answer };
}

/**
 * Renders one question. An empty answer takes the fallback, or is accepted
 * as empty for an optional field.
 *
 * @param props - The component props.
 * @param props.field - The field.
 * @param props.onAnswer - Called with the answer.
 * @param props.onCancel - Called when the user cancels.
 * @returns The question element.
 */
function Question(props: {
  field: Field;
  onAnswer: (value: string) => void;
  onCancel: () => void;
}): ReactElement {
  const { field } = props;
  const submit = (raw: string): void => {
    const trimmed = raw.trim();
    const value = trimmed === '' ? (field.fallback ?? '') : trimmed;
    if (value !== '' || field.optional === true) {
      props.onAnswer(value);
    }
  };
  const hint =
    field.fallback === undefined
      ? field.optional === true
        ? 'optional'
        : undefined
      : field.fallback;
  return (
    <TextPrompt
      hint={hint}
      label={field.label}
      onCancel={props.onCancel}
      onSubmit={submit}
    />
  );
}
