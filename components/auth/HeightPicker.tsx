import React, { useState } from 'react';
import { StyleProp, StyleSheet, TextStyle } from 'react-native';
import { SearchablePicker } from './SearchablePicker';
import { HEIGHT_OPTIONS, formatHeight, matchesHeightSearch } from './pickerUtils';

type HeightPickerProps = {
  value: string;
  inputStyle: StyleProp<TextStyle>;
  onChange: (value: string) => void;
};

export function HeightPicker({ value, inputStyle, onChange }: HeightPickerProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = value ? formatHeight(Number.parseInt(value, 10)) : '';
  const filteredOptions = HEIGHT_OPTIONS.filter((option) => matchesHeightSearch(option.label, search));

  return (
    <SearchablePicker
      placeholder="Height"
      valueLabel={selectedLabel}
      search={search}
      options={filteredOptions}
      noMatchText="No matching height"
      isOpen={isOpen}
      keyboardType="numbers-and-punctuation"
      inputStyle={inputStyle}
      containerStyle={styles.container}
      dropdownStyle={styles.dropdown}
      onOpen={() => setIsOpen(true)}
      onSearchChange={(text) => {
        setSearch(text);
        onChange('');
        setIsOpen(true);
      }}
      onSelect={(option) => {
        onChange(option.value);
        setSearch(option.label);
        setIsOpen(false);
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 30,
  },
  dropdown: {
    zIndex: 40,
  },
});
