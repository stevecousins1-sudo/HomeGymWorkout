// Machine exercise → cable/dumbbell/bodyweight equivalent
// All substitute names must exist in movements.js
export const MACHINE_SUBS = {
  'Pec deck':               'Cable fly',
  'Back extension':         'Good morning',
  'Reverse pec deck':       'Face pull',
  'Machine shoulder press': 'DB shoulder press',
  'Hack squat':             'Goblet squat',
  'Leg press':              'Bulgarian split squat',
  'Leg extension':          'Walking lunge',
  'Leg curl':               'DB Romanian DL',
  'Seated leg curl':        'Nordic curl',
  'Calf raise':             'DB calf raise',
  'Seated calf raise':      'DB calf raise',
};

export function applyMachineSubs(exerciseStrings) {
  return exerciseStrings.map(str => {
    const dashIdx = str.indexOf(' — ');
    const name = dashIdx === -1 ? str : str.slice(0, dashIdx);
    const rest = dashIdx === -1 ? '' : str.slice(dashIdx);
    const sub = MACHINE_SUBS[name.trim()];
    return sub ? sub + rest : str;
  });
}
