export type PickerOption = {
  label: string;
  value: string;
};

export function calculateAge(birthday: string) {
  const birthDate = new Date(`${birthday}T00:00:00`);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  age = hasHadBirthdayThisYear ? age : age - 1;

  return age >= 0 ? age : null;
}

export function formatHeight(totalInches: number) {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;

  return `${feet}'${inches}`;
}

export const HEIGHT_OPTIONS = Array.from({ length: 8 * 12 - 3 * 12 + 1 }, (_, index) => {
  const totalInches = 3 * 12 + index;

  return {
    label: formatHeight(totalInches),
    value: String(totalInches),
  };
});

export const MONTH_OPTIONS = [
  { label: 'Jan', value: '01' },
  { label: 'Feb', value: '02' },
  { label: 'Mar', value: '03' },
  { label: 'Apr', value: '04' },
  { label: 'May', value: '05' },
  { label: 'Jun', value: '06' },
  { label: 'Jul', value: '07' },
  { label: 'Aug', value: '08' },
  { label: 'Sep', value: '09' },
  { label: 'Oct', value: '10' },
  { label: 'Nov', value: '11' },
  { label: 'Dec', value: '12' },
];

export const CURRENT_YEAR = new Date().getFullYear();
export const YEAR_OPTIONS = Array.from({ length: 121 }, (_, index) => String(CURRENT_YEAR - index));

export function getDaysInMonth(month: string, year: string) {
  if (!month) {
    return 31;
  }

  const monthNumber = Number.parseInt(month, 10);
  const yearNumber = year ? Number.parseInt(year, 10) : CURRENT_YEAR;

  return new Date(yearNumber, monthNumber, 0).getDate();
}

export function buildBirthday(month: string, day: string, year: string) {
  return month && day && year ? `${year}-${month}-${day}` : '';
}

export function matchesBasicSearch(label: string, value: string, search: string) {
  const query = search.trim().toLowerCase();

  return !query || label.toLowerCase().startsWith(query) || value.toLowerCase().startsWith(query);
}

export function matchesHeightSearch(label: string, search: string) {
  const query = search.trim().toLowerCase();

  if (!query) {
    return true;
  }

  const normalizedLabel = label.toLowerCase();
  const compactLabel = normalizedLabel.replace("'", '');

  return /^\d$/.test(query)
    ? normalizedLabel.startsWith(`${query}'`)
    : normalizedLabel.startsWith(query) || compactLabel.startsWith(query.replace("'", ''));
}
