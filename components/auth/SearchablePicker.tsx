import React from 'react';
import { Platform, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { authPlaceholderColor, authStyles } from './authStyles';
import { homeTheme } from '@/constants/theme';
import { PickerOption } from './pickerUtils';

type SearchablePickerProps = {
  placeholder: string;
  valueLabel: string;
  search: string;
  options: PickerOption[];
  noMatchText: string;
  isOpen: boolean;
  keyboardType?: 'default' | 'number-pad' | 'numbers-and-punctuation';
  containerStyle?: StyleProp<ViewStyle>;
  dropdownStyle?: StyleProp<ViewStyle>;
  inputStyle: StyleProp<TextStyle>;
  onOpen: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (option: PickerOption) => void;
};

const dropdownShadow = Platform.select({
  web: {
    boxShadow: '0 12px 18px rgba(0, 0, 0, 0.28)',
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
  },
});

export function SearchablePicker({
  placeholder,
  valueLabel,
  search,
  options,
  noMatchText,
  isOpen,
  keyboardType = 'default',
  containerStyle,
  dropdownStyle,
  inputStyle,
  onOpen,
  onSearchChange,
  onSelect,
}: SearchablePickerProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[authStyles.field, styles.selectField]}>
        <TextInput
          value={search || valueLabel}
          onFocus={onOpen}
          onChangeText={onSearchChange}
          placeholder={placeholder}
          placeholderTextColor={authPlaceholderColor}
          autoCapitalize="none"
          keyboardType={keyboardType}
          style={[inputStyle, styles.input]}
        />
        <Text style={styles.arrow}>v</Text>
      </View>

      {isOpen && (
        <View style={[styles.dropdown, dropdownStyle]}>
          <ScrollView style={styles.dropdownList} nestedScrollEnabled>
            {options.map((option) => (
              <TouchableOpacity key={option.value} style={styles.option} onPress={() => onSelect(option)}>
                <Text style={styles.optionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            {options.length === 0 && (
              <View style={styles.option}>
                <Text style={styles.optionText}>{noMatchText}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  selectField: {
    marginBottom: 0,
    overflow: 'hidden',
    paddingRight: 10,
  },
  input: {
    minWidth: 0,
    flexShrink: 1,
  },
  arrow: {
    width: 14,
    color: homeTheme.colors.accent,
    fontWeight: '700',
    marginLeft: 6,
    textAlign: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    zIndex: 70,
    maxHeight: 180,
    borderRadius: homeTheme.radius.card,
    borderWidth: 1,
    borderColor: homeTheme.colors.surfaceBorder,
    backgroundColor: homeTheme.auth.cardBackground,
    overflow: 'hidden',
    ...dropdownShadow,
  },
  dropdownList: {
    maxHeight: 180,
  },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  optionText: {
    color: homeTheme.colors.textPrimary,
    fontWeight: '600',
  },
});
