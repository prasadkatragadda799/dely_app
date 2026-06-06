import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  type ImageResizeMode,
  type ImageSourcePropType,
  type ImageStyle,
  PixelRatio,
  StyleProp,
  StyleSheet,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/**
 * Ask the backend's /uploads endpoint for a width-resized variant (?w=) so we
 * download a small, compressed image instead of the full-size original.
 * External URLs (no /uploads/) and missing widths are returned untouched.
 */
export function sizedImageUrl(uri?: string | null, displayWidth?: number): string | undefined {
  if (!uri) return undefined;
  if (!displayWidth || !uri.includes('/uploads/')) return uri;
  const px = Math.min(Math.round(displayWidth * PixelRatio.get()), 1600);
  const sep = uri.includes('?') ? '&' : '?';
  return `${uri}${sep}w=${px}`;
}

type Props = {
  /** Remote image URL. When empty/invalid, a neutral fallback is shown. */
  uri?: string | null;
  /** Display width (dp). When set, requests a resized variant from the server. */
  width?: number;
  /** Sizing/visual style for the image box (must define width/height). */
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  /** Corner radius applied to the box, the image, and the loader overlay. */
  rounded?: number;
  /** Background shown behind a transparent / still-loading image. */
  backgroundColor?: string;
  loaderColor?: string;
  /** Local fallback when there is no uri (e.g. a brand logo). */
  fallbackSource?: ImageSourcePropType;
};

/**
 * Drop-in replacement for <Image> that shows a spinner while loading, fades the
 * image in once ready, and renders a neutral icon on error / missing URL.
 * Backed by RN's Image (Fresco on Android caches to disk automatically).
 */
const AppImage = ({
  uri,
  width,
  style,
  resizeMode = 'cover',
  rounded,
  backgroundColor = '#F1F5F9',
  loaderColor = '#94A3B8',
  fallbackSource,
}: Props) => {
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const resolvedUri = sizedImageUrl(uri, width);

  // Reset state when the URL changes (e.g. recycled list rows / carousels).
  useEffect(() => {
    setErrored(false);
    setLoading(true);
    opacity.setValue(0);
  }, [resolvedUri, opacity]);

  const radius = rounded != null ? { borderRadius: rounded } : null;
  const showFallback = (!resolvedUri || errored) && !fallbackSource;

  return (
    <View style={[styles.box, { backgroundColor }, radius, style, styles.clip]}>
      {showFallback ? (
        <Icon name="image-off-outline" size={22} color="#CBD5E1" />
      ) : (
        <Animated.Image
          source={fallbackSource && (!resolvedUri || errored) ? fallbackSource : { uri: resolvedUri! }}
          resizeMode={resizeMode}
          fadeDuration={0}
          onLoadStart={() => setLoading(true)}
          onLoad={() => {
            setLoading(false);
            Animated.timing(opacity, {
              toValue: 1,
              duration: 180,
              useNativeDriver: true,
            }).start();
          }}
          onError={() => {
            setErrored(true);
            setLoading(false);
          }}
          style={[StyleSheet.absoluteFill, radius, { opacity }]}
        />
      )}

      {loading && !showFallback ? (
        <View style={[StyleSheet.absoluteFill, styles.center, radius]} pointerEvents="none">
          <ActivityIndicator size="small" color={loaderColor} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  clip: { overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
});

/**
 * Warm the cache for a batch of URLs so they appear instantly when shown.
 * Pass the display width so the prefetched (resized) URL matches what AppImage
 * will actually request.
 */
export function prefetchImages(
  urls: Array<string | null | undefined>,
  width?: number,
) {
  for (const u of urls) {
    const sized = sizedImageUrl(u, width);
    if (sized && /^https?:\/\//.test(sized)) {
      Image.prefetch(sized).catch(() => {});
    }
  }
}

export default AppImage;
