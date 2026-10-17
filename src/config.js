// Department-wide lists shared by the API (for validation) and the browser
// (served from GET /api/me). Edit here, then redeploy.

export const FACILITY = 'SQH';

// Each location belongs to a care setting. Moving a case between settings
// (for example a ward to a clinic) is what makes it a discharge handover.
export const LOCATIONS = [
    { name: 'ICU-1', setting: 'inpatient' },
    { name: 'ICU-2', setting: 'inpatient' },
    { name: 'Surgical', setting: 'inpatient' },
    { name: 'Male medical', setting: 'inpatient' },
    { name: 'Female medical', setting: 'inpatient' },
    { name: 'Private', setting: 'inpatient' },
    { name: 'Neuro', setting: 'inpatient' },
    { name: 'Burns', setting: 'inpatient' },
    { name: 'PICU', setting: 'inpatient' },
    { name: 'NICU', setting: 'inpatient' },
    { name: 'Paediatric 1', setting: 'inpatient' },
    { name: 'Paediatric 2', setting: 'inpatient' },
    { name: 'Cardiology', setting: 'inpatient' },
    { name: 'OBYGN', setting: 'inpatient' },
    { name: 'Nutrition clinic', setting: 'outpatient' },
    { name: 'Obesity clinic', setting: 'outpatient' },
    { name: 'Paediatric clinic', setting: 'outpatient' },
    { name: 'Daycare', setting: 'outpatient' }
];

export const NEXT_ACTIONS = [
    'Initial assessment',
    'Routine follow-up',
    'Check intake',
    'Review nutrition plan',
    'Monitor EN/PN tolerance',
    'Discharge planning',
    'Outpatient review'
];

export const FEEDING_ROUTES = [
    'Oral diet',
    'Oral + supplements (ONS)',
    'Enteral (NG/NJ)',
    'Enteral (PEG/PEJ)',
    'Parenteral',
    'Mixed EN + PN',
    'Nil by mouth'
];

export const CLOSE_REASONS = [
    'Discharged — no follow-up required',
    'Nutrition follow-up complete',
    'Referred to primary care (PHC)',
    'Transferred to another hospital',
    'Entered in error'
];

export const DIRECTORY_CATEGORIES = ['Urgent', 'Our department', 'Wards', 'Clinics', 'Support services', 'Other'];

// Closed cases (and their activity log) are deleted this many days after closing.
export const RETENTION_DAYS = 90;

export const TIME_ZONE = 'Asia/Muscat';
