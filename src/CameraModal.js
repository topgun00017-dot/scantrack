// Full-screen receipt camera, opened from the orange button on any screen.
// Guide frame (photo is cropped to it), Auto capture when the phone is held steady,
// flash, company to save to, and Upload / Scan / Manual at the bottom.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, StatusBar, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Gyroscope } from 'expo-sensors';
import { setCameraListener, useCapture } from './capture';

// Switching company reloads that company's data (and this component); reopen the camera after.
let reopen = false;
import CompanySwitcher from './CompanySwitcher';
import { Icon } from './icons';
import { colors } from './theme';
import { isWeb } from './platform';
import * as ImagePicker from 'expo-image-picker';

const STEADY_RATE = 0.12; // rad/s — below this the phone counts as still
const STEADY_MS = 1300; // how long it must stay still before Auto takes the photo

// Map the on-screen guide frame onto the photo (the preview fills the screen like "cover").
function frameToPhoto(frame, view, photo) {
  const scale = Math.max(view.w / photo.w, view.h / photo.h);
  const offX = (photo.w * scale - view.w) / 2;
  const offY = (photo.h * scale - view.h) / 2;
  const m = 0.04; // keep a little margin around the receipt
  let x = (frame.x - frame.w * m + offX) / scale;
  let y = (frame.y - frame.h * m + offY) / scale;
  let w = (frame.w * (1 + 2 * m)) / scale;
  let h = (frame.h * (1 + 2 * m)) / scale;
  x = Math.max(0, x);
  y = Math.max(0, y);
  w = Math.min(photo.w - x, w);
  h = Math.min(photo.h - y, h);
  return { originX: Math.round(x), originY: Math.round(y), width: Math.round(w), height: Math.round(h) };
}

export default function CameraModal({ nav }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [perm, requestPerm] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [auto, setAuto] = useState(true);
  const [steady, setSteady] = useState(0); // 0..1 progress towards auto capture
  const [shooting, setShooting] = useState(false);
  const [view, setView] = useState({ w: 0, h: 0 });
  const cam = useRef(null);
  const { busy, processPhoto, fromGallery, manual, aiReady } = useCapture(nav);

  const openRef = useRef(false);
  openRef.current = open;
  useEffect(() => {
    setCameraListener(() => {
      setReady(false);
      setShooting(false);
      setSteady(0);
      setOpen(true);
    });
    if (reopen) {
      reopen = false;
      setOpen(true);
    }
    return () => {
      setCameraListener(null);
      reopen = openRef.current;
    };
  }, []);

  useEffect(() => {
    if (open && perm && !perm.granted && perm.canAskAgain) requestPerm();
  }, [open, perm?.granted]);

  // Guide frame: a tall receipt shape in the upper-middle of the screen.
  const fw = view.w * 0.82;
  const fh = Math.min(view.h * 0.56, fw * 1.5);
  const frame = { x: (view.w - fw) / 2, y: insets.top + 106, w: fw, h: fh };

  const shoot = async () => {
    if (shooting) return;
    if (isWeb) {
      // No live camera preview in the browser build: use the file / camera picker instead.
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
      if (res.canceled) return;
      setOpen(false);
      return processPhoto(res.assets[0]);
    }
    if (!cam.current || !ready) return;
    setShooting(true);
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.85, shutterSound: false });
      let out = { uri: photo.uri };
      try {
        const crop = frameToPhoto(frame, view, { w: photo.width, h: photo.height });
        const ctx = ImageManipulator.manipulate(photo.uri).crop(crop);
        if (crop.width > 1600) ctx.resize({ width: 1600 });
        const img = await ctx.renderAsync();
        const saved = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
        out = { uri: saved.uri, base64: saved.base64, mimeType: 'image/jpeg' };
      } catch {
        // Cropping failed: use the full photo.
        const img = await ImageManipulator.manipulate(photo.uri).resize({ width: 1600 }).renderAsync();
        const saved = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
        out = { uri: saved.uri, base64: saved.base64, mimeType: 'image/jpeg' };
      }
      await processPhoto(out);
      setOpen(false);
    } catch (e) {
      setShooting(false);
    }
  };

  // Auto: take the photo once the phone has been held still for a moment.
  useEffect(() => {
    if (!open || !auto || !ready || shooting || busy || isWeb) {
      setSteady(0);
      return;
    }
    let since = null;
    Gyroscope.setUpdateInterval(100);
    const sub = Gyroscope.addListener(({ x, y, z }) => {
      const rate = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (rate < STEADY_RATE) {
        since = since || now;
        const p = Math.min(1, (now - since) / STEADY_MS);
        setSteady(p);
        if (p >= 1) {
          sub.remove();
          shoot();
        }
      } else {
        since = null;
        setSteady(0);
      }
    });
    return () => sub.remove();
  }, [open, auto, ready, shooting, busy]);

  const close = () => setOpen(false);
  const goGallery = async () => {
    await fromGallery(); // progress shows over the camera; one photo opens the review form
    setOpen(false);
  };
  const goManual = () => {
    setOpen(false);
    manual();
  };

  if (!open) return null;
  const granted = isWeb || perm?.granted;
  const dim = 'rgba(0,0,0,0.55)';
  const corner = { position: 'absolute', width: 28, height: 28, borderColor: colors.accent };

  return (
    <Modal visible animationType="slide" onRequestClose={close} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setView({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {granted && !isWeb && (
          <CameraView ref={cam} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} />
        )}

        {/* dim everything outside the guide frame */}
        {view.w > 0 && (
          <>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: frame.y, backgroundColor: dim }} />
            <View style={{ position: 'absolute', left: 0, right: 0, top: frame.y + frame.h, bottom: 0, backgroundColor: dim }} />
            <View style={{ position: 'absolute', left: 0, width: frame.x, top: frame.y, height: frame.h, backgroundColor: dim }} />
            <View style={{ position: 'absolute', right: 0, width: frame.x, top: frame.y, height: frame.h, backgroundColor: dim }} />
            <View style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.w, height: frame.h, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}>
              <View style={[corner, { left: -2, top: -2, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 14 }]} />
              <View style={[corner, { right: -2, top: -2, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 14 }]} />
              <View style={[corner, { left: -2, bottom: -2, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 14 }]} />
              <View style={[corner, { right: -2, bottom: -2, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 14 }]} />
            </View>
            <Text style={{ position: 'absolute', top: frame.y + frame.h + 12, left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: '600' }}>
              {!granted
                ? 'Camera access is needed to scan receipts'
                : auto && steady > 0
                ? steady >= 1 ? 'Capturing…' : 'Hold steady…'
                : 'Fit the receipt inside the frame'}
            </Text>
            {!aiReady && (
              <Text style={{ position: 'absolute', top: frame.y + frame.h + 34, left: 24, right: 24, textAlign: 'center', color: '#FDE68A', fontSize: 12 }}>
                AI reading is off. You'll type the details after the photo.
              </Text>
            )}
          </>
        )}

        {/* top bar */}
        <View style={{ position: 'absolute', top: insets.top + 10, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={close} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <CompanySwitcher label="Save to" />
          </View>
          <Pressable onPress={() => setTorch((t) => !t)} hitSlop={10} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: torch ? colors.accent : 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="zap" size={20} color={torch ? colors.accentText : '#fff'} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => setAuto((a) => !a)}
          style={{ position: 'absolute', top: insets.top + 60, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: auto ? colors.accent : 'rgba(0,0,0,0.45)' }}
        >
          <Icon name="scan" size={14} color={auto ? colors.accentText : '#fff'} />
          <Text style={{ color: auto ? colors.accentText : '#fff', fontWeight: '800', fontSize: 12 }}>AUTO {auto ? 'ON' : 'OFF'}</Text>
        </Pressable>

        {/* bottom: shutter and Upload / Scan / Manual */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: insets.bottom + 14, paddingTop: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 36 }}>
            <Pressable onPress={goGallery} style={{ alignItems: 'center', width: 64 }}>
              <Icon name="images" size={26} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Upload</Text>
            </Pressable>
            <Pressable onPress={granted ? shoot : requestPerm} disabled={shooting} style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: shooting ? colors.faint : colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                {shooting ? <ActivityIndicator color="#fff" /> : <Icon name="camera" size={26} color={colors.accentText} />}
              </View>
              {auto && steady > 0 && !shooting && (
                <View style={{ position: 'absolute', bottom: -6, height: 4, width: 70 * steady, backgroundColor: colors.accent, borderRadius: 2 }} />
              )}
            </Pressable>
            <Pressable onPress={goManual} style={{ alignItems: 'center', width: 64 }}>
              <Icon name="file-text" size={26} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Manual</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: 22, marginTop: 14 }}>
            <Text onPress={goGallery} style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>UPLOAD</Text>
            <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12, letterSpacing: 1 }}>SCAN</Text>
            <Text onPress={goManual} style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>MANUAL · NO RECEIPT</Text>
          </View>
        </View>

        {/* reading the receipt */}
        {busy && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Image source={{ uri: busy.uri }} style={{ width: 200, height: 280, borderRadius: 14, opacity: 0.9 }} resizeMode="cover" />
            <ActivityIndicator color={colors.accent} size="large" style={{ marginTop: 20 }} />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 10 }}>{busy.label}</Text>
            <Text style={{ color: '#D1D5DB', marginTop: 4 }}>Merchant, date, items, tax and total</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}
