import { STAGE } from './config';

/** Validation questions of the current stage (review doc, stage E1). Ids match the review items. */
export interface Question {
  id: string;
  text: string;
  options: string[];
  /** Optional free-text follow-up shown when this option is chosen. */
  followUp?: { when: string; placeholder: string };
}

export const DAILY: Question[] = [
  { id: `${STAGE}.d1`, text: 'How many times did you check Now / Next today?', options: ['0', '1–2', '3–5', '6+'] },
  { id: `${STAGE}.d2`, text: 'Did the day follow the template, broadly?', options: ['1', '2', '3', '4', '5'] },
  { id: `${STAGE}.d3`, text: 'Did any template block need the same fix again?', options: ['Yes', 'No'], followUp: { when: 'Yes', placeholder: 'Which block?' } },
];

export const RETRO: Question[] = [
  { id: `${STAGE}.r1`, text: 'Would you miss the app if it disappeared tomorrow?', options: ['1', '2', '3', '4', '5'] },
  { id: `${STAGE}.r2`, text: 'Does the current Weekday template represent your routine?', options: ['1', '2', '3', '4', '5'] },
  { id: `${STAGE}.r3`, text: 'Where did you look more: desktop or phone?', options: ['Desktop', 'Phone', 'Equal'] },
];

export const SCALE_HINT = '1 = not at all · 5 = completely';
