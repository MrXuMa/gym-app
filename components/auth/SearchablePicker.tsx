import React from 'react';
import { Platform, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextStyle, Pressable, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.4)',
  },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 10,
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
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={homeTheme.colors.mutedForeground}
        />
      </View>

      {isOpen ? (
        <View style={[styles.dropdown, dropdownStyle]}>
          <ScrollView style={styles.dropdownList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {options.map((option) => (
              <Pressable
                key={option.value}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => onSelect(option)}
              >
                <Text style={styles.optionText}>{option.label}</Text>
              </Pressable>
            ))}
            {options.length === 0 ? (
              <View style={styles.option}>
                <Text style={styles.optionMuted}>{noMatchText}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
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
    paddingRight: 12,
  },
  input: {
    minWidth: 0,
    flexShrink: 1,
  },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    zIndex: 70,
    maxHeight: 180,
    borderRadius: homeTheme.radius.input,
    borderWidth: 1,
    borderColor: homeTheme.colors.border,
    backgroundColor: homeTheme.colors.card,
    overflow: 'hidden',
    ...dropdownShadow,
  },
  dropdownList: {
    maxHeight: 180,
  },
  option: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: homeTheme.colors.border,
  },
  optionPressed: {
    backgroundColor: homeTheme.colors.muted,
  },
  optionText: {
    color: homeTheme.colors.foreground,
    fontSize: 15,
    fontWeight: '500',
  },
  optionMuted: {
    color: homeTheme.colors.mutedForeground,
    fontSize: 14,
  },
});
