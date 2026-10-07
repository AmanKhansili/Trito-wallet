import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { generateQRMatrix } from '../utils/qrCode';
import { RADIUS, SPACING } from '../constants/theme';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  backgroundColor?: string;
  color?: string;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  value,
  size = 220,
  backgroundColor = '#FFFFFF',
  color = '#0B0F19',
}) => {
  const matrix = useMemo(() => {
    try {
      return generateQRMatrix(value);
    } catch {
      return [];
    }
  }, [value]);

  if (!matrix.length) {
    return <View style={[styles.container, { width: size, height: size }]} />;
  }

  const numCols = matrix.length;
  const cellSize = size / numCols;

  return (
    <View style={[styles.container, { backgroundColor, padding: SPACING.md }]}>
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill={backgroundColor} />
        {matrix.map((row, rIdx) =>
          row.map((isDark, cIdx) => {
            if (!isDark) return null;
            return (
              <Rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx * cellSize}
                y={rIdx * cellSize}
                width={cellSize + 0.2}
                height={cellSize + 0.2}
                fill={color}
              />
            );
          }),
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
});
