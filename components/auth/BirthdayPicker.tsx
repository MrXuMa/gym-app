import React, { useMemo, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { homeTheme } from '@/constants/theme';
import { SearchablePicker } from './SearchablePicker';
import {
  MONTH_OPTIONS,
  YEAR_OPTIONS,
  PickerOption,
  calculateAge,
  getDaysInMonth,
  matchesBasicSearch,
} from './pickerUtils';

type BirthdayPickerProps = {
  month: string;
  day: string;
  year: string;
  inputStyle: StyleProp<TextStyle>;
  onMonthChange: (value: string) => void;
  onDayChange: (value: string) => void;
  onYearChange: (value: string) => void;
};

export function BirthdayPicker({ month, day, year, inputStyle, onMonthChange, onDayChange, onYearChange }: BirthdayPickerProps) {
  const [monthSearch, setMonthSearch] = useState('');
  const [daySearch, setDaySearch] = useState('');
  const [yearSearch, setYearSearch] = useState('');
  const [openPicker, setOpenPicker] = useState<'month' | 'day' | 'year' | null>(null);
  const dayOptions = useMemo(
    () =>
      Array.from({ length: getDaysInMonth(month, year) }, (_, index) => {
        const value = String(index + 1).padStart(2, '0');
        return { label: value, value };
      }),
    [month, year]
  );
  const selectedMonthLabel = MONTH_OPTIONS.find((option) => option.value === month)?.label ?? '';
  const birthday = month && day && year ? `${year}-${month}-${day}` : '';
  const age = calculateAge(birthday);
  const filteredMonths = MONTH_OPTIONS.filter((option) => matchesBasicSearch(option.label, option.value, monthSearch));
  const filteredDays = dayOptions.filter((option) => matchesBasicSearch(option.label, option.value, daySearch));
  const filteredYears = YEAR_OPTIONS.map((option) => ({ label: option, value: option })).filter((option) =>
    matchesBasicSearch(option.label, option.value, yearSearch)
  );

  function clearInvalidDay(nextMonth: string, nextYear: string) {
    if (day && Number.parseInt(day, 10) > getDaysInMonth(nextMonth, nextYear)) {
      onDayChange('');
      setDaySearch('');
    }
  }

  return (
    <View style={styles.row}>
      <SearchablePicker
        placeholder="Month"
        valueLabel={selectedMonthLabel}
        search={monthSearch}
        options={filteredMonths}
        noMatchText="No matching month"
        isOpen={openPicker === 'month'}
        inputStyle={inputStyle}
        containerStyle={styles.picker}
        onOpen={() => setOpenPicker('month')}
        onSearchChange={(value) => {
          setMonthSearch(value);
          onMonthChange('');
          setOpenPicker('month');
        }}
        onSelect={(option: PickerOption) => {
          onMonthChange(option.value);
          setMonthSearch(option.label);
          clearInvalidDay(option.value, year);
          setOpenPicker(null);
        }}
      />

      <SearchablePicker
        placeholder="Day"
        valueLabel={day}
        search={daySearch}
        options={filteredDays}
        noMatchText="No matching day"
        isOpen={openPicker === 'day'}
        keyboardType="number-pad"
        inputStyle={inputStyle}
        containerStyle={styles.picker}
        onOpen={() => setOpenPicker('day')}
        onSearchChange={(value) => {
          setDaySearch(value);
          onDayChange('');
          setOpenPicker('day');
        }}
        onSelect={(option) => {
          onDayChange(option.value);
          setDaySearch(option.label);
          setOpenPicker(null);
        }}
      />

      <SearchablePicker
        placeholder="Year"
        valueLabel={year}
        search={yearSearch}
        options={filteredYears}
        noMatchText="No matching year"
        isOpen={openPicker === 'year'}
        keyboardType="number-pad"
        inputStyle={inputStyle}
        containerStyle={styles.picker}
        onOpen={() => setOpenPicker('year')}
        onSearchChange={(value) => {
          setYearSearch(value);
          onYearChange('');
          setOpenPicker('year');
        }}
        onSelect={(option) => {
          onYearChange(option.value);
          setYearSearch(option.label);
          clearInvalidDay(month, option.value);
          setOpenPicker(null);
        }}
      />

      <Text style={styles.age}>{age !== null && age >= 0 ? `Age ${age}` : 'Age'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    zIndex: 50,
  },
  picker: {
    minWidth: 0,
    zIndex: 60,
  },
  age: {
    color: homeTheme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'center',
    minWidth: 42,
    textAlign: 'right',
  },
});
