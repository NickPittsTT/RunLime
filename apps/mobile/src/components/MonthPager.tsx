import { Ionicons } from '@expo/vector-icons';
import { addMonths, monthGrid, monthLabel } from '@runlime/shared/events';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions, type ViewToken } from 'react-native';
import { colors } from '@runlime/ui-tokens';
import type { DayMark } from '@/lib/raceQuery';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_POSTPONED = '#FCD34D';
const DAY_CANCELLED = '#FCA5A5';

export interface YearMonth {
  year: number;
  month: number;
}

/** Month pages from January of `firstYear` for `count` months. */
export function monthPages(firstYear: number, count: number): YearMonth[] {
  return Array.from({ length: count }, (_, i) => addMonths({ year: firstYear, month: 1 }, i));
}

/**
 * N3: swipeable month view (January to December, this year and next). Days with races are marked;
 * tapping a day selects it. Arrow buttons give the same paging without swiping (screen readers).
 */
export function MonthPager({
  firstYear,
  initial,
  raceDays,
  today,
  selected,
  onSelect,
}: {
  firstYear: number;
  initial: YearMonth;
  /** Local date keys ("YYYY-MM-DD") -> races that day and their status. */
  raceDays: Map<string, DayMark>;
  today: string;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const { c, spacing } = useTheme();
  const { width } = useWindowDimensions();
  const pages = useMemo(() => monthPages(firstYear, 24), [firstYear]);
  const initialIndex = Math.max(0, pages.findIndex((p) => p.year === initial.year && p.month === initial.month));
  const [index, setIndex] = useState(initialIndex);
  const list = useRef<FlatList<YearMonth>>(null);

  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<YearMonth>[] }) => {
    const first = viewableItems[0];
    if (first?.index !== null && first?.index !== undefined) setIndex(first.index);
  }, []);

  const go = useCallback(
    (to: number) => {
      const i = Math.min(pages.length - 1, Math.max(0, to));
      setIndex(i);
      list.current?.scrollToIndex({ index: i, animated: true });
    },
    [pages.length],
  );

  const current = pages[index] ?? initial;
  const cell = Math.floor((width - spacing.lg * 2) / 7);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={index === 0} onPress={() => go(index - 1)} style={{ padding: 12, opacity: index === 0 ? 0.3 : 1 }}>
          <Ionicons name="chevron-back" size={22} color={c.ink} />
        </Pressable>
        <T variant="title" style={{ flex: 1, textAlign: 'center' }} accessibilityLiveRegion="polite">
          {monthLabel(current.year, current.month)}
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={index === pages.length - 1}
          onPress={() => go(index + 1)}
          style={{ padding: 12, opacity: index === pages.length - 1 ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-forward" size={22} color={c.ink} />
        </Pressable>
      </View>
      <FlatList
        ref={list}
        testID="month-pager"
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(p) => `${p.year}-${p.month}`}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: spacing.lg }}>
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS.map((d) => (
                <T key={d} variant="caption" style={{ width: cell, textAlign: 'center' }} importantForAccessibility="no">
                  {d}
                </T>
              ))}
            </View>
            {monthGrid(item.year, item.month).map((week) => (
              <View key={week[0]!.key} style={{ flexDirection: 'row' }}>
                {week.map((d) => {
                  const mark = d.inMonth ? raceDays.get(d.key) : undefined;
                  const count = mark?.count ?? 0;
                  const fill = !mark ? 'transparent' : mark.status === 'scheduled' ? colors.lime : mark.status === 'postponed' ? DAY_POSTPONED : DAY_CANCELLED;
                  const statusNote = mark && (mark.postponed || mark.cancelled)
                    ? `${mark.postponed ? `, ${mark.postponed} postponed` : ''}${mark.cancelled ? `, ${mark.cancelled} cancelled` : ''}`
                    : '';
                  const isSel = selected === d.key;
                  const isToday = today === d.key;
                  return (
                    <Pressable
                      key={d.key}
                      disabled={!d.inMonth}
                      accessibilityRole="button"
                      accessibilityLabel={`${d.day} ${monthLabel(item.year, item.month)}${count ? `, ${count} race${count > 1 ? 's' : ''}` : ''}${statusNote}${isToday ? ', today' : ''}`}
                      accessibilityState={{ selected: isSel }}
                      onPress={() => onSelect(isSel ? null : d.key)}
                      style={{ width: cell, height: Math.max(44, cell), alignItems: 'center', justifyContent: 'center' }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isSel ? colors.forest : fill,
                          borderWidth: isToday && !isSel ? 2 : 0,
                          borderColor: c.leaf,
                        }}
                      >
                        <T
                          style={{
                            color: !d.inMonth ? 'transparent' : isSel ? '#FFFFFF' : count ? colors.ink : c.ink,
                            fontWeight: count || isToday ? '800' : '400',
                            textDecorationLine: mark?.status === 'cancelled' && !isSel ? 'line-through' : 'none',
                          }}
                        >
                          {d.day}
                        </T>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: 4 }} accessible accessibilityLabel="Key: lime, race day; yellow, postponed; red, cancelled">
        {[
          [colors.lime, 'Race'],
          [DAY_POSTPONED, 'Postponed'],
          [DAY_CANCELLED, 'Cancelled'],
        ].map(([bg, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: bg }} />
            <T variant="caption">{label}</T>
          </View>
        ))}
      </View>
    </View>
  );
}
