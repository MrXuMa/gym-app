import { homeTheme } from '@/constants/theme';
import { useMemo } from 'react';
import { StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';

type MarkdownTextProps = {
  children: string;
  style?: TextStyle;
  containerStyle?: ViewStyle;
};

type Block =
  | { type: 'paragraph'; lines: string[] }
  | { type: 'bullet'; items: string[] }
  | { type: 'ordered'; items: string[] }
  | { type: 'heading'; level: 1 | 2 | 3; text: string };

const headingSizes: Record<1 | 2 | 3, number> = { 1: 20, 2: 17, 3: 15 };

function parseBlocks(source: string): Block[] {
  const normalized = source.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return [];
  }

  const blocks: Block[] = [];
  const lines = normalized.split('\n');
  let index = 0;

  const flushParagraph = (buffer: string[]) => {
    if (buffer.length === 0) {
      return;
    }
    blocks.push({ type: 'paragraph', lines: [...buffer] });
    buffer.length = 0;
  };

  const paragraphBuffer: string[] = [];

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(paragraphBuffer);
      index += 1;
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph(paragraphBuffer);
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, text: headingMatch[2] });
      index += 1;
      continue;
    }

    const bulletMatch = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (bulletMatch) {
      flushParagraph(paragraphBuffer);
      const items: string[] = [];
      while (index < lines.length) {
        const bulletLine = lines[index].trim();
        const itemMatch = /^[-*+]\s+(.+)$/.exec(bulletLine);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[1]);
        index += 1;
      }
      blocks.push({ type: 'bullet', items });
      continue;
    }

    const orderedMatch = /^(\d+)[.)]\s+(.+)$/.exec(trimmed);
    if (orderedMatch) {
      flushParagraph(paragraphBuffer);
      const items: string[] = [];
      while (index < lines.length) {
        const orderedLine = lines[index].trim();
        const itemMatch = /^(\d+)[.)]\s+(.+)$/.exec(orderedLine);
        if (!itemMatch) {
          break;
        }
        items.push(itemMatch[2]);
        index += 1;
      }
      blocks.push({ type: 'ordered', items });
      continue;
    }

    paragraphBuffer.push(line);
    index += 1;
  }

  flushParagraph(paragraphBuffer);
  return blocks;
}

type InlineSegment = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

function parseInline(text: string): InlineSegment[] {
  const pattern =
    /(\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*(.+?)\*|_(.+?)_)/g;

  const segments: InlineSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    if (match[2] || match[3]) {
      segments.push({ text: match[2] ?? match[3] ?? '', bold: true });
    } else if (match[4]) {
      segments.push({ text: match[4], code: true });
    } else if (match[5] || match[6]) {
      segments.push({ text: match[5] ?? match[6] ?? '', italic: true });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  if (segments.length === 0) {
    segments.push({ text });
  }

  return segments;
}

function InlineText({ text, baseStyle }: { text: string; baseStyle: TextStyle }) {
  const segments = useMemo(() => parseInline(text), [text]);

  return (
    <Text style={baseStyle}>
      {segments.map((segment, index) => {
        if (!segment.bold && !segment.italic && !segment.code) {
          return <Text key={index}>{segment.text}</Text>;
        }

        return (
          <Text
            key={index}
            style={[
              segment.bold ? styles.bold : null,
              segment.italic ? styles.italic : null,
              segment.code ? styles.code : null,
            ]}>
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}

export function MarkdownText({ children, style, containerStyle }: MarkdownTextProps) {
  const blocks = useMemo(() => parseBlocks(children), [children]);
  const baseStyle = useMemo(() => [styles.base, style], [style]);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {blocks.map((block, blockIndex) => {
        switch (block.type) {
          case 'heading':
            return (
              <InlineText
                key={blockIndex}
                text={block.text}
                baseStyle={[
                  baseStyle,
                  styles.heading,
                  { fontSize: headingSizes[block.level], fontWeight: '700' },
                ]}
              />
            );

          case 'paragraph':
            return (
              <Text key={blockIndex} style={baseStyle}>
                {block.lines.map((line, lineIndex) => (
                  <Text key={lineIndex}>
                    {lineIndex > 0 ? '\n' : null}
                    <InlineText text={line} baseStyle={baseStyle} />
                  </Text>
                ))}
              </Text>
            );

          case 'bullet':
            return (
              <View key={blockIndex} style={styles.list}>
                {block.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.listRow}>
                    <Text style={[baseStyle, styles.listMarker]}>{'\u2022'}</Text>
                    <View style={styles.listContent}>
                      <InlineText text={item} baseStyle={baseStyle} />
                    </View>
                  </View>
                ))}
              </View>
            );

          case 'ordered':
            return (
              <View key={blockIndex} style={styles.list}>
                {block.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.listRow}>
                    <Text style={[baseStyle, styles.listMarker]}>{`${itemIndex + 1}.`}</Text>
                    <View style={styles.listContent}>
                      <InlineText text={item} baseStyle={baseStyle} />
                    </View>
                  </View>
                ))}
              </View>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  base: {
    color: homeTheme.colors.cardForeground,
    fontSize: 14,
    lineHeight: 21,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: homeTheme.colors.muted,
    color: homeTheme.colors.accentForeground,
  },
  heading: {
    color: homeTheme.colors.foreground,
  },
  list: {
    gap: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  listMarker: {
    minWidth: 18,
    fontWeight: '600',
    color: homeTheme.colors.mutedForeground,
  },
  listContent: {
    flex: 1,
  },
});
