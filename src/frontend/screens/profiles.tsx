// The profile screen: the saved profiles, with login, create, default, delete.

import { Box, type Key, Text, useInput } from 'ink';
import { KeyBar, Select } from 'inkstand';
import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import {
  type Config,
  type IdentityProviderHint,
  type Profile,
  ProfileStore,
} from '../../engine/engine';
import { ProfileAddWizard } from './profile-add';
import { toProfile } from './profile-add-machine';

/** The screen contract. */
export interface ProfilesScreenProps {
  /** Looks up the identity provider of a backend, for the wizard. */
  detect: (backend: string) => Promise<IdentityProviderHint | undefined>;
  /** Called with the profile to log in to. */
  onLogin: (profile: Profile) => void;
  /** Called when the user closes the screen. */
  onCancel: () => void;
}

/** What the screen shows. */
type Phase =
  | { kind: 'list' }
  | { kind: 'wizard' }
  | { kind: 'delete'; profile: Profile };

/** The screen state the list keys act on. */
interface ListState {
  /** The saved configuration. */
  config: Config;
  /** The highlighted profile index. */
  highlight: number;
  /** Moves the highlight. */
  setHighlight: (index: number) => void;
  /** Changes the phase. */
  setPhase: (phase: Phase) => void;
  /** Reloads the configuration after a change. */
  refresh: () => void;
  /** The store. */
  store: ProfileStore;
}

/** The width profile names are padded to. */
const NAME_WIDTH = 16;

/**
 * Renders the profile screen. It starts on the wizard when no profile exists.
 *
 * @param props - The component props.
 * @returns The screen element.
 */
export function ProfilesScreen(props: ProfilesScreenProps): ReactElement {
  const { state, phase } = useProfileState();
  if (phase.kind === 'wizard') {
    return <Wizard screen={props} state={state} />;
  }
  if (phase.kind === 'delete') {
    return <DeleteConfirm profile={phase.profile} state={state} />;
  }
  return (
    <ProfileList
      onCancel={props.onCancel}
      onLogin={props.onLogin}
      state={state}
    />
  );
}

/**
 * Owns the store, the configuration, the highlight, and the phase.
 *
 * @returns The list state and the phase.
 */
function useProfileState(): { state: ListState; phase: Phase } {
  const store = useMemo(() => new ProfileStore(), []);
  const [config, setConfig] = useState(() => store.load());
  const [highlight, setHighlight] = useState(0);
  const [phase, setPhase] = useState<Phase>(() =>
    config.profiles.length === 0 ? { kind: 'wizard' } : { kind: 'list' },
  );
  const refresh = (): void => setConfig(store.load());
  return {
    state: { config, highlight, setHighlight, setPhase, refresh, store },
    phase,
  };
}

/**
 * Renders the wizard phase. Cancelling returns to the list, or closes the
 * screen when no profile exists yet.
 *
 * @param props - The component props.
 * @param props.screen - The screen props.
 * @param props.state - The list state.
 * @returns The wizard element.
 */
function Wizard(props: {
  screen: ProfilesScreenProps;
  state: ListState;
}): ReactElement {
  const { screen, state } = props;
  const empty = state.config.profiles.length === 0;
  return (
    <ProfileAddWizard
      detect={screen.detect}
      onCancel={() =>
        empty ? screen.onCancel() : state.setPhase({ kind: 'list' })
      }
      onSubmit={(answers) =>
        screen.onLogin(save(state.store, toProfile(answers)))
      }
    />
  );
}

/**
 * Saves a profile; the first one saved becomes the default.
 *
 * @param store - The store.
 * @param profile - The profile.
 * @returns The profile.
 */
function save(store: ProfileStore, profile: Profile): Profile {
  const first = store.load().profiles.length === 0;
  store.upsert(profile);
  if (first) {
    store.setDefault(profile.name);
  }
  return profile;
}

/**
 * Renders the list phase.
 *
 * @param props - The component props.
 * @param props.state - The list state.
 * @param props.onLogin - Called with the profile to log in to.
 * @param props.onCancel - Called when the user closes the screen.
 * @returns The list element.
 */
function ProfileList(props: {
  state: ListState;
  onLogin: (profile: Profile) => void;
  onCancel: () => void;
}): ReactElement {
  const { state } = props;
  const { profiles, defaultProfile } = state.config;
  useInput((input, key) => listKey(input, key, props));
  return (
    <Box
      borderColor="cyan"
      borderStyle="round"
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color="cyan">
        Profiles (esc closes)
      </Text>
      {profiles.length === 0 ? (
        <Text dimColor>No profiles. Press n to create one.</Text>
      ) : (
        profiles.map((profile, index) => (
          <Row
            highlighted={index === state.highlight}
            isDefault={profile.name === defaultProfile}
            key={profile.name}
            profile={profile}
          />
        ))
      )}
      <KeyBar
        actions={[
          { key: '↵', label: 'log in', disabled: profiles.length === 0 },
          { key: 'n', label: 'new' },
          { key: 'd', label: 'default', disabled: profiles.length === 0 },
          { key: 'x', label: 'delete', disabled: profiles.length === 0 },
        ]}
      />
    </Box>
  );
}

/**
 * Renders one profile row.
 *
 * @param props - The component props.
 * @param props.profile - The profile.
 * @param props.highlighted - Whether the row is highlighted.
 * @param props.isDefault - Whether the profile is the default.
 * @returns The row element.
 */
function Row(props: {
  profile: Profile;
  highlighted: boolean;
  isDefault: boolean;
}): ReactElement {
  return (
    <Text
      bold={props.highlighted}
      color={props.highlighted ? 'cyan' : undefined}
      dimColor={!props.highlighted}
    >
      {props.highlighted ? '❯ ' : '  '}
      {props.profile.name.padEnd(NAME_WIDTH)} {props.profile.backend}
      {props.isDefault ? '  (default)' : ''}
    </Text>
  );
}

/**
 * Applies one keystroke of the list phase.
 *
 * @param input - The typed character.
 * @param key - The special-key flags.
 * @param props - The list props.
 * @param props.state - The list state.
 * @param props.onLogin - Called with the profile to log in to.
 * @param props.onCancel - Called when the user closes the screen.
 * @returns Nothing.
 */
function listKey(
  input: string,
  key: Key,
  props: {
    state: ListState;
    onLogin: (profile: Profile) => void;
    onCancel: () => void;
  },
): void {
  const { state } = props;
  if (isCancel(input, key)) {
    props.onCancel();
    return;
  }
  if (input === 'n') {
    state.setPhase({ kind: 'wizard' });
    return;
  }
  const count = state.config.profiles.length;
  const profile = state.config.profiles[state.highlight];
  if (count > 0 && (key.upArrow || key.downArrow)) {
    const step = key.upArrow ? count - 1 : 1;
    state.setHighlight((state.highlight + step) % count);
  } else if (profile !== undefined) {
    profileKey(input, key, profile, props);
  }
}

/**
 * Reports whether a keystroke closes the screen.
 *
 * @param input - The typed character.
 * @param key - The special-key flags.
 * @returns Whether the keystroke is escape, `q`, or ctrl+c.
 */
function isCancel(input: string, key: Key): boolean {
  return key.escape || input === 'q' || (key.ctrl && input === 'c');
}

/**
 * Applies one keystroke that acts on the highlighted profile.
 *
 * @param input - The typed character.
 * @param key - The special-key flags.
 * @param profile - The highlighted profile.
 * @param props - The list props.
 * @param props.state - The list state.
 * @param props.onLogin - Called with the profile to log in to.
 * @returns Nothing.
 */
function profileKey(
  input: string,
  key: Key,
  profile: Profile,
  props: { state: ListState; onLogin: (profile: Profile) => void },
): void {
  if (key.return) {
    props.onLogin(profile);
  } else if (input === 'd') {
    props.state.store.setDefault(profile.name);
    props.state.refresh();
  } else if (input === 'x') {
    props.state.setPhase({ kind: 'delete', profile });
  }
}

/**
 * Renders the delete confirmation.
 *
 * @param props - The component props.
 * @param props.profile - The profile to delete.
 * @param props.state - The list state.
 * @returns The confirmation element.
 */
function DeleteConfirm(props: {
  profile: Profile;
  state: ListState;
}): ReactElement {
  const { state } = props;
  const back = (): void => state.setPhase({ kind: 'list' });
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      back();
    }
  });
  return (
    <Box
      borderColor="red"
      borderStyle="round"
      flexDirection="column"
      paddingX={1}
    >
      <Text color="red">Delete profile "{props.profile.name}"?</Text>
      <Select
        highlightColor="cyan"
        items={[
          { label: 'no', value: false },
          { label: 'yes, delete', value: true },
        ]}
        onSelect={(confirmed) => {
          if (confirmed) {
            state.store.remove(props.profile.name);
            state.refresh();
            state.setHighlight(0);
          }
          back();
        }}
      />
    </Box>
  );
}
