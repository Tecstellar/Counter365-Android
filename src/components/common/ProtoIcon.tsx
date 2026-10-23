import React from 'react';
import Svg, { Path } from 'react-native-svg';

export const PROTO_PATHS = {
  ar: 'M5 12h14M13 6l6 6-6 6',
  back: 'M19 12H5M11 6l-6 6 6 6',
  ck: 'M5 12.500l4.500 4.500L19 7.500',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  wa: 'M4 20l1.300-4.200A8 8 0 1 1 8.200 18.800zM9 9.500c0 3 2.500 5.500 5.500 5.500l1-1.500-2-1-.8.800a4 4 0 0 1-1.800-1.800l.8-.8-1-2z',
  prn: 'M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z',
};

export type ProtoIconName = keyof typeof PROTO_PATHS;

interface ProtoIconProps {
  name: ProtoIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const ProtoIcon: React.FC<ProtoIconProps> = ({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
}) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={PROTO_PATHS[name]}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
};
