import { STAGE } from './config';

/** Validation questions of the current stage (review doc, stage E1). Ids match the review items. */
export interface Question {
  id: string;
  text: string;
  options: string[];
  /** Optional free-text follow-up shown when this option is chosen. */
  followUp?: { when: string; placeholder: string };
}

/** E2–E8 were built together (decision 05/10): one combined set, from the review doc's questions for each stage. */
export const DAILY: Question[] = [
  { id: `${STAGE}.d1`, text: 'Does the real you recorded today represent the day?', options: ['1', '2', '3', '4', '5'] },
  { id: `${STAGE}.d2`, text: 'Did you record live or afterwards?', options: ['Live', 'Mixed', 'All afterwards'] },
  { id: `${STAGE}.d3`, text: 'Were the tasks in your blocks the ones you did?', options: ['1', '2', '3', '4', '5', 'No tasks'] },
  { id: `${STAGE}.d4`, text: 'Used focus today? If not, why?', options: ['Used it', 'Forgot', 'Did not need', 'Gets in the way'] },
];

export const RETRO: Question[] = [
  { id: `${STAGE}.r1`, text: 'Would you miss the app if it disappeared tomorrow?', options: ['1', '2', '3', '4', '5'] },
  { id: `${STAGE}.r2`, text: 'Did closing the day become a habit?', options: ['1', '2', '3', '4', '5'] },
  { id: `${STAGE}.r3`, text: 'What took the most work?', options: ['Remembering to record', 'Fixing times', 'Choosing areas', 'Nothing'] },
  { id: `${STAGE}.r4`, text: 'Did changing the plan during the day feel easy?', options: ['1', '2', '3', '4', '5'] },
  { id: `${STAGE}.r5`, text: 'What still makes you go to the desktop?', options: ['Nothing', 'Planning', 'Editing times', 'Tasks'] },
];

export const SCALE_HINT = '1 = not at all · 5 = completely';
