// The /profile add wizard UI: renders the machine's questions.

import { Box, Text, useInput } from 'ink';
import { Select, TextPrompt } from 'inkstand';
import type { ReactElement } from 'react';
import { useState } from 'react';
import type { IdentityProviderHint } from '../../engine/engine';
import {
  ProfileAddMachine,
  type ProfileAnswers,
  type Question,
} from './profile-add-machine';

/** The wizard contract. */
export interface ProfileAddWizardProps {
  /** Called with the answers when the wizard completes. */
  onSubmit: (answers: ProfileAnswers) => void;
  /** Called when the user cancels with escape. */
  onCancel: () => void;
  /** Looks up the identity provider of a backend to pre-fill the defaults. */
  detect: (backend: string) => Promise<IdentityProviderHint | undefined>;
}

/** The wizard state: the machine, plus what the detection is doing. */
interface WizardState {
  /** The current machine state. */
  machine: ProfileAddMachine;
  /** Whether the detection is running. */
  detecting: boolean;
  /** What the detection found, shown under the title. */
  detected?: string;
}

/**
 * Renders the connect wizard.
 *
 * @param props - The component props.
 * @returns The wizard element.
 */
export function ProfileAddWizard(props: ProfileAddWizardProps): ReactElement {
  const { state, answer } = useWizard(props);
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
        Connect to a backend (esc or ctrl+c to cancel)
      </Text>
      {state.detected !== undefined && <Text dimColor>{state.detected}</Text>}
      {state.detecting ? (
        <Text dimColor>Detecting the identity provider…</Text>
      ) : (
        <QuestionView
          key={state.machine.step}
          onAnswer={answer}
          onCancel={props.onCancel}
          question={state.machine.question}
        />
      )}
    </Box>
  );
}

/**
 * Owns the wizard state and applies answers, running the detection after
 * the backend step.
 *
 * @param props - The wizard props.
 * @returns The state and the answer handler.
 */
function useWizard(props: ProfileAddWizardProps): {
  state: WizardState;
  answer: (value: string | boolean) => void;
} {
  const [state, setState] = useState<WizardState>({
    machine: ProfileAddMachine.start(),
    detecting: false,
  });
  const answer = (value: string | boolean): void => {
    const next = state.machine.answer(value);
    if (next.result !== undefined) {
      props.onSubmit(next.result);
    } else if (state.machine.step === 'backend') {
      setState({ machine: next, detecting: true });
      void detectInto(props.detect, String(value), next, setState);
    } else {
      setState({ ...state, machine: next });
    }
  };
  return { state, answer };
}

/**
 * Runs the detection and feeds what it found into the machine as fallbacks.
 *
 * @param detect - The detection function.
 * @param backend - The backend URL just answered.
 * @param machine - The machine state at the issuer step.
 * @param setState - Updates the wizard state.
 * @returns Nothing.
 */
async function detectInto(
  detect: ProfileAddWizardProps['detect'],
  backend: string,
  machine: ProfileAddMachine,
  setState: (state: WizardState) => void,
): Promise<void> {
  const hint = await detect(backend);
  if (hint === undefined) {
    setState({
      machine,
      detecting: false,
      detected: 'No identity provider detected; the defaults are guesses.',
    });
    return;
  }
  setState({
    machine: machine.withAnswers(hint),
    detecting: false,
    detected: `Detected ${hint.issuer} (client ${hint.clientId}).`,
  });
}

/**
 * Renders one question.
 *
 * @param props - The component props.
 * @param props.question - The question to render.
 * @param props.onAnswer - Called with the answer.
 * @param props.onCancel - Called when the user cancels.
 * @returns The question element.
 */
function QuestionView(props: {
  question: Question;
  onAnswer: (value: string | boolean) => void;
  onCancel: () => void;
}): ReactElement {
  if (props.question.kind === 'select') {
    return (
      <Box flexDirection="column">
        <Text>{props.question.label}</Text>
        <Select
          highlightColor="cyan"
          items={props.question.items ?? []}
          onSelect={(value) => props.onAnswer(value)}
        />
      </Box>
    );
  }
  return <TextQuestion {...props} />;
}

/**
 * Renders one text question.
 *
 * @param props - The component props.
 * @param props.question - The question to render.
 * @param props.onAnswer - Called with the entered text.
 * @param props.onCancel - Called when the user cancels.
 * @returns The question element.
 */
function TextQuestion(props: {
  question: Question;
  onAnswer: (value: string) => void;
  onCancel: () => void;
}): ReactElement {
  const submit = (raw: string): void => {
    const trimmed = raw.trim();
    const final = trimmed === '' ? (props.question.fallback ?? '') : trimmed;
    if (final !== '') {
      props.onAnswer(final);
    }
  };
  return (
    <TextPrompt
      label={label(props.question)}
      onCancel={props.onCancel}
      onSubmit={submit}
    />
  );
}

/**
 * Builds the question label, with the fallback in brackets.
 *
 * @param question - The question to label.
 * @returns The label text.
 */
function label(question: Question): string {
  return question.fallback === undefined
    ? question.label
    : `${question.label} [${question.fallback}]`;
}
