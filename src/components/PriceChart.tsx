import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { formatFiat } from '../utils/formatters';
import { CurrencyPreference } from '../types';

export type TimeframeOption = '1D' | '1W' | '1M' | '1Y';

interface PriceChartProps {
  data: number[];
  timeframe: TimeframeOption;
  onTimeframeChange: (tf: TimeframeOption) => void;
  currencyPreference: CurrencyPreference;
  height?: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  data,
  timeframe,
  onTimeframeChange,
  currencyPreference,
  height = 170,
}) => {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width - 48;
  const width = Math.max(screenWidth, 300);

  const { min, max, isPositive, pathD, areaD } = useMemo(() => {
    const safeData = data && data.length >= 2 ? data : [100, 102, 101, 104, 103, 106, 105, 108];

    const minVal = Math.min(...safeData);
    const maxVal = Math.max(...safeData);
    const range = maxVal - minVal || 1;
    const padding = 12;
    const effectiveHeight = height - padding * 2;

    const points = safeData.map((val, idx) => {
      const x = (idx / (safeData.length - 1)) * width;
      const y = padding + effectiveHeight - ((val - minVal) / range) * effectiveHeight;
      return { x, y };
    });

    const isUp = safeData[safeData.length - 1] >= safeData[0];

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx = (prev.x + curr.x) / 2;
      d += ` C ${cx.toFixed(1)} ${prev.y.toFixed(1)}, ${cx.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }

    const area = `${d} L ${width.toFixed(1)} ${height} L 0 ${height} Z`;
    return { min: minVal, max: maxVal, isPositive: isUp, pathD: d, areaD: area };
  }, [data, width, height]);

  const lineColor = isPositive ? '#10B981' : '#EF4444';
  const gradientId = isPositive ? 'chartGlowGreen' : 'chartGlowRed';
  const timeframes: TimeframeOption[] = ['1D', '1W', '1M', '1Y'];

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {/* 24h High and Low Display */}
      <View style={styles.metricsRow}>
        <View>
          <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>24H HIGH</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {formatFiat(max, currencyPreference)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>24H LOW</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {formatFiat(min, currencyPreference)}
          </Text>
        </View>
      </View>

      {/* SVG Chart Graphic */}
      <View style={styles.chartWrapper}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={lineColor} stopOpacity="0.30" />
              <Stop offset="70%" stopColor={lineColor} stopOpacity="0.05" />
              <Stop offset="100%" stopColor={lineColor} stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {areaD ? <Path d={areaD} fill={`url(#${gradientId})`} /> : null}

          {pathD ? (
            <Path
              d={pathD}
              fill="none"
              stroke={lineColor}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      </View>

      {/* Timeframe Filter Buttons */}
      <View style={[styles.timeframeRow, { borderTopColor: colors.border }]}>
        {timeframes.map((tf) => {
          const isActive = timeframe === tf;
          return (
            <TouchableOpacity
              key={tf}
              style={[
                styles.tfButton,
                isActive && {
                  backgroundColor: isPositive
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  borderColor: lineColor,
                  borderWidth: 1,
                },
              ]}
              onPress={() => onTimeframeChange(tf)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tfText,
                  {
                    color: isActive ? lineColor : colors.textTertiary,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tf}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  },
  metricLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 13,
    marginTop: 2,
  },
  chartWrapper: {
    alignItems: 'center',
    marginVertical: SPACING.xs,
    overflow: 'hidden',
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  tfButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  tfText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
  },
});
