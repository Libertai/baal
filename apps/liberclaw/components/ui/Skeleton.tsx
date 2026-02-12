import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

export default function Skeleton({
  width = '100%',
  height = 20,
  className = '',
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const style: ViewStyle = {
    width: width as ViewStyle['width'],
    height: height as ViewStyle['height'],
  };

  return (
    <Animated.View
      style={[style, { opacity }]}
      className={`rounded-md bg-surface-border ${className}`}
    />
  );
}
