// The state machine driving the /profile add wizard steps.

import { DEFAULT_SCOPES, type Profile } from '../../engine/engine';

/** The answers the wizard collects. */
export interface ProfileAnswers {
  /** Profile name. */
  name: string;
  /** Base URL of the pillarbox backend. */
  backend: string;
  /** Issuer URL of the identity provider. */
  issuer: string;
  /** The public client pbctl authenticates as. */
  clientId: string;
  /** The scopes, space separated. */
  scopes: string;
  /** Whether to verify TLS certificates. */
  tlsVerify: boolean;
}

type Step = 'name' | 'backend' | 'issuer' | 'clientId' | 'scopes' | 'tls';

/** One wizard question: how to render it, how to apply it, where to go next. */
export interface Question {
  /** The input kind. */
  kind: 'text' | 'select';
  /** The question label. */
  label: string;
  /** The value an empty text input falls back to. */
  fallback?: string;
  /** The selectable items of a select question. */
  items?: { label: string; value: boolean }[];
  /** The step that follows. Undefined means the wizard is complete. */
  next?: Step;
  /**
   * Merges the answer into the collected answers. The default stores the
   * value as a string under the step id.
   */
  apply?: (
    answers: Partial<ProfileAnswers>,
    value: string | boolean,
  ) => Partial<ProfileAnswers>;
}

const QUESTIONS: Record<Step, Question> = {
  name: {
    kind: 'text',
    label: 'Profile name',
    fallback: 'default',
    next: 'backend',
  },
  backend: {
    kind: 'text',
    label: 'Backend URL',
    fallback: 'http://localhost:8080',
    next: 'issuer',
  },
  issuer: {
    kind: 'text',
    label: 'Identity provider issuer',
    fallback: 'http://localhost:8081/realms/pillarbox',
    next: 'clientId',
  },
  clientId: {
    kind: 'text',
    label: 'Client id',
    fallback: 'pillarbox-api',
    next: 'scopes',
  },
  scopes: {
    kind: 'text',
    label: 'Scopes',
    fallback: DEFAULT_SCOPES.join(' '),
    next: 'tls',
  },
  tls: {
    kind: 'select',
    label: 'Verify TLS certificates?',
    items: [
      { label: 'yes', value: true },
      { label: 'no', value: false },
    ],
    apply: (answers, value) => ({ ...answers, tlsVerify: value === true }),
  },
};

/** Executes the wizard questions: holds the answers and the current step. */
export class ProfileAddMachine {
  /** The current step. */
  readonly step: Step;
  /** The answers collected so far. */
  private readonly answers: Partial<ProfileAnswers>;
  /** The completed answers, set when the wizard is done. */
  readonly result?: ProfileAnswers;

  /**
   * Creates a machine state.
   *
   * @param step - The current step.
   * @param answers - The answers collected so far.
   * @param result - The completed answers when the wizard is done.
   */
  private constructor(
    step: Step,
    answers: Partial<ProfileAnswers>,
    result?: ProfileAnswers,
  ) {
    this.step = step;
    this.answers = answers;
    this.result = result;
  }

  /**
   * Starts the wizard at the first question.
   *
   * @param initial - Answers that become the fallbacks of their questions.
   * @returns The starting machine state.
   */
  static start(initial: Partial<ProfileAnswers> = {}): ProfileAddMachine {
    return new ProfileAddMachine('name', initial);
  }

  /**
   * Returns the question of the current step.
   *
   * @returns The question. A text question whose field already has an answer
   * uses that answer as fallback, so enter keeps it.
   */
  get question(): Question {
    const question = QUESTIONS[this.step];
    const previous = this.answers[this.step as keyof ProfileAnswers];
    if (question.kind === 'text' && typeof previous === 'string') {
      return { ...question, fallback: previous };
    }
    return question;
  }

  /**
   * Merges answers in without moving, so detected values become fallbacks.
   *
   * @param answers - The answers to merge.
   * @returns The machine state at the same step.
   */
  withAnswers(answers: Partial<ProfileAnswers>): ProfileAddMachine {
    return new ProfileAddMachine(this.step, { ...this.answers, ...answers });
  }

  /**
   * Applies the answer of the current step.
   *
   * @param value - The text answer or the selected value.
   * @returns The next machine state, carrying the result when complete.
   */
  answer(value: string | boolean): ProfileAddMachine {
    const question = QUESTIONS[this.step];
    const answers =
      question.apply === undefined
        ? { ...this.answers, [this.step]: String(value) }
        : question.apply(this.answers, value);
    if (question.next === undefined) {
      return new ProfileAddMachine(
        this.step,
        answers,
        answers as ProfileAnswers,
      );
    }
    return new ProfileAddMachine(question.next, answers);
  }
}

/**
 * Turns the wizard answers into a profile.
 *
 * @param answers - The completed answers.
 * @returns The profile to save.
 */
export function toProfile(answers: ProfileAnswers): Profile {
  return {
    name: answers.name,
    backend: answers.backend.replace(/\/+$/, ''),
    issuer: answers.issuer.replace(/\/+$/, ''),
    clientId: answers.clientId,
    scopes: answers.scopes.split(/\s+/).filter((scope) => scope !== ''),
    tlsVerify: answers.tlsVerify,
  };
}
